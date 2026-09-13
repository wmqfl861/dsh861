# r30 本地任务：闭合 CI 失败证据通道

只处理 `C:\Albert\project\dsh861`、`wmqfl861/dsh861`、`chore/latest-stable-upgrade-20260912` 和草稿 PR #13。目标是让远端能下载、校验和定位三个红项的真实失败证据，不是重做 r29，也不是修改尚未定因的产品行为。

## 接收与已有事实

基线为 `1baf323167e9d4bde171249f322ab4ebec7f3567`。本任务所在交接提交只新增记录并更新 handoff，没有待应用源码补丁。读取 [取证记录](READOUT.md)及适用 AGENTS；先检查工作树，fetch 原分支并安全快进到提示词给出的固定交接 SHA。存在后续提交时保留并审阅，不 reset、不强推、不自动 stash、不重复 clone。

用 `git merge-base --is-ancestor 1baf323167e9d4bde171249f322ab4ebec7f3567 HEAD` 确认接续关系。r29 独立复审已由用户转达 PASS，不因封存回执的较早待审字段重做整轮。ACP、built-lib、idle 预算和 expect(2) 均保留。不重跑 Gateway212、Loader122、exe/wheel 矩阵或全量升级。

先用本机已有 r29 日志核对 READOUT 的 golden 分类勘误。只更新当前分类，不重跑全部六例来证明已知失败；不刷新 golden，不修改 normalizer，不把 macOS/Linux 夹具范围误当作 Windows 新增验收义务。首次 push 失败输出缺失、r28 本机 47/47 日志缺失都已经如实结案，不再寻找替代材料造齐。

## 实施范围

先检查现有代码是否已有可复用的 CI 报告/日志导出功能。优先复用；只有确实缺失才给 `scripts/run-gates.ts` 增加显式启用的结果导出及小型拥有者模块/测试，并在 `.github/workflows/ci.yml` 的 Linux coverage、Windows coverage、consumers 三个作业接入失败后 artifact 上传。不得为此新增依赖、创建新 runner、复制一套调度器，或改动其他已绿作业。

三条现有 aggregate 的命令、GateResult、调度器和 stdout/stderr 所有权保持不变。基于已有结果导出，不通过另写 pnpm/PowerShell 子进程启动器替换项目入口。报告开关未设置时不产生新文件或行为；输出目录仅在 runner.temp 或测试自建临时目录。

建议一个 artifact 内有 identity.json、gate-results.json、脱敏的失败/被中止 gate 日志及 manifest.json。这只是数据组织建议，可沿仓库现有规范命名，不另外设计服务。

identity 至少记录 repository、PR 编号、run ID、run attempt、job key、PR head/base、实际 git HEAD 及父提交、Node/pnpm/平台、aggregate 名。PR head 与 checkout merge SHA 分开，不把 github.sha 自动等同于 PR head。只读取明确允许的非敏感 CI 元数据与 Git 元数据，不 dump 全环境、事件载荷、认证配置或用户目录。

gate-results 从真实 GateResult 记录各 gate 的 id/label/公开命令、passed/failed/skipped、aborted、duration、exitCode、signalCode；fail-fast 未执行或被中止的项目不得变为通过。按实际 Git HEAD 记录必要源码/测试路径和 blob 身份，便于核对失败日志路径；无需上传源码配置内容或整仓目录。

日志只取本次三个 keyless aggregate 的现有输出。先沿仓库已建立的方法脱敏，再生成 SHA-256 与字节数；只上传脱敏产物。脱敏失败时保留检查失败并明确报告原因，不上传未扫描原文。artifact 不含生产 Key、认证头、cookie、token、个人账号路径、完整环境、.env、历史本机日志、工作区配置或凭据文件。临时原文不得误落入上传 glob。

输出实行明确大小上限；需要截断时注明省略字节数、原始/保留长度和截断状态，保留首失及尾部摘要的规则必须可测，不能把截断日志称为完整原文。SHA-256 针对实际上传的脱敏字节。manifest 列出精确文件列表，禁止目录遍历、跟随 symlink 或宽泛上传 workspace/runner.temp。

artifact 名含 job、run、attempt，避免并发作业覆盖。上传条件只在相应 gate 步骤失败后成立；保留原作业失败结论，报告失败或上传失败也不能把测试结果变绿。使用工作流已有兼容的 artifact action，不改权限、分支保护、needs 九项、runner 标签、timeout、覆盖率分区/阈值、90000ms 测试超时、并发预算、allowFailure/continue-on-error 或测试选择。

## 必须验证的行为

用项目已有测试入口运行最小 fake gate，不跑全量 coverage。覆盖：开关关闭无文件；成功/失败/跳过/aborted 状态忠实；fail-fast 中止后仍非通过；非零退出和信号不被导出吞掉；导出写入失败不可掩盖原失败；公开命令与 stdout/stderr 区分保留。不要为了等日志而改 timeout、加 sleep 或改变子进程树清理。

取证模块还需验证：run/attempt/job 命名隔离；checkout 与 PR head 区分；manifest 字节/hash 一致；不存在的测试路径明确不匹配；脱敏样例含假 token/认证头/个人路径并做反向断言；超限截断可见；路径遍历或 symlink 不进入 artifact。Windows 原生路径与写文件/信号行为在本机验证，Linux 专属流程由 CI 执行，不冒称本机证明 Linux。

运行受影响 spec、typecheck、lint、test:docs 及必要双语 Agent Note/配对。新源码、测试和工作流经独立复审后，使用正常 hooks 提交并非强推原分支；不能以远端已有交接提交或 r29 PASS 替代 r30 源码审核。

## 交付与后续分工

本轮交付取证实现、真实测试结果、独立复审和未执行范围，证据追加到当前 r30 目录下 windows-execution/。记录源码 SHA、命令、退出码、每项结果与脱敏清单；旧 r29/r28 封存证据不改写。报告时准确区分“实现已验证”“artifact 已由真实 CI 生成”“artifact 已实际下载核验”。

本机没有 gh 不是阻塞条件：不安装 gh、不找新 Token、不读全局认证。本地完成正常推送并返回 SHA 后，由远端现有 GitHub 连接器读取新 CI、下载诊断 artifact，核验 run/attempt/checkout/hash 后再安排真实修复。此分工不是要求本机凭空取得旧 CI 日志，也不要求为了取件开放新权限。

远端已对 run34789573313 发起失败作业重跑，最近元数据为 attempt2 运行中；不要重复发起。新 push 可能创建新 run 或取消旧 run，不将旧的成功/失败结果冒充新提交的结论。Issue policy、Issue lifecycle、Build PR preview 的失败继续单列未归因，不用权限变更处理。若已有可信的新 artifact 能直接定因，保留最小范围并先复现，不因本任务文案坚持重复建设。

模型配置两文件、provider/endpoint/思考等级/credentialRef、P0-B state、pkg 补丁、锁文件、历史证据保持原字节。不读生产 Key、不调用真实模型、不修改系统/账号/ACL/注册表/防火墙/UAC/Developer Mode、不使用 Remote Desktop Commander、不发布生产包、不操作其他项目。Windows CSPRNG 子进程与文件 symlink 旧未证明项仍保留。指定 P0-B 计划/硬审核不由本轮独立复审替代；不合并、不改 PR base、不验收 P0-B、不进入 P0-C。
