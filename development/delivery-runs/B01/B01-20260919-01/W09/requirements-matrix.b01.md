# W09 执行版需求矩阵（AC-01—AC-32，B01-20260919-01）

状态口径见 [00-start.md](00-start.md) §3。引用 `E##` 为附录 A 证据条目（路径 + HEAD `f5ab2fed` blob）。
消费者均为已核实的真实调用链；"未开工"指已检索 tracked 源码无实现（方法见 00-start §2）。

| AC | 状态 | 已有实现（真实源码路径） | 真实消费者 | 局部测试 | 下一所属阶段 | 证据 |
|---|---|---|---|---|---|---|
| AC-01 四种 harness 接入 | partial_evidence | 仅 2/4 有产品后端：Codex `packages/subagent/subagent-codex`（pin `@openai/codex@0.154.0`，E06）；Claude Code `packages/subagent/subagent-claude-code`（pin `@anthropic-ai/claude-agent-sdk@0.3.269` + `@anthropic-ai/sdk@0.125.0`，E10）。ACP 通用后端 `packages/subagent/subagent-acp`（E11/E12）可接任意 ACP agent 但不等于 OpenCode 适配。OpenCode CLI 适配：零实现（tracked 全仓检索，`opencode` 仅出现于 pi-ai 模型目录与注释）。Grok CLI（`@xai-official/grok`）：零匹配 | 注册链：Bundle `cordis.patch.yml`（E04）在 Profile 安装后把 provider 注册上 `ctx.subagents`（seam E13）；消费链：`dsh-tool-subagent`（E15）工具行，standard/cordis/ptc 预设携带 `disabled: true` 的 `subagent_codex`/`subagent_claude_code` 行（E17），安装 Bundle 并复制预设启用后才暴露给模型 | codex 15 个测试文件含 `real-product.spec.ts`（E5，pin 载荷+fixture 模型端点的 keyless 真实产品验证）、`loader-composition.e2e.ts`、`subagent-codex.spec.ts`；claude-code 8 个含 `real-product.spec.ts`（E9）；acp 7 个 | P0-B（四者矩阵+真实验收）、P1 | E01–E06, E11–E13, E15, E17 |
| AC-02 全局隔离 | partial_evidence | `packages/util/home-paths`（E19，DSH_HOME 解析）、`packages/util/launch-environment`（E20，分层信任环境快照）、`packages/credentials/credentials-local`（E21，home 私有凭据文件+固定优先级）、`packages/subprocess/subprocess-local/src/spawn.ts`（E22，子进程环境擦除凭据与 `DSH_*`）；Desktop dev 默认独立 home（`apps/desktop/.desktop-build/development/home`） | base bundle 装配全部上述插件（E18）→ 每个 dsh profile 启动即消费 | 各包自带测试（credentials-local、launch-environment、subprocess-local 均有 tests/）；desktop specs 覆盖 owned-directory | P0-B（双向标记测试：全局环境不被加载/改写）、P1 | E18–E22 |
| AC-02 局限（不满足部分） | — | 产品后端 Codex/Claude Code **刻意保持 native 配置与登录权威**（两包 README"Native configuration/authentication remain authoritative"，经父 HOME/CODEX_HOME）；与 REQ-003"不读取继承全局 agent 数据"方向相反，属设计现状而非遗漏 | 同上 | — | P0-B 需按 REQ-003 决定隔离边界并验证 | E01, E07 |
| AC-03 配置和模型真实性 | partial_evidence | `packages/llm/llm`（E59，Service Definition/组装）、`llm-deepseek`、`agent-default-model`、凭据优先级（E21）、`tool-subagent/src/model-selection-settings.ts`、客户端 `ui-model-selection` | agent-loop 每步经 llm seam 发请求；模型可见请求可从 session log 重建（"model-visible ⟺ logged"仓库不变量，session E62） | llm/llm-deepseek/token-meter 各自 tests；`apps/web/tests/expected/models-settings/*` 快照 | P0-B、P1 | E18, E21, E59, E62 |
| AC-04 同成员换 harness | reusable_code | dsh 内部子代理续接：`packages/subagent/subagent/src/continuation.ts`（E14，历史种子子代理+continuation-activation）；匿名身份 `packages/identity/anonymous-user-id`（E53）。跨 harness 成员身份/记忆连续：零实现 | 续接经 `dsh-tool-subagent`（backgroundMode: continuable，E17）消费；匿名 ID 为底座遥测/会话标识 | subagent 16 个测试文件；`snapshots/sdk/subagent-teardown`（冻结 replay） | P0-B、P3（REQ-002 已明确不承诺原生会话迁移） | E13–E15, E17, E53 |
| AC-05 岗位空间并发 | reusable_code | `packages/experimental/agent-team`（E40：任务板 CAS、成员 roster、持久消息；E64）+ `tool-agent-team`（E41）+ `agent-team-profile`（E42）。限制：单进程、共享 checkout、writeScopes 仅 advisory（README 明示） | agent-team-profile 组合；`apps/cli/tests/agent-team-headless.e2e.ts`；`snapshots/sdk/agent-team-teardown` 场景 | 7 个测试文件 + sdk teardown 快照 + r46 queued/delivery fence 断言 | P1、P2 | E40–E42, E64 |
| AC-06 全局/项目铁律 | reusable_code | `packages/core/system-prompt`（E31，有序组装+agent 作用域覆盖）、`packages/context/agent-instructions`（E32，AGENTS.md 链加载+字节预算，base 默认启用）、`packages/hooks/hooks-codex`/`hooks-claude-code`（导入既有 hooks.json 的桥）。统一规则管理台/版本/合成顺序/冲突报告：零实现 | system-prompt 由 agent-loop 每模型步消费；agent-instructions 在 base bundle 装配（E18） | 两包 tests；快照含 system-prompt.expected.md 冻结对照 | P1 | E18, E31, E32 |
| AC-07 权限实际执行 | partial_evidence | `packages/sandbox/sandbox`（E25，read-only/workspace-write/danger 三档，无法强制时 `SANDBOX_UNAVAILABLE` 拒绝）、`sandbox-local`（E26）、`sandbox-policy`（E27）、`sandbox-windows-acl`（E28，Win32 ACL FFI）、`interaction/user-approval`（E29，一次性审批、缺 answerer 即 fail-closed）、`permission-presets`（E30）、`fs-observation-policy`、`fs-sandbox` | base bundle 装配 sandbox-local/policy、bash-sandbox、pwsh-sandbox、user-approval、fs 系列（E18）；README 载明 tools pipeline 与沙箱 shell 的 ask 决策路由到 user-approval | sandbox-local 8 个测试文件；user-approval 2 个；permission-presets、fs 系列各包 tests | P0-B（原生工具越权路径）、P1 | E18, E25–E30 |
| AC-08 铁律冲突和撤销 | unassessed（已检索无实现） | 无规则版本/冲突报告/撤销引擎；user-approval 的批准明确"仅对该请求生效"（E29 README），即当前设计不含授权复用或撤销语义 | — | — | P1、P5 | E29 |
| AC-09 授权复用 | unassessed（已检索无实现） | 无范围授权模型、无"批准对象变化致失效"逻辑 | — | — | P1 | — |
| AC-10 Skills 与工具集中提供 | reusable_code | `packages/skill/skill`（E33，注册表）、`skill-filesystem`（E34）、`tool-skill`（E35，模型目录+按需加载）、`skill-badge`、`packages/mcp/mcp-client`（E36，外部 MCP 工具桥接为 `mcp__<server>__<tool>`）、`packages/core/tools`（工具管线） | base bundle 装配 skill/skill-filesystem/skill-badge/tool-skill/mcp-client 由部署显式配置服务器（E18）；模型经 tool-skill 目录消费 | skill 1 个 + mcp-client 10 个测试文件 | P0-B、P3（岗位/项目/实例级授权维度不存在） | E18, E33–E36 |
| AC-11 UX/UI 与美工交付 | unassessed（已检索无实现；P4 未开工） | 无设计/美工岗位产物链（原型、可编辑素材、来源记录）零实现 | — | — | P4 | — |
| AC-12 网站交付 | unassessed（已检索：参考预约业务网站零实现） | `website/` 是本产品自身的 VitePress 双语文档站（E58 相邻的 `website/package.json`），不是 AC 要求的参考业务网站；无 React 业务应用 | website 由 `pnpm run website:build` 产出文档站 | website build 即死链检查 | P2、P4 | E65（apps/cli 入口相邻） |
| AC-13 Android 交付 | blocked | 零实现（react-native/expo/androidx tracked 检索仅命中 open-in-app 编辑器目录与示例配置，非交付代码） | — | — | P4；阻塞归因：未登记 Android 工具链节点与构建授权 | — |
| AC-14 iOS 交付 | blocked | 零实现（xcode 检索仅命中 open-in-app 打开编辑器功能） | — | — | P4；阻塞归因：需求明示需受支持 macOS/Xcode 节点或授权构建服务，当前无 | — |
| AC-15 微信小程序交付 | blocked | 零实现（taro/weapp/miniprogram 检索零产品命中） | — | — | P4；阻塞归因：AppID 与上传授权缺失，规格明示分列 | — |
| AC-16 PostgreSQL 数据隔离 | blocked | 产品源码零 PostgreSQL（tracked 检索 postgres/pgvector 零命中 src）。现有持久化：session JSONL（E44）、`storage-json`/`storage-sqlite`（E50）、`session-query-sqlite`（E51）——均为本地文件/SQLite，非 REQ-016 主库 | base bundle 装配 session-persistence-jsonl、storage-json、session-query-sqlite（E18） | storage-sqlite/session-query-sqlite 各包 tests | P0-C（未实例化/未进入）、P1；阻塞归因：无受管 PostgreSQL 服务与账号；P0-C 由 P0-B next_node_allowed=false（E68）与 B01 边界 PHASE_B01"不启动P0-C"（E69）阻断 | E18, E44, E50, E51, E68, E69 |
| AC-17 GBrain 跨 harness 记忆 | blocked | 集成代码零实现；仅有选型前评估文档 `GBRAIN_MEMORY_ASSESSMENT.md`（E57，固定 gbrain 0.48.4.0@2efaaf8 兼容性评估，明示"不能认定开箱即用"） | 无产品消费者（评估文档无代码消费方） | 无 | P0-C（未放行）、P3；阻塞归因：无 PostgreSQL 环境、无 embedding/记忆调用授权、P0-C 冻结 | E57 |
| AC-18 共享与私有知识 | blocked | 无 source 级知识权限系统（skill 目录无权限模型；GBrain 未接入） | — | — | P0-C、P3；阻塞归因：同 AC-16/17，且正反向权限测试需真实 source 数据 | — |
| AC-19 流程编辑和模板 | reusable_code | `packages/workflow/workflow`（E37，JS 脚本编排：agent()/parallel()/phase()）、`tool-workflow`（E38）、`workflow-worker-thread`（引擎）、`tool-ralph`、`plan-mode`（E39，计划作为 logged state）、`tool-todo`；客户端 `ui-plan`/`ui-workflow-run` | base/preset 装配 workflow 引擎与工具行（E17/E18）；模型经 workflow 工具提交脚本 | workflow 2 个测试文件；tool-workflow/plan-mode 各包 tests；快照场景 | P3（自然语言规划→结构化编辑→流程图/模板版本不存在） | E17, E18, E37–E39 |
| AC-20 独立审核与版本 | unassessed（产品内零实现） | 产品内无"审核绑定候选版本/改动失效"机制；本项目自身的节点硬审规则（NODE_DEVELOPMENT_RULES.md）是开发流程，非产品能力，且内部调用 Codex/OpenCode 记录按约束不计入验收 | — | — | P1、P2、P6 | — |
| AC-21 崩溃与交接 | partial_evidence | `packages/session/session-persistence`（E43，单写者、flush 持久屏障）+ `session-persistence-jsonl`（E44，每会话一条 append-only zstd JSONL）；agent-team 消息/任务板跨重启恢复（E40）；subagent 续接（E14）；`schedule` 提醒跨重启（关闭会话保持 overdue） | agent-loop 是 session 的生产发布点（发布前取得写句柄）；agent-team 依赖持久存储激活 | session-persistence 3 个测试文件；agent-team 7 个；desktop 重开读取会话属 W06 待验动作 | P1、P5（平台 worker 恢复未建） | E40, E43, E44 |
| AC-22 外部副作用重试 | unassessed（已检索无实现） | 无稳定操作标识/结果凭证/待核实状态机；`llm-retry`（E48）只重试模型请求（无外部副作用），jobs-local 明示"进程死即失、不持久"（E52） | llm-retry 在 base bundle 装配（E18） | llm-retry tests | P1、P5 | E18, E48, E52 |
| AC-23 取消与资源所有权 | partial_evidence | `packages/subprocess/subprocess`（E23，受管进程范围终止）、`subprocess-local`（E22）、`win32-process`（E24，Win32 FFI 进程树/Job 语义）、`guard/timeout-policy`（E49，协作超时→清晰模型错误）、`tool-subagent-control`（E16，owned contexts；r44 生产修复件 `owned-contexts.ts` blob `7713e57d…`）、jobs `job_kill` | 沙箱 shell、LSP、PTY、进程外子代理后端均经 subprocess seam（E23 README 载明）；base 装配 timeout-policy | subprocess 2 个测试文件；`snapshots/sdk/teardown.snapshot.ts` 两个真实关闭用例（r46 delivery fence） | P0-B、P1、P5 | E16, E18, E22–E24, E49 |
| AC-24 预算和限流 | reusable_code | `packages/llm/token-meter`（E47，确定性计量/上下文压力，不做决定）、`llm-retry`（E48，有界重试）、`jobs-local`（E52，单 owner 并发上限默认 10）。费用上限/达限停止收费/不换模型：零实现 | token-meter 在 base bundle 装配（E18），供压缩/占用显示/遥测消费 | token-meter 5 个测试文件 | P1、P5 | E18, E47, E48, E52 |
| AC-25 Codex 运行中升级 | unassessed（已检索：无组件版本并行/路由代码） | Desktop 整包更新（E55，electron-updater，`beforeRestart` 停自有进程后替换）是相邻能力但语义为"停机整包替换"，非 AC 的"旧流程续用旧版本、新流程用新版本" | update-coordinator 由 `apps/desktop/src/main.ts:275` 消费 | desktop tests（update 状态机） | P5 | E55, E56 |
| AC-26 工具和 skill 升级 | reusable_code | Desktop 插件管理：exact-version 依赖、升级校验、`desktop-runtime.json` 绑定清单、pending-build 审批（`allowBuilds`）；README 明示"无自动回滚"。skill 注册表无版本路由 | desktop main/profile-packages 消费；插件窗口提供 update/update-check 操作 | desktop specs（runtime-file-policy、package-target 等） | P1、P5 | E56, E66 |
| AC-27 组件回退 | unassessed（已检索且 README 明示不提供） | Desktop README 两处明示 "no automatic profile rollback"/"plugin changes have no automatic rollback"；无 60 秒路由回退机制 | — | — | P5 | E56（README 相邻） |
| AC-28 数据迁移不兼容 | partial_evidence | `packages/session/session-format`（E45，相邻迁移目录/无损校验）+ `session-format-v0-to-v1/v1-to-v2/v2-to-v3`（E46：V2→V3 完整规范含拒绝路径 refusal；已发布代次不可覆盖为仓库铁律） | 持久化恢复路径经静态 catalog 消费 | session-format-v2-to-v3 8 个测试文件；session-format 各包 tests | P5（平台数据库迁移维度未建；Session 记录维度已有实现+测试） | E45, E46 |
| AC-29 记忆或数据库失联 | blocked | 平台侧无数据库依赖可失联（无 PG）；REQ-016 的"数据库不可用时不确认接单"状态机零实现 | — | — | P0-C、P3、P5；阻塞归因：依赖 P0-C 数据库环境与真实失联注入验证 | — |
| AC-30 备份恢复 | blocked | 无备份/恢复演练代码或产物（RPO/RTO 验证零实现） | — | — | P5；阻塞归因：需独立恢复环境与真实数据集，规格明示不冒充 | — |
| AC-31 控制台和真实性 | partial_evidence | Web UI：`apps/web`（E54，薄入口）+ `packages/client/*`（会话/设置/模型/插件/审批/交付物/技能/子代理/工作流运行等 UI 包）；Web 服务 `packages/host/webserver`（E60）；BFF 装配 `packages/api/remotes`（E61）；Desktop 壳 `apps/desktop`（E56，Electron、无监听端口、framed byte pipes） | `apps/web` dist 由 apps/cli 的 `dsh web` 服务（E65 package.json 描述）；Desktop 经 `dsh-app://`+IPC 消费同一 Web UI | `apps/web/tests/expected/*` 快照；desktop 8+ specs；web-stress 配置存在 | P1、P3、P6（公司控制台语义——项目/岗位/规则/看板——不存在，当前为 dsh 会话控制台） | E54, E56, E60, E61, E65, E66 |
| AC-32 性能与代表性任务集 | reusable_code | `benchmarks/`（E58：active-stream-reconnect、agent-continuation、conversation-fold、long-session-browser、session-open 五套平台基准 + vitest.bench/web.perf 配置） | benchmarks 经 `vitest.bench.config.ts`/`vitest.web.perf.config.ts` 运行 | 基准即测试 | P6（参考环境代表性任务集/费用/人工介入记录不存在） | E58 |

## 统计

`product_accepted` 0 项；`partial_evidence` 8 项（AC-01/02/03/07/21/23/28/31；AC-02 局限为附注行，不计入 32 行口径）；`reusable_code` 8 项；`blocked` 8 项；`unassessed` 8 项。合计 32 行（AC-02 局限为附注行）。

## 附录 A：证据绑定（HEAD `f5ab2fed621988c559b1c7299a60562bba558e96` blob）

| # | 路径 | blob |
|---|---|---|
| E01 | packages/subagent/subagent-codex/src/index.ts | 825aaa848c55c5b5985d1b716d994793c7f32b49 |
| E02 | packages/subagent/subagent-codex/src/run.ts | 12abd405e3b24858a3ae5fc00e8c0be341821bab |
| E03 | packages/subagent/subagent-codex/src/wire.ts | 8e99c5ea6d37befc9f2843c02be37f1b2fe58ae3 |
| E04 | packages/subagent/subagent-codex/cordis.patch.yml | fb64fdcb9d2f55efab10e7df78ea3398975d8819 |
| E05 | packages/subagent/subagent-codex/tests/real-product.spec.ts | c8a32237c5eb49365636b78982e27b1ee1a2bf1f |
| E06 | packages/subagent/subagent-codex/package.json | cc57c5cb4876d90be8d64d9d102b9809100f4704 |
| E07 | packages/subagent/subagent-claude-code/src/index.ts | 9b9abce5dbf0b6890aa8882c87ec10be26cf7d3e |
| E08 | packages/subagent/subagent-claude-code/src/run.ts | dfe6c5fee70b108bc675958cc0f14ee2ba25de91 |
| E09 | packages/subagent/subagent-claude-code/tests/real-product.spec.ts | 776a6702121cfde8f825170b097a48adb4ff2d9a |
| E10 | packages/subagent/subagent-claude-code/package.json | 9bb358b7c98e30d93f072b41cf8ea91453aaa7b4 |
| E11 | packages/subagent/subagent-acp/src/index.ts | b9e8cf1a4527c428dc6bb8d29c01cfa614371601 |
| E12 | packages/subagent/subagent-acp/src/run.ts | 3164c5d634bf5943ad7d86e63f2d28b165a175ac |
| E13 | packages/subagent/subagent/src/index.ts | f68fe09fc73c1e438c698f9de64296390d60745e |
| E14 | packages/subagent/subagent/src/continuation.ts | b86d5cd836527d0f6d746297b32b0f584cd00db4 |
| E15 | packages/subagent/tool-subagent/src/index.ts | 4e8cc4b6b14779106d6a868ace1d99fd6abf5708 |
| E16 | packages/subagent/tool-subagent-control/src/index.ts | f66264cff462ddeeec042931a9b3ea61ebe43200 |
| E17 | packages/preset/agent-presets/presets/standard/agent.cordis.yml | b2c26e4ef0668344ff71168327d82cecfb9dc7ea |
| E18 | packages/bundle/base/cordis.patch.yml | f906ea8601e3158895697dce2663132ddf27ad17 |
| E19 | packages/util/home-paths/src/index.ts | 0d7b934003ac0d0d14dc473062f51700d77f036c |
| E20 | packages/util/launch-environment/src/index.ts | ddd6ecd46be42e1a43a2fc0a44fd646ab8dd4146 |
| E21 | packages/credentials/credentials-local/src/index.ts | 9bdece7bc653394e34e29e4d46e183375f5cc1ea |
| E22 | packages/subprocess/subprocess-local/src/spawn.ts | 9079716c71d391a55fc21a5841521cea997c0f25 |
| E23 | packages/subprocess/subprocess/src/index.ts | 0cda343664fd280e64abe7daa2ded33b970d1cb2 |
| E24 | packages/subprocess/win32-process/src/index.ts | 5fc6de85ce0305a9c6a16a734ed73ddadb0f418b |
| E25 | packages/sandbox/sandbox/src/index.ts | 2d9ee5b91b570e6f0ae53c65482dd49508628266 |
| E26 | packages/sandbox/sandbox-local/src/index.ts | 9e9b45a7413f71b76b5ea369d5216c3f46ba2949 |
| E27 | packages/sandbox/sandbox-policy/src/index.ts | ba688c97598f2fb6806db044225115d98ef4db20 |
| E28 | packages/sandbox/sandbox-windows-acl/src/index.ts | 5ebdccbd6a7cfb91e26afdab08610573835061e7 |
| E29 | packages/interaction/user-approval/src/index.ts | 8a5f506bf1bacdf2ed04f778774245e6464ced6a |
| E30 | packages/interaction/permission-presets/src/index.ts | 9e9a6ec91efc600907756ac4757c6121b7b6232d |
| E31 | packages/core/system-prompt/src/index.ts | d83cc4d2160450d4fcf0e9b17a9682aaba7b100d |
| E32 | packages/context/agent-instructions/src/index.ts | f775c30a9c6a1efa2a4537223c6d1106bbd9baae |
| E33 | packages/skill/skill/src/index.ts | 9c6bbf0ccfc87dfce966de1c9e83cb66275066af |
| E34 | packages/skill/skill-filesystem/src/index.ts | 80891dd274d638ec3bf814c0f4b1fb9b2489c3b8 |
| E35 | packages/skill/tool-skill/src/index.ts | 0099332fa27da10e154146959997e2427e3a767d |
| E36 | packages/mcp/mcp-client/src/index.ts | 59ef928751b64964a044a49e4da8f7ba051b3369 |
| E37 | packages/workflow/workflow/src/index.ts | e345ab55d4c028a793b66b0cf6b2d414b178f9c0 |
| E38 | packages/workflow/tool-workflow/src/index.ts | f422ab381cf849cfa4a203a9f88ef78ef54ddc41 |
| E39 | packages/plan/plan-mode/src/index.ts | e5910064de7f36f1783973c2048c2e0847e7ebff |
| E40 | packages/experimental/agent-team/src/index.ts | 2ccbbe95cafadf727ceb8c93376f8bd0a8e82bb3 |
| E41 | packages/experimental/tool-agent-team/src/index.ts | 824c042f233271bb01bab23800246a1add12de2e |
| E42 | packages/experimental/agent-team-profile/src/index.ts | 25d4e92224b148dc87baaafce12815aa2bb028a3 |
| E43 | packages/session/session-persistence/src/index.ts | f17ec2e7774062964237bea117160509db312f38 |
| E44 | packages/session/session-persistence-jsonl/src/index.ts | ba4f8996f08edc7f633891103309fd27f7815674 |
| E45 | packages/session/session-format/src/catalog.ts | b96b5a79c09a93e3d011d91276c3e80cb61f9244 |
| E46 | packages/session/session-format-v2-to-v3/src/index.ts | aeba87024551ac34039e1c50ab17bbdb0a3146a0 |
| E47 | packages/llm/token-meter/src/index.ts | 2693af5913d9995cea4b14404cc8d017cb86d400 |
| E48 | packages/llm/llm-retry/src/index.ts | 89ffc14c40d937af31499a2a945dfbabfe6100af |
| E49 | packages/guard/timeout-policy/src/index.ts | 9ee3c7026b52df87510f0af1d4c55b073d4168a2 |
| E50 | packages/storage/storage-sqlite/src/index.ts | 5cd59cadc24ff0817aa00920311d13cff17f6351 |
| E51 | packages/session-query/session-query-sqlite/src/index.ts | e0b24b3c390387fb9c63ff66bbefe84aba3e8ba7 |
| E52 | packages/jobs/jobs-local/src/index.ts | 8c71ae1b79efc7e0db423e0ea9d4178edf11778e |
| E53 | packages/identity/anonymous-user-id/src/index.ts | cc60fb580f9ffd76e04d4e181054c512f5e3c6f9 |
| E54 | apps/web/src/main.ts | 2ff361f3db106367b3daf8a835ad476b2ebf3a42 |
| E55 | apps/desktop/src/update-coordinator.ts | be629228d864295360b65e507574228599c1e99a |
| E56 | apps/desktop/src/main.ts | a73a6223a5bb03c7f568686b75a34c40197347c0 |
| E57 | GBRAIN_MEMORY_ASSESSMENT.md | d79de4e8c8f281da213a49ca8a5eeb176cb634de |
| E58 | benchmarks/package.json | 310a2f13339c74affe783c2abcd396dc06415310 |
| E59 | packages/llm/llm/src/index.ts | 367688c0d179a1bad9bd14ef3eb964511e2a211b |
| E60 | packages/host/webserver/src/index.ts | bc41100de9f9dcfcf105fba8fd8f6ac403f60937 |
| E61 | packages/api/remotes/src/index.ts | c75e55eefd9f96c4a88fa8f77836df903524c973 |
| E62 | packages/core/session/src/index.ts | 12e9ed19188e1d5e10659519f7063adc8dc984bb |
| E63 | packages/subagent/subagent-acp/package.json | 45e0f6c99ccf5f51514a785907061025f24e6850 |
| E64 | packages/experimental/agent-team/package.json | 75fa1040f755b96b4d28ef8c170bb388e80ff92d |
| E65 | apps/cli/package.json | f1a0004af7f9c147d384ba0b391cee8d4df9fa68 |
| E66 | apps/desktop/package.json | 4f8f83a2f51bec37ea9a8de637ec16ef23cd3668 |
| E67 | packages/preset/agent-presets/package.json | 2da30ab67729eadf9a5fb52bee00034c577e59b4 |
| E68 | development/nodes/P0-B/state.json | 4fa1dd1ab8f34e620a14e83fe4c9c7beea12665f |
| E69 | development/delivery-plan/PHASE_B01.md | 118970cd966aadc6602f977ee6aca5461bd54e97 |

补充绑定（formal-plan §6 已列，本次复核一致）：`packages/core/agent-loop/src/index.ts` blob `6df307bee573a93ddbf97a6dc87b86965a568c5f`；`packages/subagent/tool-subagent-control/tests/owned-contexts.ts` blob `7713e57d18adab01b5ed4ceb59c08ebb66e3bfd5`。
