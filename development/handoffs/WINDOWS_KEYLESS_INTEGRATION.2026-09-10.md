# Windows 验证、凭据接入与 P0-B 规划交接

仅处理 `wmqfl861/dsh861`，本地项目为 `C:\Albert\project\dsh861`。继续 PR #8 的 `feat/p0b-owner-approval-20260911`，不复活 PR #7，不应用旧附件。P0-B blocked，不合并 master，不进入 P0-C；本轮不启动真实模型或指定规划／硬审核。

## 当前输入

本地 r17 提交 `602a3d9498f044a71df9632748c72602f09b7599` 之后，远端已有 r18 提交 `5e72c4a5644794f9c5fd4a0bb9bf0b587853dca9`。本次 r19 正常叠加其上，保留[Windows 批准层回执](../remediation/2026-09-11/approval-admission-r17-win/verification.json)、[TLS 回执](../remediation/2026-09-12/planner-tls-r18/verification.json)、原申请和全部历史记录。r18 的 TLS 及待执行原生用例不是另一份要重复应用的补丁。

## r19：读取开始不等于响应可以放行

[准入层](../../scripts/p0-b/windows-credentials/owner-approved-planner.ts)在密封读取完成后再次核对批准有效期、预约绑定、在线控制及固定文件，再把响应交给既有读取器。读取期间发生撤销、过期、提示词／读取文件改变或预约错配时，不放行密封响应。已经开始的读取仍记为发生过，不能回写为零；本检查不撤销已交付给运行中目标的凭据，也不替代持续的 OS／费用控制。

运行时只修改上述一个文件；原凭据、签名账本、TLS 验证器、作业对象、门控启动和投影／原入口均保持原样。原消费路径的在线检查次数由3改为4，对应新增读取完成检查，不删除既有断言。[七项读取完成控制](../../scripts/p0-b/windows-credentials/owner-approved-read-completion.test.mjs)与[后继证据](../remediation/2026-09-12/read-completion-r19/verification.json)记录先失败再修复的结果。

## 本地一次性完成 r18+r19 的受影响验证

安全同步同一分支至最新提交，沿用 Node 26.4.0、专用 pnpm 11.7.0 和既有依赖。不要重装、不强制覆盖、不自动 stash。已有更晚提交时先读差异，不能回退。无新变化的 r17 批准21项、旧门控、凭据存取、版本帮助、配置解析和历史归档不重复运行。

执行以下四组：TLS 套件24项、消费路径24项、读取完成7项，以及 Windows 原生组合6项。原生6项包含 r18 的3项和新增读取中撤销／过期／提示词变化3项，必须在 Windows 实跑。正常仓库不设置模块覆盖变量。仅使用临时合成签名、密封对端及回环 TLS，不请求中转，不安装测试 CA，不改变宿主安全策略。

```sh
node --test scripts/p0-b/windows-credentials/planner-tls.test.mjs
node --experimental-vm-modules --test scripts/p0-b/windows-credentials/owner-approved-planner.test.mjs scripts/p0-b/windows-credentials/owner-approved-read-completion.test.mjs
node --import tsx/esm --test scripts/p0-b/windows-credentials/owner-approved-planner-native.test.mjs
```

新增原生用例要求真实既有入口返回拒绝、目标 marker 不存在、作业计数归零且已销毁、只发生一次合成密封读取、恢复合成提示或测试时钟后仍不能重用批准。区分“读取前拒绝”和“读取已开始但禁止继续”，不要统一改写成 reads=0。时钟模拟由测试上下文恢复，不影响服务器时间。

保留首次失败，最小修复真实原因，不删断言或用任意重试掩盖错误。按影响完成类型、lint、test:docs/doc-sync。README 双语已更新；r18 既有 Agent Note 的配对写入仍待本地，核对后对 README 和该 Note 点名重录，不用 --write --all。已有匹配当前输入的有效结果可复用，不为了提交机械重跑。

只暂存明确文件，正常推送本分支，保持原 PR #8。交回新 SHA、24/24/7/6 的实际结果与明确跳过情况、必要门禁及可取回日志。归档只包含必要证据，清空账户／组／时间头；不重造缺失历史日志。

## 仍未完成的真实调用条件

代码测试不会登记生产信任、导入真实 Key、确认服务商撤销、授予 HTTPS 路由或费用权限。生产签署入口／公钥登记、账本 ACL／恢复、经验证的只读与范围隔离、实际 CLI 的 TLS 及金额强制仍分别需要实现或部署。TLS 探测只证明探测自身，不能认证后续 CLI 连接。具体路由、轮换确认及本人隐藏录入、金额／币种／有效期由用户决定；不索取新 Key 到聊天或让 agent 代填。

四套模型声明、模型锁、pnpm-lock、state.json、[未批准申请](../nodes/P0-B/planner-launch-request.r01.md)和[固定提示词](../nodes/P0-B/planner-prompt.r01.txt)保持不变。保留[网页后台需求](../requirements/WEB_CONTROL_CONSOLE_SUPPLEMENT.v1.md)，但本轮没有交付后台页面，不扩大为完整控制台、通用权限或计费框架。指定 Codex plan.v4 和 OpenCode 硬审核不能由本轮或内置子代理代签。
