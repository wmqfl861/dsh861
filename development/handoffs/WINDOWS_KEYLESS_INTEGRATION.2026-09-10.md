# Windows 验证、升级收尾与 P0-B 交接

仅处理 `wmqfl861/dsh861`、`C:\Albert\project\dsh861`、`chore/latest-stable-upgrade-20260912` 和草稿 PR #13，base `feat/multi-agent-company-nodes` 不变。不合并、不验收 P0-B、不进入 P0-C。

## 当前接收与实际 CI

r33 接收源码为 `b6b7c7585dfbe537653846711d36c694b524783e`；用户转达独立复审10/10 PASS。保留transform/3、receiver和switch语义修复、去重及其历史证据，不重复r31推送或r32排查。

远端已读取该SHA的CI run34871934787/attempt1：consumers job104069700622实际11过/0败/0跳，主Web批次100文件通过、355测试通过、13跳过。queue-actions、sidebar、IME、预览、preset及built-boot原失败场景均在本次通过；这关闭了“等待第一次新CI验证”的待办，不是各历史机制唯一归因证明。Windows observational也通过。不要再将旧r32失败或r33 duplication列为当前首失。

Windows coverage前置组仍失败：thread-safe的Chokidar5写入稳定用例期望一次add，实际add后change；组内1703过/1败/96跳，主coverage因fail-fast未运行。不能把该状态描述为覆盖率百分比不足。Linux coverage无最终结论，未发现同名失败artifact不代表成功。

## 当前唯一任务

r34 取件 `33d82004f536bf54881e2f96f07ac06a541fa398`（父=b6b7c758，blob 核验一致，ff-only 快进）已本地真实验证：thread-safe 与 process-bound 两 project × Chokidar4/5 两夹具 ×7 用例=28/28 通过；负控真实执行（临时关闭 awaitWriteFinish→"稳定前无事件"断言 8 失败、首失留存→恢复原字节复验 28/28）；无未处理拒绝/watcher 残留，后续真实时钟用例不受污染。门禁先败后过：lint 首失为候选新增行显式 `onceEvent<void>` 触发 oxlint 规则，最小整改一行改回同文件既有推断写法（语义等价，spec blob 变为 `b8458db29e24c59d23e7b3f897bc8483b7ae8110`）；test:docs 首失为 Note 配对未录，按点名命令写入后 16/16。typecheck/duplication 一次通过。证据见 [r34 windows-execution](../remediation/2026-09-15/chokidar-timing-r34/windows-execution/FINDINGS.md)（logs/01–14）。

当前状态：本地执行完成；主会话转达全新上下文独立复审 9/9 全项 PASS、无需整改。已按交付规则正常 hooks 分组提交并非强推推送同分支（完整远端 SHA 见本轮回执/提交记录）。复审结论不等于新 CI 已发生或 Linux coverage 已有结论；CI 延迟链归因仍属机制性（轮询模型+受控时钟），非逐次写入时间实证。

## 交付规则与范围

给本地agent的文件先放GitHub，提示词提供固定SHA、路径、完整性和用法。本轮所有候选/说明已入库，原Windows ZIP在该仓库Actions artifact。安全fetch/快进，保留其他工作，不reset、不强推、不自动stash。正常hooks与独立复审后，追加r34/windows-execution证据并推送同分支。

复用现有Node26.8.2/pnpm12.4.1/依赖；不重装、不再升级、不跑全部Web、完整coverage、Gateway212、Loader122或exe/wheel矩阵。必要源码推送可能使旧CI被取消，不能把取消当通过；不手动重复触发。Issue policy/lifecycle/PR preview独立失败不通过权限或发布配置绕过。

历史r29–r33回执与更正保持原字节，不再寻找或补造缺失push/旧static日志，不重做既有Windows命令golden。真实API未授权，macOS打包矩阵、Windows CSPRNG同类子进程及文件symlink的旧未证明范围不自动标绿。

模型配置两文件、provider/endpoint/思考等级/credentialRef、P0-B state、pnpm锁、pkg补丁、生产运行源码与CI策略不变。不读生产Key或全局凭据、不操作用户.env、不调用真实模型、不改系统/账号/ACL/防火墙/UAC/Developer Mode、不用Remote Desktop Commander、不操作其他项目。普通独立复审不冒充指定P0-B规划/硬审核。
