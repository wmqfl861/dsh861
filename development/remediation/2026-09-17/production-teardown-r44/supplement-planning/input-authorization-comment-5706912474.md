## r44-B 阻断接收与授权优先级澄清：停止重复核验，等待所有者实际操作

本次重新读取PR：HEAD仍为 **`e8d1858ca6a65710c346007e48809580f6064beb`**，draft、base `feat/multi-agent-company-nodes`与未合并状态不变。查询上次更新之后的评论没有取得新的所有者范围批准。用户转达本地一次复探仍为0 credentials / Provider not found及零改动；本会话未访问该主机、未读取仓库外8个文件，也未重新执行或独立复核这次本地探测。

**当前没有新的开发轮要执行。** r44-A已归档，plan.v1与3个未跟踪保留原件不动；r44-B未启用，不重复auth/models探测、不重跑Codex、不再为相同阻断派审计或新增文件/提交。没有新实现，不重复下载旧CI包或把历史结果改标为新验收。

### 授权来源澄清

“审计链条一律以旧PR评论为准”不是本项目的授权规则。旧助手评论是当时的计划与状态记录，**不能否定所有者后来在当前会话或直接给本地执行者的明确、可追溯授权**。用户明确批准后，执行者保存该原话、适用范围与来源，同步记录到GitHub即可；不要求用户再到GitHub批准第二次，更不能因为旧评论仍写“待批准”而再循环阻断。

反之，助手提出的范围、引用的待批准模板、转述的agent回执，都不自动成为所有者授权。本次用户消息仍是继续任务并转交阻断报告，本评论不伪造“用户已经批准”，也不宣称认证已经恢复。`NODE_DEVELOPMENT_RULES.md`将额外范围/模型/凭据决定归用户，指定规划与硬审核继续有效。

### 用户本人完成的认证步骤

已核对[OpenCode官方CLI说明](https://opencode.ai/docs/cli/#auth)与[智谱官方OpenCode手动接入说明](https://docs.bigmodel.cn/cn/coding-plan/tool/opencode)：交互入口是 **`opencode auth login`**，选择 **Zhipu AI Coding Plan**，凭据只由用户本人输入其本机交互界面。不要把Key发到聊天、PR、命令参数或项目.env。使用本地执行者实际使用的同一Windows用户及既有OpenCode，不重装、不运行自动配置/安装助手、不随意切换普通Zhipu AI或其他provider。

文档是公开接入依据，不是对本机v1.18.26的执行证明。若该选项在实际界面不存在，或完成后仍无法解析既定provider，记录不含秘密的菜单/错误信息即可，不能擅自升级、添加自定义endpoint或改审核者绕过。`auth list`仅描述其列出的认证来源，`models <provider>`列出已配置provider的模型；0 credentials本身不是“所有认证途径绝对不存在”的通用证明，模型列表可见也不证明真实远程调用和max参数已获服务端接受。后者仍须在获准的真实调用中验证。

### 待所有者明确确认的有限范围（不是本评论自行批准）

原三个领域目标：
```
packages/experimental/agent-team/src/index.ts
packages/subagent/subagent/src/continuation-activation.ts
packages/subagent/subagent/src/index.ts
```
三个core扩展：
```
packages/core/agent/src/index.ts
packages/core/agent-loop/src/index.ts
packages/core/agent-loop/src/agent.ts
```
配套仅为 `scripts/smoke-python-runtime.py` 的本轮keyless/built-CLI支持，以及[既有r44-B清单](https://github.com/wmqfl861/dsh861/pull/13#issuecomment-5706434230)和冻结计划明列的直接测试、文档与新Session/SDK快照。不是整个core/scripts/SDK可写，也不批准vendor、scope、core inbox、session-projection框架、持久化/lease、锁、workflow、模型配置或P0-B state变更。

所有者明确批准后，范围条件即可登记为满足；认证尚缺则只保留认证阻断，不把范围重新退回“待批准”。认证完成而范围未批时则保留范围阻断。一次批准不免除真实旧接口轨迹、正式短补订、验证及固定候选硬审核。

### 给本地agent的最小接续说明（发生实际解锁后才用）

仅在收到所有者明确范围批准及“本人已完成既定认证”的新事实后：
1. 原样保存这两项输入，不以旧助手评论推翻较新的所有者授权，不要求重复批准；未发生变化则不再探测或审计。
2. 在既有授权和相同执行用户/工具环境中，仅做一次必要的provider/model元数据核验；不读取auth.json、Key、全环境或用户.env，不做未授权收费试问。确认目标仍为 `zhipuai-coding-plan/glm-5.3`，不自行换模型或降级max；失败只报告新增事实。
3. 满足适用准入后沿用[原r44-B任务](https://github.com/wmqfl861/dsh861/pull/13#issuecomment-5706434230)与[审阅补项](https://github.com/wmqfl861/dsh861/pull/13#issuecomment-5706427680)：指定规划者作有限短补充，旧接口真实取证，然后获准范围的实现、正负控、必要门禁与真实OpenCode固定候选硬审。原Codex argv/exit缺口不补造，不全量重规划。
4. 保留r43 observer、正常teardown成功期待、原40个用例和3个afterDispose回调；生产候选全部必需验证及硬审PASS后才正常hooks提交、非强制推送。PR保持draft、base不变，不合并、不进入P0-C。

没有新补丁或文件需要下载；计划与索引已经在固定e8d提交，现有工作树直接使用。接收副本时用[固定计划](https://github.com/wmqfl861/dsh861/blob/e8d1858ca6a65710c346007e48809580f6064beb/development/remediation/2026-09-17/production-teardown-r44/planning/plan.v1.md)及[归档索引](https://github.com/wmqfl861/dsh861/blob/e8d1858ca6a65710c346007e48809580f6064beb/development/remediation/2026-09-17/production-teardown-r44/archive-receipt.v1.md)，按索引核验后阅读；不得下载main覆盖或清理3个保留原件。

本轮远端仅完成状态/规则读取、公开认证入口核实及本说明，没有调用本机CLI、改凭据、产生源码提交或干预CI。下一步需要的是所有者一次明确范围决定与本人认证操作，不是又一轮BLOCKED审计。
