# Windows 验证、凭据接入与 P0-B 规划交接

仅处理 `wmqfl861/dsh861`，本地目录为 `C:\Albert\project\dsh861`。PR #7 已合并，旧门控修复轮已结束。合并提交 `ff0ca468c3a70b90b855bb079306db56fe88e671` 与接收提交 `a136d799ace828d57addb70839043a09103be5a8` 同树；后继交接提交 `227e5597bf85419a6e60bd61e5e9f83025828c56` 另含交接变更，不能混称三者同树。P0-B 仍 blocked，不合并 master，不进入 P0-C，不代写指定 Codex 计划或 OpenCode 硬审核。

## 已接收的准备申请

保留 `dcb4845a6cf42d0af2701cfc405dff6757b364ab` 的[启动申请 r01](../nodes/P0-B/planner-launch-request.r01.md)，其中 7 个读取文件和 12 个辅助脚本是该申请的固定输入。它仍然是 `approved=false`、`executionAuthorized=false`，不是运行批准。[r15 Windows 回执](../remediation/2026-09-11/entry-gate-r15-win/verification.json)及[接收记录](../remediation/2026-09-11/entry-gate-r15-win/integration-review.r16.json)保持原样。不重复已完成的安装、门控／原生凭据、版本、配置探针或旧归档任务。

## r17 的新实现与调用输入

本轮在任务分支 `feat/p0b-owner-approval-20260911` 上接入所有者批准检查，不继续使用关闭的 PR #7 分支。入口是[owner-approved-planner.ts](../../scripts/p0-b/windows-credentials/owner-approved-planner.ts)，它使用实际[签名验证器](../../scripts/p0-b/windows-credentials/planner-approval.mjs)，最后调用既有 `invokeProjectedPlannerOnce`。没有新增第二套进程启动器，也不修改原 Windows 凭据／作业／门控代码。

公开请求摘要绑定源码版本、获准读取文件、提示词摘要、投影配置、程序与辅助脚本哈希、路径和运行限制。所有者决定必须经独立登记的受信公钥验证，并明确同意唯一请求、有效期、轮换确认、传输引用及金额上限；请求不能自带一个公钥来替自己授权。本地受保护账本在预约或使用凭据前独占消费一次尝试，同一批准不能跨调用／进程重放。失败仍消费该尝试，不能自动重试。

新增[提示词 r01](../nodes/P0-B/planner-prompt.r01.txt)只是执行者准备的固定输入，不是 plan.v4。应先核对其正文与摘要，再形成完整的可签署请求，不能在批准后才临时改写提示词。原申请的固定读取集若不足以核实目标源码，先提出最小追加清单并重新生成请求，不默许整个仓库和全局配置可读。

[准入回执](../remediation/2026-09-11/approval-admission-r17/verification.json)记录 21 项真实密码学／本地账本测试和 18 项消费路径测试。后者模拟原生入口及部署控制，不是 Windows 或生产认证证据。两项已写好的 Windows 原生组合测试尚未执行，不能用 Linux 或旧 PASS 代替。

## 本地仅验证本轮变化

同步此任务分支，沿用现有 Node 26.4.0、pnpm 11.7.0 及依赖，不重装、不强制覆盖、不自动 stash。执行新增的 `planner-approval.test.mjs`、`owner-approved-planner.test.mjs` 和 `owner-approved-planner-native.test.mjs`；第三组用真实旧入口、PowerShell 和作业，只使用合成签署者、密封对端和费用／隔离适配器。在 Windows 两项必须实跑。重点核实有效签名才到达实际入口、未知签署者或变更输入在建运行目录前拒绝、一次性消费跨进程有效、在线控制在读取前失效会拒绝、关闭控制失败保持 BLOCKED。

不从测试临时签署者创建生产信任，不导入任何真实 Key，不访问中转或收费模型。签名工具使用的是应用批准身份，不是让用户再提供一种模型 API Key。真实签署界面、私钥保管、受信公钥登记和账本父目录／ACL 尚需部署；本轮只验证合成身份，不由 agent 替所有者点击批准。

按实际影响完成类型、lint 和文档检查。README 与现有 Agent Note 已同步双语正文，原 `.i18n.yaml` 没有伪装重录；核对后用仓库程序逐项重录，不用 `--write --all`。旧门控及凭据源码未改时，不机械重跑旧 8/25/12、34/2 和配置发现套件。新接口暴露的真实组合问题按首次失败最小修复；正常提交推送同一任务分支并返回 SHA 和可取回日志。

## 签名不能代替运行时控制

`acquireControls` 是受信部署接口，必须实际落实受保护路由、只读／范围隔离和金额预约／强制点，并在真正读取凭据前再次检查有效性；不存在默认成功实现。返回匹配字符串、签名正确或将目录命名为 isolated 都不是技术证明。真实适配器不存在、失败或控制状态未知时必须阻塞，不以合成测试适配器运行生产。外部控制操作必须有界，资源状态未知时禁止自动再次执行。

依然需要所有者明确实际 HTTPS 路由及其批准、确认服务商撤销旧 Codex Key并本人隐藏录入替代值、具体费用上限／币种／有效期。实现端负责技术强制，不能要求用户自己写两条内部记录或管理哈希。没有收到这些决定就不替用户填值。原 HTTP 配置继续被投影拒绝，模型声明、模型锁、pnpm-lock、state.json 保持原字节。

实际 OS 隔离、TLS、金额强制适配器及所有者签署入口尚不是本轮测试交付。按[节点规则](../../NODE_DEVELOPMENT_RULES.md)区分有限开发工具使用与完整交付产品，不因此建设整个公网后台或通用权限系统，也不豁免本次调用的安全条件。保留[网页后台需求](../requirements/WEB_CONTROL_CONSOLE_SUPPLEMENT.v1.md)，真实计划仍由指定 Codex 产生，指定 OpenCode 最终审核在实施并固定候选之后进行。
