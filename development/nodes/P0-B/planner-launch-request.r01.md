# P0-B 单次真实 Codex 规划启动申请 r01（未批准，未授权）

日期：2026-09-11。记录者：ZCode 内置执行子代理（builtin:bigmodel-coding-plan/GLM-5.3）；不是指定 Codex 规划者，不是 OpenCode 硬审核者。本文件是脱敏的单次规划启动申请与缺项表：`approved=false`、`executionAuthorized=false`。准备过程中未读取、未写入、未枚举生产凭据，未读全局认证，未探测网关或 TLS，未调用任何收费模型，未生成 plan.v4，未提前 OpenCode 硬审核，未修改 P0-B 通过状态或任何受保护文件。本申请不签发任何运行授权；任一前置条件未满足时，真实调用停在请求阶段。

依据：[节点规则](../../../NODE_DEVELOPMENT_RULES.md)第 1、2 节与[交接](../../handoffs/WINDOWS_KEYLESS_INTEGRATION.2026-09-10.md)“下一目标：真实 P0-B 后继规划”一节。本文件与 `plan-revision-request.r01/r02.md` 不同类：那两份是给规划器的输入；本文件是给所有者的启动申请与缺项清单。仓库内不存在同一输入的既有等价申请（全仓检索无 `executionAuthorized`/启动申请类记录），故新立本文件，不构成新测试轮。

## 固定输入

源码提交固定为 `227e5597bf85419a6e60bd61e5e9f83025828c56`（`feat/multi-agent-company-nodes` 尖端；PR #7 合并提交 `ff0ca468c3a70b90b855bb079306db56fe88e671` 已核实为其祖先，且与接收提交 `a136d799ace828d57addb70839043a09103be5a8` 同树）。本地同步方式为显式 fetch 快进，无 stash、无强制覆盖、无重装环境、未向已关闭的 PR #7 追加任何提交。

规划器读取范围固定为下列仓库文件（sha256 于 227e559 处核得）：

| 文件 | sha256 |
|---|---|
| MULTI_AGENT_REQUIREMENTS.md | 53a87e7f15b1cee8e42960e1ed32252950cb4ae76e2b4fb1605c316b784fe5f3 |
| MULTI_AGENT_DEVELOPMENT_ROADMAP.md | 88ad49bde81a3c40f773e287b8cdf75b186a90824b17624a2742464e05c4f0bf |
| development/nodes/P0-B/plan-revision-request.r01.md | 536a1dece5e45081eca53cee789b5b39fc4bf0cc6a6cf6f58bea94d98620515a |
| development/nodes/P0-B/plan-revision-request.r02.md | bc42836f7e6730acd401207cf52d1e6926f82e0c12d38946325a91ced9a8b107 |
| development/nodes/P0-B/acceptance-map.r01.json | d9fe19557bf7efe2ed1c67b5c2e77b590ef3a0655e9270cf8292cbb2d674cb28 |
| development/requirements/WEB_CONTROL_CONSOLE_SUPPLEMENT.v1.md | 72d6cf712894475e326f38c6d861773e25b1eb90dd7d25ef210bd07e72540a34 |
| development/nodes/P0-B/plan.v3.md（被修订对象） | edf442efff475a336cb36071e5b76dee44b3f6e8f61f7dc21ed4e7055b795ffe |

提示词本体本轮不写、不散列：按调用包装的既有顺序，提示词文件与可执行程序哈希在读取任何凭据之前固定并快照；授权到位后，以 r01/r02 收敛要求、验收映射与主规格为内容基础落成单一提示词文件，记录其 sha256 后才进入凭据租借。提示词要求产出 plan.v4，满足节点规则第 4 节最低内容；本地代理不得自署名代写。

## 钉版程序与辅助脚本

规划程序沿用 [precheck r01](evidence/planner-precheck.r01.json) 选定的仓库钉版二进制：`node_modules/.pnpm/@openai+codex@0.149.1-win32-x64/node_modules/@openai/codex/vendor/x86_64-pc-windows-msvc/bin/codex.exe`，版本 0.149.1，sha256 `a395030b56b126f608f2403036dddb654a9c063213e9c2b5f85d954cf490ebe6`，297481008 字节；由 `packages/subagent/subagent-codex/package.json` 声明与 pnpm-lock.yaml（sha256 `2c903ab870f821ee2db62fa9417d11b1c2b9c65fbeec30e851ddc53c4cc8c383`）钉版。该摘要已于 2026-09-11 在本机只读复验一致（记录于 `C:\Albert\project\dsh861-local-validation\20260911-planner-launch-request-91d4\codex-binary-digest.txt`）；真实调用前须再次复验，二进制或摘要变化时才重跑 precheck 探针。配置层兼容证据（`my-gpt` / `gpt-6-astra` / `max` 精确拼写被 0.149.1 接受为有效启动值）沿用 r01，不重跑。

调用参数固定为节点规则第 2 节形式：`--model gpt-6-astra` 与 `model_reasoning_effort="max"`，不换模型、不换 provider、不降思考等级。凭据引用保持 `secret-reference:providers/codex`（Windows 目标 `dsh861/providers/codex`），配置中只出现凭据变量名 `DSH861_CODEX_API_KEY`，值仅在授权调用时经一次性租借注入进程环境，不进配置、argv、Git 或聊天。

辅助脚本身份（git blob，227e559 处核得）：`planner-entry.ts` ef3b3339、`planner-invocation.ts` 962eb4d9、`codex-launch-projection.mjs` 93084fae、`windows-job-owner.ts` abced441、`job-owner.ps1` cdfe0a6d、`launch-gate.mjs` 4893121d、`reader.ts` f4a885d1、`bridge.ps1` 83fb78a3、`native-credential.cs` ca792eee、`manage.ps1` 0eb02265、`../credential-ref.ts` 0a599a19、`../redaction.ts` 655221ae。`planner-entry.ts` 为 r15 lint 修复后的最终版本，与 [r15 Windows 回执](../../remediation/2026-09-11/entry-gate-r15-win/verification.json)记录一致。

## 实际门控入口、CODEX_HOME、输出保护与取消

实际入口是 `scripts/p0-b/windows-credentials/planner-entry.ts` 的 `invokeProjectedPlannerOnce`，不另建运行器。链路：`projectCodexLaunch` 依批准路由与锁（`publicConfigSha256`）投影 argv/TOML/环境（`CODEX_LAUNCH_PROJECTED_NOT_AUTHORIZED`，不读键、不建目录、不起进程）；入口校验批准引用非空且 subject（model/reasoningEffort/baseUrl）与投影一致，否则 `PLANNER_APPROVAL_INVALID` / `PLANNER_SUBJECT_NOT_APPROVED`；独占保留新 run root（0700/0600、`wx` 写入，拒绝复用目录与预置链接）；`createProcessJobOwner`（job-owner.ps1 助手 + 钉版 launch-gate.mjs 在创建目标前加入无 breakaway 的 Windows job）；`invokePlannerOnce` 在读取凭据之前快照输入并核对提示词/程序哈希与边界，生成前扫描租借秘密出 argv，双通道先脱敏再保留；结束阶段强制 `terminateOwned`/`activeProcesses`/`dispose` 并保留全部清理事实，状态为 `PROJECTED_PLANNER_COMPLETED` / `PROJECTED_PLANNER_CANCELLED` / `PROJECTED_PLANNER_CLEANUP_BLOCKED` 或各 `*_REFUSED` 拒绝码。

argv 形态（投影生成）：`exec --model gpt-6-astra --config model_provider="my-gpt" --config model_reasoning_effort="max" --sandbox read-only --ephemeral --json --color never --cd <repo> -`；TOML 同时固定 `approval_policy="never"`、`sandbox_mode="read-only"`、`web_search="disabled"`、`[shell_environment_policy] inherit="none"` 且 `include_only` 安全位置（排除 `CODEX_HOME`）、`exclude ["*KEY*","*TOKEN*","*SECRET*"]`。隔离环境全部落在 run root 下：`CODEX_HOME=<runRoot>\codex-home`、`HOME`/`USERPROFILE=<runRoot>\home`、`TEMP`/`TMP`/`TMPDIR`、XDG 各目录分置，`PATH` 仅由显式 toolDirectories 组成。

输出保护：沿用 r06 脱敏管线与 `redactionLimits`；`maxChannelBytes` 约束保留的 UTF-8 字节（含延迟 EOF 片段与替换扩展），违规片段在保留前丢弃；输入投递失败即取消、泄漏锁存、不完整捕获显式记录。取消：`deadlineMs` 覆盖派生阶段、`terminationGraceMs` 约束取消等待；`abortGated` 先于 `releaseGated`，未分配时也可中止并请求直接终止；强制关管不等于进程树退出，job 无 breakaway 保证树级终止，后代状态未核实时如实记 `NOT_VERIFIED`。上述边界值（数值）属所有者决定的一部分（见缺项表），本轮不猜测、不代填。

读取/只读范围：规划器只读上表固定文件清单；`--cd` 钉在仓库；run root 与 workspace/可执行程序互不包含。`--sandbox read-only` 与 `sandbox_mode="read-only"` 目前是 CLI 配置层约束（precheck r01 已证配置层接受），不是操作系统级只读强制——该差距在缺项表技术栏如实列出，不用“read-only 字符串”冒充 OS 证明。

## 缺项表

### 用户输入栏（仅所有者能提供；不要求用户写程序或理解内部哈希）

1. 受保护路由批准：提供并批准实际可用的 HTTPS base URL（或可核验的受保护链路）。现行批准路由 `http://154.89.153.24:8080/v1` 为明文 HTTP，会被投影以 `CODEX_LAUNCH_PROJECTION_REFUSED` 拒绝（`codex-launch-projection.mjs` 第 33-34 行强制 `https:` 并拒绝 userinfo/search/hash）；路由变更须走所有者授权的新配置版本（models.v1 + 锁），未授权前不改 URL、不关证书检查、不把书面接受 HTTP 风险当传输保护。
2. 旧 Key 撤销/轮换确认与本人隐藏录入：所有者确认服务商侧已撤销并在聊天中暴露的旧 Codex Key 并签发替代 Key；替代 Key 由本人经 `manage.ps1 -Action Set -Provider codex` 的 `Read-Host -AsSecureString` 双提示录入 `dsh861/providers/codex`，不发聊天、agent、Git、命令参数或普通文件。首次规划只需 Codex 一套凭据，不索取其余三套，也不索取无关的 DEEPSEEK_API_KEY。
3. 费用与时限字段：本次单次调用的费用上限（数值与币种）、有效期、wall-clock 时限（`deadlineMs`/`terminationGraceMs`/`maxChannelBytes` 的具体数值）及实施该上限的服务商或受控执行点。单次 CLI 可能发出多次请求；进程数、超时与字节边界都不是金额硬上限，本申请不预设金额、不虚构服务商额度功能、不替所有者批准费用。
4. 对固定输入集与批准记录的签署：所有者明确批准本申请所列源码提交、读取清单、钉版程序、入口与边界，并给出入口所引用的两条记录（`approval.record` 与 `transportEvidenceRecord`）对应的真实决定内容，使实施端能把所有者决定绑定到固定输入与程序/配置/脚本哈希上。

### 技术工作栏（按投影 `requiredBeforeCredentialRead` 七项；已实现的引用证据，缺失的写明具体缺口）

| 项 | 现状（证据） | 尚缺 |
|---|---|---|
| owned-process-tree-control | 已有原生证据：r14 真实内核身份/退出与 breakaway 遏制、r15-win 门控 8/8 原生通过（真实 job-owner powershell 与 launch-gate 子进程、kernel pid/ppid、完成/取消语义） | 无结构性缺口；真实调用时按调用记录复核同一事实 |
| verified-owner-approval | 入口校验批准引用非空且 subject 与投影一致，失配即拒（`planner-entry.ts`）；测试覆盖拒绝路径 | 批准记录的认证与所有者绑定未实现：非空字符串+subject 匹配不证明记录存在或由所有者签署。需要把所有者决定落到可核验的批准记录机制（签署/版本化记录），由实施端接线，不等同于用户一句确认 |
| rotation-attestation | `state.json` 记 `credential_rotation_status=UNKNOWN_NOT_VERIFIED`、`product_calls_using_exposed_credentials_allowed=false`；仓库内无更新记录 | 等待用户输入栏第 2 项；所有者确认后由实施端把轮换事实记入状态并作为调用前置证据，本轮不读取任何凭据核实 |
| native-config-and-read-only-enforcement | CLI 配置层接受 `read-only`/`max`（precheck r01 精确拼写探针）；job 对象提供进程树拥有/终止 | OS 级只读与配置发现隔离未验证：`--sandbox read-only` 是 CLI 约束而非 OS 强制证明，进程以同一 Windows 用户运行、无专用身份隔离，run root 父目录 ACL 仍靠受信调用方。需要原生验证或等价 OS 隔离证据后才可读凭据 |
| scope-and-config-discovery-isolation | 投影环境隔离 HOME/USERPROFILE/CODEX_HOME/TEMP/XDG 于 run root、PATH 仅 toolDirectories、shell 环境策略 inherit=none；run root 独占保留、拒绝复用与预置链接 junction 边界经 r06/r07 系列 | 读取范围隔离的独立观察（规划器实际访问超出清单即被发现/拒绝）尚无原生验证；同用户进程对仓库其余部分的访问不受 OS 限制 |
| transport-certificate-and-route-verification | 强制点已落实：投影拒绝一切非 `https:` 路由与 userinfo/search/hash，路由经锁校验 | 真实 HTTPS 路由的证书验证行为未验证（本轮禁止探针）；待所有者批准路由后，在授权调用时以真实响应核验，不用 HTTPS 拼写冒充证书验证 |
| external-budget-enforcement | 时间/字节边界（`deadlineMs`/`terminationGraceMs`/`maxChannelBytes`，r09 加固、r15 复验）已实现且明示非金额上限 | 金额强制完全缺失：r15-win `notRun` 明列 monetary-budget enforcement；无服务商侧额度或受控执行点接线。需所有者指明可实施的强制点，实施端落实后才能读凭据 |

以上判定不把“非空记录名”“read-only 字符串”“一个 CLI 进程”当成任何一项的证明；每格要么给出可引用的仓库内证据，要么写明缺失的具体实现或验证。

## 停止条件、复用与界限

本轮未读取/写入/枚举生产凭据、未读全局认证、未请求中转、未调用任何模型、未生成 plan.v4、未以合成授权放行生产、未修改 `models.v1.json`、`models.v1.lock.json`、`pnpm-lock.yaml`、`state.json`。源码与环境未变，按交接不重跑已通过的正式入口 8 项、ownership 25 项、入口 12 项回归、版本帮助、配置探针与完整文档门禁；后续变更影响哪一项才复验对应范围。

按节点规则第 2 节，本次调用既有 CLI 属开发工具使用；交付产品的长期安装隔离、公网认证后台、通用权限与计费框架不在本申请内实现或验收，也不因编写本计划而提前建设。真实条件全部成立并获授权后，才经上述实际入口调用指定 Codex 一次，保存固定输入、参数、原始脱敏输出与结果；不自动重试收费调用、不覆盖旧计划或失败回执。最终 OpenCode 硬审核在按计划实施并固定候选之后进行，本申请不触及其准入。
