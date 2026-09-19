# W12 未关闭项清单 — 逐项含后续责任归属建议

运行: B01-20260919-01 / W12。日期: 2026-09-19/20。汇编口径: formal-plan §5.2/§6 与各包精确阻塞记录；不含已由本阶段关闭的项。

## 1. 验收面缺件

| # | 项 | 精确内容 | 证据指针 | 后续责任归属建议 |
|---|---|---|---|---|
| U1 | A3 安全分项 NOT_RUN | prepare 脚本 `-Dtests=false`：上游 bubblewrap 0.12.0 安全回归未执行；普通 `true` 功能 probe 不能替代（D13）。无既有获准 Linux 通道可跑固定源码的有限上游测试 | W03/FINDINGS.md F9、A2-6、A3-2；formal-plan §2 W03 安全证据限制 | owner：裁决是否授权建立上游测试通道（或接受风险标注）。工程面无可独立推进项 |
| U2 | A5 原生对话框人验 | "添加工作区"唯一路径是 Win32 IFileOpenDialog；UIA 全手段（ValuePattern/SetFocus/ClickablePoint/RawViewWalker/Ctrl+L/SendKeys）无法程序输入路径。动作 2 已由 bootstrap 路径等效验证，原生子路径留人验 | W06/FINDINGS.md F2 + logs/07/08-dialog-tree.txt | owner 人工验证一次（持有产物者可复现：W07 产物模式同界面）；或后继阶段投入专用 UIA 驱动 |
| U3 | A6 安装器未构建 | NSIS 系统与 electron-builder 用户缓存均缺（`%LOCALAPPDATA%\electron-builder\Cache` 不存在）；按约束未获下载授权。可运行目录不受影响 | W07/FINDINGS.md F6；artifact-index.md 状态分列 | owner：授权 electron-builder 自行下载 NSIS 到用户缓存后，由 Desktop 实施者补一次 `--unsigned`（非 `--dir`）安装包构建与记录 |
| U4 | sandbox.yml NOT_CLOSED | `.github/workflows/sandbox.yml:87` 仍为独立 `sudo apt-get install -yq bubblewrap` 入口；本批次明确不迁移（保护面） | candidate-manifest §3.1（blob `cdcb229a…` 复核不变）；W11/FINDINGS SANDBOX-OTHER-ENTRY | 后继独立 remediation（比照 r48 的 owner 双评论授权模式），不在 B01 内 |
| U5 | W11-F CI 终验待定 | pi-ai 修复（fixture 1000→20000ms + r29 款守护）的最终判据 = CP-A4 头上 CI `test:expected` 复绿 → fail-fast 解除 → `test:snapshot` 实际执行（同时是 W04 F4.2/F4.3 Linux 证据链与五项清单的解锁前提） | W11F/FINDINGS.md F5；W04/round-2.md §5 | 并行 CI 终验任务（本任务不做 CI 观察）；结果归 CP-F/A4 收口 |
| U6 | W07 O1-O3 证据完备性缺口 | W07 CP1 记录的 O1-O7 观察中，O1-O3 为证据完备性缺口（非阻断；不影响 A6 判定，CP1 维持 accepted） | STATUS.run.json 证据行（W07 CP1）；W07 CP1 评审记录 | 按 CP1 结论随阶段报告披露即可；如需补采，归 W07 实施者在产物仍存续期间（`C:\dsh-b01-w07\product\`）执行 |

## 2. G 群既有失败台账（本分支既有/环境敏感；不降阈值、不扩 exclude、不无界修复）

| # | 项 | 分类 | 证据指针 | 责任归属建议 |
|---|---|---|---|---|
| G-a | `packages/terminal/terminal-bash/tests/local.spec.ts:333`（created.motd 空、未含 `dsh> `；hold:false 变体失败） | 本分支既有·断言失败（pwsh-on-Linux 时序敏感） | W11/FINDINGS.md F3；failure-ledger.md | 后继 terminal 维护者 |
| G-b | `packages/experimental/code-runtime-python/tests/runtime.spec.ts:5158`（60s wall-clock 超时，4-CPU 满载分区并发） | 上游环境·本分支既有敏感性 | 同上 | 后继 code-runtime 维护者（预算或并发再标定） |
| G-c | `packages/typert/generator/tests/tools-catalog.spec.ts`（30s per-test 预算 × 慢 Windows runner；G6 已用 artifact 10585476793 关闭定性：单注解、无隐藏失败、coverage gate 被 fail-fast 连坐） | 本分支既有·环境敏感（pre-B01 钉死预算） | W11/FINDINGS.md F3/N1/N4 | 后继 typert 维护者 |
| G-d | coverage 67 文件短缺（60 client UI 嵌套文件：豁免 glob 单层未覆盖子目录 + ui-tool/ui-layout 无豁免；7 core/experimental 文件：r44 teardown/continuation 未覆盖行） | 本分支既有·结构性 GUI 债 | W11/coverage-gaps.md | owner 裁决豁免 glob 修正或补测路线；不在 B01 内动阈值 |
| G-e | pi-ai 幻影请求家族（STREAM_IDLE_TIMEOUT 重试；本分支既有、环境敏感；B01 已交付最小解锁修复待 U5 终验） | 本分支既有·环境敏感 | W11/pi-ai-classification.md（5 重证据链）；W11F/FINDINGS.md | U5 终验后关闭；如更深饥饿再现，失败形态响亮（守护断言保证不静默回退） |
| G-f | issue-lifecycle / issue-policy / build-preview-cloudflare 三个旁路 workflow（run 40 为 failure；run 41+ 状态本轮无证据） | 非 B01 范围 | W03/FINDINGS.md F11；W11/FINDINGS.md F2 | 总控按需取对应 run 作业归类；不计入本台账必需项 |
| G-g | Windows coverage lane 红（typert G-c 单点；非 B01 引入） | 本分支既有 | W11/FINDINGS.md F2/F3 | 同 G-c |

## 3. 状态簿记与环境注记（非缺陷）

| # | 项 | 内容 | 处置建议 |
|---|---|---|---|
| B1 | STATUS.run.json `mandatory_acceptance` 值滞后 | A1/A2/A7 仍为创建时 `not_run`，与本表（及各包 accepted 证据）不一致 | 总控在 CP-F 合并本目录 acceptance-status-A1-A9.md 时同步回填 |
| B2 | formal-plan §3.6 P0-B state.json 指纹转写勘误 | 计划表指纹第 24 位 `b` 应为 `f`（实际 blob `4fa1dd1a…83fe4c9…`，基线=候选三读一致，文件未动） | 总控知悉即可；保护属性不受影响 |
| B3 | 本机 src 模式 expected 启动超预算 | 固定 30s 子进程预算下，负载中的本机 tsx 启动超时（run-02 系列）；lib 模式（正式载体）全绿 | 环境注记；无需仓库变更。见 integration-checks.md §3 |
| B4 | P0-B 维持 blocked | C1-C6 owner 级准入缺件未解除；B01 不改正式节点状态 | W10 集中准入请求待 owner 处置 |

## 4. 清理核验（派发任务 4）

- **进程残留抽查（实测，2026-09-20 02:3x）**：`Get-Process electron,node` 与 `tasklist | grep -i electron/node` 双视图均 **0 命中**——本阶段（W01—W12）自有进程/servers/gates 无 electron/node 挂起。
- `C:\dsh-b01-*\` 17 个工作树外临时目录**全部保留为证据 raw**（含 `C:\dsh-b01-w07\product\win-unpacked\` 产物），按派发不删除。
- 本任务自有 TMP `C:\dsh-b01-w12\tmp` 中无存活句柄（全部 vitest 运行已记录真实 `EXIT=` 后结束）。
