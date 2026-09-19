# W12 组合核验记录 — 跨包共享消费者与重跑结果

运行: B01-20260919-01 / W12。日期: 2026-09-19/20（02:23–02:32 本机时段）。执行者: ZCode。
树: HEAD `89dce53b80`（工作树源码面与候选零漂移，见 candidate-manifest.md §1）。
工具: `C:\dsh-r24-upgrade-20260912-01\node-v26.8.2-win-x64\node.exe` 直连 `node_modules/vitest/vitest.mjs`；双目录 PATH 前缀；自有 TMP `C:\dsh-b01-w12\tmp`；全部 >60s 命令后台化+轮询；原始输出 `C:\dsh-b01-w12\raw\run-0*.out`（各文件尾行 `EXIT=` 为真实退出码）。

## 1. 重跑矩阵（真实数量/退出码）

| run | 面向 | 命令（展开要点） | 退出码 | 结果 |
|---|---|---|---|---|
| run-01 | W07 修改 × W06 fixture 组合（desktop） | `node node_modules/vitest/vitest.mjs run --project thread-safe apps/desktop/tests/{backend-controller,host-process,host-protocol,development-project,runtime-file-policy}.spec.ts` | **0** | **5 files / 25 tests 全过**（6.87s） |
| run-02 | W04 sidecar × W11-F fixture × W05 修改组合（expected，src 模式） | `… run --config vitest.expected.config.ts apps/cli/tests/profiles/headless/tests/{subagent-diagnostic,subagent-inheritance}.expected.e2e.ts`（DSH_EXAMPLE_MODE 未设=src） | 1 | 2 failed：均为 `did not exit within 30s. stdout:(空) stderr:(空)`（每项 ~31s） |
| run-02b | 同上复跑（排除瞬时冷缓存） | 同 run-02 | 1 | 2 failed，同签名（~31s） |
| run-02c | 串行诊断（单文件、排除并行争用） | 仅 subagent-diagnostic 文件 | 1 | 1 failed，同签名（~31s） |
| run-03 | 同 run-02，**lib 模式**（计划 §5.1 正式 assembled 载体） | 同 run-02 + `DSH_EXAMPLE_MODE=lib` | **0** | **2 files / 2 tests 全过**（每项 28.1s，总 34.78s） |
| run-04 | 共享 lane win32 两场景（snapshot 配置 + `-t` 过滤） | `… run --config vitest.snapshot.config.ts snapshots/sdk/sdk.snapshot.ts -t "replays (subagent-teardown\|agent-team-teardown) through dsh --profile sdk"` + `DSH_EXAMPLE_MODE=lib` | **0** | **2 passed \| 18 skipped**（过滤精确选中两目标场景；47.49s） |
| run-05 | 专用 teardown adapter | `… run --config vitest.snapshot.config.ts snapshots/sdk/teardown.snapshot.ts` + `DSH_EXAMPLE_MODE=lib` | **0** | **1 file / 2 tests 全过**（49.01s；r46 delivery/cancel/close/takeover 断言链 intact） |

## 2. 组合结论

1. **W07 × W06 组合绿**：run-01 在候选字节上以 W07 终态的 `runtime-file-policy.spec.ts`（native-sample fixture）+ W07 修改的 `runtime-file-policy.ts`/`project-manager.ts`/`prepare-runtime.ts` 与 W06 三个 `b01-preview-*` fixture 同树执行，五个 spec 全过——W06 fixture 依赖的产品函数未被 W07 改坏。
2. **W04 × W11-F × W05 组合绿**：run-03/04/05（lib 模式）证明 expected 双目标、共享 lane 两场景（含全部 win32 sidecar 选择与 prompt sidecar）、专用 adapter 在同一候选字节上互不冲突、全绿。过滤报告与 W05 记录的形态一致（2 selected / 18 skipped）。
3. **无组合缺陷需要返工**；run-02 系列的失败经归因（§3）为环境面，非候选字节问题。

## 3. run-02 系列失败归因（报告，不动手）

- **签名**：loader-smoke 子进程 30s 进程预算（`packages/test-support/loader-smoke/src/index.ts:28` `DEFAULT_PROCESS_TIMEOUT_MS=30_000`，execa `timeout`+SIGKILL）超时，stdout/stderr 均为空——应用未在预算内完成 src 模式启动。
- **排除候选字节因素**：① 候选 diff 零 `packages/`、零 `apps/cli/src` 改动（candidate-manifest §2.2），启动路径字节与 W11-F 实测时相同；② W11-F log 07（同一 headless 基础设施，src 模式，2026-09-19）单场景 ~8.2s 通过；③ W05 同两文件 src 模式四轮 2/2 绿（logs 06/07/14）。字节相同、行为漂移 ⇒ 环境变量。
- **归因**：src 模式 = tsx 即时转译整个工作区闭包启动；本机当前负载（并行 CI 终验观察任务 + 本会话）下启动成本超过固定 30s 子进程预算。串行（run-02c）与复跑（run-02b）均同签名，排除"两文件并行争用"与"瞬时冷缓存"单独解释；lib 模式（run-03）同字节通过（28.1s，含同负载），证实瓶颈在启动转译成本而非比较逻辑。
- **载体合规性**：formal-plan §5.1 明文"正式 assembled 验收使用 `DSH_EXAMPLE_MODE=lib`，前置共享构建必须有相同输入的有效记录"——本次 lib 前置构建有效记录 = CP-A4 "integration typecheck exit 0"（含 Host 构建，输入即候选字节）；本任务复核 `apps/cli/lib/bin.js`（2026-09-20 02:18）晚于全部 src 输入（`find … -newer` 计数 0）。故 run-03/04/05 即正式载体证据；run-02 系列保留为环境面诊断记录。
- **后续建议（交总控，不在本任务执行）**：若后续本机需在 src 模式复现 W05 形态，宜在空载时段执行；CI（lib 模式）不受影响。无需修改任何仓库字节。

## 4. 附带核验

- 复核 `DSH_SNAPSHOT` 语义：`replay`/未设等价（仅 `=== 'refresh'`/`=== 'record'` 分支不同）；本次 snapshot 运行未设该变量（replay 默认），无 golden 改写风险。
- 全部运行等待真实退出后记录 `EXIT=`；无悬挂进程（清理抽查见 open-items.md §进程残留）。
