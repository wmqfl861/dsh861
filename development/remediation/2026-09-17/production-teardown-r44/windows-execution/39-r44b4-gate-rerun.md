# r44b4 最终字节关键门禁复跑（2026-09-17T15:39–15:47Z）

原始日志仓库外 `C:\dsh-r24-upgrade-20260912-01\r44b4-exec-raw\`（文件名后缀 -r44b4）。工具链：node 26.8.2 + pnpm 12.4.1 双目录 PATH 前缀（系统 pnpm sh shim 损坏；vitest 直调 `node_modules/vitest/vitest.mjs`；doc-sync 经 `pnpm run doc-sync`）。

## 结果

| 门禁 | 命令 | exit | 结果 |
|---|---|---|---|
| 清单三元组验证 | Node 脚本逐项 bytes/git blob/SHA-256 vs 工作树 | 0 | checked=63 mismatches=0（manifest-verify-r44b4.log；首跑脚本 sha1 漏 blob 头全部误报，修正后全符，误报为脚本 bug 非仓库状态） |
| cordis-catalog | `node --import tsx/esm scripts/gen-cordis-catalog.ts --check` | 0 | 97 generated file(s)/region(s) are up to date（cordis-catalog-check.log） |
| git diff --check | `git diff --check` | 0 | 0 字节输出（git-diff-check.log） |
| 基础 40 | `vitest run --project thread-safe owned-contexts.spec.ts + tool-subagent-control.spec.ts + tool-team.spec.ts` | 0 | 40/40（base40-final-r44b4.log。注：第一次调用 tool-team.spec.ts 路径笔误（写成 agent-team/tests/）仅匹配 2 文件 28 用例 exit 0；同日志文件被正确三文件 40/40 exit 0 复跑覆盖） |
| owner-local 三套 | `vitest run --project thread-safe teardown-ownership.spec.ts + teardown.spec.ts + continuation-teardown.spec.ts` | 0 | 33/33（owner-local-final-r44b4.log） |
| doc-sync | `pnpm run doc-sync` | 0 | 34 passed, 0 failed, 0 skipped in 201.88s（doc-sync-final-r44b4.log；首次尝试经 tsx 直调 run-gates 因 npm_execpath 缺失 exit 1，第二次 npm_execpath 指错 pnpm 34 门禁全败于 shim，第三次正确双目录 PATH 下全绿——三次日志同文件，终态为正确调用） |
| git status 对账 | Node 脚本（status-reconcile.mjs） | 0 | 32 个已修改跟踪文件全部在 63 项清单内（tracked_not_in_manifest=[]）；63 项全部对应工作树条目；未跟踪非证据非保留原件项全部为清单内新文件（note 三件/3 spec/snapshot 目录/python 快照）；`scripts/__pycache__` 已删除（status-reconcile-r44b4.log） |

## 候选冻结状态

- `candidates/candidate-r44b4.md`：63 项；文件 SHA-256 `74cc534912d901a3db249934f4936adec21c5093413b25d5aaa98a56f93bc613`；相对 candidate-r44b3.md（`b734dfc989c3a3bb25b269a45f04d6786e33f98d2f2daf9bad89d304ff575bc9`）行差异恰为新增 api-catalog.ts 一行，62 行逐字节不变。
- api-catalog.ts：472788 bytes / git blob `6ec3d307bc56660d761c2ca2ea09b6f0bbd7026d` / SHA-256 `d7b1f38279725fc5cf17787c3b8b1d47a43d0d7019cb58f22654bb025e4e6c3e`，与第二轮硬审工作树字节一致。
- HEAD/分支/远端未动：`chore/latest-stable-upgrade-20260912` @ `e8d1858ca6a65710c346007e48809580f6064beb`。
