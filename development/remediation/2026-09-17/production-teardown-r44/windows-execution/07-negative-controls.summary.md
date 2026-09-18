# r44-B negative controls summary (2026-09-17)

## Team ownership mutation (plan v1 §12.2)
- mutation: packages/experimental/agent-team/src/index.ts — projection registration restored to the old ctx.root.sessionProjections.register shape
- negative run: pnpm exec vitest run --project thread-safe packages/experimental/agent-team/tests/teardown.spec.ts -t "R44-T02"
mutation=applied
2026-09-17T07:57:58Z
negative_exit_code=1
restored_sha256=1f1cf4f5778baf4b5ef3931c9febbb2753f1753eed8e2b878c75f49b2ce33394
candidate_sha256=1f1cf4f5778baf4b5ef3931c9febbb2753f1753eed8e2b878c75f49b2ce33394
positive_exit_code=0

## Subagent early-exit mutation (plan v1 §12.3)
- mutation: packages/subagent/subagent/src/continuation-activation.ts — finishDisposal pre-positioned unguarded cancel({kind:'parent'}) outside the failure-collecting transaction
- negative run: pnpm exec vitest run --project thread-safe packages/subagent/subagent/tests/continuation-teardown.spec.ts -t "R44-S07"
mutation=applied
2026-09-17T07:58:27Z
negative_exit_code=1
restored_sha256=612fa4e8c26ed2540db0176b8e2c998087fb0573e769d6825a97d74f02b5ad34
candidate_sha256=612fa4e8c26ed2540db0176b8e2c998087fb0573e769d6825a97d74f02b5ad34
positive_exit_code=0

Raw artifacts (mutation diffs via backups, run logs, byte backups): repo-external C:\dsh-r24-upgrade-20260912-01\r44b-exec-raw\negative-controls\
