# 2026-09-09 审查整改与交接

[English](README.md) | 中文

起点：`feat/multi-agent-company-nodes` @ `673ba77593e3100c1245601a53fb36b7f85ddb10`。实施身份：ChatGPT，按用户“好的，按你推荐的做，你直接更新仓库”的本轮授权进行维护整改。不是指定 Codex、ZCode 或 OpenCode 的调用记录。

## 已落地的维护修复

| 项目 | 本轮结果 | 仍不能据此声称 |
|---|---|---|
| AC 映射 | 新增 `../../nodes/P0-B/acceptance-map.r01.json`；纠正 AC-04/10/21/23/24 对应，并新增从主规格核验标题和版本的命令。 | 产品 AC 已通过。 |
| 计划范围 | 新增后继计划请求，明确 nativeResume 与 artifactHandoff，以及 P0-B 与后续中央控制面的边界。旧计划不改写。 | 已有新的真实 Codex 计划。 |
| 交接状态 | `CURRENT_NODE.json` 选择 P0-B，NODE_STATUS 由节点 state 生成；P0-B 明确等待修订，不开放 P0-C。 | P0-A 历史 PASS 认证了当前整个提交。 |
| B2 runner | 拒绝未知/重复/歧义参数；BLOCKED 返回 2；证据保留；入口兼容不具备 import.meta.main 的引擎。 | 启动了真实产品或完成原生适配。 |
| 假 PASS | 保留旧 schema，增加严格 foundation overlay 与语义 guard；无观察的旧格式不能认作 PASS。 | 原生 product evidence v2 已实现。 |
| 候选摘要 | 增加固定 Git blob/保留字节校验，拒绝越界、重复和空清单；LF/CRLF 差异始终失败，只提供诊断。 | 历史候选已被重新独立认证。 |

运行命令和证据见 [验证回执](verification.r01.json)。全部离线测试使用合成数据；通过数仅属于维护回归。新脚本尚未接入仓库的全部 CI/文档门禁，不能把可运行的独立命令描述为已覆盖每次提交的强制门禁。

## 历史完整性

不修改 P0-A 的计划、state、候选、审核及 evidence，不修改 P0-B plan.v1/v2/v3、schema.v1 或旧测试回执，不改模型、Key、provider、endpoint、锁文件或原生 Session 格式，不合并 master。

旧 `acp-fixture-before-v15.json` 的 Git blob 是 664 字节；candidate.r03 记录 681 字节。历史审查发现，重建 CRLF 后的摘要与候选一致。此项是字节口径漂移，不是恶意篡改结论。新校验器不得将此诊断转为 PASS，不通过修改旧数字掩盖差异。后续候选应绑定不可变 Git tree 或可取回的原始字节归档。

## 必须继续处理的事项

**正式计划与审核：** P0-B v3 保留为历史版本，状态为 blocked。指定真实 Codex 必须发布后继版本，包含明确有限的节点完成条件；新的候选还要经指定真实 OpenCode 审核。不得使用本轮维护代码、JSON 状态或测试退出码代替其真实调用。

**凭据：** 暴露凭据是否已经轮换尚未核实。本轮没有读取或更改秘密值，也无法替凭据管理者确认供应商侧撤销。未确认前，不继续使用受影响凭据进行真实调用。参见根目录 `SECURITY_CREDENTIAL_ROTATION.md`。

**stderr 通道：** `packages/subagent/subagent-codex/src/run.ts` 的原始 stderr 转发未在本轮更改。需要在宿主转发和任何落盘之前脱敏，并测试跨块、编码、错误对象和退出分支。没有真实凭据泄漏复现，也不能把未复现解释为安全。此项应纳入运行时安全修复候选，不用于当前真实受限任务。

**真实适配和 v2 证据：** 四产品 allow/deny/cancel、外部 collector、受控工具连接、真实产物交接及 product evidence v2 尚未完成。本轮 guard 只针对旧 adapterless B2，不能替代这些任务。

**独立复核：** 需要在受支持 Node/pnpm 环境运行受影响仓库测试、lint、文档门禁与 source/artifact smoke；本轮只做单文件 TypeScript 严格编译和离线控制。不能声称 Windows、实际 CLI、PostgreSQL、GBrain 或三端交付已通过。

## 后继设计应具体化的需求

隔离需区分配置发现隔离与操作系统级目录/网络/进程限制，并按执行节点登记可保证的等级；不能兑现所需等级的岗位应拒绝启动。人类协作者需要明确登录、邀请、撤权、恢复和谁能批准发布或修改铁律。

持久执行需要定义状态转换、task/run/attempt 的关系、派发租约、稳定操作标识、断联后的旧 worker 结果处理以及审批版本失效规则；不要只靠日志或模型自由文本维护状态。

记忆需要中文检索、来源、更正、失效及撤权后的搜索/直接读取负向用例。设计交付需要明确实际接受的可编辑源格式、素材来源和版本。以上是要纳入所属节点设计的验收细化，不是本轮已经交付的功能，也不授权新增模型或付费服务。

## 接手顺序

先读取生成的 `development/NODE_STATUS.md` 与 P0-B state；核实凭据阻塞；让指定规划者处理后继请求；将本轮维护修改纳入新的候选和必要复验；完成当前节点真实证据及硬审核后再按原有规则推进。不要覆盖原始失败或将局部回归 PASS 写成产品 PASS。
