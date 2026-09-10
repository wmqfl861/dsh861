# Windows 无密钥修复接收与整合交接

更新：2026-09-10。适用仓库仅为 `wmqfl861/dsh861`。本页是当前协作入口，不是指定 Codex 节点计划或 OpenCode 硬审核，不授予产品 PASS。

## 已接收的修复与唯一开发入口

统一开发分支为 `feat/multi-agent-company-nodes`，向 `master` 的集成入口仍是 PR #2。Windows 修复分支的提交 `2a62e488856eee00688740a287abc3cceb90d399` 已通过 PR #5 合入开发分支，合并提交为 `c896db947cef531ef0c6f73354f4687bedd09e94`。原 17 处修复提交 `6c4a64fdb1c2c45f5c5c84d1e6ecd3e9d0974e5d` 及失败记录保留。接手时 fetch 并核对实际 HEAD，不把旧提交当作回退目标。

本地工作目录为 `C:\Albert\project\dsh861`。不用重新克隆、安装 Node 或重做文档修复；沿用已验证的 Node 26.4.0、专用 pnpm 11.7.0 和现有依赖。远端已核对两个旧文档分支引用不存在。PR #3/#4 已包含在开发分支，评论 `5609931895` 的重复文档候选继续停用，不重新应用其 helper 或补丁。

## 验证事实与可取回证据

| 证据 | 能支持的结论 | 不能据此声称 |
|---|---|---|
| [Windows 回执](../remediation/2026-09-10/windows-keyless-r06/verification.json) | 本地实际完成六组配对、12 个快照核验、完整 test:docs 15/15、doc-sync 33/33、完整 lint；原行为回归按不变源码复用。 | 当前会话重新运行了 Windows、四种真实 CLI 或所有压缩日志。 |
| [源码候选](../remediation/2026-09-10/windows-keyless-r06/candidate-manifest.json) | 记录本地源码指纹、受保护文件及原 17 处修复；绑定其说明的代码版本。 | 后续提交自动继承完整验收，或远端已重算全部 9,299 个源文件。 |
| [发布回执](../remediation/2026-09-10/windows-keyless-r06/publication.json) | 与远端分支及提交读回共同核对发布事实。 | 本地工作区此刻仍干净，或凭据／原生执行已就绪。 |
| [远端补充复核](../remediation/2026-09-10/windows-keyless-r06/remote-review.json) | 已审查源码差异及可读 JSON 回执；独立复现旧输出判定问题，修复后 1,892 组合与反序检查通过。 | 指定独立硬审核、完整类型检查或 Windows 重跑。 |

原始可携带材料为 [prior-validation.zip](../remediation/2026-09-10/windows-keyless-r06/prior-validation.zip)、[validation.zip](../remediation/2026-09-10/windows-keyless-r06/validation.zip) 和 [publication.zip](../remediation/2026-09-10/windows-keyless-r06/publication.zip)，配有各自导出清单；远端纯函数复核的源码、脚本与输出随本次对话交付为 `dsh861_r06_remote_review.zip`，摘要记录在远端补充复核 JSON 中；没有在仓库写入另一份源码实现。本会话无法从网络下载前三份 ZIP，未独立展开或全量重算；已读回的结构化回执不冒充这些操作。

旧 r05 转述摘要和 r01/r02 中“尚未推送、文档失败”的描述属于当时输入，已由 r06 和本页的接收事实接续；保留旧内容，不再要求本地重复完成这些收尾。旧测试回执绑定其当时源码，不将后续状态／交接文档更新重新标成原完整门禁已运行。

## 当前剩余边界

[P0-B 状态](../nodes/P0-B/state.json)仍为 blocked，正式计划仍为 v3，candidate 与 hard_review 尚为空。模型声明与锁、依赖锁保持原值。Node/libuv 的偶发 `UV_HANDLE_CLOSING` 未复发不等于根因已解决；Windows ACL、父包装进程先退出后的完整后代清理、真实产品与完整 Loader 回合仍未验证。

下一项依赖是[节点规则](../../NODE_DEVELOPMENT_RULES.md)指定的真实 Codex 后继规划及其安全调用前置条件，不是再次全量执行已经通过的安装、文档与无密钥测试。所有者授权的仓库实施、有限修复与正常提交／推送继续适用；具体模型、权限或费用变更不由一般开发授权替代。

## 本地下一项任务：安全预检与真实后继规划

先在干净工作区正常整合 `origin/feat/multi-agent-company-nodes`；存在新工作则保留，不自动 stash、强制重置或覆盖。原 Windows 修复分支可保留用于追溯，不需要重新发布同一补丁。新增工作使用当前节点专用分支。

读取[请求 r01](../nodes/P0-B/plan-revision-request.r01.md)、[请求 r02](../nodes/P0-B/plan-revision-request.r02.md)、[主规格](../../MULTI_AGENT_REQUIREMENTS.md)、[配置参考](../../config/agents/README.zh.md)和[控制台补充](../requirements/WEB_CONTROL_CONSOLE_SUPPLEMENT.v1.md)，以本页及 r06 纠正旧状态。新增网页范围不等于 P0-B 必须实现完整公网后台。

第一步仅做无密钥预检：确认本次批准的真实 Codex 程序绝对路径、来源、版本和摘要，核对其原生 schema／帮助／源码对指定模型、provider、协议及 `max` 的接受情况。预检使用专用空目录与隔离配置，不读取全局认证、聊天密钥或其他项目配置，不为试探参数先请求模型。不能从 `--help`、配置文件存在或模型自述推断真实调用已成功。

规划调用还需要：已轮换且明确授权给本次任务的专用凭据引用、可验证的传输保护、所需读取范围、执行预算和输出保护。只检查授权引用的就绪状态，不枚举全部秘密。没有这些条件时生成一次不含秘密的阻塞清单并交回，不尝试旧 Key、不关闭 TLS 检查、不改变端点、不静默映射 `max` 为其他等级。

条件全部成立时，按节点规则调用真实 Codex，以固定输入提交和获准参数编写正式后继计划。保留独立身份、程序、实际请求设置与可观察返回、提示词摘要、时间、退出码及脱敏产物；不可观察字段保留 UNKNOWN。原生不接受配置时停止，实施者不能替它署名编写 plan.v4。

后继计划必须收敛当前节点完成标准：使用原 AC 含义及节点独立用例 ID；分开 nativeResume 与 artifactHandoff；包含四产品真实入口、必要适配和配置兑现、Windows 权限／完整后代清理、取消及外部观察；明确全局工具治理、数据库和完整界面的后续归属。复用已通过且源码未变的检查，不能削弱主规格或无限扩大当前节点。

本轮本地交付先到真实计划及其前置证据；不同时改动待审源码并执行最终 OpenCode 硬审核。指定 OpenCode 审核在计划内实施与候选证据齐备后进行。任何节点通过都仍须匹配当时固定候选，不进入 P0-C，不自动合并 master。

新回报须给出固定输入提交、实际程序和参数证据、真实后继计划或精确阻塞、可取回的脱敏回执，以及正常推送的分支和 SHA。只需补齐真正缺少的前置条件，不再要求用户提供已有的四套非密钥配置或重装已通过的环境。
