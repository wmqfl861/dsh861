# Windows 验证、升级收尾与 P0-B 交接

仅处理 `wmqfl861/dsh861` 与本地 `C:\Albert\project\dsh861`，继续 `chore/latest-stable-upgrade-20260912` 和草稿 PR #13。接收 r27 提交 `fa1a3751720558a0040633b322ee73cb1c5f3c54`；本轮 r28 只提交新的 CI 诊断和执行任务，不改源码、依赖或节点状态。P0-B 仍 blocked，不合并 master、不开放 P0-C，不代写指定计划或硬审核。

## 固定交付规则

远端先完成可直接执行的工作，只有依赖本地实际环境的步骤才交给本地 agent。交付文件先放此 GitHub 仓库，提示词提供完整固定提交 SHA、路径、完整性核对与使用方法，不依赖聊天附件或滚动分支链接。存在新工作时审阅整合，不覆盖、不回退、不自动 stash、不强推。

## 已接收的 r27 与 r26

[r27 Windows 回执](../remediation/2026-09-13/gateway-scope-r27/windows-execution/verification.json)记录 Gateway 补丁只改一个 spec 的身份夹具和两条 RPC 计数断言，两个原失败在两 project 中全部通过，整文件 212/212，类型、lint 和快速文档检查通过。用户转达独立复审 PASS；本次远端读取回执与提交，没有重新运行 Windows 或独立扫描其归档。实际补丁已应用，不重复 r27 的 apply 或验证任务。

[r26 Windows 回执](../remediation/2026-09-13/loader-entry-r26/windows-execution/verification.json)及其 Loader/Fiber 六套件 122/122 保留。已完成的上游、主版本与工具链升级不重做。Windows CSPRNG 同类子进程及 present-open.host 文件 symlink 仍是未证明范围，目录 junction 不替代文件 symlink；缺失的旧 stderr 不重造。

## r28：CI 出现真实宿主打包失败

[r28 记录](../remediation/2026-09-13/artifact-build-r28/verification.json)及[本地执行说明](../remediation/2026-09-13/artifact-build-r28/LOCAL_AGENT_PROMPT.md)为唯一当前任务入口。没有新源码补丁，不再 apply r27 文件。

接收提交的 CI run `34754759281` 中，job `103717195665` 的日志实际执行 PR 合并测试提交 `41c81747f67bff78d7eb4fd7c740f9c180a4a0a`。frozen 安装完成后，`pnpm run build:lib` 进入宿主 tsdown 打包，在 `@tailwindcss/vite@4.3.1` 解析 `@tailwindcss/cli/package.json` 时发生 UNRESOLVED_IMPORT 并退出 1。整体排队状态不能掩盖已失败的 job；此问题与可选预览上传或 Windows CSPRNG 分别记录。

错误点已从原始 job 日志确定，但缺失声明、外部依赖处理及模块解析位置之间的根因尚未证明。远端对固定提交的部分源码与 blob 读取未能交叉闭合，因此没有根据片段写入猜测修复。必须在完整工作区核对真实配置和实际安装闭包，按日志内包名定位拥有者，不复用猜测目录。

## 本地连续完成的工作

复用现有 Node26.8.2、pnpm12.4.1、TS7 与安装，按 r28 说明取得固定交付，检查 PR merge 与 head 的相关差异，定位真实调用与正确包拥有者，保存首失，最小修复并验证完整构建产物。必要的定向依赖／锁更新仍在既有授权内，不整体重新升级或重装。不能用只通过 typecheck、忽略解析错误、给根目录随意补包或改成全量 external 代替产物闭合。

通过实际构建、产物级回归及必要检查后，独立复审固定候选，正常钩子提交推送同一分支。明确 Windows 与 Linux 结果，等待中的 CI 不认证成功。本轮的实际日志与摘要写入 r28 新执行目录，不覆盖 r25/r26/r27 记录。未受影响通过检查复用旧证据，不机械重跑 Gateway212、Loader122或整个 Web 测试矩阵。

## 不变的边界

模型配置两文件、provider/endpoint/思考等级/credentialRef、P0-B state 与历史计划/证据保持原字节。本轮诊断未改变依赖锁或 pkg 补丁；后继必要锁变更由包管理器真实生成并验证。升级修复不等于模型调用或系统初始化授权。不读生产 Key、全局认证、不登录、不请求模型，不复制旧沙箱秘密，不改全局工具、账号/ACL/注册表/Firewall/WFP/UAC，不使用 Remote Desktop Commander、不操作其他项目。三个来源不可达的 vendor 和指定规划/审核仍独立记录。
