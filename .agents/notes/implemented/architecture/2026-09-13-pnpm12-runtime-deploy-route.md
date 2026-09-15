# Agent Note: pnpm 12 runtime deploy route and closure-level peer supply

Status: implemented

English | [中文](2026-09-13-pnpm12-runtime-deploy-route.zh.md)

## Problem

The r24 toolchain migration pinned `pnpm@12.4.1` (upstream `master` pins `11.7.0`), and every `python runtime / release-shaped matrix` job on this branch failed at the `Build single-exe` step from the branch's first CI run onward. A remote round had attributed the failure to a Tailwind bundling error decoded from a connector-processed log; that diagnosis names packages which do not exist anywhere in this tree and did not reproduce locally, so it was discarded as evidence. Local execution of the exact CI command isolated two pnpm 12 behavior changes in `deploy --legacy`, each reproduced with a five-package minimal workspace (`development/remediation/2026-09-13/ci-integration-r28/local-execution/`):

1. A `workspace:^` peer that no production dependency supplies is rewritten to the invalid bare range `^`, aborting resolution with `ERR_PNPM_SPEC_NOT_SUPPORTED_BY_ANY_RESOLVER`. pnpm 11 instead omitted the peer package from the deploy target silently — a latent runtime hole, because the peer-owning plugin imports it at load time.
2. With `node-linker=hoisted`, the registry tree is materialized in the workspace-root `node_modules` (running install scripts against the root) while the deploy target keeps an empty virtual store.

## Decision

- `python/sdk-runtime/package.json` declares the two peer providers the production closure was missing — `@deepseek-ai/dsh-session-title-llm` (peer of `dsh-session-title-first-prompt-llm`, mounted through `@deepseek-ai/dsh-base`) and `@deepseek-ai/dsh-util-workspace-path` (peer of `dsh-api-session-controller`, mounted through `@deepseek-ai/dsh-web-app`) — following the manifest's existing root-level peer-supply pattern.
- The deploy drops `--legacy` (pnpm 12's deploy fills the target correctly) and adds `--ignore-scripts`: pnpm 12's strict per-dependency build gate keys the injected workspace package by its rewritten absolute `file:///` path, which is machine-specific, so no committed `allowBuilds` key can authorize it and the deploy hard-fails otherwise. Skipping scripts is safe for this closure because node-pty ships its `prebuilds/` (including the Windows `conpty` directory beside the addons) and koffi's native binary arrives through the `@koromix/koffi-*` platform optional dependency; the only workspace postinstall — the node-pty macOS spawn-helper chmod — is mirrored by `scripts/build-exe-for-python-sdk.ts` after the deploy.
- `scripts/verify-runtime-closure.ts` now walks `apps/*/package.json` as well (the closure reaches `@deepseek-ai/dsh` there) and accepts peer supply from anywhere in the production closure, not only the runtime root, matching what `deploy --prod` materializes; `devDependencies` never satisfy a peer.

## Consequences

The staged tree is complete straight from the deploy, so the legacy restore pass is gone from the build script. The closure verifier now rejects the failure class that queued eleven red packaging runs: removing either manifest line fails `pnpm run verify-runtime-closure` with the full referencing chain before any packaging runs. The Linux CI node-pty manylinux rebuild keeps operating on the workspace package, unaffected by the deploy-route change.

## Alternatives considered

| Rejected | One-line reason |
|---|---|
| Downgrading pnpm to 11.7.0 | Reverts the authorized r24 toolchain migration and hides the real closure hole pnpm 12 exposed |
| Keeping `--legacy` with script-side repair | The registry tree never reaches the target; copying out of the shared workspace `node_modules` is not separable |
| `--config.strict-dep-builds=false` / env override | The deploy re-derives the gate from the written target settings; the flag does not reach the inner install (verified empirically) |
| Mount-point peer supply (`dsh-base`/`dsh-web-app` declaring the peers) | Works with pnpm 12 but diverges from the manifest's established root-level supply pattern and from the verifier's rule |
