import { composeError, Context } from '@deepseek-ai/cordis'
import { isNonNullable, type Dict } from '@deepseek-ai/cosmokit'
import { Entry, type EntryOptions } from './entry.ts'
import { EntryGroup } from './group.ts'
import { createResolve } from '../resolve.ts'

/**
 * One tree-side mutation, reported to `EntryTree.commit()` synchronously after
 * it has been applied to `entry.options` / `group.data`.
 *
 * - `options` absent: the entry was removed from `group`.
 * - `legacy` absent: the entry was created in `group`.
 * - both present: the entry was updated and now lives in `group`; `from` is
 *   the group it left if the update moved it.
 */
export interface EntryChange {
  id: string
  group: EntryGroup
  from?: EntryGroup
  options?: EntryOptions
  legacy?: EntryOptions
}

/** Mutable tree of loader entries. Persistence is supplied by subclasses. */
export abstract class EntryTree {
  static readonly sep = ':'

  public ctx: Context
  public enableLogs?: boolean
  public root: EntryGroup
  public store: Dict<Entry> = Object.create(null)

  constructor(ctx: Context) {
    this.ctx = ctx.extend({ baseUrl: ctx.baseUrl })
    this.root = new EntryGroup(this.ctx, this)
    const entry = this.ctx.fiber.entry
    if (entry) entry.subtree = this
  }

  get context(): Context {
    return this.ctx
  }

  /** Iterate entries in this tree and any nested subtrees. */
  * entries(): Generator<Entry, void, void> {
    for (const entry of Object.values(this.store)) {
      yield entry
      if (!entry.subtree) continue
      yield* entry.subtree.entries()
    }
  }

  /** Return pending import and lifecycle tasks owned by this tree. */
  getTasks() {
    return [...this.entries()]
      .map(entry => entry._initTask || entry.fiber?.inertia)
      .filter(isNonNullable)
  }

  /**
   * Wait until this tree has no active import or lifecycle tasks.
   * @throws a settled fiber failure, or an aggregate when several fibers failed.
   */
  async await() {
    while (true) {
      const tasks = this.getTasks()
      if (tasks.length) {
        await Promise.allSettled(tasks)
        continue
      }
      const outcomes = await Promise.allSettled(
        [...this.entries()].map(entry => entry._await()),
      )
      const failures = outcomes
        .filter((outcome): outcome is PromiseRejectedResult => outcome.status === 'rejected')
        .map(outcome => outcome.reason)
      if (failures.length === 1) throw failures[0]
      if (failures.length > 1) throw new AggregateError(failures, 'loader fibers failed')
      this.ctx.reflect.notify(['loader'])
      if (!this.getTasks().length) return
    }
  }

  ensureId(options: Partial<EntryOptions>) {
    if (!options.id) {
      do {
        options.id = Math.random().toString(16).slice(2, 10)
      } while (this.store[options.id])
    }
    return options.id!
  }

  /** Resolve an entry by id, including nested ids separated by `EntryTree.sep`. */
  resolve(id: string) {
    const parts = id.split(EntryTree.sep)
    let tree: EntryTree | undefined = this
    const final = parts.pop()!
    for (const part of parts) {
      tree = tree.store[part]?.subtree
      if (!tree) throw new Error(`cannot resolve entry ${id}`)
    }
    const entry = tree.store[final]
    if (!entry) throw new Error(`cannot resolve entry ${id}`)
    return entry
  }

  resolveGroup(id: string | null) {
    if (!id) return this.root
    const entry = this.resolve(id)
    if (!entry.subgroup) throw new Error(`entry ${id} is not a group`)
    return entry.subgroup
  }

  /**
   * Create an entry in the root group or a nested group. Failed activation
   * removes its candidate row; successful activation precedes the creation journal.
   */
  async create(options: Omit<EntryOptions, 'id'>, parent: string | null = null, position = Infinity) {
    const group = this.resolveGroup(parent)
    const id = group.tree.ensureId(options)
    group.data.splice(position, 0, options as EntryOptions)
    let created: string | undefined
    try {
      created = await group.create(options)
    } catch (error) {
      // Remove only this candidate, not siblings added during its activation.
      group.unlink(options as EntryOptions)
      throw error
    }
    group.tree.commit({ id, group, options: options as EntryOptions })
    return created ?? id
  }

  /** Stop and remove an entry from its parent group. */
  async remove(id: string) {
    const entry = this.resolve(id)
    const group = entry.parent
    const legacy = entry.options
    await group.remove(legacy.id)
    group.tree.commit({ id: legacy.id, group, legacy })
  }

  /** Update an entry and optionally move it to another group. */
  async update(id: string, options: Omit<EntryOptions, 'id' | 'name'>, parent?: string | null, position?: number) {
    const entry = this.resolve(id)
    const source = entry.parent
    const sourceIndex = source.data.indexOf(entry.options)
    let target = source
    const legacy = { ...entry.options }
    if (parent !== undefined) {
      target = this.resolveGroup(parent)
      source.unlink(entry.options)
      target.data.splice(position ?? Infinity, 0, entry.options)
      entry.parent = target
    }
    // `Entry.update` assigns the new options before its first `await`, so the
    // change is fully visible to `commit()` once the call returns.
    const task = entry.update(options, false, true)
    try {
      await task
    } catch (error) {
      if (parent !== undefined) {
        target.unlink(entry.options)
        source.data.splice(sourceIndex < 0 ? source.data.length : sourceIndex, 0, entry.options)
        entry.parent = source
        try {
          await entry.update({}, false, true)
        } catch (rollbackError) {
          throw new AggregateError([error, rollbackError], `failed to roll back loader entry move ${id}`)
        }
      }
      throw error
    }
    if (entry.parent.tree !== source.tree) {
      source.tree.commit({ id: legacy.id, group: source, legacy })
    }
    const from = entry.parent === source ? undefined : source
    entry.parent.tree.commit({ id: legacy.id, group: entry.parent, from, options: entry.options, legacy })
  }

  /** Import a plugin module from a specifier or `cordis:` builtin. */
  import(name: string, getOuterStack?: () => string[]) {
    if (name.startsWith('cordis:')) {
      return this.ctx.loader.builtins[name.slice(7)]
    }
    return composeError(async (info) => {
      // ModuleJob.run
      // onImport.tracePromise.__proto__
      // internal.import
      info.offset += 3
      if (this.ctx.loader.internal) {
        return await this.ctx.loader.internal.import(name, this.ctx.baseUrl!, {})
      } else if (name.startsWith('.')) {
        return await import(/* @vite-ignore */ new URL(name, this.ctx.baseUrl).href)
      } else {
        // An `import()` written here anchors on this file, reaching the loader's
        // own dependencies. A helper inside the config file's project supplies
        // that project as the anchor; the plain import applies when no project
        // can be located.
        const resolve = await createResolve(this.ctx.baseUrl)
        const url = resolve ? resolve(name) : name
        return await import(/* @vite-ignore */ url)
      }
    }, getOuterStack)
  }

  /**
   * Report one applied tree mutation to the owning tree for persistence.
   * In-memory trees may ignore the change and do nothing.
   */
  abstract commit(change: EntryChange): void
}
