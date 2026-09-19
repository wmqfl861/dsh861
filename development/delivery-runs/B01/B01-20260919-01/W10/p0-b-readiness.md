# W10：P0-B 准入缺件与后继输入整理（集中准入请求）

任务：B01-20260919-01 / W10。执行者：产品分析者（只读）。本目录为本任务独占产物。

本任务对照 P0-B `state.json`（blob `4fa1dd1a…`，本轮在 HEAD 复核未变）、`plan.v3.md`、修订请求 r01/r02、规划启动申请 r01、Windows elevated 申请 r01 与本地已有非秘密授权/验证记录，将 P0-B 相关条件分为三类：历史阻断（已过时/已解除）、当前已解决的开发工具条件、仍缺的产品接入条件。**没有变化不重复 auth list、help、收费试问或密钥探测**——本任务只引用仓库内既有证据，未发起任何探测。本次 B01 规划调用不能反向更新 P0-B 产品状态，也不能证明旧 state 中各项条件已经解决；任何"已解除"仅指该历史阻断事件被更晚的仓库内记录取代，不构成产品验收。

## 0. 输入核验

| 项目 | 值 |
|---|---|
| 工作目录 / 分支 | `C:\Albert\project\dsh861` / `chore/latest-stable-upgrade-20260912` |
| 本任务读取时 HEAD | `6528141bc9f435f8a2361f4a0c56eb9393092c02`（W09 盘点基线 `f5ab2fed` + 后续采纳提交） |
| formal-plan §6 受保护输入复核 | `plan.v3.md`=`2d6f8e6a…`、`plan-revision-request.r02.md`=`4d559ba2…`、`acceptance-map.r01.json`=`cb1f0a8d…`、`NODE_STATUS.md`=`475447e5…`、`CURRENT_NODE.json`=`a36d6625…`、`P0-B/state.json`=`4fa1dd1a…`、`MULTI_AGENT_REQUIREMENTS.md`=`3c1b0229…`、`MULTI_AGENT_DEVELOPMENT_ROADMAP.md`=`a2e61dc1…`——全部与 formal-plan.v1 §6 登记一致，B01 期间未漂移 |
| W09 输入（已 accepted 冻结） | `../W09/requirements-matrix.b01.md`（32 行矩阵 + 附录 A E01–E69）、`../W09/reuse-and-gaps.md`（R1–R16 / G1–G14）、`../W09/FINDINGS.md`、`../W09/00-start.md` |

只读范围：仓库源码、git 对象、`development/` 历史证据与 delivery-runs 记录。未读取密钥/`.env`/auth.json/全局认证，未调用任何模型，未修改任何产品源码、正式节点状态或 W09 冻结产物。

## 1. 三类条件清单

### 1.A 历史阻断（已过时/已解除——被更晚的仓库内记录取代）

| # | 历史阻断事件（原始记录） | 解除证据（更晚记录） | 残余注意 |
|---|---|---|---|
| H1 | "OpenCode 硬审 CLI 在本机无认证"：r44 首轮探测（2026-09-17）`auth list` 0 credentials、`models zhipuai-coding-plan` 报 Provider not found（1.18.26），指定硬审本轮 BLOCKED，且明令禁止自行创建凭据解除 | r44-B 一次性就绪核验（2026-09-17）：owner 会话告知"认证已就绪"后，`auth list` → 1 credentials（Zhipu AI Coding Plan api）、`models zhipuai-coding-plan` exit 0 且含 `glm-5.3`（`remediation/2026-09-17/production-teardown-r44/windows-execution/02-readiness-verification.md`，原始件仓库外带哈希）。随后真实硬审完成：第三轮 PASS（`review/r44b-hard-review-round3.md`）、第四轮合规硬审 PASS（`review/r44b-hard-review-round4.md`）、r44b5 独立审计无条件 PASS、owner S3 追认（`review/owner-s3-ratification-r44b5.md`，manifest `077ea3d4…`）——真实远程调用本身即 D4 边界（"元数据可见≠真实调用"）的闭合证据 | 本任务不再重复认证探测；下一次硬审以实际调用 + invocation 归档复验。第三轮 argv 缺 `--variant` 的 PARAMETERS_NONCONFORMING 仅对该历史运行成立（见 D3） |
| H2 | "指定规划 Codex 程序不可达"：precheck r01 记录历史治理机 D 盘消失，历史二进制与 `D:\Temp_projects\*` 原始 run 根不可达（`evidence/planner-precheck.r01.json` historical_program_unreachable） | r44 探测（2026-09-17）：本机用户全局 codex 0.153.4 可用，且按节点规则精确参数（`--model gpt-6-astra`、`model_reasoning_effort="max"`、read-only）实测 exit 0 `CODEX_PROBE_OK`（`remediation/2026-09-17/production-teardown-r44/planning/cli-availability-probe.md`）；precheck r01 另选定仓库钉版 0.149.1（sha256 `a395030b…`）为指定规划程序并复验摘要 | 仓库内历史回执仍是有效记录，未被改写；两程序并存，指定调用用钉版 0.149.1 |
| H3 | r02 待核验项"本地执行端报告 17 处修复完成但代码与原始回执尚未推送，转述摘要不能代替补丁审查"（`plan-revision-request.r02.md` §必须先取得的可核验材料） | r06（2026-09-10）：17 处修复保全、集成提交 `7dbf9879`、专用分支发布、导出/清点 ZIP 与 manifest（`remediation/2026-09-10/windows-keyless-r06/verification.json`），并经 PR #5 远端集成评审（非指定硬审，`remote-review.json`：基线缺陷复现、全部断言通过、明示无产品验收）；`state.json` 记 `integrated_validation_commit: 2a62e488…`。后续推送链闭合：r48 交付推送 `7f63d035`（两端 HEAD 核验一致，非强推） | r06 远端评审自标 `not-designated-hard-review`；它解除的是"未推送/未审"历史事实，不是 P0-B 产品验收 |

不列入本类的项：`state.json` blocker 原文三项缺件（凭据绑定/轮换确认/传输保护）至今无解除记录，属 §1.C；P0-B 四角色 harness 验收阻塞属 plan.v3 AC 映射，同样在 §1.C。

### 1.B 当前已解决的开发工具条件（有非秘密证据；开发工具使用 ≠ 产品验收）

| # | 条件 | 证据 | 授权依据 | 边界 |
|---|---|---|---|---|
| D1 | 指定规划者 CLI 可用且指定参数可运行 | r44 探测：codex 0.153.4 exit 0（H2）；钉版 0.149.1 摘要 `a395030b…` 于 2026-09-11 复验（`planner-launch-request.r01.md` §钉版程序） | NODE_DEVELOPMENT_RULES §2：既有 CLI 调用属开发工具使用 | 真实调用前须再复验摘要；二进制变化才重跑 precheck 探针 |
| D2 | 钉版 Codex 配置层兼容已证：`my-gpt`/`gpt-6-astra`/`max` 精确拼写被 0.149.1 接受为有效启动值 | precheck r01 `config_layer_probe_exact_approved_spelling`（banner 证据 + loopback + bogus 对照，输出件带哈希） | precheck r01 `reusable_for_next_round` 明示可复用 | 对照探针证明 CLI 不做本地枚举校验：banner 只证配置层接受，网关 wire 层接受 `max` 仍未验证——归 C1 真实调用时闭合 |
| D3 | 指定硬审 OpenCode CLI 可用：1.18.31 实际二进制（sha256 `0242a0dc…`）、认证 1 条（Zhipu AI Coding Plan api）、`glm-5.3` 在列、`run --variant` 旗标存在 | r44-B 就绪核验（H1）；r44b5 CLI 能力探针（`windows-execution/41-r44b5-cli-variant-probe.md`：`--variant  model variant … [string]`，二进制早于第三轮调用未被替换）；真实调用证据 = 三/四轮硬审 stdout 归档 | r44-B 任务授权链（PR #13 评论 5706434230 + 授权评论 D1–D8）+ owner"认证已就绪"会话告知 | 按任务约束本轮不重复 auth list/help；r44b5 明示探针不回溯追认第三轮历史 argv |
| D4 | 本机工具链与门禁调用方式固化 | Node 26.8.2 + pnpm 12.4.1 双目录 PATH 前缀；vitest 直连 `node_modules/vitest/vitest.mjs`（r45 发现 A）；doc-sync 正确调用 = 双目录 PATH 下 `pnpm run doc-sync`（r44b4 34/34） | `RUN_CONTEXT.json` toolchain + formal-plan §1.2 | 系统 pnpm shim 仍坏（r45 结论沿用），不修复 |
| D5 | 受保护面变更的 owner 评论授权通道有效且有先例 | r48 任务私有 bubblewrap 0.12.0 私有构建：owner 双评论授权（PR #13 评论 5740293063 / 5740288027），交付推送 `7f63d035`、独立复审无条件 PASS（`remediation/2026-09-19/private-bubblewrap-build-r48/comment-draft.md`）；r47 源获取授权在案 | 上述 owner 评论（明确、具体、先行） | r48 范围仅其两文件 + Note 三件套 + 证据树；不外溢为对其他受保护面的空白授权 |

### 1.C 仍缺的产品接入条件（P0-B 真实后继规划与验收的剩余缺件）

以下 C1–C6 为 owner 级准入缺件（`state.json` blocker 三项 + 规划启动申请缺项表展开），C7 为其解除后的 P0-B 实施验收链。逐条给出负责者、需要的准确输入、授权状态、能继续的任务、最终验证方法——即第 2 节集中准入请求的正文。

| # | 缺件 | 负责者 | 需要的准确输入 | 已有有效授权？ | 能继续的任务 | 最终验证方法 |
|---|---|---|---|---|---|---|
| C1 | 授权绑定的凭据引用（`CREDENTIAL_NOT_BOUND`） | owner（提供与授权）＋实施端（接线已有） | 轮换后的新 Codex Key 由 owner 本人经 `manage.ps1 -Action Set -Provider codex` 的 `Read-Host -AsSecureString` 双提示录入仓库外受保护存储 `dsh861/providers/codex`，并授予单次调用绑定（`env:<NAME>` 或 `secret-reference:providers/codex`）；值仅在授权调用时一次性租借注入进程环境，不进配置/argv/Git/聊天 | 否（precheck r01 MISSING；本轮复核仓库内仍无更新记录，`state.json` blocker 第 1 项仍有效） | 无——未解除前真实规划调用停在请求阶段；**不阻塞 B01 底座任务**（W06/W08 等按 WORK_PACKAGES W10 卡继续） | 经 `planner-entry.ts` 的 `invokeProjectedPlannerOnce` 完成一次真实调用并保存 `PROJECTED_PLANNER_COMPLETED` 回执（脱敏双流 + 哈希）；凭据值不出现在 argv/文件/日志/Session/evidence（redaction 负向测试在案） |
| C2 | 旧 Key 轮换确认（`ROTATION_UNCONFIRMED`；`credential_rotation_status: UNKNOWN_NOT_VERIFIED`） | owner | 服务商侧撤销聊天中暴露的旧网关 Key ＋签发替代 Key ＋owner 明示"撤销＋替换"确认，使状态脱离 UNKNOWN_NOT_VERIFIED | 否（`remediation/2026-09-09/model-config-r03/verification.json`：rotation REQUIRED_NOT_VERIFIED；全仓无更新记录） | 无（与 C1 绑定；`product_calls_using_exposed_credentials_allowed: false` 维持） | owner 确认记录落档后，实施端把轮换事实记入状态作为调用前置证据；不以读取任何凭据"核实" |
| C3 | 明文 HTTP 批准路线的传输保护（`TRANSPORT_PROTECTION_UNPROVEN`） | owner | 二选一：(a) 提供并批准实际可用的 HTTPS base URL，经 owner 授权的 `models.v1` 新配置版本（含锁文件）落档；(b) 对本次单次调用明示接受并授权现行 `http://154.89.153.24:8080/v1`。投影层已强制 `https:`（`CODEX_LAUNCH_PROJECTION_REFUSED`），书面接受风险不等于传输保护 | 否（`config/agents/models.v1.json`（`2026-09-09.1`）仍为明文 HTTP；README 明示凭据传输保护未验证、禁止在无保护公网连接上送 key） | 无 | 授权调用时以真实响应核验证书/路由行为（申请 r01 技术栏既定口径）；不预跑 TLS 探针 |
| C4 | 费用与时限边界（金额强制完全缺失） | owner（数值与强制点）＋实施端（接线） | 本次单次调用的费用上限（数值与币种）、有效期、wall-clock 时限（`deadlineMs`/`terminationGraceMs`/`maxChannelBytes` 具体数值）及实施该上限的服务商侧或受控执行点 | 部分（时间/字节边界机制已实现并经 r09 加固、r15-win 复验；金额强制与全部数值未授权——r15-win `notRun` 明列 monetary-budget enforcement） | 无（属 `requiredBeforeCredentialRead` 前置） | 授权调用回执带边界执行记录；金额强制点落实并有测试 |
| C5 | 批准记录的 owner 绑定签署（`verified-owner-approval` 仅非空＋subject 匹配） | owner＋实施端 | 对规划启动申请 r01 固定输入集（源码提交 `227e5597` 起算的读取清单、钉版程序、实际入口与边界）的明确批准，并给出 `approval.record` 与 `transportEvidenceRecord` 两条记录对应的真实决定内容 | 否（申请 r01 `approved=false`、`executionAuthorized=false`，至今无后续批准记录） | 无 | 入口校验批准引用与记录一致、失配即拒的既有测试路径 ＋ 可核验的批准记录机制（签署/版本化记录） |
| C6 | OS 级只读与配置发现隔离（`native-config-and-read-only-enforcement` / `scope-and-config-discovery-isolation`） | owner（系统影响批准）＋实施端（最小接线） | 对 `windows-elevated-setup-request.r01.md` 影响清单（本机身份/沙箱秘密目录/文件设备权限/防火墙与 WFP 过滤/最小提权/遥测）的精确批准；r21 原生 BLOCKED 仍有效，重复原测试不能补齐 | 否（申请 `approved=false`；`windows-elevated-inventory.r01.json`（r22）为已完成的**只读清点**，`systemChangesAuthorized=false`；钉版 0.149.1 摘要本轮清点中已复验、未执行） | 只读清点（已完成并落档）；其余无 | 获准输入可读、目录外父子读取被拒、写入被拒、宿主字节/作业清理证据（合成复验要求，申请"批准之后"节既定） |
| C7 | P0-B 实施与验收链本体（owner 级缺件之外的全部 plan.v3 阻塞） | 指定真实 Codex（plan.v4 规划）→ ZCode（实施）→ 指定真实 OpenCode（硬审） | C1–C6 解除后：指定 Codex 产出 plan.v4（纳入 r01/r02 收敛要求与 acceptance-map 修正）；实施四角色隔离 harness（Codex/Claude Code/Product OpenCode/Grok 的 allow/deny/cancel/handoff native 证据）；冻结"部分验证＋部分阻塞"候选；指定 OpenCode 独立硬审 PASS。含 r01 边界：nativeResume 与 artifactHandoff 分列、无原生接口时如实报不支持 | 否（P0-B `blocked`、`next_node_allowed: false`；`product_acceptance_completed: []`；B01 边界"不启动 P0-C"（E69）） | 无（不在 B01 内实施）；运行时 stderr 全捕获仍 PENDING（`security_implementation: PARTIAL_CODEX_STDERR_PRIVACY_WIRED_FULL_CAPTURE_PENDING`）等实现项随 plan.v4 排程 | plan.v3 §候选、清理和硬审核准入的全部条件 ＋ r01 §节点边界和准入：真实 Codex 后继计划、实际完成证据、固定候选、指定 OpenCode PASS，四者齐备才解除 P0-C 准入 |

**P0-B 之后的产品接入条件不重复展开**：OpenCode/Grok 适配器、受管 PostgreSQL、GBrain 集成、三端管线、备份恢复环境、性能任务集等已在 W09 `reuse-and-gaps.md` G1–G14 逐条登记（负责者/准确输入/授权状态/可继续任务/验证方法五列齐全），本报告直接引用，不复制不改写。

## 2. 集中准入请求（全文即本文件）

对 owner 的请求浓缩为一张最小清单（全部为 owner 级输入；任何一项未满足时真实调用停在请求阶段，P0-B 保持 `blocked`）：

1. **凭据**（C1+C2）：撤销并替换聊天暴露的旧网关 Key；新 Key 经 SecureString 录入 `dsh861/providers/codex`；授予单次调用绑定。
2. **路由**（C3）：HTTPS base URL ＋ 新 `models.v1` 授权版本，或对该次调用明示授权现行 HTTP 路线。
3. **额度**（C4）：费用上限（数值/币种）、有效期、`deadlineMs`/`terminationGraceMs`/`maxChannelBytes` 数值与金额强制点。
4. **签署**（C5）：批准规划启动申请 r01 的固定输入集，给出 `approval.record`/`transportEvidenceRecord` 真实决定内容。
5. **系统影响**（C6）：Windows elevated 沙箱影响清单的精确批准（或继续维持不用 OS 级沙箱的现状并接受相应差距标注）。

1–5 齐备 → 指定 Codex 单次真实规划（plan.v4）→ 实施与候选 → 指定 OpenCode 硬审 PASS → P0-B 解锁评审。此链在 B01 内不启动。

## 3. P0-C 及后继的路线输入（引用，不预排）

- 蓝图 §4 交付阶梯：`development/delivery-plan/PRODUCT_BLUEPRINT.md` M1b/P0-C 行——"P0-B 放行后才激活；没有数据库环境不能写成完成"；蓝图明示后继行是架构与路线，B01 结束可集中提交一次准入报告（即本文件），实际下一节点由规定的真实 Codex 在前置通过后制定。
- 范围收敛输入：`plan-revision-request.r01.md`（acceptance-map 修正、nativeResume/artifactHandoff 分列、有限必需项/可选项/后续项）、`plan-revision-request.r02.md`（Windows 复验材料核验、网页控制台新增要求的适配器缺口表达边界）、`development/requirements/WEB_CONTROL_CONSOLE_SUPPLEMENT.v1.md`。
- 数据库/GBrain/三端/恢复/性能的缺件与验证方法：W09 `reuse-and-gaps.md` G4/G5/G10/G12/G13。
- 本报告不为未放行节点生成详细实施计划。

## 4. 附属修正建议清单（只建议，不改）

W09 FINDINGS §5 记录的两条仓库事实，本轮在 HEAD `6528141b` 复核仍然成立：

| # | 事实 | 复核证据 | 建议（交总控登记后由文档责任者处理，本任务不动） |
|---|---|---|---|
| S1 | 根 `AGENTS.md` 布局表列有 `packages/self-modification/`，仓库无此目录 | `AGENTS.md` 第 46 行 `self-modification/  the agent inspects/mounts its own plugins`；`git ls-files packages/self-modification` 零命中 | 布局表删该行或目录补建，二选一后过 `doc-sync` |
| S2 | `subagent-codex` README 与实际 pin 漂移 | `packages/subagent/subagent-codex/README.md` L177"verified 0.153.4 protocol baseline"、L193"pinned to `@openai/codex@0.153.4`" vs `package.json` L47 `"@openai/codex": "0.154.0"`（W09 E06） | README 与 pin 对齐；因 README 声称的升级验证证据（handshake/answer-selection/nonce 等测试）是否覆盖 0.154.0 未在案，修正文字须与 P0-B 复核该证据覆盖度一并进行，不单独改字 |

## 5. W09 复审 R-1 的处置说明

R-1（非阻断）：AC-17 行"下一所属阶段"列简写"P0-C 冻结"与 AC-16 行完整归因（"P0-C 未实例化/未进入"，附 `next_node_allowed=false`（E68）＋PHASE_B01"不启动P0-C"（E69）依据）措辞不统一。处置：**本任务不修改 W09 产物**——W09 已 CP1 accepted 冻结，按本任务指令默认只记录；如需更正须由总控登记 erratum 后进行，建议统一措辞为"P0-C 未放行（P0-B `next_node_allowed=false`，E68；PHASE_B01'不启动 P0-C'，E69）"。两行 blocker 依据相同（E68/E69），纯措辞差异，无语义分歧，不改变任何行状态或后续判定。

## 6. 本次未做（边界）

未运行 auth list/help/收费试问/密钥或全局配置探测；未读密钥/`.env`/auth.json；未调用任何模型；未写产品源码；未更新 `NODE_STATUS.md`/`state.json`/生成状态；未解锁 P0-C；未修改 W09 冻结产物与 §4 建议对象；未生成 P0-C 实施计划。所有命令只读（git 元数据与文件读取），单次 ≤60 秒。
