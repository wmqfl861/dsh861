# Windows 验证、升级收尾与 P0-B 交接

仅处理 `wmqfl861/dsh861`、`C:\Albert\project\dsh861`、`chore/latest-stable-upgrade-20260912` 和草稿 PR #13，base `feat/multi-agent-company-nodes` 不变。不合并、不验收 P0-B、不进入 P0-C。

## 当前接收与实际 CI

r33 接收源码为 `b6b7c7585dfbe537653846711d36c694b524783e`；用户转达独立复审10/10 PASS。保留transform/3、receiver和switch语义修复、去重及其历史证据，不重复r31推送或r32排查。

远端已读取该SHA的CI run34871934787/attempt1：consumers job104069700622实际11过/0败/0跳，主Web批次100文件通过、355测试通过、13跳过。queue-actions、sidebar、IME、预览、preset及built-boot原失败场景均在本次通过；这关闭了“等待第一次新CI验证”的待办，不是各历史机制唯一归因证明。Windows observational也通过。不要再将旧r32失败或r33 duplication列为当前首失。

Windows coverage前置组仍失败：thread-safe的Chokidar5写入稳定用例期望一次add，实际add后change；组内1703过/1败/96跳，主coverage因fail-fast未运行。不能把该状态描述为覆盖率百分比不足。Linux coverage无最终结论，未发现同名失败artifact不代表成功。

## 当前唯一任务

[r34任务](../remediation/2026-09-15/chokidar-timing-r34/LOCAL_AGENT_TASK.md)与[远端回执](../remediation/2026-09-15/chokidar-timing-r34/verification.json)是接续入口。候选已直接修改Chokidar spec，不是待应用patch。取件按最终交接消息的完整SHA，核对祖先及文件blob，再执行实际两个库版本/两个project。

候选仅在写入稳定场景控制Date与timeout/interval，保留生产Loader/VFS/安装包、30ms/5ms和一次add契约；增加稳定前不发事件、add读到完整内容与稍后独立写入应发change的断言。watcher关闭后恢复真实时钟。完整Vitest/Windows集成、类型/lint/duplication/docs及独立复审尚未由远端执行，不能把2项显式轮询模型实验称作真实Chokidar通过。

原10ms真实等待不保证实际间隔短于30ms，CI也没有逐次写入时间。已提出并处理测试前提风险，但具体CI延迟链尚未实证；本地真实执行若暴露其他缺陷，保留首失后窄修，不改变事件预期或提高阈值掩盖。

## 交付规则与范围

给本地agent的文件先放GitHub，提示词提供固定SHA、路径、完整性和用法。本轮所有候选/说明已入库，原Windows ZIP在该仓库Actions artifact。安全fetch/快进，保留其他工作，不reset、不强推、不自动stash。正常hooks与独立复审后，追加r34/windows-execution证据并推送同分支。

复用现有Node26.8.2/pnpm12.4.1/依赖；不重装、不再升级、不跑全部Web、完整coverage、Gateway212、Loader122或exe/wheel矩阵。必要源码推送可能使旧CI被取消，不能把取消当通过；不手动重复触发。Issue policy/lifecycle/PR preview独立失败不通过权限或发布配置绕过。

历史r29–r33回执与更正保持原字节，不再寻找或补造缺失push/旧static日志，不重做既有Windows命令golden。真实API未授权，macOS打包矩阵、Windows CSPRNG同类子进程及文件symlink的旧未证明范围不自动标绿。

模型配置两文件、provider/endpoint/思考等级/credentialRef、P0-B state、pnpm锁、pkg补丁、生产运行源码与CI策略不变。不读生产Key或全局凭据、不操作用户.env、不调用真实模型、不改系统/账号/ACL/防火墙/UAC/Developer Mode、不用Remote Desktop Commander、不操作其他项目。普通独立复审不冒充指定P0-B规划/硬审核。
