# r34：接收受控时间候选并完成真实 Chokidar 组合验证

只处理 `C:\Albert\project\dsh861`、仓库 `wmqfl861/dsh861`、`chore/latest-stable-upgrade-20260912` 和草稿 PR #13。base 保持 `feat/multi-agent-company-nodes`；不合并、不验收 P0-B、不进入 P0-C。

## 取件和已完成工作

本任务与源码已在同一次提交中，不是待应用 patch。按最终交接消息的完整提交 SHA，通过已有仓库 `git fetch origin chore/latest-stable-upgrade-20260912` 取件，检查工作树及后续历史后安全快进。不要 reset、强推、自动 stash、重复 clone 或覆盖新工作。

基线 `b6b7c7585dfbe537653846711d36c694b524783e` 必须是接收提交祖先。对本交接固定提交，目标 `packages/experimental/webworker-runtime/tests/node/chokidar.spec.ts` 的 Git blob 应为 `07fef9ee2ffb9fb32c8c3a2fdf760048f5a1eb69`；如接收了额外后续源码变化，先审阅差异，不为恢复旧哈希覆盖它。读本目录 verification.json 和适用 AGENTS。

r33 的真实 CI run34871934787/attempt1 中，consumers 已11/0/0通过，Web主批次100文件通过、355测试通过、13跳过。queue-actions、sidebar、IME、预览等原失败本次均未再现；这是本次不复发，不是唯一根因证明。不要重做这些 Web 修复、transform/3、r31取证或 r29旧任务。

## 本轮仅验证/修复一个测试文件

Windows coverage 前置组的 thread-safe / Chokidar5 用例期望一次add，却收到add后change；主coverage被fail-fast跳过。原10ms真实等待不保证实际间隔少于30ms。CI未记录写入时间，所以不预称精确延迟根因已实证。

远端已提交的候选仅控制写入稳定用例的 Date/timeout/interval 时钟，不替换 Chokidar 4/5、VFS、Loader、stat 或事件。不改稳定阈值30ms、轮询5ms，也不放宽事件断言。候选要求稳定前无事件、首次add读到完整abc、随后无额外事件；新增用例要求稳定后新写入产生change。先关闭watcher再恢复真实时钟；nextTick/queueMicrotask/setImmediate不被fake。

沿现有工具链和正常 Vitest 配置执行整个文件：

```powershell
pnpm exec vitest run packages/experimental/webworker-runtime/tests/node/chokidar.spec.ts
```

必须实跑两个消费方的安装版本（Chokidar4、5）以及仓库正常两个project。报告实际用例/项目数，不预填PASS总数、不只选原失败版本。使用现有依赖，不升级库、不重装项目、不改全局Node。

如果ready、close、异步stat或时钟恢复发生真实集成失败，先保留首失，再只修正夹具的时钟推进/清理接线。禁止将watcher/stat换成替身、加任意长sleep、增加测试timeout、跳过用例、过滤change或把预期改成add+change。不使用runAllTimers把持续watcher跑成无限循环；必须保持有界推进。

增加或利用最小控制证明：临时取消awaitWriteFinish应使“稳定前无事件”断言失败；恢复原字节后全部通过。控制只在测试自有候选副本/临时修改中执行，明确恢复并核对，不能把本目录polling模型的2/2当实际变异证明。核对后续真实时钟用例仍运行、watcher可关闭、无未处理拒绝或计时器泄漏。必要时追加窄回归而非掩盖退出问题。

已验证的CI基线失败可复用，不为诱发调度抖动无限重复旧版用例。候选通过后按影响执行typecheck、lint、duplication和test:docs，原程序点名生成新Note配对：

```powershell
pnpm run verify-translation-pairing --write .agents/notes/implemented/testing/2026-09-15-chokidar-controlled-time.md
```

远端只跑了语法、全文件补丁字节和显式轮询模型；未跑这些项目门禁或Git钩子。不要把文档中的Status: implemented当整体验收通过。最终候选必须经全新上下文独立复审，修复发现后再正常钩子提交推送。

## GitHub 原始失败证据

运行页面：`https://github.com/wmqfl861/dsh861/actions/runs/34871934787`。
artifact：`gate-evidence-windows-coverage-run34871934787-attempt1`，ID `10359444500`。
原始ZIP：71274字节，SHA-256 `5fcfa723b6ecc3517ece0aa34cc27892b0593b4c108044b4764eb4f240c7134d`。

通过运行页面Artifacts或既有合法下载能力取得。已有gh时可用：

```text
gh run download 34871934787 --repo wmqfl861/dsh861 --name gate-evidence-windows-coverage-run34871934787-attempt1 --dir <新建空目录>
```

gh返回解包成员，不是原ZIP；未留存原ZIP不得声称核对外层摘要。先检查路径/类型/重复条目，再按manifest核验5个成员的字节和SHA256，共6文件。身份应匹配head b6b7、checkout `2099905cc6fb93a76cde247618bc11ebda036882`、run/attempt与windows-coverage。没有下载能力时使用已核验摘要继续定向复现，记录未取得原ZIP；不安装gh、不索取Token、不读取GCM或全局认证。

远端读取的前置组汇总为1失败、1703通过、96跳过；文件为1失败、87通过、2跳过。不要把跳过算通过或把前置组叫完整coverage。若本机取回字节与记录不符，先核对artifact/manifest，不追随错误计数。Linux coverage未取得最终结论，空artifact列表不算成功。

## 交付与不变边界

证据追加 `development/remediation/2026-09-15/chokidar-timing-r34/windows-execution/`，包括首失（如有）、真实版本/项目、控制结果、最终日志、退出码、清理检查、独立复审、NOT_RUN。归档按已有规范归零头、敏感扫描，保留r29–r33历史字节。不要改写作者模型日志或将它重命名为真实Chokidar日志。

更新现行handoff，所有新交接文件提交GitHub，返回完整远端SHA与固定路径。只暂存明确改动、正常hooks、非强推；不为补推送回执额外制造重复提交。

不跑全部Web、完整coverage、Gateway212、Loader122、exe/wheel、全量升级或六个既有Windows命令golden；新源码CI由既有工作流执行。推送可能取消旧运行，取消不算通过，不手工重跑/取消以制造结论。若独立Linux证据之后出现新首失，另按匹配来源处理。

模型配置两文件、provider/endpoint/思考等级/credentialRef、P0-B state、pnpm-lock、pkg补丁、生产运行源码和工作流策略不变。不降覆盖阈值、减少分区/用例、改90000ms或并发预算。不读生产Key、全局凭据、不请求真实模型、不进入record、不操作用户.env、不改系统/账号/ACL/防火墙/UAC/Developer Mode、不用Remote Desktop Commander、不操作其他项目。旧CSPRNG与文件symlink未证明范围不因本轮通过改变。本轮普通独立复审不替代指定P0-B规划/硬审核。
