/**
 * The worker's module transform: one acorn parse turns an ES module into a
 * CommonJS body **and** routes every suspension point through the ambient-store
 * protocol.
 *
 * Both jobs live in one pass because they are two edits over one syntax tree;
 * running a lexer first and a parser second meant two scanners, two sets of
 * blind spots, and a second pass reading the first pass's output. Editing is
 * interval-based — the original text is sliced and spliced, never reprinted —
 * so **line numbers survive**: a stack frame in a transformed module points at
 * the same line as the built artifact it came from.
 *
 * The image packer is this transform's only caller: it lowers every JavaScript
 * entry it packs and records `LOWERING_VERSION` in the image manifest, so the
 * worker wraps those bodies without carrying a compiler of its own.
 *
 * Named and default import bindings stay live: each use site reads through the
 * required module's exports, because a cyclic module pair legally touches an
 * import inside a function before the exporting module finished evaluating,
 * and an eager `const local = held[name]` would trip the temporal dead zone
 * there. Namespace imports remain an eager snapshot.
 * @module @deepseek-ai/dsh-experimental-webworker-runtime/src/compile/transform
 */
import { parse } from 'acorn'

const HELPER_SOURCE: Record<string, string> = {
  def: 'const __dsh$def=(t,k,get)=>Object.defineProperty(t,k,{enumerable:true,configurable:true,get});',
  default: 'const __dsh$default=(m)=>(m&&m.__esModule?m.default:m);',
  ns: 'const __dsh$ns=(m)=>(m&&m.__esModule?m:Object.assign({},m,{default:m}));',
  exportAll: 'const __dsh$exportAll=(t,m)=>{for(const k of Object.keys(m))if(k!=="default"&&!(k in t))__dsh$def(t,k,()=>m[k]);};',
  dynImport: 'const __dsh$dynImport=(s)=>Promise.resolve().then(()=>__dsh$ns(require(s)));',
}

const HELPER_DEPENDENCIES: Record<string, readonly string[]> = {
  exportAll: ['def'],
  dynImport: ['ns'],
}

/** Runtime identifier the suspension protocol reaches. */
const ALS = '__als'

interface Node {
  readonly type: string
  readonly start: number
  readonly end: number
  readonly [key: string]: unknown
}

/** @returns Number of line breaks in a slice. */
function countNewlines(text: string): number {
  let count = 0
  for (let index = text.indexOf('\n'); index >= 0; index = text.indexOf('\n', index + 1)) count += 1
  return count
}

interface Edit {
  readonly start: number
  readonly end: number
  /** Rendered lazily so edits inside a replaced range still apply. */
  readonly render: (inner: (from: number, to: number) => string) => string
}

/** One binding to publish on `exports`. */
interface Binding {
  readonly exported: string
  /** Expression read lazily by the export getter: a local identifier or an import accessor. */
  readonly read: string
}

/**
 * A named or default import binding. The lowered body reads it through the
 * required module's exports at each use site, never eagerly at evaluation:
 * a cyclic module pair (zod's core/util is the shipped example) legally
 * accesses an import inside a function while the exporting module has not
 * finished evaluating, and an eager `const local = held[name]` would trip the
 * temporal dead zone there.
 */
interface ImportedBinding {
  readonly held: string
  readonly imported: string
  readonly interop: 'named' | 'default'
}

class Transformer {
  private readonly edits: Edit[] = []
  private readonly source: string
  private readonly helpers = new Set<string>()
  private readonly bindings: Binding[] = []
  private readonly importedLocals = new Map<string, ImportedBinding>()
  /** Import statement start offset to its prepared held-module temp. */
  private readonly preparedImports = new Map<number, string>()
  /** Prologue requires emitted in import-statement order, ESM-hoisted ahead of the body. */
  private readonly importRequires: string[] = []
  /** Names each entered non-module scope declares; a shadowed import keeps its local meaning. */
  private readonly scopes: Array<ReadonlySet<string>> = []
  private modules = 0
  private temporaries = 0
  private moduleSyntax = false
  private readonly moduleRequests = new Set<string>()
  private readonly metaResolveRequests = new Set<string>()
  private readonly createRequireBindings = new Set<string>()

  constructor(source: string, private readonly path: string) {
    // A `#!` line is only legal at offset zero, and the prologue takes that spot;
    // commenting it out in place keeps every offset and the line count intact.
    this.source = source.startsWith('#!') ? `//${source.slice(2)}` : source
  }

  private fail(detail: string, index: number): never {
    const line = this.source.slice(0, index).split('\n').length
    throw new Error(`webworker transform: ${detail} (${this.path}:${line})`)
  }

  private helper(name: string): string {
    for (const dependency of HELPER_DEPENDENCIES[name] ?? []) this.helper(dependency)
    this.helpers.add(name)
    return `__dsh$${name}`
  }

  private moduleTemp(): string {
    this.modules += 1
    return `__dsh$m${this.modules}`
  }

  private alsTemp(): string {
    this.temporaries += 1
    return `__als$${this.temporaries}`
  }

  /**
   * Replace a range, keeping the module's line count.
   *
   * The padding is the newlines the original range held **minus** the ones the
   * replacement re-emits: a rewrite that splices the original body back in
   * (a desugared loop) already carries that body's newlines, and padding by the
   * whole range again would push every later line down.
   */
  private edit(start: number, end: number, build: (inner: (from: number, to: number) => string) => string): void {
    const original = countNewlines(this.source.slice(start, end))
    this.edits.push({
      start,
      end,
      render: (inner) => {
        const text = build(inner)
        return text + '\n'.repeat(Math.max(0, original - countNewlines(text)))
      },
    })
  }

  private replace(start: number, end: number, text: string): void {
    this.edit(start, end, () => text)
  }

  private insert(at: number, text: string): void {
    this.edits.push({ start: at, end: at, render: () => text })
  }

  private structural(start: number, end: number, render: Edit['render']): void {
    this.edit(start, end, render)
  }

  private literal(node: Node): string {
    const value = node.value
    if (typeof value !== 'string') this.fail('a module specifier must be a string literal', node.start)
    this.moduleRequests.add(value)
    return JSON.stringify(value)
  }

  /** @returns Static module requests the body makes, in first-appearance order. */
  requests(): readonly string[] {
    return [...this.moduleRequests]
  }

  /** @returns Literal `import.meta.resolve()` requests, in first-appearance order. */
  metaRequests(): readonly string[] {
    return [...this.metaResolveRequests]
  }

  // --- module syntax --------------------------------------------------------

  /**
   * Register one import's held module temp and its lazy locals before the
   * traversal: ESM hoists imports, so a reference may textually precede its
   * import statement and the binding must already be known when it is
   * visited. Idempotent per import statement.
   * @returns The temp that holds the required module at the import's position.
   */
  private prepareImport(node: Node): string {
    const existing = this.preparedImports.get(node.start)
    if (existing !== undefined) return existing
    const held = this.moduleTemp()
    this.preparedImports.set(node.start, held)
    this.moduleSyntax = true
    for (const specifier of node.specifiers as Node[]) {
      if (specifier.type === 'ImportNamespaceSpecifier') continue
      const local = (specifier.local as Node).name as string
      const isDefault = specifier.type === 'ImportDefaultSpecifier'
      const imported = specifier.imported as Node
      const name = isDefault
        ? 'default'
        : imported.type === 'Identifier' ? imported.name as string : imported.value as string
      this.importedLocals.set(local, { held, imported: name, interop: isDefault ? 'default' : 'named' })
    }
    return held
  }

  private importDeclaration(node: Node): void {
    if (Array.isArray(node.attributes) && node.attributes.length > 0) {
      this.fail('import attributes are not supported', node.start)
    }
    const source = node.source as Node
    const request = `require(${this.literal(source)})`
    const specifiers = node.specifiers as Node[]
    // ESM evaluates imports before the module body however late the statement
    // sits in it, so the require joins the prologue rather than its statement
    // position; a body statement that runs before the textual import still
    // reads an initialized binding.
    if (specifiers.length === 0) {
      this.importRequires.push(`${request};`)
    } else {
      const held = this.prepareImport(node)
      this.importRequires.push(`const ${held}=${request};`)
      for (const specifier of specifiers) {
        if (specifier.type !== 'ImportNamespaceSpecifier') continue
        // A namespace import stays an eager snapshot: nothing in the shipped
        // graph reaches a cycle through one, and a live namespace would need
        // identity-stable lazy properties the CommonJS body cannot express.
        const local = (specifier.local as Node).name as string
        this.importRequires.push(`const ${local}=${this.helper('ns')}(${held});`)
      }
    }
    this.replace(node.start, node.end, '')
  }

  /** @returns The expression a use site reads one import binding through. */
  private importedRead(binding: ImportedBinding): string {
    // The default accessor is parenthesized: it is a call expression, and a
    // bare call after `new` would bind the constructor invocation to the
    // helper instead of the imported default (`new X()` must construct X).
    return binding.interop === 'default'
      ? `(${this.helper('default')}(${binding.held}))`
      : `${binding.held}[${JSON.stringify(binding.imported)}]`
  }

  private exportNamed(node: Node): void {
    this.moduleSyntax = true
    const declaration = node.declaration as Node | null
    const source = node.source as Node | null
    const specifiers = node.specifiers as Node[]

    if (declaration !== null) {
      // `export const x = 1` keeps its declaration; only the keyword goes.
      this.replace(node.start, declaration.start, '')
      for (const { exported, local } of declaredBindings(declaration, detail => this.fail(detail, declaration.start))) {
        this.bindings.push({ exported, read: local })
      }
      return
    }
    if (source !== null) {
      const held = this.moduleTemp()
      const define = this.helper('def')
      const lines = [`const ${held}=require(${this.literal(source)});`]
      for (const specifier of specifiers) {
        const local = nameOf(specifier.local as Node)
        const exported = nameOf(specifier.exported as Node)
        lines.push(`${define}(exports,${JSON.stringify(exported)},()=>${held}[${JSON.stringify(local)}]);`)
      }
      this.replace(node.start, node.end, lines.join(''))
      return
    }
    // A bare `export {}` is a module marker with nothing to publish. An
    // imported local re-exported here reads through its accessor, not a local
    // binding the lowered body never declared.
    for (const specifier of specifiers) {
      const local = nameOf(specifier.local as Node)
      const binding = this.importedLocals.get(local)
      this.bindings.push({
        exported: nameOf(specifier.exported as Node),
        read: binding === undefined ? local : this.importedRead(binding),
      })
    }
    this.replace(node.start, node.end, '')
  }

  private exportDefault(node: Node): void {
    this.moduleSyntax = true
    const declaration = node.declaration as Node
    this.replace(node.start, declaration.start, 'exports.default = ')
  }

  private exportAll(node: Node): void {
    this.moduleSyntax = true
    const request = `require(${this.literal(node.source as Node)})`
    const exported = node.exported as Node | null
    if (exported === null) {
      this.replace(node.start, node.end, `${this.helper('exportAll')}(exports,${request});`)
      return
    }
    const held = this.moduleTemp()
    const define = this.helper('def')
    this.replace(
      node.start,
      node.end,
      `const ${held}=${this.helper('ns')}(${request});${define}(exports,${JSON.stringify(nameOf(exported))},()=>${held});`,
    )
  }

  // --- suspension points ----------------------------------------------------

  private awaitExpression(node: Node): void {
    const keywordEnd = node.start + 'await'.length
    if (this.source.slice(node.start, keywordEnd) !== 'await') this.fail('unexpected await layout', node.start)
    this.replace(node.start, keywordEnd, `${ALS}.resume(await ${ALS}.pause(`)
    this.insert(node.end, '))')
  }

  /**
   * `for await (L of R) B` becomes an explicit loop over the same protocol.
   * `iterator.return` runs only on abrupt completion, as the language says, and
   * is awaited so teardown still orders before the loop exits.
   */
  private forAwait(node: Node): void {
    const left = node.left as Node
    const right = node.right as Node
    const body = node.body as Node
    const iterator = this.alsTemp()
    const step = this.alsTemp()
    const exhausted = this.alsTemp()
    const binding = (inner: (from: number, to: number) => string): string => {
      if (left.type !== 'VariableDeclaration') return `(${inner(left.start, left.end)})=${step}.value;`
      const declarations = left.declarations as Node[]
      const pattern = declarations[0]?.id as Node | undefined
      if (declarations.length !== 1 || pattern === undefined) {
        this.fail('for-await must declare exactly one binding', left.start)
      }
      return `${String(left.kind)} ${inner(pattern.start, pattern.end)}=${step}.value;`
    }
    this.structural(node.start, node.end, inner => [
      `{const ${iterator}=${ALS}.iterator(${inner(right.start, right.end)});`,
      `let ${step};let ${exhausted}=false;`,
      `try{for(;;){${step}=${ALS}.resume(await ${ALS}.pause(${iterator}.next()));`,
      `if(${step}.done){${exhausted}=true;break}`,
      `{${binding(inner)}${body.type === 'BlockStatement' ? inner(body.start, body.end) : `{${inner(body.start, body.end)}}`}}}}`,
      `finally{if(!${exhausted})${ALS}.resume(await ${ALS}.pause(${ALS}.close(${iterator})))}}`,
    ].join(''))
  }

  /**
   * `yield` resumes with whatever the consumer sent, so the snapshot is taken
   * before suspending and restored when the call completes. `yield*` delegates,
   * which has no expression form here: it is desugared as a statement, and a
   * consumer's `throw()` is not forwarded into the inner iterator (`next` and
   * `return` are).
   */
  private yieldExpression(node: Node, statement: Node | undefined): void {
    if (node.delegate !== true) {
      this.insert(node.start, `${ALS}.afterYield(${ALS}.snapshot(),`)
      this.insert(node.end, ')')
      return
    }
    const argument = node.argument as Node | null
    if (argument === null) this.fail('yield* without an operand', node.start)
    if (statement === undefined) this.fail('yield* is only supported as a statement', node.start)
    if ((statement.expression as Node) !== node) {
      // Anything around the delegation (`x = yield* g()`, `f(yield* g())`)
      // would be silently dropped by the statement-wide rewrite below; the
      // all-or-nothing lowering contract demands a loud refusal instead.
      this.fail('yield* is only supported as the whole statement expression', node.start)
    }
    const iterator = this.alsTemp()
    const step = this.alsTemp()
    const sent = this.alsTemp()
    const exhausted = this.alsTemp()
    this.structural(statement.start, statement.end, inner => [
      `{const ${iterator}=${ALS}.iterator(${inner(argument.start, argument.end)});`,
      `let ${sent};let ${exhausted}=false;`,
      `try{for(;;){const ${step}=${ALS}.resume(await ${ALS}.pause(${iterator}.next(${sent})));`,
      `if(${step}.done){${exhausted}=true;break}`,
      `${sent}=${ALS}.afterYield(${ALS}.snapshot(),yield ${step}.value)}}`,
      `finally{if(!${exhausted})${ALS}.resume(await ${ALS}.pause(${ALS}.close(${iterator})))}}`,
    ].join(''))
  }

  // --- traversal ------------------------------------------------------------

  /** A slot an identifier occupies without being a reference to a binding. */
  private isBindingSlot(parent: Node, key: string): boolean {
    switch (parent.type) {
      case 'MemberExpression':
      case 'OptionalMemberExpression':
        return key === 'property' && parent.computed !== true
      case 'Property':
      case 'MethodDefinition':
      case 'PropertyDefinition':
        return key === 'key' && parent.computed !== true
      case 'VariableDeclarator':
      case 'FunctionDeclaration':
      case 'FunctionExpression':
      case 'ClassDeclaration':
      case 'ClassExpression':
        return key === 'id'
      case 'LabeledStatement':
      case 'BreakStatement':
      case 'ContinueStatement':
        return key === 'label'
      case 'CatchClause':
        return key === 'param'
      case 'MetaProperty':
        return key === 'meta' || key === 'property'
      default:
        return false
    }
  }

  private visit(node: unknown, context: {
    asyncGenerator: boolean
    functionDepth: number
    moduleScope: boolean
    statement?: Node
    parent?: Node
    key?: string
    skipReferences?: boolean
  }): void {
    if (node === null || typeof node !== 'object') return
    if (Array.isArray(node)) {
      for (const child of node) this.visit(child, context)
      return
    }
    const record = node as Node
    if (typeof record.type !== 'string') return
    let next = context
    switch (record.type) {
      case 'ImportDeclaration':
        this.importDeclaration(record)
        // Nothing inside an import statement is a reference to rewrite.
        return
      case 'ExportNamedDeclaration': {
        this.exportNamed(record)
        const declaration = record.declaration as Node | null
        if (declaration !== null) {
          this.visit(declaration, { ...next, parent: record, key: 'declaration' })
        }
        return
      }
      case 'ExportDefaultDeclaration': this.exportDefault(record); break
      case 'ExportAllDeclaration': this.exportAll(record); return
      case 'Identifier': {
        const parent = context.parent
        if (context.skipReferences === true || parent === undefined) break
        if (this.isBindingSlot(parent, context.key ?? '')) break
        const name = record.name as string
        const binding = this.importedLocals.get(name)
        if (binding === undefined || this.scopes.some(scope => scope.has(name))) break
        // The named read is a member expression, so a bare use as a callee or
        // template tag would call the function with the held module as its
        // receiver. Native ESM calls an imported function receiver-free; the
        // comma expression reads the value first and restores that. `new` and
        // value positions are unaffected: a constructor ignores the receiver,
        // and the default accessor is already a parenthesized call.
        const valueCallPosition = (parent.type === 'CallExpression' || parent.type === 'OptionalCallExpression')
          ? context.key === 'callee'
          : parent.type === 'TaggedTemplateExpression' && context.key === 'tag'
        const read = this.importedRead(binding)
        const callRead = valueCallPosition && binding.interop === 'named' ? `(0,${read})` : read
        const shorthand = parent.type === 'Property' && context.key === 'value'
          && (parent as Node & { shorthand?: boolean }).shorthand === true
        this.replace(record.start, record.end, shorthand ? `${name}:${callRead}` : callRead)
        break
      }
      case 'VariableDeclarator': {
        this.visit(record.id, { ...next, parent: record, key: 'id', skipReferences: true })
        this.visit(record.init, { ...next, parent: record, key: 'init' })
        return
      }
      case 'ImportExpression': {
        this.moduleSyntax = true
        if (!this.source.startsWith('import', record.start)) this.fail('unexpected dynamic import layout', record.start)
        this.replace(record.start, record.start + 'import'.length, this.helper('dynImport'))
        // A computed dynamic import stays out of the request list; resolution
        // then happens (and fails loud) at runtime, never silently at pack time.
        const argument = record.source as Node | undefined
        if (argument !== undefined && typeof argument.value === 'string') this.moduleRequests.add(argument.value)
        break
      }
      case 'CallExpression': {
        // CommonJS bodies pass through untransformed, but literal calls through
        // the wrapper's `require` remain module requests. The ESM case accepts
        // only a direct module-scope createRequire call with the importer URL.
        const callee = record.callee as Node
        const callArguments = record.arguments as Node[]
        const literalArgument = callArguments[0]?.value
        if (this.isRequireCall(callee, context.moduleScope) && callArguments.length === 1
          && typeof literalArgument === 'string') {
          this.moduleRequests.add(literalArgument)
        }
        // `import.meta.resolve('lit')` is the third static request face: the
        // loader answers it from the image, so the pack sweep must keep the
        // target. A computed argument stays out, same as dynamic import —
        // resolution then fails loud at runtime, never silently at pack time.
        if (callee.type === 'MemberExpression') {
          const object = callee.object as Node
          const property = callee.property as Node
          if (object.type === 'MetaProperty' && (object.meta as Node).name === 'import'
            && property.type === 'Identifier' && property.name === 'resolve'
            && typeof literalArgument === 'string') {
            this.metaResolveRequests.add(literalArgument)
          }
        }
        break
      }
      case 'MetaProperty': {
        // `new.target` is a MetaProperty too, and it must survive untouched:
        // the abstract-seam guards in the roster read it (`new.target === X`).
        const meta = record.meta as Node
        if (meta.name === 'import') {
          this.moduleSyntax = true
          this.replace(record.start, record.end, '__dsh$meta')
        }
        break
      }
      case 'AwaitExpression':
        if (context.functionDepth === 0) {
          this.fail('top-level await cannot run as CommonJS in the worker', record.start)
        }
        this.awaitExpression(record)
        break
      case 'ForOfStatement':
        if (record.await === true) {
          if (context.functionDepth === 0) this.fail('a top-level for-await loop cannot run as CommonJS in the worker', record.start)
          this.forAwait(record)
        }
        this.visitLoop(record, context)
        return
      case 'ForStatement':
      case 'ForInStatement':
        this.visitLoop(record, context)
        return
      case 'LabeledStatement': {
        const body = record.body as Node
        if (body.type === 'ForOfStatement' && body.await === true) {
          this.fail('a labeled for-await loop is not supported', record.start)
        }
        break
      }
      case 'YieldExpression':
        if (context.asyncGenerator) this.yieldExpression(record, context.statement)
        break
      case 'FunctionDeclaration':
      case 'FunctionExpression':
      case 'ArrowFunctionExpression': {
        next = {
          ...next,
          asyncGenerator: record.async === true && record.generator === true,
          functionDepth: context.functionDepth + 1,
          moduleScope: false,
        }
        this.scopes.push(functionScopeNames(record))
        try {
          this.visit(record.id, { ...next, key: 'id', parent: record, skipReferences: true })
          for (const param of record.params as Node[]) {
            this.visit(param, { ...next, key: 'params', parent: record, skipReferences: true })
          }
          this.visit(record.body, { ...next, key: 'body', parent: record })
        } finally {
          this.scopes.pop()
        }
        return
      }
      case 'BlockStatement': {
        next = { ...next, moduleScope: false }
        this.scopes.push(blockScopeNames(record))
        try {
          this.recurse(record, next)
        } finally {
          this.scopes.pop()
        }
        return
      }
      case 'CatchClause': {
        next = { ...next, moduleScope: false }
        const caught = new Set<string>()
        patternNames(record.param, caught)
        this.scopes.push(caught)
        try {
          this.visit(record.param, { ...next, key: 'param', parent: record, skipReferences: true })
          this.visit(record.body, { ...next, key: 'body', parent: record })
        } finally {
          this.scopes.pop()
        }
        return
      }
      case 'SwitchStatement': {
        next = { ...next, moduleScope: false }
        // The discriminant evaluates in the enclosing scope, before the
        // switch's shared case scope exists: a case-body declaration must not
        // shadow an import the discriminant reads. The cases (tests included)
        // then share that one lexical scope.
        this.visit(record.discriminant, { ...next, parent: record, key: 'discriminant' })
        this.scopes.push(switchScopeNames(record))
        try {
          this.visit(record.cases, { ...next, parent: record, key: 'cases' })
        } finally {
          this.scopes.pop()
        }
        return
      }
      case 'ClassBody':
      case 'ClassDeclaration':
      case 'ClassExpression':
        next = { ...next, moduleScope: false }
        break
      default: break
    }
    if (record.type === 'ExpressionStatement') next = { ...next, statement: record }
    this.recurse(record, next)
  }

  /** Recurse into every child of a node with parent/key context attached. */
  private recurse(record: Node, next: {
    asyncGenerator: boolean
    functionDepth: number
    moduleScope: boolean
    statement?: Node
    parent?: Node
    key?: string
    skipReferences?: boolean
  }): void {
    for (const [key, value] of Object.entries(record)) {
      if (key === 'type' || key === 'start' || key === 'end') continue
      this.visit(value, { ...next, parent: record, key, skipReferences: false })
    }
  }

  /** Visit a loop whose `init`/`left` declares per-iteration block bindings. */
  private visitLoop(record: Node, context: {
    asyncGenerator: boolean
    functionDepth: number
    moduleScope: boolean
    statement?: Node
    parent?: Node
    key?: string
    skipReferences?: boolean
  }): void {
    const next = { ...context, moduleScope: false }
    const declared = new Set<string>()
    const head = (record.type === 'ForStatement' ? record.init : record.left) as Node | null
    if (head !== null && head.type === 'VariableDeclaration' && head.kind !== 'var') {
      for (const declarator of head.declarations as Node[]) patternNames(declarator.id, declared)
    }
    this.scopes.push(declared)
    try {
      if (head !== null) {
        if (head.type === 'VariableDeclaration') {
          this.visit(head, { ...next, parent: record, key: 'init' })
        } else {
          this.visit(head, { ...next, parent: record, key: 'left' })
        }
      }
      if (record.type !== 'ForStatement') this.visit(record.right, { ...next, parent: record, key: 'right' })
      if (record.type === 'ForStatement') {
        this.visit(record.test, { ...next, parent: record, key: 'test' })
        this.visit(record.update, { ...next, parent: record, key: 'update' })
      }
      this.visit(record.body, { ...next, parent: record, key: 'body' })
    } finally {
      this.scopes.pop()
    }
  }

  private isCreateRequireCall(node: Node): boolean {
    if (node.type !== 'CallExpression') return false
    const callee = node.callee as Node
    const args = node.arguments as Node[]
    if (callee.type !== 'Identifier' || !this.createRequireBindings.has(nameOf(callee)) || args.length !== 1) {
      return false
    }
    const base = args[0] as Node
    if (base.type !== 'MemberExpression' || base.computed === true) return false
    const object = base.object as Node
    const property = base.property as Node
    return object.type === 'MetaProperty'
      && (object.meta as Node).name === 'import'
      && property.type === 'Identifier'
      && property.name === 'url'
  }

  private isRequireCall(callee: Node, moduleScope: boolean): boolean {
    return (callee.type === 'Identifier' && callee.name === 'require')
      || (moduleScope && this.isCreateRequireCall(callee))
  }

  private indexCreateRequireImports(program: Node): void {
    for (const statement of program.body as Node[]) {
      if (statement.type !== 'ImportDeclaration') continue
      const source = statement.source as Node
      if (source.value !== 'node:module' && source.value !== 'module') continue
      for (const specifier of statement.specifiers as Node[]) {
        if (specifier.type !== 'ImportSpecifier' || nameOf(specifier.imported as Node) !== 'createRequire') continue
        this.createRequireBindings.add(nameOf(specifier.local as Node))
      }
    }
  }

  run(): string {
    // Transforming a lowered body again would nest the protocol inside itself:
    // it still runs, only slower and unreadable, so a mis-wired manifest must
    // surface here rather than as a silent tax on every load.
    if (this.source.includes(`${ALS}.pause(`) || this.source.includes('__als$')) {
      this.fail('the module is already lowered; check the image manifest wiring', 0)
    }
    let program: Node
    try {
      program = parse(this.source, {
        ecmaVersion: 'latest',
        sourceType: 'module',
        allowAwaitOutsideFunction: true,
      }) as unknown as Node
    } catch (reason) {
      this.fail(`parse failed: ${(reason as Error).message}`, 0)
    }
    this.indexCreateRequireImports(program)
    // Imports register their lazy locals before the traversal: ESM hoists
    // them, so a reference may textually precede its import and the binding
    // must already be known when the reference is visited. The statement's
    // own rewrite still happens at its position, keeping request order.
    for (const statement of program.body as Node[]) {
      if (statement.type === 'ImportDeclaration') this.prepareImport(statement)
    }
    this.visit(program, { asyncGenerator: false, functionDepth: 0, moduleScope: true })
    if (this.edits.length === 0 && !this.moduleSyntax) return this.source

    const prologue: string[] = []
    if (this.moduleSyntax) prologue.push('"use strict";Object.defineProperty(exports,"__esModule",{value:true});')
    if (this.bindings.length > 0) this.helper('def')
    for (const [name, source] of Object.entries(HELPER_SOURCE)) {
      if (this.helpers.has(name)) prologue.push(source)
    }
    prologue.push(...this.importRequires)
    for (const { exported, read } of this.bindings) {
      prologue.push(`__dsh$def(exports,${JSON.stringify(exported)},()=>${read});`)
    }

    const sorted = [...this.edits].sort((left, right) => left.start - right.start || left.end - right.end)
    const render = (from: number, to: number): string => {
      let cursor = from
      let out = ''
      for (const edit of sorted) {
        if (edit.start < cursor || edit.end > to) continue
        out += this.source.slice(cursor, edit.start) + edit.render(render)
        cursor = edit.end
      }
      return out + this.source.slice(cursor, to)
    }
    const code = prologue.join('') + render(0, this.source.length)
    // Proof that the emitted body is CommonJS a wrapper can compile: any leftover
    // module syntax, or any mis-spliced interval, fails here rather than at load.
    try {
      parse(code, { ecmaVersion: 'latest', sourceType: 'script', allowAwaitOutsideFunction: false })
    } catch (reason) {
      this.fail(`the transform produced code that does not parse: ${(reason as Error).message}`, 0)
    }
    return code
  }
}

/** @returns The name a specifier or identifier node carries. */
function nameOf(node: Node): string {
  return node.type === 'Identifier' ? node.name as string : String(node.value)
}

/** Collect every name a binding pattern declares into `into`. */
function patternNames(pattern: unknown, into: Set<string>): void {
  if (pattern === null || typeof pattern !== 'object') return
  const node = pattern as Node
  switch (node.type) {
    case 'Identifier':
      into.add(node.name as string)
      return
    case 'ObjectPattern':
      for (const property of node.properties as Node[]) {
        patternNames(property.type === 'RestElement' ? property.argument : property.value, into)
      }
      return
    case 'ArrayPattern':
      for (const element of node.elements as Array<Node | null>) {
        if (element !== null) patternNames(element, into)
      }
      return
    case 'AssignmentPattern':
      patternNames(node.left, into)
      return
    case 'RestElement':
      patternNames(node.argument, into)
      return
    default:
      return
  }
}

/**
 * Collect `var` names declared anywhere under `node`, stopping at function
 * boundaries: `var` hoists to the enclosing function scope, so a nested
 * block's `var` still shadows a same-named import for the whole function.
 */
function collectVarNames(node: Node, into: Set<string>): void {
  if (node.type === 'FunctionDeclaration' || node.type === 'FunctionExpression'
    || node.type === 'ArrowFunctionExpression') return
  if (node.type === 'VariableDeclaration' && node.kind === 'var') {
    for (const declarator of node.declarations as Node[]) patternNames(declarator.id, into)
  }
  for (const [key, value] of Object.entries(node)) {
    if (key === 'type' || key === 'start' || key === 'end') continue
    if (value === null || typeof value !== 'object') continue
    if (Array.isArray(value)) {
      for (const child of value) {
        if (child !== null && typeof child === 'object') collectVarNames(child as Node, into)
      }
      continue
    }
    if (typeof (value as Node).type === 'string') collectVarNames(value as Node, into)
  }
}

/**
 * Names one function's own scope declares: parameters, a named function
 * expression's self-binding, and every `var` under it. Block-level lexical
 * declarations belong to their blocks and are collected there instead.
 */
function functionScopeNames(node: Node): ReadonlySet<string> {
  const names = new Set<string>()
  const id = node.id as Node | null
  if (id !== null) names.add(id.name as string)
  for (const param of node.params as Node[]) patternNames(param, names)
  collectVarNames(node.body as Node, names)
  return names
}

/** Add one statement's lexical declarations (let/const/class/function) to `into`. */
function collectLexicalNames(statement: Node, into: Set<string>): void {
  if (statement.type === 'VariableDeclaration' && statement.kind !== 'var') {
    for (const declarator of statement.declarations as Node[]) patternNames(declarator.id, into)
  } else if (statement.type === 'FunctionDeclaration' || statement.type === 'ClassDeclaration') {
    const id = statement.id as Node | null
    if (id !== null) into.add(id.name as string)
  }
}

/** Names a block's direct statement list declares lexically (let/const/class/function). */
function blockScopeNames(block: Node): ReadonlySet<string> {
  const names = new Set<string>()
  for (const statement of block.body as Node[]) collectLexicalNames(statement, names)
  return names
}

/** Names a switch's shared block scope declares across its case bodies. */
function switchScopeNames(switchNode: Node): ReadonlySet<string> {
  const names = new Set<string>()
  for (const caseClause of switchNode.cases as Node[]) {
    for (const statement of caseClause.consequent as Node[]) collectLexicalNames(statement, names)
  }
  return names
}

/** Every binding an exported declaration introduces, including patterns. */
function declaredBindings(declaration: Node, fail: (detail: string) => never): Array<{ exported: string; local: string }> {
  if (declaration.type === 'FunctionDeclaration' || declaration.type === 'ClassDeclaration') {
    const id = declaration.id as Node | null
    if (id === null) fail('an exported declaration must be named')
    const name = id.name as string
    return [{ exported: name, local: name }]
  }
  if (declaration.type !== 'VariableDeclaration') fail(`unsupported exported declaration ${declaration.type}`)
  const bindings: Array<{ exported: string; local: string }> = []
  const collect = (pattern: Node): void => {
    switch (pattern.type) {
      case 'Identifier':
        bindings.push({ exported: pattern.name as string, local: pattern.name as string })
        return
      case 'ObjectPattern':
        for (const property of pattern.properties as Node[]) {
          collect((property.type === 'RestElement' ? property.argument : property.value) as Node)
        }
        return
      case 'ArrayPattern':
        for (const element of pattern.elements as Array<Node | null>) if (element !== null) collect(element)
        return
      case 'AssignmentPattern':
        collect(pattern.left as Node)
        return
      case 'RestElement':
        collect(pattern.argument as Node)
        return
      default:
        fail(`unsupported binding pattern ${pattern.type}`)
    }
  }
  for (const declarator of declaration.declarations as Node[]) collect(declarator.id as Node)
  return bindings
}

interface TransformedModule {
  readonly code: string
  readonly moduleRequests: readonly string[]
  readonly metaResolveRequests: readonly string[]
}

const cache = new Map<string, TransformedModule>()

/**
 * Transform one module into a body for the worker wrapper.
 *
 * Results are cached by source text, so a module reached through two paths, or
 * a repeated build, parses once.
 * @param source - Module source, ESM or CommonJS.
 * @param path - Path used in diagnostics.
 * @returns The lowered body and the module requests found in it.
 */
function transformDetailed(source: string, path: string): TransformedModule {
  const cached = cache.get(source)
  if (cached !== undefined) return cached
  const transformer = new Transformer(source, path)
  const transformed = { code: transformer.run(), moduleRequests: transformer.requests(), metaResolveRequests: transformer.metaRequests() }
  cache.set(source, transformed)
  return transformed
}

/** One module the collector considered. */
export interface LoweredModule {
  /** Transformed body, or the input unchanged when nothing needed lowering. */
  readonly code: string
  /** False means the entry may be packed as it is. */
  readonly lowered: boolean
  /**
   * Static module requests the body makes: import and re-export sources,
   * literal dynamic imports and calls through `require`, plus module-scope
   * direct literal calls through an imported `createRequire(import.meta.url)`.
   * Computed and rebased requests resolve (and fail loud) at runtime only.
   */
  readonly moduleRequests: readonly string[]
  /**
   * Literal `import.meta.resolve()` requests. These are URL mappings, not
   * loads: the pack sweep keeps a resolvable target and tolerates a missing
   * one, and the loader answers or throws at the call site.
   */
  readonly metaResolveRequests: readonly string[]
}

/**
 * Lower one module at image-pack time.
 *
 * The collector calls this for every JavaScript entry it packs and records
 * `LOWERING_VERSION` in the image manifest; the loader then wraps those entries
 * without parsing them. `lowered: false` reports that the transform would have
 * returned the input verbatim (already CommonJS, no suspension point), so the
 * entry may be packed as it is.
 *
 * Throwing is the intended failure mode: a module this transform cannot express
 * must fail the build rather than ship an image that breaks at load.
 * @param options - Virtual path inside the image and the module source.
 * @returns The code to pack and whether it changed.
 */
export function lowerModuleSource(options: { readonly filename: string; readonly source: string }): LoweredModule {
  const { code, moduleRequests, metaResolveRequests } = transformDetailed(options.source, options.filename)
  return { code, lowered: code !== options.source, moduleRequests, metaResolveRequests }
}
