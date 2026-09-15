import ts from '@typescript/typescript6'

const decoratorSyntax = /^\s*@[A-Za-z_$][\w$]*/m

/**
 * Worker arguments that keep process-wide Web Storage from shadowing jsdom storage.
 * Node lists the positive spelling in `allowedNodeEnvironmentFlags` for this negatable flag.
 */
export const vitestExecArgv = process.allowedNodeEnvironmentFlags.has('--webstorage') ? ['--no-webstorage'] : []

/**
 * Transform JSX with the automatic runtime in every test surface.
 *
 * Vite's esbuild transform reads `compilerOptions.jsx` from the file's nearest tsconfig. Face-split
 * packages keep a solution-only root tsconfig without compiler options (the faces carry them), so
 * without this preset their `.tsx` specs fall back to the classic `React.createElement` transform
 * and fail with `React is not defined`. The value mirrors `tsconfig.base.client.json`.
 */
export const vitestEsbuild = { jsx: 'automatic' } as const

/**
 * Transform standard TypeScript decorators before Vite's default parser sees source files.
 * @returns a pre-transform Vite plugin shared by source-mode test configurations.
 */
export function standardDecoratorPlugin() {
  return {
    name: 'dsh-standard-decorators',
    enforce: 'pre' as const,
    transform(code: string, id: string) {
      const file = id.split('?', 1)[0]!
      if (!/\.[cm]?tsx?$/.test(file) || !decoratorSyntax.test(code)) return
      const result = ts.transpileModule(code, {
        fileName: file,
        compilerOptions: {
          target: ts.ScriptTarget.ES2024,
          module: ts.ModuleKind.ESNext,
          // A conditional spread keeps the key absent for non-JSX files; an explicit
          // `undefined` value fails `exactOptionalPropertyTypes` under the host program.
          ...(file.endsWith('x') ? { jsx: ts.JsxEmit.ReactJSX } : {}),
          sourceMap: true,
        },
      })
      return {
        code: result.outputText
          .replace(
            /^(\s*)(__esDecorate\()/gmu,
            '$1/* v8 ignore next -- compiler-synthetic decorator accessors have no source behavior */ $2',
          )
          .replace(/\n?\/\/# sourceMappingURL=.*$/u, '\n'),
        map: result.sourceMapText,
      }
    },
  }
}
