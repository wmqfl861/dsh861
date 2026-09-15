# Minimal reproduction: pnpm 11.7.0 vs 12.4.1 `deploy --legacy`

Two throwaway workspaces under `C:\dsh-r28-20260913-01` (outside the repository)
isolated the two pnpm 12 legacy-deploy behavior changes that broke the Python
runtime packaging lane. Logs: `logs/mini-deploy-12.log`, `logs/mini-deploy-11.log`,
`logs/deploy11.log`, `logs/deploy12.log` in this directory.

## Reproduction 1 — unsatisfied `workspace:^` peer becomes a bare `^`

Workspace: `root -> a -> b -> c` (prod deps) with `c` declaring
`peerDependencies: { d: "workspace:^" }` and nothing else depending on `d`.

| command | pnpm 11.7.0 | pnpm 12.4.1 |
|---|---|---|
| `deploy --legacy --prod --config.node-linker=hoisted --config.auto-install-peers=false --config.link-workspace-packages=true target` | exit 0; `d` absent from `target/node_modules` (peer silently dropped) | exit 1: `ERR_PNPM_SPEC_NOT_SUPPORTED_BY_ANY_RESOLVER — "d@^" isn't supported by any available resolver` |

Variant: adding `d` as a regular dependency of `b` (the consumer of `c`, the
mount point) makes pnpm 12.4.1 succeed with `d` present in the target. Adding
`d` only to `c` itself (beside the peer declaration) still fails — satisfaction
must come from the deployed dependency graph, which is the semantics
`scripts/verify-runtime-closure.ts` now checks.

## Reproduction 2 — hoisted registry tree lands in the workspace root

Workspace: `root -> {a (workspace:^), semver (^7.7.0)}` with `a -> ms (^2.1.3)`.

| pnpm | `target/node_modules` | workspace-root `node_modules` |
|---|---|---|
| 11.7.0 | `a`, `ms`, `semver` (complete hoisted tree) | no registry pollution |
| 12.4.1 | empty | `semver` hoisted into the workspace root |

The same misplacement was observed on the real repository: the deploy reported
`added 503` while the staging directory kept only an empty virtual store and the
workspace root gained a real `node_modules/node-pty` directory whose install
scripts ran against the root (`Copying C:\...\dsh861\node_modules\node-pty\...`).

## Non-legacy deploy (pnpm 12.4.1 default)

Dropping `--legacy` fills the deploy target correctly (complete hoisted tree,
node-pty `prebuilds/win32-x64` including the `conpty` directory, no root
pollution). Lifecycle scripts must be skipped for the deploy invocation:
`@deepseek-ai/dsh-subprocess-local` is rewritten to an absolute `file:///`
dependency whose per-dep build key is machine-specific, so pnpm 12's strict
build gate (`ERR_PNPM_IGNORED_BUILDS`) rejects it regardless of
`--config.strict-dep-builds=false` or the `npm_config_strict_dep_builds` env
override. `--ignore-scripts` is safe for this closure because node-pty and
koffi ship their prebuilt binaries (`@koromix/koffi-win32-x64` carries
`koffi.node`; node-pty's tarball carries `prebuilds/`), and the only workspace
postinstall (the node-pty spawn-helper chmod) is mirrored by
`scripts/build-exe-for-python-sdk.ts` after the deploy.
