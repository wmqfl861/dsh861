# Windows 无密钥修复接收与整合交接

更新：2026-09-10。适用仓库仅为 `wmqfl861/dsh861`。本页是当前本地与远端协作入口，不是指定 Codex 节点计划或 OpenCode 硬审核，不授予产品 PASS。

## 唯一开发入口与已完成整合

统一开发分支为 `feat/multi-agent-company-nodes`，向 `master` 的集成入口是 PR #2。PR #4 已以 `76988bf576d556345ef57fa3be985b7bf26a7b4c` 合入开发分支，并包含 PR #3；拉取时以该开发分支实际 HEAD 为准，不另行叠加 PR #3 或 PR #4 补丁。

PR #2 评论 `5609931895` 中的另一套文档支持候选与上述修改重复。其五份英文译文及补丁生成 helper 不进入工作树，不再执行下载、生成或应用步骤；保留对象标识作历史追溯。该评论原有“不提交、不推送”要求不再控制本轮交付，按所有者当前授权正常提交并推送专用修复分支。

保留已合入的文档、需求及原始历史记录，不重写 Git 历史，不删除旧失败证据，不通过重建仓库来清理。本轮仅统一文档和交接；运行时代码、模型清单与锁、依赖锁和节点验收状态均不因整合改变。其他仓库的运行报告不能用作本项目的验证材料。

## 尚未取得的本地修复

本地目录为 `C:\Albert\project\dsh861`，上轮报告分支为 `fix/windows-keyless-validation-20260909`，报告所用基线为 `9060d7113c4f4302b31459d618d66eae1d09f4c7`。用户报告 17 个已跟踪文件修复仍未提交、未推送；原补丁、17 份快照、57 份命令记录及 157 项文件哈希尚未交给远端审查者。

[接收摘要](../remediation/2026-09-10/docs-r05/local-report-received.json)仅为用户转述，不是原始回执。候选指纹 `216f6b85a74f0894de645a3f4c19b5564148526c3642d6e1cf754db63492ce31` 尚未独立重算。不能根据该摘要重写修复代码，也不能把报告中的通过结果视为远端旧代码已通过。

上轮 lint 首次失败与后续 `lint:contracts-ready` 成功是不同执行事实；完整文档检查尚未确认通过。Node/libuv 的 `UV_HANDLE_CLOSING` 偶发退出、Windows ACL、后代进程残留场景、四种真实 CLI 和指定规划／审核仍按实际证据记录，不能因文档合并而闭合。

## 已选定的文档与需求

五组 development README 已形成英文、中文和配对记录，[配置参考](../../config/agents/README.zh.md)的中文链接已修正。维护轮次说明保留各自的历史实现与验证边界；旧执行回执中的哈希仍绑定当时内容，不自动认证后续翻译或修复。

[文档专项记录](../remediation/2026-09-10/docs-r05/verification.json)覆盖六组配对与五项负控；本轮重新运行了同一专项检查。它不是原仓库的完整 `verify-translation-pairing`、`test:docs` 或 `doc-sync`。当前环境无法通过网络克隆完整仓库，未重新安装全库依赖或执行 Windows 测试。

[网页控制台需求补充](../requirements/WEB_CONTROL_CONSOLE_SUPPLEMENT.v1.md)保留公网后台、多团队、组织与流程编辑、成员对话、任务状态及全站 Codex 管理助手的要求。[后继计划输入 r02](../nodes/P0-B/plan-revision-request.r02.md)与原[输入 r01](../nodes/P0-B/plan-revision-request.r01.md)供指定规划者使用，不是正式后继计划，不把整个后台变成 P0-B 的新增前置条件。

## 本地执行端的下一项任务

沿用已成功的 Node 26.4.0、专用 pnpm 11.7.0 和现有依赖，不重装、不重新克隆，不调用本机连接插件。先核对实际分支、工作区与原封存清单；若已经应用过另一份文档候选，应先保留差异，逐文件整合，不覆盖或重复应用。

先将 17 处修复及必要的脱敏证据保存成独立提交，然后 fetch 并正常整合 `origin/feat/multi-agent-company-nodes`。只暂存明确文件；禁止无差别暂存、强制重置、自动 stash、强制推送或整体选择冲突的一侧。提交钩子若被旧文档阻塞，不关闭钩子：先保全原字节补丁和快照，再安全整合文档，确实无法继续时报告具体阻塞。

逐对确认语义后，用仓库原配对程序显式点名本次六组文件执行 `--write`，保存对应 Git 快照并核验；不得使用 `--write --all` 或仅重算错误内容的哈希放行。随后运行受影响配对检查和此前未通过的完整文档检查：

```sh
pnpm run verify-translation-pairing development/nodes/P0-B/evidence/README.md development/remediation/2026-09-09/README.md development/remediation/2026-09-09/security-r02/README.md development/remediation/2026-09-09/model-config-r03/README.md development/remediation/2026-09-09/codex-stderr-r04/README.md config/agents/README.md
pnpm run test:docs
pnpm run doc-sync
```

保存实际命令、环境、退出码、日志和源码版本。纯文档整合不机械重复已通过且未受影响的行为测试；源码冲突或后续修复改变行为时复测对应范围。`lint:contracts-ready` 不改名为 `pnpm run lint`；若最终候选缺少要求的完整 lint 证据，单独完成并记录。偶发崩溃必须保留，不能无限重试到通过再抹掉失败。

核对 `config/agents/models.v1.json`、`config/agents/models.v1.lock.json` 和 `pnpm-lock.yaml` 保持原字节。保留旧候选及回执，对整合结果另建指纹。报告须区分原始通过、后续定向复测与未执行项，不把新候选自动标为已完成所有原生验证。

完成后正常推送专用修复分支，返回分支与提交 SHA，并创建目标为 `feat/multi-agent-company-nodes` 的草稿 PR；没有 PR 工具时返回已推送的分支即可。必要日志、补丁与回执必须能从远端取回，不能只给本机绝对路径。若推送失败，保留本地提交并交付脱敏补丁包，不重新制作修复。

不推送或合并 `master`，不提高 P0-B 状态，不开放 P0-C；不使用聊天中的旧 Key、不读取全局认证、不调用收费模型。真实产品与指定审核待安全凭据、兼容入口和所需运行证据就绪后执行。

最终回报仅需：远端分支、提交 SHA／PR、可取回的证据位置、配对与文档检查结果、额外源码变化及复测、受保护文件是否不变、剩余阻塞。不要再次只返回“未提交、未推送、下一步无”。
