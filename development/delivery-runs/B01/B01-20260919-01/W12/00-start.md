# W12 00-start — 组合候选核验与最终冻结准备

运行: B01-20260919-01 / W12。执行者: ZCode（本任务派发身份）。日期: 2026-09-19。
分支 `chore/latest-stable-upgrade-20260912`。

## 起始身份（实测）

| 项 | 值 |
|---|---|
| HEAD | `89dce53b805241d9ec38f8c8ea7bde1109dac4b4`（CP-A4 提交，与 STATUS 一致） |
| 工作树 vs HEAD | 仅 2 个已跟踪修改（`STATUS.run.json`、r48 `comment-draft.md`）+ 4 个未跟踪 remediation 项；**无任何产品/测试源码偏离候选**（manifest 步骤复核） |
| 源码基线 | `7f63d03538759306f8363d5a912c1e99fbe015bf`（r48，与 formal-plan §1.1 一致） |
| Node / pnpm | `C:\dsh-r24-upgrade-20260912-01\node-v26.8.2-win-x64\node.exe` / `C:\dsh-r24-upgrade-20260912-01\pnpm-12.4.1\pnpm.exe`（实测存在；双目录 PATH 前缀） |
| 自有 TMP | `C:\dsh-b01-w12\tmp\`（本任务独占） |
| 原始输出 | `C:\dsh-b01-w12\raw\`（run-01 起编号）；本目录 `logs/` 为索引与摘录 |

## 任务范围（派发词固定）

1. 组合候选核验（对 89dce53b80 的树，不重跑未变单包矩阵）：
   - W06 五个 desktop spec 一遍（W07 prepare-runtime/runtime-file-policy/project-manager 与 W06 三 fixture 同提交的组合检查）；直连 vitest + 自有 TMP。
   - W04 sidecar × W11-F fixture 同提交组合：expected 双目标用例、共享 lane win32 两场景、adapter（teardown.snapshot.ts）各一遍。
2. 候选 manifest：`git diff --name-status 7f63d035..89dce53b80` 全量差异清单，按工作包归属 + 保护面核验（应为零）。
3. A1—A7（及 A8/A9 现状）逐项状态汇编。
4. 未关闭项清单。
5. 本阶段自有进程残留抽查（electron/node；`C:\dsh-b01-*` 保留为证据 raw，不删）。
6. 三组双语 Agent Note（formal-plan §3.7 预登记 NEW 路径）+ 具名配对 + doc 检查。
7. W13 硬审输入准备（提示词草稿）。

## 约束（派发词固定）

只读 + 上述指定重跑 + 写 Note/产物；不改产品/测试源码；不提交不推送；vitest 直连 + 自有 TMP；工具链 PATH 前缀；防超时后台+轮询；不读密钥。CI 终验观察由并行任务承接，本任务不做 CI 观察。

## 产物清单（本目录）

`integration-checks.md`、`candidate-manifest.md`、`acceptance-status-A1-A9.md`、`open-items.md`、`notes-plan.md`、`hard-review-prompt-draft.md`。
