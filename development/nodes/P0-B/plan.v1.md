# P0-B：四种真实 harness 验证

**节点 ID：** `P0-B`
**计划版本：** `v1`
**计划性质：** 只读规划；本计划不修改仓库、不安装依赖、不运行测试、不调用其他模型或代理。
**规划者：** 真实 Codex，固定 `gpt-6-astra`，`model_reasoning_effort="max"`。
**实施者：** ZCode，按本计划实施、测试、整合并修复。
**硬审核者：** 真实 OpenCode，固定 `zhipuai-coding-plan/glm-5.3 --variant max`，对冻结候选只读审核。
**工作分支：** `feat/multi-agent-company-nodes`。

## 1. 前置基线与不可覆盖的历史证据

P0-B 只能从已经通过 P0-A 的状态开始。实施前必须把以下事实复制到 P0-B 的节点状态和候选索引中，作为只读引用：

- 基线提交：`d347e703908d0406b7a7ef80e3a0e594d86b2215`。
- P0-A 状态：`development/nodes/P0-A/state.json`，状态为允许规划 P0-B。
- P0-A 当前候选：`development/nodes/P0-A/candidate.r03.json`。
- P0-A 候选 SHA-256：`04bb71cbace30c5fbd2a15f4056d9c3067e76df9e658dd543c93f57c870c39bd`。
- P0-A 真实 OpenCode 审核：`development/nodes/P0-A/reviews/r03.json`，使用 `zhipuai-coding-plan/glm-5.3 --variant max`，结论为明确 `PASS`。
- P0-A 恢复和验证证据：`development/nodes/P0-A/evidence/recovery-v15-validated.json`。
- P0-A hygiene 证据：`development/nodes/P0-A/evidence/hygiene-v15-completed.json`，结果为 `16/16`。
- P0-A 依赖解析证据：`development/nodes/P0-A/evidence/dependency-resolution-summary.json`。
- P0-A 最高归档计划为 `development/nodes/P0-A/plan.v15.md`；`plan.v1.md` 至 `plan.v15.md` 以及历次失败和审核记录均保持原名、原内容和原路径。

P0-A 证明的是 Windows 工具链、冻结依赖、文档门禁、完整 build、hygiene、源码和构建版 CLI 入口、五个 built-bin 必选用例以及一个 keyless smoke。它没有证明本项目已经接入四种真实 harness，也没有完成 AC-01 至 AC-32 中任何尚未实现的产品能力。特别是：

- P0-A 开发工具 Codex CLI 的计划调用记录不能当作交付产品 Codex harness 证据。
- P0-A 使用的真实 OpenCode 硬审核进程不能当作交付产品 OpenCode harness 证据。
- 现有 keyless fixture、loopback Responses、loopback SDK、mock provider 或内置 GLM 子代理不能当作真实产品成功路径。
- P0-A 的历史失败、r01/r02 无结论审核、v9 跨构建 HTML SHA 不一致等证据不得覆盖、改名或重新解释。

## 2. 节点目标与范围决策

P0-B 采用“真实验证加条件性最小适配实现”的混合范围：

1. 对已有的 Codex 和 Claude Code provider 进行真实产品级验证，覆盖真实程序、版本、配置发现、认证发现、工作目录、专用数据目录、权限、系统工具、取消和退出、交接边界、用量和原生工具观测。
2. 对 OpenCode 和 Grok CLI 先执行真实程序发现门。只有发现结果同时满足以下条件，才在 P0-B 中实现最小的一次性 `SubagentProvider` 适配并进行真实验证：
   - 能定位官方程序或官方 npm 包的绝对路径；
   - 能读取实际版本并固定到候选；
   - 能确认真实启动入口和机器可用协议；
   - 能在受控目录中隔离配置、认证状态、session、cache、日志和临时文件；
   - 能定义实际的允许和拒绝操作；
   - 能通过外部进程、文件和日志检查证明取消后自有进程归零；
   - 能取得真实 provider 返回的模型、版本、用量或明确记录其不可观测原因。
3. 如果 OpenCode 或 Grok 缺少程序、账号、网络、平台或可安全确认的协议，则留下明确的 `BLOCKED` 适配决策和证据，不创建空 provider、空 installer、只有服务声明的伪接入，也不使用通用 ACP 或其他模型改名冒充。
4. 现有 provider 的原生续接能力不存在时，验证必须记录“原生续接不支持”的明确缺口，并验证可行的步骤级交接；不得把再次发送一句文本或单次响应称为续接。

P0-B 不实现全局铁律和项目铁律管理平台、集中 skills/tools/MCP 控制面、PostgreSQL、GBrain、工作流编排、三端交付、公司级审核平台或 P0-C 的数据库和记忆系统。需要这些系统提供的交接点只记录真实接口事实和缺口。

## 3. 需求和验收映射

| 需求或 AC | P0-B 责任 | 证据要求 |
|---|---|---|
| REQ-002 / SUP-011 | 四个不同的真实 harness 身份、入口和版本 | 每个 harness 的绝对程序路径、包来源、版本输出、命令摘要和进程树 |
| REQ-003 | 程序、配置、认证状态、skills、MCP、hooks、session、memory、cache、日志隔离 | 受控目录清单、全局诱饵、前后 hash、外部进程和文件检查 |
| REQ-004 | Grok 使用 `@xai-official/grok` 来源，安装隔离，版本固定 | npm 包解析、实际 bin、resolved version、lock 或版本清单、未使用 `npm -g` 的证据 |
| REQ-011 | 验证使用的规则和授权可追溯 | 每次运行的规则版本、权限模式、工具 allow-list、授权记录 |
| REQ-015 / SUP-010 | 模型可见工具集合与实际调用权限一致 | native advertised tools、DSH 可见集合、成功调用、拒绝调用和错误证据 |
| REQ-017 / SUP-012 | 身份、岗位、模型、版本、工具请求、结果、产物和失败可查 | 结构化 manifest、原始 stdout/stderr、Session JSONL、外部观察记录 |
| REQ-018 / SUP-006 | 取消、失败、重试、交接、持久状态和副作用可核对 | 中断时序、自有进程归零、文件结果、交接包、恢复结果 |
| SUP-014 | 每项声明关联真实证据 | 候选矩阵中每个 PASS/FAIL/BLOCKED/NOT_RUN 都有引用 |
| AC-01 | 四种真实程序启动、执行任务并产生可审查结果 | 每个 harness 至少一个真实成功路径；缺条件为 BLOCKED |
| AC-02 | 全局配置和诱饵不被加载或写回 | 全局配置前后 hash 相同，诱饵程序未启动，专用目录反向修改不影响全局 |
| AC-03 | 真实模型和配置选择一致 | 原生版本/模型观察；未知字段明确写 `UNKNOWN`，不降级到全局默认 |
| AC-04 | harness 交接时身份、岗位和获准记忆范围连续 | 显式 handoff manifest、Session/artifact hash、全局上下文未继承 |
| AC-07 | 未授权工具、路径、网络或数据访问真实拒绝 | 拒绝操作返回真实错误，目标文件/进程/网络无副作用 |
| AC-10 | skills/tools/MCP 集中可见集合与调用集合一致 | allow/deny 对照表、catalog、native 工具列表、调用和拒绝事件 |
| AC-16 至 AC-18 | 验证节点交接、记忆和共享边界 | P0-B 只验证已存在的交接点；GBrain、长期共享记忆和完整权限治理仍标缺口 |
| AC-20 | 执行者和审核者身份独立 | 记录产品执行身份和真实 OpenCode 审核身份，禁止相互冒充 |
| AC-21 | 崩溃后任务和产物可找回 | 外部 session/artifact 清单、故障后重新装载或明确 BLOCKED |
| AC-23 | 取消只终止本节点拥有的进程树 | 取消前后 PID/PPID、监听、文件和其他任务存活证据 |
| AC-24 | 用量、限额和费用来自真实 provider 或明确未知 | 原生 usage、账单响应或 `UNKNOWN` 原因；禁止估算和伪造 |
| AC-31 | 真实性可查 | 原始程序输出、文件 hash、进程检查、配置来源和命令回执 |
| AC-32 | 耗时、平台耗时、费用、人工介入和不可观测项记录 | 每次运行的时间戳、平台、人工步骤和未知项 |

P0-B 不宣称 AC-01 至 AC-32 全部完成；矩阵只表示本节点实际验证或实际缺口。

## 4. 已核实源码、接口和数据责任

### 4.1 Codex

必须以以下源码为实施和验证依据：

- `packages/subagent/subagent-codex/package.json`
- `packages/subagent/subagent-codex/src/index.ts`
- `packages/subagent/subagent-codex/src/run.ts`
- `packages/subagent/subagent-codex/src/wire.ts`
- `packages/subagent/subagent-codex/cordis.patch.yml`
- `packages/subagent/subagent-codex/tests/subagent-codex.spec.ts`
- `packages/subagent/subagent-codex/tests/real-product.spec.ts`
- `packages/subagent/subagent-codex/tests/loader-composition.e2e.ts`
- Codex 中英文 README

已确认事实：

- DSH package 版本为 `0.1.3-alpha.1`。
- 运行时依赖 `@openai/codex` `0.149.1`。
- 实际入口由 package-local `createRequire(...).resolve('@openai/codex/package.json')` 解析，再使用 `process.execPath <package-local-bin> app-server --stdio`。
- 启动协议为 `initialize`、`initialized`、`thread/start`，每次新进程、新 thread、新 turn，并设置 `ephemeral: true`。
- provider registry 名称默认为 `codex`，注入 `subagents` 和 `subprocess`，不支持 agentOptions、outputSchema、depthLimit、toolFilter、persona 等可选能力，`inheritsParentContext=false`。
- cwd 从父 Session header 的 `cwd` 派生；配置包括 `providerName`、可选 `model`、显式 `env`、`permissionMode`、`disposeGraceMs`。
- 权限模式为 `never`、`approve-for-me`、`dangerously-bypass-approvals-and-sandbox`，默认 `never`。
- 环境由 credential-scrubbed parent env 加显式 overlay 构成。
- `run.ts` 和 `wire.ts` 只向父调用者收敛最终 assistant 文本、错误和进程退出；原生工具请求、工具结果、usage、raw stderr、workspace diff、产品 session id 和命令路径不会进入父 Session。
- 取消通过 `wire.interrupt()`，随后关闭 wire/stdin、terminate 子树、`waitForExit`，等待 `done`。
- 没有原生 continuation/resume、pooling、产品 session 持久化、wall-clock timeout 或副作用 rollback。

因此 P0-B 必须同时记录“外部 app-server 原生观察范围”和“父 Session 当前只收到最终文本”的差异。

### 4.2 Claude Code

必须以以下源码为实施和验证依据：

- `packages/subagent/subagent-claude-code/package.json`
- `packages/subagent/subagent-claude-code/src/index.ts`
- `packages/subagent/subagent-claude-code/src/run.ts`
- `packages/subagent/subagent-claude-code/src/process.ts`
- `packages/subagent/subagent-claude-code/cordis.patch.yml`
- `packages/subagent/subagent-claude-code/tests/subagent-claude-code.spec.ts`
- `packages/subagent/subagent-claude-code/tests/real-product.spec.ts`
- `packages/subagent/subagent-claude-code/tests/loader-composition.e2e.ts`
- Claude Code 中英文 README

已确认事实：

- DSH package 版本为 `0.1.3-alpha.1`。
- SDK 版本为 `@anthropic-ai/claude-agent-sdk` `0.3.241`，Anthropic SDK `0.93.0`，MCP SDK `^1.29.0`。
- 当前 SDK payload 解析到 Claude Code `2.1.241`，实施时必须从实际分发包和 `--version` 再核实。
- provider registry 名称默认为 `claude-code`，使用官方 SDK `query()`，`inheritsParentContext=false`，cwd 来自父 Session。
- 权限模式为 `dontAsk`、`acceptEdits`、`auto`、`plan`、`bypassPermissions`，默认 `dontAsk`。
- 显式 env 叠加在 scrubbed parent env 上；自定义 spawn hook 将 SDK CLI 进程纳入共享 subprocess owner。
- `settingSources` 被省略，因此用户、项目和本地 Claude 设置仍是原生权威来源，不能未经测试声称 hermetic。
- `persistSession=false`，禁用 AskUserQuestion，无原生 continuation/resume。
- 只有 subtype 为 success、`is_error=false`、result 非空且异步迭代器正常完成时才算完成。
- 取消和 dispose 由 `process.ts` 的进程树控制；最终文本之外的工具、推理、usage、中间事件、stderr 和 workspace diff 留在产品本地。

P0-B 必须明确 P0-A 的 OpenCode 审核规则与产品 Claude Code 接入无关，也不能调用 Claude 代替本计划的规划者。

### 4.3 通用 ACP 和 DSH SDK 的边界

- `packages/subagent/subagent-acp/src/index.ts`、`src/run.ts` 和 README 提供通用 ACP 子进程能力，但不提供 OpenCode 身份、版本、配置发现、usage 或原生工具观测。因此不能把 ACP registry 行当作 OpenCode provider。
- `packages/subagent/subagent-dsh-sdk` 是 DSH 子运行时，不是 OpenCode 或 Grok CLI。它可以作为进程隔离和交接设计的参考，但不能作为四种真实 harness 中的替身。
- 不新增一个“通用产品进程 helper”来掩盖不同官方程序的身份差异；每个新 provider 必须拥有自己的入口解析、版本核对、配置隔离和协议责任。

### 4.4 共享 capability seam

已有公共 seam 位于：

- `packages/subagent/subagent/src/types.ts`
- `packages/subagent/subagent/src/index.ts`
- `packages/subagent/subagent/src/descriptor.ts`
- `packages/subagent/subagent/src/continuation.ts`
- `packages/subagent/subagent/README.md`
- `docs/subsystems/subagent.md`

`SubagentProvider` 至少包含 `name`、`capabilities`、`inheritsParentContext`、可选 `agentRouteDefaults`、`start(request)` 和可选 `prepareContinuable(...)`。`SubagentRun` 使用 branded `SessionId`，包含 `localAgent`、`result` 和 `dispose`。

新增 OpenCode 或 Grok provider 时必须按 capability seam 分离：

- **Service Definition：** provider 名称、配置类型、能力枚举、版本和隔离字段的公共类型。
- **Service Provider：** 官方程序解析、版本核实、配置和 env 构造、协议启动、权限、取消和 quiescent cleanup。
- **Consumer：** cordis profile、Loader composition、受控测试项目和 CLI/profile 暴露。

每个注册必须通过 `ctx.effect()` 或 `ctx.on()`，`register()` 返回 disposer。不得使用空 installer、只检查服务存在或只注册 metadata 来满足完成条件。

## 5. 四种真实 harness 组合矩阵

矩阵中使用以下状态：

- `PASS`：真实程序执行成功，要求的允许和拒绝证据齐全，外部检查通过。
- `FAIL`：真实程序已运行，但行为违反隔离、权限、取消、交接或观测要求。
- `BLOCKED`：程序、账号、网络、平台或必要条件缺失，未把缺失伪装成通过。
- `NOT_RUN`：因前置任务失败或明确裁剪而没有执行；不得计入通过。

每个字段还必须允许 `UNKNOWN` 作为观测值。`UNKNOWN` 必须附原因、来源和是否影响支持声明；未知用量或原生轨迹不能由 agent 自报补齐。

| Harness | 真实角色和入口 | 版本和模型 | 配置、认证和数据 | 工作目录与权限 | 工具、取消和交接 | 用量与原生观察 |
|---|---|---|---|---|---|---|
| Codex | DSH `codex` provider；package-local `@openai/codex` 的实际 bin；`process.execPath <bin> app-server --stdio` | DSH `0.1.3-alpha.1`；Codex `0.149.1`；`thread/start` 的 model 只能来自用户现有配置 | `CODEX_HOME` 指向本次 run 的专用目录；认证只从用户授权的 native 状态发现；禁止读取用户主目录的诱饵配置；Session、cache、logs 均在 run 根目录 | cwd 必须等于父 Session header 派生的受控 work 目录；先用 `permissionMode=never` 验证拒绝，再使用用户明确授权的实际模式验证允许 | 允许在 work 目录创建标记文件；拒绝访问 work 外诱饵文件或执行诱饵程序；捕获 app-server 原生消息、外部进程树和文件变化；验证 `wire.interrupt()` 后自有进程归零；原生 resume 预期为不支持，步骤交接必须显式 | 若真实 app-server 返回 usage，保存原始 usage；否则记录 `UNKNOWN`；父 Session 当前只记录最终文本，原生 tool/usage 不得伪造为父事件 |
| Claude Code | DSH `claude-code` provider；官方 `query()` 启动的真实 Claude Code CLI；实际 CLI 路径由 SDK 分发包解析 | DSH `0.1.3-alpha.1`；SDK `0.3.241`、Anthropic SDK `0.93.0`；实际 CLI 版本必须由 `--version` 核实；model 仅使用现有配置 | `CLAUDE_CONFIG_DIR`、`HOME`、`XDG_CONFIG_HOME`、session/cache/log 目录逐项指向专用 run 根；`settingSources` 的实际行为必须记录，不能假设 hermetic | cwd 从父 Session 派生；`dontAsk` 或等效拒绝模式测试外部写入拒绝；用户授权后测试 `acceptEdits`/`bypassPermissions` 的受控允许路径 | 允许写 work 内标记；拒绝读取全局诱饵和 work 外路径；通过 SDK spawn hook 观察自有 CLI；取消后关闭通知、terminate 子树并等待退出；`persistSession=false` 时原生续接预期为不支持，单独验证步骤交接 | 记录 SDK/CLI 返回的真实 usage 或 `UNKNOWN`；最终 result 以严格 success 条件认定；工具和中间事件留在产品本地时必须标出父 Session 不可见 |
| OpenCode | 现有源码没有产品级 OpenCode provider；先发现官方 executable/package 和真实入口；若官方支持 ACP，可实现带 OpenCode 身份和版本锁定的专用 provider | 版本必须来自实际 `--version`、package manifest 或官方响应并固定；不得把硬审核所用 OpenCode 进程算入 | 专用 config/home/cache/session/log 目录；不得继承全局 OpenCode 配置；若需新 package，配置类型、provider 和 consumer 分离 | 允许和拒绝操作必须由 OpenCode 的真实权限或工具机制产生；不得凭空添加未证实的 flags；cwd、权限、系统工具和网络访问必须外部验证 | 取消必须终止 OpenCode 自有进程树；原生 resume、session handoff、usage 和 native trace 逐项核实；若协议无法安全确认，整项为 BLOCKED | 只接受 OpenCode 原生响应、日志或协议事件；ACP 通用结果不能单独证明 OpenCode 产品功能 |
| Grok CLI | 现有源码没有 Grok adapter；来源固定为 `@xai-official/grok`；安装到 package-local 或语义化受控目录，禁止 `npm -g` | `latest` 只能作为发现来源；候选必须记录实际 resolved version 和完整 bin 路径；model、endpoint、API key 使用用户现有配置 | `npm --prefix <isolated-root>` 或等效受控安装；专用 HOME/config/cache/session/log；禁止修改用户或机器级 npm、Grok 或 shell 配置 | 允许写 work 内标记；拒绝 work 外路径、诱饵全局工具或未授权网络；入口和协议必须从实际包和 `--help`/文档确认 | 取消必须清理 Grok 自有子树；续接若无原生支持则记录步骤交接或 BLOCKED；不能用普通 shell 文本响应代替 harness 协议 | usage、model、版本和 native tool 只能取自真实 Grok 响应或外部日志；无 xAI 账号/API key/网络时为 BLOCKED，不使用 keyless fixture 代替 |

### 5.1 每个 harness 的允许和拒绝操作

每个真实运行都必须至少包含以下两条操作，并分别保存证据：

1. **允许操作：** 模型通过产品真实工具或原生工具，在 `<run-root>\<harness>\work\allowed` 内创建或读取固定 sentinel；操作结果、文件 hash、调用参数和 Session 关联均可检查。
2. **拒绝操作：** 模型尝试访问 `<run-root>\bait\global-secret.txt`、写入 work 外目录，或执行只存在于诱饵 PATH 的同名程序。拒绝必须由真实产品权限、工具边界或系统沙箱产生，且外部检查确认没有创建文件、启动诱饵进程或写入日志。

允许和拒绝操作的具体工具名必须来自实际 native advertised list 和 DSH 注册表。不能把不存在的工具名写进实现后再将“未调用”当拒绝证据。

## 6. 受控测试项目和外部证据设计

所有 P0-B 临时数据只能写入：

- `D:\Temp_projects\dsh861-node-governance`
- 或语义化的新目录 `D:\Temp_projects\dsh861-p0-b-harness-validation`

禁止在用户主目录散落配置、日志、缓存、session 或临时文件。每次运行创建唯一的受控根目录：

```text
<harness-validation-root>/
  <harness>/<run-id>/
    config/
    auth-reference/
    home/
    cache/
    session/
    logs/
    work/
    bait/
    artifacts/
    process/
    raw/
```

真实凭据不得写入日志、Session、候选、截图、快照或错误诊断。manifest 只能记录凭据变量名、来源类别和是否存在；值必须以固定长度 hash 或 `[REDACTED]` 表示。

中央证据 schema 由一个责任者维护，建议位置：

```text
development/nodes/P0-B/evidence/schema.v1.json
development/nodes/P0-B/evidence/README.md
scripts/p0-b/validate-harness.ts
scripts/p0-b/validate-harness.mjs
scripts/p0-b/fixtures/mcp-allow-deny-server.mjs
scripts/p0-b/collect-process-tree.ps1
scripts/p0-b/collect-process-tree.sh
scripts/p0-b/collect-filesystem-state.ts
```

如果仓库已有等价的 governance/evidence runner，必须复用其命名和格式，不重复创建第二套 schema。

每个运行至少保存：

- `manifest.json`：节点、harness、测试身份、任务和岗位、程序绝对路径、包来源、版本、版本 hash、argv 摘要、模型字段、权限模式、cwd、配置和数据目录、工具集合、规则版本、授权记录、操作系统、开始和结束时间、退出码。
- `stdout.raw`、`stderr.raw` 及对应 SHA-256。
- 启动前、运行中和取消后的 `process-tree-*.json`。
- 配置、全局诱饵、专用目录的 `filesystem-before.json`、`filesystem-after.json` 和文件 hash。
- `session.jsonl`、`handoff.json`、`artifacts.json`。
- 原生协议或日志观察 `native-events.jsonl`；无法观察的字段使用 `UNKNOWN` 并说明原因。
- `tool-observation.json`：可见工具、实际可调用工具、允许调用、拒绝调用、错误、目标进程和文件副作用。
- `global-bait-check.json`：诱饵是否被读取、执行或写回。
- `result.json`：本次运行的状态、失败分类、阻塞条件和证据引用。
- `subprocess-receipt.json`：实际启动命令、绝对路径、参数摘要 hash、环境变量名称清单、退出码、信号和等待结果。

### 6.1 全局隔离诱饵

每次运行必须同时设置和检查：

- 全局配置目录中的同名配置文件，内容包含唯一 bait marker。
- 全局 PATH 中的同名诱饵 executable，执行时写入外部 bait marker。
- 环境变量 `DSH_P0B_GLOBAL_BAIT`，验证 ambient `DSH_*` 被 scrub，不进入子进程；如果产品显式配置重新加入该变量，必须判定为 FAIL。
- 专用配置目录中的反向 marker，验证改变专用目录不会修改全局目录。
- 全局配置、全局 cache、全局日志和用户主目录的前后 hash。

必须由外部检查进程、文件和日志判断诱饵是否进入系统执行。agent 的“我没有读取”只能作为普通输出，不能作为证据。

### 6.2 进程和取消

Windows 运行使用限定于本次 run 的 PowerShell 检查，例如 `Get-CimInstance Win32_Process`、`Get-NetTCPConnection` 和 `Get-FileHash`，只记录拥有的 PID/PPID；POSIX 使用 `ps`、`/proc`、`lsof` 或同等命令，只操作本次 run 的 PID 集合。禁止广泛 `taskkill /F`、按名称杀进程、杀用户进程或使用全局串行锁。

取消流程必须由产品 API 或真实 stdin/protocol interrupt 触发：

1. 记录取消请求事件和时间戳。
2. 关闭通知或协议输入。
3. 终止 provider 自有进程树。
4. 调用 `waitForExit` 或官方等价等待整棵子树退出。
5. 检查监听、子进程、临时锁和文件写入是否归零。
6. 检查其他 run、全局 CLI 和用户进程仍在运行。

不得使用固定 `sleep`、无限 retry 或提高 timeout 掩盖未退出进程。 readiness 必须使用协议初始化、端口就绪或明确的子进程事件。

### 6.3 Session、交接和模型可重建性

现有 Codex、Claude 和 ACP provider 都是 one-shot。P0-B 要求：

- 记录父 Session 的 `turn/start`、`step/start`、子 agent descriptor/lifecycle、`assistant/message`、`tool/call`、`tool/result` 和 `session/end-seed` 等已有事件。
- 原生工具、usage、产品 session id 若未进入父 Session，必须在外部证据中明确为“产品本地可观察、父 Session 不可重建”。
- 不为测试方便添加隐藏模型输入、隐式全局上下文或未记录的 prompt。
- 若实现新模型可见输入、交接元数据或工具选择，必须由唯一的 Session 类型责任者更新 `SessionEventMap`、投影、Python/TypeScript SDK 预期输出、快照、文档和迁移；不得只改一个端。
- 交接包至少包含 branded `SessionId`、岗位和授权摘要、获准记忆范围、输入/输出 artifact hash、源 Session 日志路径、规则版本和工具 allow-list。禁止包含凭据和未授权全局配置。
- 若官方 harness 支持原生 resume/session id，使用其真实 API 并保存恢复前后证据。
- 若官方 harness 不支持原生 resume，则必须使原生调用明确返回“不支持”，再执行步骤级交接；第二个实例只能接收显式交接包，不能读取第一实例的全局 home、cache 或隐式 session。
- 缺乏续接接口时状态为 `BLOCKED` 或 `NOT_RUN`，不得用“再次发送同一句任务”替代。

## 7. 实施任务、所有权和并行关系

以下任务由 ZCode 执行。中央 schema、根配置、锁文件和 Session 类型各只有一个责任者可以修改。

### B0：节点冻结、源码索引和证据责任建立

- **责任者：** 节点治理负责人。
- **输入：** 本计划、P0-A 状态和候选、`AGENTS.md`、`NODE_DEVELOPMENT_RULES.md`、四个需求文件、已核实的 package 源码。
- **输出：** `development/nodes/P0-B/plan.v1.md`、`development/nodes/P0-B/state.json` 初始状态、源码索引、不可覆盖的 P0-A 引用清单、责任矩阵。
- **前置：** P0-A r03 明确 PASS。
- **并行：** 可与 B1、B2 并行；不允许其他任务修改 P0-B 状态 schema。
- **成功验证：** 只读检查 P0-A 文件 hash 和 P0-B 引用一致。
- **拒绝验证：** 尝试覆盖 P0-A 候选或重命名历史证据必须被流程检查拒绝。
- **证据：** `development/nodes/P0-B/evidence/governance/preconditions.json`。

### B1：OpenCode/Grok 真实程序发现和条件门

- **责任者：** provider 发现负责人；如需修改根 lockfile，由该负责人单独负责。
- **输入：** 当前工作树、系统 PATH、已安装 package manifest、用户明确提供的账号/网络条件。
- **输出：** 每个程序的 discovery manifest、绝对路径、版本、包来源、`--help`/协议证据、配置路径、认证变量名称、平台依赖和 `PASS/BLOCKED/NOT_RUN` 决策。
- **前置：** B0 完成。
- **并行：** OpenCode 和 Grok 发现可并行；适配实现必须等待各自发现通过。
- **发现命令：**
  - Windows：`Get-Command <candidate>`、`Resolve-Path`、`& <absolute-path> --version`、`& <absolute-path> --help`。
  - POSIX：`command -v <candidate>`、`readlink -f`、`<absolute-path> --version`、`<absolute-path> --help`。
  - Grok 必须在受控目录使用 `npm view @xai-official/grok version` 或本地 manifest 核对来源；安装实施只能使用 `npm --prefix <isolated-root>`，禁止 `npm -g`。
- **成功验证：** 入口、版本、协议、配置和隔离方法全部有原始输出和 hash。
- **拒绝验证：** 不允许把 P0-A 审核 OpenCode、通用 ACP、DSH SDK、普通 shell 文本或内置 GLM 标记为 OpenCode/Grok。
- **证据：** `development/nodes/P0-B/evidence/discovery/opencode.json`、`grok.json` 及 raw stdout/stderr。

### B2：受控测试项目、工具 fixture 和外部观察器

- **责任者：** 测试基础设施负责人；唯一维护 `schema.v1.json`、runner 入口和 process/filesystem collector。
- **输入：** B0 的 schema 决策、`ctx.subprocess`、MCP/skill/tools 现有接口。
- **输出：** 受控目录创建器、全局诱饵、允许/拒绝 MCP fixture、进程树和文件 hash 采集器、凭据脱敏器、source/artifact 两个 runner 入口。
- **前置：** B0 完成；不得等待 OpenCode/Grok 账号。
- **并行：** 可与 B3、B4 的源码回归准备并行；B3-B6 的真实运行依赖 B2。
- **成功命令：**
  - source plane：`node --import tsx/esm scripts/p0-b/validate-harness.ts --harness <id> --case allow --source`
  - refusal：`node --import tsx/esm scripts/p0-b/validate-harness.ts --harness <id> --case deny --source --expect-denied`
  - runner 必须在缺程序或凭据时输出 `BLOCKED`，不能静默 skip。
- **证据：** `development/nodes/P0-B/evidence/fixture/<run-id>/...`。

### B3：Codex 真实产品验证

- **责任者：** Codex provider 负责人。
- **输入：** B2 runner、现有 Codex provider 和用户授权的 Codex 认证。
- **输出：** Codex 能力矩阵、允许/拒绝运行证据、配置隔离和取消证据、原生观察与父 Session 可见性报告。
- **前置：** B2 完成；需要真实 Codex 认证时必须由用户提供，不能从 P0-A 计划调用继承。
- **并行：** 可与 B4 并行。
- **成功命令：**
  - package 回归：`pnpm exec vitest run packages/subagent/subagent-codex/tests/real-product.spec.ts`
  - source real composition：`node --import tsx/esm scripts/p0-b/validate-harness.ts --harness codex --case allow --source --require-real-product`
  - refusal：`node --import tsx/esm scripts/p0-b/validate-harness.ts --harness codex --case deny --source --require-real-product --expect-denied`
  - built：完成 `pnpm run build` 后，使用 `node scripts/p0-b/validate-harness.mjs --harness codex --case allow|deny --artifact --require-real-product`。
- **失败条件：** 全局 bait 被加载或写回、cwd 越界、拒绝操作成功、取消后自有进程仍存活、其他 run 被终止、模型/版本与 manifest 不一致。
- **缺口记录：** provider 当前只返回最终文本、无原生续接和父 Session tool/usage bridge，分别记录为 `BLOCKED` 或 `UNKNOWN`，不修改为虚假支持。
- **证据：** `development/nodes/P0-B/evidence/codex/<run-id>/`。

### B4：Claude Code 真实产品验证

- **责任者：** Claude Code provider 负责人。
- **输入：** B2 runner、现有 Claude provider、官方 SDK/CLI 和用户授权的 Anthropic 认证。
- **输出：** Claude Code 能力矩阵、`settingSources` 和 config discovery 事实、允许/拒绝、取消、退出和交接证据。
- **前置：** B2 完成；不得把真实 OpenCode 硬审核进程当作 Claude 条件。
- **并行：** 可与 B3 并行。
- **成功命令：**
  - package 回归：`pnpm exec vitest run packages/subagent/subagent-claude-code/tests/real-product.spec.ts`
  - source real composition：`node --import tsx/esm scripts/p0-b/validate-harness.ts --harness claude-code --case allow --source --require-real-product`
  - refusal：`node --import tsx/esm scripts/p0-b/validate-harness.ts --harness claude-code --case deny --source --require-real-product --expect-denied`
  - built：`node scripts/p0-b/validate-harness.mjs --harness claude-code --case allow|deny --artifact --require-real-product`
- **失败条件：** 用户、项目或本地全局设置意外进入受控运行、拒绝写入成功、取消后 CLI 子树未退出、正常退出不满足 SDK success 条件、父 Session 误宣称拥有原生 usage/tool trace。
- **证据：** `development/nodes/P0-B/evidence/claude-code/<run-id>/`。

### B5：OpenCode 最小 provider 和验证

- **责任者：** OpenCode 适配负责人。
- **输入：** B1 discovery manifest；若使用 ACP，输入实际 OpenCode ACP 入口和版本证据。
- **输出：** 仅在协议可确认时新增 `packages/subagent/subagent-opencode/` 的 package、Service Definition、Provider、Consumer、README、测试和 cordis patch；一次性真实启动、权限、取消和观察证据。
- **前置：** B1 的 OpenCode 状态为可实现 `PASS`。
- **并行：** 与 B6 可并行，但不得并行修改中央 Session 类型、根配置或 lockfile。
- **实现限制：**
  - 不猜测 `--json`、`--stdio`、ACP 或其他 flags；所有 argv 必须来自 B1 原始帮助或官方协议。
  - 不能把 generic ACP registry 直接改名。
  - provider 只实现真实可证明的最小 one-shot seam；没有原生 continuation 就显式拒绝。
  - 所有注册通过 effects，cwd、env、权限和 dispose 必须使用现有 subprocess 语义。
- **成功命令：** `node --import tsx/esm scripts/p0-b/validate-harness.ts --harness opencode --case allow --source --require-real-product` 以及对应 `--case deny --expect-denied`；构建后重复 artifact 命令。
- **BLOCKED 条件：** 入口、协议、版本、配置隔离或账号任何一项无法确认；不得添加空接口。
- **证据：** `development/nodes/P0-B/evidence/opencode/<run-id>/`；若阻塞，保存 discovery、缺失条件和用户可补充条件。

### B6：Grok CLI 最小 provider 和验证

- **责任者：** Grok 适配负责人。
- **输入：** B1 Grok manifest、`@xai-official/grok` 真实 resolved package、用户授权的 xAI 账号/API key 和网络。
- **输出：** 仅在实际 package/bin/protocol 可确认时新增 `packages/subagent/subagent-grok/` 的 Service Definition、Provider、Consumer、README、测试和 profile wiring；受控安装、版本锁定和真实 allow/deny 证据。
- **前置：** B1 Grok discovery `PASS`；禁止使用机器全局安装作为前置。
- **并行：** 可与 B5 并行；lockfile 由 B1 指定的单一责任者修改。
- **实现限制：**
  - 安装路径必须是 `D:\Temp_projects\dsh861-p0-b-harness-validation\<run-id>\grok-install` 或仓库受控测试目录。
  - 禁止修改用户 npm prefix、用户 home、系统级 Grok 配置和机器级全局 PATH。
  - 版本由实际 resolved version 固定，不能持续使用 `latest`。
  - 没有机器协议时不能把交互式普通文本 shell 调用包装成 harness。
- **成功命令：** `node --import tsx/esm scripts/p0-b/validate-harness.ts --harness grok --case allow --source --require-real-product` 以及 `--case deny --expect-denied`；构建后重复 artifact 命令。
- **BLOCKED 条件：** 无网络、无账号/API key、包不存在、入口或协议无法确认、平台不支持或无法隔离。
- **证据：** `development/nodes/P0-B/evidence/grok/<run-id>/`。

### B7：交接、崩溃恢复、取消和观测汇总

- **责任者：** Session/生命周期负责人；唯一可修改 `SessionEventMap`、SDK projection 和相关迁移。
- **输入：** B3-B6 的运行结果、`packages/subagent/subagent/src/continuation.ts`、现有 Session 事件和 subprocess dispose 语义。
- **输出：** 每个 harness 的交接矩阵、取消时序、崩溃恢复结果、usage/tool/native trace 观测范围和缺口报告。
- **前置：** 至少一个 harness 的真实成功运行；每个缺失 harness 保留 BLOCKED。
- **并行：** 可先对 Codex/Claude 执行；OpenCode/Grok 依赖各自适配。
- **成功验证：**
  - 第一实例产生 Session/artifact；
  - 外部终止第一实例；
  - 第二实例只加载显式 handoff 包；
  - 产物 hash、岗位、授权和获准记忆连续；
  - 全局 bait、第一实例私有数据和未授权工具不被第二实例读取；
  - 原生不支持 resume 时，API 明确返回 unsupported，步骤交接结果单独标记。
- **证据：** `development/nodes/P0-B/evidence/handoff/<harness>/<run-id>/`。

### B8：Loader、profile、文档和 package 集成

- **责任者：** 集成负责人。
- **输入：** B3-B7 已通过的 provider 和 capability manifest。
- **输出：** 真正经过 Loader/app/process 的 composition 测试、profile wiring、每个 changed package 的中英文 README/JSDoc、适用的 docs 页面和双语事实。
- **前置：** 对应 provider 实现完成；不得为 BLOCKED 的 OpenCode/Grok 创建误导性公开支持说明。
- **并行：** 各 provider README 可并行；根文档、profile 和生成目录由单一集成负责人串行修改。
- **成功验证：** source composition 和 built composition 均从真实 profile 加载；直接手写 `ctx.plugin` 的测试只能作为单元测试，不能作为产品接入证明。
- **证据：** `development/nodes/P0-B/evidence/composition/`、`development/nodes/P0-B/evidence/docs/`。

### B9：测试、快照和门禁

- **责任者：** 验证负责人。
- **输入：** B2-B8 的源代码、测试和文档。
- **输出：** focused/unit、real composition/Loader、built artifact、真实 API 和必要 snapshot 的完整结果清单。
- **前置：** 所有实现和文档合并到工作树。
- **并行：** focused tests、文档 quick checks 和 built smoke 可并行；涉及同一 fixture 的运行必须按 run-id 隔离。
- **命令：**
  - `pnpm run typecheck`
  - `pnpm run lint`
  - `pnpm run build`
  - `pnpm run hygiene`
  - 受影响 package 的 focused Vitest
  - `pnpm run test:docs`
  - 需要时 `pnpm run doc-sync`
  - 需要时 `pnpm run test:snapshot -t <p0-b-case>`
  - 真实 API runner 使用 `--require-real-product`；缺 key 输出 BLOCKED，不得视作成功。
- **source/artifact 规则：** source 测试通过 tsconfig paths 和 `node --import tsx/esm` 进入 `src`；built 测试只加载 `lib/`，使用 plain Node，不把 source import 混入 artifact 验证。
- **证据：** `development/nodes/P0-B/evidence/checks/`。

### B10：候选冻结和审核包

- **责任者：** 节点治理负责人。
- **输入：** B0-B9 的全部结果、git diff、未跟踪文件、原始证据和阻塞记录。
- **输出：** `development/nodes/P0-B/candidate.r01.json`、候选 SHA-256、能力矩阵、证据索引、变更文件 hash、测试命令和退出码、阻塞清单、审核请求材料。
- **前置：** 所有适用检查完成；任何 BLOCKED/NOT_RUN 都有明确责任、缺少条件和对产品支持声明的影响。
- **成功验证：** `git status --short`、未跟踪文件清单、逐文件 SHA-256、候选文件自身 hash、P0-A 引用 hash 均固定；`git diff --cached --check` 通过。
- **证据：** `development/nodes/P0-B/evidence/candidate/`。

## 8. 配置、模型和凭据纪律

- 本次规划使用的 `gpt-6-astra` 与 `max` 只属于规划者，不能写入产品 harness 默认模型或 provider 配置。
- 测试不得修改 `model`、provider、base URL、API key、reasoning effort、service tier 或用户现有路由来“制造”通过。
- 每个 harness 使用其原生配置发现规则和用户明确授权的模型；配置缺失时返回 `BLOCKED` 或原生失败。
- 不得从全局配置、P0-A 开发工具环境、其他 harness 的认证缓存或用户 home 借用凭据。
- 只记录凭据变量名和存在性；stdout、stderr、Session、快照、候选和 Agent Note 均不得包含密钥。
- 真实 API、账号、网络和平台条件按 harness 分别列出；一个 harness 有凭据不能解除另一个 harness 的 BLOCKED。

## 9. 测试层级和真实性要求

每个已经声明支持的功能都必须有成功和拒绝证据：

- **focused/unit：** 验证参数解析、能力声明、状态归类、脱敏、disposer 和错误分类；不把单元测试当真实产品启动。
- **real composition/Loader：** 从实际 cordis profile 和 Loader 加载 provider，验证 effect 注册、配置发现和消费者路径。
- **built artifact：** 先 build，再用 `lib/` 和真实 package/bin 启动 plain Node 子进程。
- **真实 API：** 真实官方程序和真实账号；没有凭据时是 `BLOCKED`，keyless fixture 不能替代。
- **snapshot：** 只有模型可见输入、Session 事件或用户可见产品行为改变时才添加或更新；凭据和机器路径不得进入 snapshot。若新增 Session 事件，必须同时更新 TypeScript/Python SDK 投影和预期输出。

真实验证必须包含外部观察：

- 启动前后检查进程树、监听、文件和日志；
- 读取配置文件和目录 hash，比较全局和专用根；
- 检查诱饵程序是否启动；
- 比较模型可见工具集合、native advertised 集合和实际成功/拒绝调用；
- 将工具输入及结果通过已有 Session 事件或外部脱敏证据关联；
- 记录取消请求、退出码、信号和 `waitForExit` 完成；
- 记录外部耗时、平台耗时、usage、费用、人工介入和不可观测字段；
- 不能使用 mock harness、mock model、mock provider、自报版本、自报工具列表或一句静态文本作为接入证据。

涉及释放、重试、并发、数据库或跨进程时必须说明资源 owner、原子分配、ready、quiescent cleanup、恢复和重复运行方式。测试不能提高 timeout、开启全局串行、固定等待或 retry 来掩盖缺陷。

## 10. 文档、Agent Note 和代码质量要求

若新增或修改 provider、runner、配置或能力字段，必须同时：

- 更新每个受影响 package 的中英文 README；
- 为每个非显然 export、配置字段、Service Definition、Provider 方法和 Consumer 入口补充本地完整 JSDoc；
- 遵循 ESM、严格 TypeScript、`.ts` 相对导入、effects 注册和 `assertNever` 规则；
- 跨进程、文件、模型、工具、Session 和 wire 数据处执行实际解析与脱敏；
- opaque session、handoff、run 和 artifact id 使用现有 branded 类型；
- 不在 provider 边界对同进程已由 TypeScript 保证的值增加无依据的运行时 fallback；
- 为非机械的产品接入或隔离变化新增 Agent Note，例如 `.agents/notes/implemented/feature/2026-09-*-p0-b-real-harness-validation.md`，记录实际支持范围、证据位置、原生续接缺口和后续节点依赖；
- 双语文档一一对应，一段一行，一个事实只有一个权威归属；
- 不写审查历史、推理过程、被拒绝方案或“曾经如何”的泄漏式叙述。

## 11. 候选和证据固定纪律

候选包必须包括：

- 原始 `plan.v1.md`；
- P0-A 前置证据的只读引用和 hash；
- B1 的真实程序 discovery 回执；
- 每次真实 subprocess 的绝对路径、版本、argv 摘要、开始/结束时间、退出码、提示词摘要 hash（如适用）和输出位置；
- 所有 stdout/stderr 原文及 SHA-256；
- 环境变量名称清单和脱敏后的模型配置；
- 受控目录、全局诱饵、进程树和文件系统前后状态；
- 每个 harness 的能力矩阵、允许/拒绝证据、交接和取消证据；
- focused、composition、built、snapshot、真实 API 和文档检查命令及结果；
- `git status --short`、未跟踪文件列表和每个未跟踪文件 hash；
- BLOCKED/FAIL/NOT_RUN 的逐项解释、缺失条件、责任者和对支持声明的影响。

禁止修改或覆盖 `development/nodes/P0-A/` 下的候选、审核和历史证据。P0-B 的候选只引用这些文件，不复制后再改变内容。候选固定后计算 SHA-256；任何修改都必须生成新的候选版本并重新执行适用检查。

## 12. 完成标准

P0-B 只有在以下条件全部满足时才可提交硬审核：

1. Codex、Claude Code、OpenCode、Grok CLI 各自有独立能力矩阵，所有字段状态为 `PASS`、`FAIL`、`BLOCKED` 或 `NOT_RUN`，并能回溯到具体证据。
2. 每个已经声明支持的 harness 功能都有至少一条真实允许操作和一条真实拒绝操作；拒绝由真实权限、工具、路径、网络或配置边界产生。
3. 产品专用安装/配置目录与系统全局安装隔离，工作目录、Session、cache、日志、凭据变量归属可由外部进程和文件检查复核。
4. 系统工具、MCP、skill 和原生工具的可见集合与实际可调用集合一致；未授权工具或路径不能绕过限制。
5. 取消关闭通知、终止并等待自有子进程；其他任务、全局 CLI 和用户进程不受影响。
6. 原生续接、步骤交接、崩溃恢复、记忆和产物边界逐项给出真实结果；不支持的能力明确标注缺口。
7. 版本、模型、用量、工具轨迹和外部耗时来自真实程序、真实 provider 或明确的 `UNKNOWN`；没有模拟、自报或隐式降级。
8. OpenCode/Grok 若没有真实程序、账号、网络、平台或可确认协议，候选保留 `BLOCKED` 证据和具体缺失条件；不得以跳过、通用 ACP、DSH SDK、普通 shell 或硬审核进程充当通过。
9. 代码、测试、Loader composition、built artifact、README/JSDoc、双语文档、Agent Note、必要 snapshot 和候选审计记录完整。
10. 真实 OpenCode `zhipuai-coding-plan/glm-5.3 --variant max` 对当前固定候选执行只读硬审核，并在 `development/nodes/P0-B/reviews/r01.json` 中给出明确 `PASS`。硬审核失败时，按审核意见修复、重新测试、重新固定候选并再次审核；不得在无明确 `PASS` 时进入下一节点。

**下一节点准入：** 只有 P0-B 实现完成、所有适用验证实际通过、所有 BLOCKED 项已经由用户授权条件解决或明确记录为本节点不可交付缺口、四个 harness 的候选和证据固定、文档和审计记录完整，并且真实 OpenCode `zhipuai-coding-plan/glm-5.3 --variant max` 对当前候选明确给出 `PASS`，才允许调用真实 Codex 规划下一节点。不得在本计划批准前实施 P0-C。
