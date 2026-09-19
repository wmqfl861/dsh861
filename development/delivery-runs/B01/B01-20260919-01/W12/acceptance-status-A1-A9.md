# W12 — B01-A1…A9 验收状态汇编（证据指针 + 判定）

运行: B01-20260919-01 / W12。日期: 2026-09-19/20。汇编自 STATUS.run.json 证据链与各包 FINDINGS/产物；判定口径 = formal-plan §5.2 必需验收表。
图例: **已证**（必需内容齐备）/ **部分**（部分内容有证据，明确缺件）/ **待证**（依赖未完成的 CI 终验或 W13）。

> 注: STATUS.run.json `mandatory_acceptance` 中 A1/A2/A7 仍为创建时值 `not_run`（总控随 CP 演进，尚未回填）；本表为按证据实编译的当前状态，供总控合并 CP-F 时同步。

## 状态表

| 验收 | 判定 | 证据指针（均已物理在档） | 缺口 |
|---|---|---|---|
| **A1** prepare 契约修复（字段/退出回归 + 真实 pinned deb 字段） | **已证** | 本地: W01/FINDINGS.md §4（48/48 exit0）+ §5（NC-A/NC-B 链闭）；CI 真实面: W03/FINDINGS.md A2-1（run 35447649954 两条 Linux 准备管线 success，逐字段 dpkg 契约在真实 pinned deb 上通过）+ A3-1（CP-A3 轮 4 处失败零出现，逐文件权威表 artifact 10587360084）；bash -n exit0（W01 run-01）；W01 rework-2.md（两形态链接证据 + 克隆去重，63+1，NC-C/D） | 无必需缺口。脚本侧首失已在 CI 实测消除 |
| **A2** Windows 替身真实执行 + CI 文件级 | **已证（含注记）** | 本机: W02/FINDINGS.md §4（run-02/07: 60 passed\|1 skipped, exit0；NC-A/NC-B 含 CI 签名复现 27\|5）；返工: W02/rework-linux.md（4 处 CI 失败根因 + 零弱化修复，Windows 64\|1 green，NC-A/B replayed）；CI: W03 CP-A2/A3 轮（static+observational regreen；coverage annotations 中 prepare-spec 失败零出现）；W11/FINDINGS.md F2（observational 绿=克隆去重兑现） | 注记: Windows coverage lane 本身仍红（G6 typert 超时，本分支既有，见 open-items）；该 lane 对 prepare-spec 无隐藏失败（artifact 10585476793 单注解） |
| **A3** 真实 Linux 构建与安全准备 | **部分** | 构建面（已证 ×3 轮）: W03/FINDINGS.md A2-1（下载/hash/审计/Meson/6+1 编译/绝对 libcap.a 链接/ELF/NEEDED/ldd/版本 0.12.0/probe/GITHUB_PATH）+ A3-2（CP-A3 复验 17s×2 exit0）；W03 linux-evidence*.md 三份 | ① 安全分项 **NOT_RUN**（脚本 `-Dtests=false`，无上游安全测试通道；普通 probe 不能替代）；② `sandbox.yml` 独立 apt 入口 **NOT_CLOSED**（保护面，本批次不迁移） |
| **A4** 共享 SDK 场景平台预期 | **部分（待 CI 终验）** | Windows（已证）: W05/FINDINGS.md F4 表（共享 lane 2/2×3、expected 2/2×3、adapter 2/2、identity 15/15、NC 闭环）；W04 轮二零变更探针 12/12×2。Linux 目标用例: W03 CP-A3 轮 A3-4（sdk snapshot 首次真实执行，两不匹配即 W04 F4.2/F4.3 输入）；Linux expected 双目标: W03 A2-4（passed）。W12 组合复验: 本目录 integration-checks.md run-03/04/05（候选树全绿） | Linux shared-auto lane 的最终证据 = CP-A4 后 CI snapshot gate（五项清单，W04 round-2 §5）——由并行 CI 终验任务承接，本任务不观察 |
| **A5** 实际 Electron 窗口与隔离任务流程 | **部分（6/7）** | W06/FINDINGS.md §A5 表（七动作逐项）+ journey.md + screenshots/（06/07 空态、09 workspace/任务、10 重开转录、11 错误页）；INCIDENT-1.md（返工三硬条件）；W06 CP1 accepted。W07 承诺补采已交付（W07/FINDINGS.md 续节: run 20-25 每 run 进程树/json/version 补采，journey-replay.md） | 动作 2 的原生目录对话框子路径**留人验**（F2: IFileOpenDialog 无法程序输入路径；bootstrap 路径已等效验证打开临时项目） |
| **A6** 产物模式 Windows 预览 | **已证（本机面）+ 安装器缺件** | W07/FINDINGS.md 续节（win-unpacked 980MB/11,747 文件、exe 246MB sha b6d76259、7 动作旅程、junction 241/241、重复启动/退出/清理、F7 受信链环境事实入 README-product）；artifact-index.md（逐文件清单+manifest hash）；W07 CP1 accepted（产物 hash 复算、截图目验） | 安装器**未构建**（NSIS 缺件且未获下载授权，F6）；签名/发布未做（按约束单列不冒称） |
| **A7** AC-01—32 盘点与 P0-B 缺件 | **已证（盘点交付；product_accepted=0 是结论不是缺口）** | W09/FINDINGS.md §1（32/32: partial 8 / reusable 8 / blocked 8 / unassessed 8）+ requirements-matrix.b01.md（附录 A E01-E69 blob 钉定）+ reuse-and-gaps.md；W09 CP1 incremental accepted（I-1/I-2/I-3 复核）；W10/p0-b-readiness.md（H1-H3/D1-D5/C1-C7 三类清单 + 集中准入请求）+ W10 CP1 accepted（保护面零漂移） | 无盘点缺口。产品验收本身依 P0-B blocked 维持未启动（正式边界） |
| **A8** 直接回归、CP1/CP2、文档与组合检查、W13 硬审 | **部分（进行中）** | 各包 CP1 见 STATUS 证据行（W01/W02/W05/W08/W09/W10/W11/W11F accepted 或 local_pass→accepted；W03 ACCEPTED；W04 本地闭环待 CI；W06/W07 accepted）；组合检查 = 本目录 integration-checks.md（run-01…05 全绿 + 归因）；integration typecheck exit0（CP-A4 证据行）；文档面 = 本任务 Note 三件套 + doc 检查（notes-plan.md 记录） | W12 CP2 结论本任务交付后由总控落定；W13 指定硬审未开始（输入就绪声明见 hard-review-prompt-draft.md） |
| **A9** CI 全貌、完整索引、阶段报告、Git/产物身份 | **部分（进行中）** | CI 全貌: W11/FINDINGS.md（7 根因组 + 67 文件归因 + G6 artifact 关闭）+ failure-ledger.md + coverage-gaps.md + pi-ai-classification.md；索引: 本目录 candidate-manifest.md（338 文件全量 + 保护面零）+ 各包 artifact-index；Git 身份: 本 manifest §1（提交链 + 工作树零源码漂移）；产物身份: W07 artifact-index | CP-A4 后 CI 终验（A4-linux/W11-F/snapshot 五项）由并行任务观察；W13 阶段报告未生成 |

## 阶段结论建议（供总控 CP2/CP-F）

按 formal-plan §5.2 判据：A1/A2/A6/A7 已证；A3/A4/A5 部分且缺件精确（安全分项、CI 终验、人验子路径、安装器）；A8/A9 随 CP2/CP3/CI 终验收口。当前形态指向 **PARTIAL_WITH_BLOCKERS**（外部条件缺件 + CI 终验未落），非 REWORK（本阶段无未修复的正确性缺陷；本任务组合核验全绿）。
