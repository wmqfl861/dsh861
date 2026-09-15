# Windows 验证、升级收尾与 P0-B 交接

仅处理 `wmqfl861/dsh861`、`C:\Albert\project\dsh861`、`chore/latest-stable-upgrade-20260912` 和草稿 PR #13，base `feat/multi-agent-company-nodes` 不变。不合并、不验收 P0-B、不进入 P0-C。

## 当前接收与实际 CI

r33 接收源码为 `b6b7c7585dfbe537653846711d36c694b524783e`；用户转达独立复审10/10 PASS。保留transform/3、receiver和switch语义修复、去重及其历史证据，不重复r31推送或r32排查。

远端已读取该SHA的CI run34871934787/attempt1：consumers job104069700622实际11过/0败/0跳，主Web批次100文件通过、355测试通过、13跳过。queue-actions、sidebar、IME、预览、preset及built-boot原失败场景均在本次通过；这关闭了“等待第一次新CI验证”的待办，不是各历史机制唯一归因证明。Windows observational也通过。不要再将旧r32失败或r33 duplication列为当前首失。

Windows coverage前置组仍失败：thread-safe的Chokidar5写入稳定用例期望一次add，实际add后change；组内1703过/1败/96跳，主coverage因fail-fast未运行。不能把该状态描述为覆盖率百分比不足。Linux coverage无最终结论，未发现同名失败artifact不代表成功。

## 当前唯一任务

r34 已完成：独立复审 9/9 PASS 后按交付规则分组提交并非强推推送同分支（记录见 [r34 windows-execution](../remediation/2026-09-15/chokidar-timing-r34/windows-execution/FINDINGS.md)，logs/01–14；r33/r34 历史回执保持原字节）。

r35 修复 Vitest 5 内联项目继承造成的测试范围重叠与覆盖清单项目归属冲突，取件 `b5e6fd857ca737aa32196c02a3707a99d3703b54`（fetch 后远端无新提交、本地领先、三个基线 blob 核对一致）。根因实测（Vitest 5.0.0 源码+真实输出）：内联项目默认继承声明文件且数组经 Vite mergeConfig 串联，根 `test.include` 并入两项目（普通模式 1236 个唯一文件中 1229 个双归属、process-bound 膨胀到 1236 个；r34 chokidar 单 spec 双项目 28 用例即此）且根插件与项目插件叠加注册；coverage 不受 `extends` 影响（每项目一律取 globalConfig.coverage）。修复：两内联项目顶层 `extends: false`（非 `extends: true` 隐藏警告）+ 共享 `testSetupFiles` 常量显式接线；项目插件/esbuild/execArgv/forks/平台规则与根 coverage include-exclude/阈值/reporter/分区模式不变；`parseListOutput` 豁免前置展开+反斜杠归一+同文件异项目抛错（含文件与两项目名）+JSDoc 同步，其余实现未替换。真实验证（实际安装 Vitest）：两模式唯一文件并集修复前后零差异（1236/1191，不靠重复执行凑数）、两项目交集空、process-bound 恰为 win32 允许的 7 个清单文件、每项目两目标插件各 1 次、两初始化脚本不重复不丢失；新增 `scripts/vitest-project-inheritance.spec.ts`（真实 createVitest 子进程探针 + 过滤 list 唯一归属 + 真实 Vitest 枚举协调器生成的分区配置，证明缩小分区不重新继承根部宽泛 include、空侧不扩展为运行全部；临时目录自建自清理）。解析器回归先对原函数留存真实首失（3 failed | 41 passed）再修复复测 44/44。负控真实执行：恢复隐式继承→真实 `parseListOutput` 对真实 list 输出抛错+最终版回归 4 failed（插件重复/setup 翻倍/spec 双归属）；仅移除项目 setupFiles→项目解析 setupFiles 为空+接线回归失败；恢复后 blob 复验 `f65397a8…` 字节一致、复验绿。定向测试 4 文件/82 用例通过（chokidar 仅 thread-safe 14 用例，不再双项目重复）。门禁先败后过（首失留存）：typecheck 首失为首版 spec 静态导入 vitest.config.ts 触发 TS6307（重写为子进程探针后过）；lint 首失为一处引号（一行整改后 0 警告 0 错误）；test:docs 首失为 Note 配对未录（点名命令写入后 16/16）；duplication 0 clones。中英 Note 已配对。主会话"10/10、162 组差分"仅属隔离验证，未复用为仓库结果。证据见 [r35 windows-execution](../remediation/2026-09-15/vitest-project-inheritance-r35/windows-execution/FINDINGS.md)（logs/01–28）。

当前状态：本地执行完成，工作树改动待主会话派发全新上下文独立复审；复审 PASS 前不提交、不推送。完整 coverage 与 Linux 通道本轮未运行（维持无结论）；新源码 CI 未发生；不提前宣布升级阶段完成。

## 交付规则与范围

给本地agent的文件先放GitHub，提示词提供固定SHA、路径、完整性和用法。本轮所有候选/说明已入库，原Windows ZIP在该仓库Actions artifact。安全fetch/快进，保留其他工作，不reset、不强推、不自动stash。正常hooks与独立复审后，追加r34/windows-execution证据并推送同分支。

复用现有Node26.8.2/pnpm12.4.1/依赖；不重装、不再升级、不跑全部Web、完整coverage、Gateway212、Loader122或exe/wheel矩阵。必要源码推送可能使旧CI被取消，不能把取消当通过；不手动重复触发。Issue policy/lifecycle/PR preview独立失败不通过权限或发布配置绕过。

历史r29–r33回执与更正保持原字节，不再寻找或补造缺失push/旧static日志，不重做既有Windows命令golden。真实API未授权，macOS打包矩阵、Windows CSPRNG同类子进程及文件symlink的旧未证明范围不自动标绿。

模型配置两文件、provider/endpoint/思考等级/credentialRef、P0-B state、pnpm锁、pkg补丁、生产运行源码与CI策略不变。不读生产Key或全局凭据、不操作用户.env、不调用真实模型、不改系统/账号/ACL/防火墙/UAC/Developer Mode、不用Remote Desktop Commander、不操作其他项目。普通独立复审不冒充指定P0-B规划/硬审核。
