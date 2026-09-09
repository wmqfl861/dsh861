# GBrain 共享记忆适配评估

评估日期：2026-09-08。

选型状态更新：用户随后明确要求平台与 GBrain 使用 PostgreSQL，并授权确定其余产品需求；[现行主规格](MULTI_AGENT_REQUIREMENTS.md)已将 GBrain + PostgreSQL 选为长期记忆方案。本文保留选型前的兼容性评估和未完成验证，以下“候选”表述是评估结论，不再表示产品选型等待决定；选定组件不等于已经通过运行验证。

评估对象暂按用户所称 gbrain 对应 [garrytan/gbrain](https://github.com/garrytan/gbrain) 理解；用户尚未提供项目链接。已核实其仓库描述为 “Garry's Opinionated OpenClaw/Hermes Agent Brain”，许可证为 MIT。本次读取固定在提交 [`2efaaf8f8a817b5b82e023383618fdcdb1cc5f7d`](https://github.com/garrytan/gbrain/tree/2efaaf8f8a817b5b82e023383618fdcdb1cc5f7d)，[package.json](https://github.com/garrytan/gbrain/blob/2efaaf8f8a817b5b82e023383618fdcdb1cc5f7d/package.json) 声明版本为 `0.48.4.0`、运行环境为 Bun `>=1.3.10`。

本文对照 [开发需求](MULTI_AGENT_REQUIREMENTS.md) 中已经明确及正在讨论的记忆需求，不把仍在讨论的权限或记忆范围视为已确认决定。本次只阅读官方仓库文档及局部源码，没有安装软件、执行产品测试、调用真实 agent、配置凭据或修改任何模型设置。

## 结论

GBrain 具有共享长期记忆组件所需的多项基础能力，包括统一 MCP 记忆接口、持久存储、检索、事实来源、上下文组装、多 source 数据组织和 OAuth 读写授权，值得保留为候选。它不只是一个向量索引。

不能认定它开箱即用且完全满足本系统需求。岗位身份与 GBrain 权限的映射、跨 harness 一致的读取和写回行为、中文与项目资料检索效果、并发写入与事实冲突规则、独立部署和运行审计仍需明确并验证。系统工作流状态和原生会话不能仅凭共享记忆接口自动接续。

## 与用户需求的对应关系

| 用户需要或正在讨论的能力 | 当前依据 | 评估 |
|---|---|---|
| 系统集中提供记忆，各 harness 通过系统访问 | GBrain 提供 stdio 和 HTTP MCP，记忆动词有稳定的协议说明。 | 有适合作为系统后端的接口；dsh 的连接、身份传递和权限执行仍需集成。 |
| 更换 harness 后保留成员记忆 | 记忆存储独立于 CLI 会话，提供 recall、context_pack、delta。 | 能支持保存内容的连续访问；不等于保留原生会话、全部上下文或相同模型判断。 |
| 共享记忆与岗位或成员私有记忆并存 | 多 source、单 source 写入授权、跨 source 读集合和写入前缀限制。 | 有基础，但读权限按 source 粒度划分；单一 source 内不同文件夹不构成读取隔离。 |
| 使用用户指定的 Grok CLI | 官方 GBrain Grok 文档明确标识 `@xai-official/grok`，并声明验证到 Grok Build v1.0.4。 | 接入对象相符；不证明用户将安装的 latest 版本以及 dsh 集成已通过验证。 |
| 记忆自动读取、及时写回 | 有主动拉取和部分 harness 原生 hook 接入，自动写回默认关闭。 | 产品间行为不同，尤其集中服务方式不能自动获得原生 hook 的全部能力。 |
| 多个 agent 并发访问 | 公司脑文档采用 Postgres，另有 PGLite 锁和部分页面写入锁。 | 并发基础存在；本次未验证容量或所有操作，存储锁也不等于业务事实冲突已正确处理。 |
| 来源可追溯、记忆可更正 | 记忆接口包含 provenance、有效期、forget、证据及成本字段。 | 支持来源与失效管理；来源字段本身不证明内容真实，也未证明所有更正都经过所需审批。 |
| 与全局安装完全隔离 | GBrain 有可配置的 home 与独立服务接入方式，常规 bootstrap 同时包含用户级配置写入。 | 可隔离部署的可能性存在；默认安装流程不能直接视为符合本系统要求。 |
| Windows 环境运行 | 当前 Codex 插件路径明确限定 Unix；没有取得完整 Windows 原生部署验证证据。 | 属于待验证适配项，不据此断言整个服务不支持 Windows。 |
| 工作流进度、任务交接和审批可恢复 | GBrain 自身有 Minions 队列及持久 agent 功能，但本次未审查它们与 dsh 的整合。 | 这些功能存在不代表能替代 dsh 工作流状态、人工审批或真实外部 CLI 的恢复。 |
| 岗位 skill 和工具权限 | 公司脑指南明确 skill 的岗位路由约定由宿主 harness 执行。 | GBrain 的数据授权不能自动完成系统级 skill/工具权限控制。 |

## 关键官方证据

### 统一记忆服务及原生会话的区别

[MEMORY_VERBS v1](https://github.com/garrytan/gbrain/blob/2efaaf8f8a817b5b82e023383618fdcdb1cc5f7d/docs/protocol/MEMORY_VERBS_v1.md)描述七个动词：recall、remember、entity、synthesize、forget、context_pack、delta。记忆返回包含来源、证据和预算信息；context_pack 面向新会话或上下文压缩后的组装，delta 获取游标之后的变化。

这套接口可以让不同 harness 访问同一份持久内容，但需要调用方确实获取并使用内容，也需要新的事实被成功写入。它不会复制某个 harness 的原生运行状态。context_pack 会受实体数量与 token 预算限制，delta 有至少一次交付和游标语义；不能把有上下文接口表述为完整历史总能进入每次模型请求。

### 共享与岗位隔离的具体粒度

[公司脑指南](https://github.com/garrytan/gbrain/blob/2efaaf8f8a817b5b82e023383618fdcdb1cc5f7d/docs/tutorials/company-brain.md#two-scoping-models-pick-the-one-that-matches-your-shape)区分 source 级 OAuth 隔离与同一 source 的目录约定。读权限维持 source 粒度；具有某 source 读取权限的客户端能读取该 source 内全部文件夹。目录前缀可以限制部分写入，不能代替文件夹级读取授权。

[部署说明](https://github.com/garrytan/gbrain/blob/2efaaf8f8a817b5b82e023383618fdcdb1cc5f7d/docs/mcp/DEPLOY.md)说明客户端有一个写 source，并可配置多个可读 source。绑定 slug 前缀会使不能严格限制到前缀的部分操作不可用，因此不能未经检查就把同一套记忆动词授予所有绑定方式。

[HTTP 实现](https://github.com/garrytan/gbrain/blob/2efaaf8f8a817b5b82e023383618fdcdb1cc5f7d/src/commands/serve-http.ts#L2405)在列举工具与调用工具时检查 scopes 和绑定条件；[dispatch 实现](https://github.com/garrytan/gbrain/blob/2efaaf8f8a817b5b82e023383618fdcdb1cc5f7d/src/mcp/dispatch.ts#L634)对远程调用缺少已解析 source 的情况返回失败。这是局部实现证据，不是对全部接口的权限审计。

同一协议中的事实 `visibility=private` 仅供可信本地 CLI/hook 读取，远程 MCP 不能通过 `include_private` 扩大读取；`world` 表示对该脑中具有相应数据授权的客户端可读，不表示互联网公开。因此“某岗位私有但可跨 harness 使用”不能仅等同于写入 `private`，需要完整定义成员与 source 的授权关系。

### 各 harness 的接入与写回并不相同

[Grok 接入指南](https://github.com/garrytan/gbrain/blob/2efaaf8f8a817b5b82e023383618fdcdb1cc5f7d/docs/mcp/GROK.md)明确目标为 xAI 官方 Grok Build，而非社区同名 CLI，安装包名与用户指定的 `@xai-official/grok` 一致。指南提供的是记忆接入；Grok 的完整持久个人 agent bootstrap 尚未支持。文档亦指出工作区中的普通 skills 目录不一定被 Grok 当成原生 skills 自动发现。

[Ambient recall](https://github.com/garrytan/gbrain/blob/2efaaf8f8a817b5b82e023383618fdcdb1cc5f7d/docs/guides/ambient-recall.md)提供可移植的主动拉取接口，同时描述部分产品的原生注入。不同入口不等于自动具有一致的生命周期行为。

[Ambient writeback](https://github.com/garrytan/gbrain/blob/2efaaf8f8a817b5b82e023383618fdcdb1cc5f7d/docs/guides/ambient-writeback.md#per-harness-reality-honest-limitations)明确自动写回默认关闭：Claude Code 有 Stop-hook 后备路径，Codex 的后备为延后处理会话记录，OpenCode 等主要依靠 MCP 指令而未接入同等后备。上述是 GBrain 集成路径现状，不是对这些 CLI 全部原生能力的审计。MCP 能连接、工具能列出，不能证明每次需要记忆时都成功读写。

### 并发、语义冲突与记录可靠性

[公司脑指南](https://github.com/garrytan/gbrain/blob/2efaaf8f8a817b5b82e023383618fdcdb1cc5f7d/docs/tutorials/company-brain.md#part-2-switch-the-brain-backend-to-multi-user-postgres)对多人共享部署采用 Postgres。[serve/sync 并发说明](https://github.com/garrytan/gbrain/blob/2efaaf8f8a817b5b82e023383618fdcdb1cc5f7d/docs/architecture/serve-sync-concurrency.md)解释 PGLite 的单写入者所有权及运行中同步限制；[页面锁源码](https://github.com/garrytan/gbrain/blob/2efaaf8f8a817b5b82e023383618fdcdb1cc5f7d/src/core/page-lock.ts)包含页面读改写锁。这些不证明所有接口已经免于并发问题，也不决定两个 agent 对同一事实给出相反结论时谁能覆盖谁。

记忆的来源、TTL 和失效操作有协议依据，但共享事实何时进入正式知识、如何审批更正、怎样处理错误提取、删除范围和备份恢复仍需与需求逐项对应。协议中的 forget 是使事实失效，不等于从数据库、文件、备份或既有模型上下文中彻底删除全部副本。

[SECURITY.md 的审计说明](https://github.com/garrytan/gbrain/blob/2efaaf8f8a817b5b82e023383618fdcdb1cc5f7d/SECURITY.md#audit-log)及 HTTP 代码包含请求日志与默认参数脱敏。其审计失败不阻断请求的设计不能当作完整、不可缺失的业务审计或 dsh 模型输入重放保证。

### 部署与模型成本需单独确认

[Codex 插件指南](https://github.com/garrytan/gbrain/blob/2efaaf8f8a817b5b82e023383618fdcdb1cc5f7d/docs/mcp/CODEX.md)明确该原生插件启动路径为 Unix（macOS/Linux）限定。将 GBrain 作为独立 MCP 服务与安装该插件是不同部署路径，本次没有验证 Windows 上服务、进程、路径和持久数据行为。

[README](https://github.com/garrytan/gbrain/blob/2efaaf8f8a817b5b82e023383618fdcdb1cc5f7d/README.md)和记忆协议区分关键词检索、embedding、reranker 以及 LLM synthesis 等路径。Synthesize 会额外调用模型，部分自动提取和去重也依赖提供商能力。选用 GBrain 不等于授权任何 embedding、重排或推理模型及其 endpoint、Key 或成本设置；这些仍遵守用户的模型配置授权要求。中文检索、项目术语召回与长期记忆质量尚未使用用户资料验证。

## 发现的文档不一致

同一固定提交的 [SECURITY.md 第184行](https://github.com/garrytan/gbrain/blob/2efaaf8f8a817b5b82e023383618fdcdb1cc5f7d/SECURITY.md#L184)仍称 HTTP 需要 Postgres，而 [DEPLOY.md](https://github.com/garrytan/gbrain/blob/2efaaf8f8a817b5b82e023383618fdcdb1cc5f7d/docs/mcp/DEPLOY.md)明确支持两种引擎。[serve-http.ts 第860行](https://github.com/garrytan/gbrain/blob/2efaaf8f8a817b5b82e023383618fdcdb1cc5f7d/src/commands/serve-http.ts#L860)显示已通过引擎适配处理 PGLite。本评估不采用“HTTP 只能 Postgres”的旧文档结论，实际部署仍需要运行验证。

## 尚未完成的适配验证

- 同一成员通过不同真实 harness 写入、读取、更正和失效同一事实，确认稳定身份与授权不因切换而改变。
- 共享、项目和成员私有区域之间的读取拒绝与写入拒绝；确认直接调用未授权操作同样失败，而不只是列表隐藏。
- 多个成员同时写入或更正同一条记录、服务中断与重试后，检查内容、版本、来源和失败记录。
- 使用真实中文需求与项目资料验证召回和错误更正，不把第三方或仓库自报分数等同于本系统结果。
- 验证系统专用配置、凭据、原生 CLI 环境和 GBrain 运行数据的隔离，以及所选部署环境的可运行性。
- 确认哪些任务状态仍由工作流负责，并验证记忆服务不可用时实际任务状态、权限与失败报告仍然准确。

这些是判断是否满足需求所需的验证范围，不是已经执行的测试，也不是本轮安装或开发计划。

## 调研方法与工具限制

Exa 未配置，zread 与 web_reader 不在本次可调用 MCP 列表中；GitHub CLI 未认证，读取请求未成功。Firecrawl 搜索定位项目，随后取得官方 GitHub 页正文；GitHub 公共 API 和固定提交的 raw 文件用于核实项目身份、版本与具体文档源码。本次没有读取或改动任何用户凭据，也未将第三方介绍中的功能声称作为最终能力证据。
