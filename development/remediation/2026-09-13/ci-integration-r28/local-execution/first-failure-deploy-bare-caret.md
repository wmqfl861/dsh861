# r28 Windows first failure: legacy deploy rejects the closure with a bare `^` spec

Recorded from the full local run of the CI `Build single-exe` command on Windows
(Node 26.8.2, pnpm 12.4.1, checkout of `fa1a3751720558a0040633b322ee73cb1c5f3c54`
plus the r27 handoff docs commit). Full log: `logs/05-build-exe-full-node26.log`.

Command (mirrors `.github/workflows/build-exe-for-python-sdk.yml` step `Build single-exe`):

```
DSH_BUILD_CLIENT_PROFILE=official pnpm exec tsx scripts/build-exe-for-python-sdk.ts --targets=node24-win-x64
```

Pipeline progress before the failure:

- `pnpm run verify-runtime-closure` — pass
- `pnpm run build` (native-system, build:lib host+client, build:web) — pass
  (the earlier remote "tailwind/tsdown" diagnosis did not reproduce; the tree has no tailwind dependency)
- `pnpm --filter dsh-python-runtime-closure deploy --legacy --prod ...` — **fail, exit 1**

Verbatim failure:

```
Error: ERR_PNPM_SPEC_NOT_SUPPORTED_BY_ANY_RESOLVER

  × installing deployed dependencies
  ╰─▶ Failed to resolve dependency tree: "@deepseek-ai/dsh-session-title-
      llm@^" isn't supported by any available resolver.
```

Root cause chain (each step reproduced locally, see `verification.json`):

1. The production closure reaches `@deepseek-ai/dsh-session-title-first-prompt-llm`
   via `dsh-python-runtime-closure -> @deepseek-ai/dsh -> @deepseek-ai/dsh-base`.
2. That package declares `@deepseek-ai/dsh-session-title-llm` as a
   `workspace:^` peer dependency; nothing in the production subset provides it
   (its other consumers only carry it as a devDependency, which `--prod` strips).
3. pnpm 12.4.1 `deploy --legacy` converts that unsatisfied peer to the invalid
   bare range `^` and resolution aborts. pnpm 11.7.0 (upstream's pin) tolerated
   the same manifest and silently omitted the peer package from the deploy
   target — a latent runtime hole, because
   `packages/session/session-title-first-prompt-llm/src/index.ts` imports the
   peer at load time.
4. A 5-package minimal workspace reproduces both behaviors (`logs/mini-deploy-*.log`).

Second failure exposed after the first fix: pnpm 12.4.1 `deploy --legacy` with
`node-linker=hoisted` materializes the registry tree in the workspace-root
`node_modules` instead of the deploy target (root pollution, empty target);
pnpm 11.7.0 fills the target. Minimal proof recorded in
`mini-deploy-pnpm11-vs-12.md`.
