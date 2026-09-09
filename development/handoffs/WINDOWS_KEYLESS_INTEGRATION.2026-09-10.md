# Windows 无密钥修复接收与整合交接

日期：2026-09-10。执行者：ChatGPT。本轮不调用本机插件，不执行真实产品，不代替指定规划或硬审核。

## 当前事实及证据等级

远端开发基线为 `9060d7113c4f4302b31459d618d66eae1d09f4c7`。用户转述本地 ZCode 内置执行子代理的报告：Windows 无密钥测试、有限修复及证据封存已完成，17 个已跟踪文件仍为未提交修改，分支为 `fix/windows-keyless-validation-20260909`，没有推送。原补丁、17 份快照、57 份命令记录和157项文件哈希尚未交给远端审查者。不得据此把远端旧代码标为已修复，也不能从文字摘要重建这些变更。

接收的是[转述摘要](../remediation/2026-09-10/docs-r05/local-report-received.json)，不是原始命令回执。摘要指纹 `216f6b85a74f0894de645a3f4c19b5564148526c3642d6e1cf754db63492ce31` 由用户提供，尚未独立重算。报告中的 lint 首次失败及后续 contracts-ready 成功保持为两个事实；test:docs 和 doc-sync 尚未整体通过。Node 26/libuv 的 UV_HANDLE_CLOSING 一次性崩溃仍未归因，后续通过不等于根治。

## 远端可独立完成的修复

补齐下面五个 README 的英文、中文和配对记录，不增加翻译或链接豁免。保留原始历史回执、候选、计划、日志和模型锁；历史回执中的源码哈希仍描述原来的提交，不自动改成新翻译文件的哈希。README 是对应维护轮次的说明，不宣称最新工作区已经通过验证。

| 英文说明 | 中文说明 |
|---|---|
| [B2 基础设施](../nodes/P0-B/evidence/README.md) | [中文](../nodes/P0-B/evidence/README.zh.md) |
| [初始维护](../remediation/2026-09-09/README.md) | [中文](../remediation/2026-09-09/README.zh.md) |
| [安全组件](../remediation/2026-09-09/security-r02/README.md) | [中文](../remediation/2026-09-09/security-r02/README.zh.md) |
| [模型声明](../remediation/2026-09-09/model-config-r03/README.md) | [中文](../remediation/2026-09-09/model-config-r03/README.zh.md) |
| [stderr 修复](../remediation/2026-09-09/codex-stderr-r04/README.md) | [中文](../remediation/2026-09-09/codex-stderr-r04/README.zh.md) |

[配置中文说明](../../config/agents/README.zh.md)的验证边界链接改为新增的中文对侧，并只更新其配对记录。正文中的模型、provider、endpoint、推理等级和 credentialRef 不变；没有替用户初始化凭据库。

专项检查验证六组配对的 Git blob hash、结构、代码围栏、已读取仓库清单中的链接和语言方向，另有五项负控。见[本轮验证记录](../remediation/2026-09-10/docs-r05/verification.json)。这些是独立 Python/Markdown 结构检查，不是原仓库 pnpm 门禁；完整文档门禁仍须在合并本地补丁后的 Windows 副本验证。

## 新增后台需求的交接

本分支以网页需求提交 `f3e7227c2356e0904d9562f52a5b6aea097c884e` 为父提交，包含[网页控制台需求补充](../requirements/WEB_CONTROL_CONSOLE_SUPPLEMENT.v1.md)。团队并行、组织架构与流程编辑、成员对话、任务状态和全站可折叠 Codex 管理助手没有因本轮文档修复而实现；后继规划须读取这些产品要求，但不能把整个公网后台变成 P0-B 的新前置条件。

新增[后继计划输入 r02](../nodes/P0-B/plan-revision-request.r02.md)补充本地报告及新增后台的约束。它是输入材料，不是 plan.v4；不改变当前节点的准入状态。原[请求 r01](../nodes/P0-B/plan-revision-request.r01.md)保留。

## 必须由本地执行端完成的下一步

在 `C:\Albert\project\dsh861` 使用上轮成功的 Node 26.4.0、专用 pnpm 11.7.0 和现有依赖，不重新克隆、不重装 Node，不调用 Remote Desktop Commander。

本轮所有者授权的目的，是把已有修复和脱敏证据安全发布给远端审查者。可以在专用修复分支上保存本地提交并正常推送；不强制推送、不推送 master、不自动合并 master，不把草稿 PR 当作节点 PASS。

先核对工作区和已封存清单，确认 17 处修改没有被新工作覆盖。只暂存本轮明确修改的源码、测试、文档和已检查的脱敏交接材料，不使用无差别 git add，不把凭据、全局认证、工具、缓存、node_modules 或聊天数据库纳入提交。关键命令、失败日志、回执索引、补丁和哈希必须可取回，不能只提交指向本机绝对路径的引用。

优先将这17处修复和必要证据保存成独立提交，再整合 `fix/docs-pairing-and-handoff-20260910`。保留原始57条命令和原候选指纹；整合之后的代码另建指纹，不把旧通过记录改写成对新树的认证。若提交钩子被尚未补齐的文档阻塞，不关闭钩子；先保存原字节补丁与清单，在明确保护本地修改的前提下整合文档并验证，或报告具体阻塞。冲突逐文件按两边原意解决，不整体选择 ours/theirs。

整合后先运行六组配对检查、test:docs，再运行本次修改所需的 doc-sync。纯文档改动不要求重新安装依赖或重复已通过的71项产品回归、31项审计、56项安全测试；若冲突解决改变了对应源码，则只对受影响范围补复测。遇到 UV_HANDLE_CLOSING 保存失败、当前环境及命令，不用重复执行直到偶然成功来代替诊断。

下面是文档门禁入口；实际调用使用上轮成功的专用 pnpm，不能误用全局旧版本。配对检查失败时先检查内容与语言链接，不直接重算哈希放行。

```sh
pnpm run verify-translation-pairing development/nodes/P0-B/evidence/README.md development/remediation/2026-09-09/README.md development/remediation/2026-09-09/security-r02/README.md development/remediation/2026-09-09/model-config-r03/README.md development/remediation/2026-09-09/codex-stderr-r04/README.md config/agents/README.md
pnpm run test:docs
pnpm run doc-sync
```

通过后把整合结果正常推送到自己的修复分支，创建目标为 `feat/multi-agent-company-nodes` 的草稿 PR。若无 PR 工具，推送成功后返回远端分支和 SHA 即可；远端审查者可代建 PR。若 push 失败，不因旧指令而一律“不提交”，而是保留本地提交，明确鉴权或网络错误并提供不含秘密的可上传补丁/证据包。

本轮不授权使用聊天中暴露的 Key、导入全局认证或绕过 HTTP 传输保护来完成规划；不猜测 max 的映射、不换模型。真实指定 Codex 规划和 OpenCode 审核属于后续实际调用；缺少安全凭据或兼容入口时如实保留阻塞。

最终返回：实际远端分支、提交 SHA、PR 编号、补丁及证据路径；六组配对、test:docs、doc-sync 的实际结果；是否有额外代码变动；模型配置和锁是否保持原字节；仍未完成的真实产品与硬审核条件。不要只再返回“17处未提交修改，下一步无”。
