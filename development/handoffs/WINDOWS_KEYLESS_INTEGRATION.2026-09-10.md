# Windows 验证、凭据接入与 P0-B 规划交接

仅处理 `wmqfl861/dsh861`，本地目录 `C:\Albert\project\dsh861`。继续 PR #8 的 `feat/p0b-owner-approval-20260911`，不复活已合并 PR #7，不应用旧 ZIP。P0-B blocked、master 未合并、不进入 P0-C；本页与内置子代理审核不代替指定 Codex 规划或 OpenCode 硬审核。

## r17 接收与保留

接收基线 `602a3d9498f044a71df9632748c72602f09b7599`。[Windows 回执](../remediation/2026-09-11/approval-admission-r17-win/verification.json)记录批准 21/21、消费路径 18/18、原生组合 2/2，以及 typecheck、修复后 lint、test:docs 15/15 和 doc-sync 33/33。已有签名、一次性账本、Windows 作业／门控与原始回执保留，不重复旧验证轮；回执中未交付能力没有因为内置 PASS 而变成已实现。

## r18 新目标：实际 TLS 探测接入凭据读取前

[planner-tls.mjs](../../scripts/p0-b/windows-credentials/planner-tls.mjs) 使用受信部署的精确路由、显式 CA 和可选公钥钉扎，执行真实 TLS 握手、主机名/IP、最低协议、绝对握手时限及 socket 关闭检查。只返回固定错误或公开摘要；不发 HTTP、不携带 Key、不重定向、不重试。TLS 证书、验证器与证据语义归[组件说明](../../scripts/p0-b/windows-credentials/README.zh.md)所有。

[owner-approved-planner.ts](../../scripts/p0-b/windows-credentials/owner-approved-planner.ts) 的受信服务新增必需 `transport` 验证器。在已签名且已消费的请求真正读凭据之前探测路由，随后再次检查批准有效期、在线控制及固定文件；失败不读取 Key，不能再次使用同一批准重试。新的 `transport` 结果仅说明探测连接通过，不将探测等同于 Codex 后续请求已受到保护。原 Windows 启动器和凭据读取实现未改。

[r18 回执](../remediation/2026-09-12/planner-tls-r18/verification.json)包含真实回环 TLS 24 项与消费路径 24 项（原18项加6项传输控制），Linux 执行48通过。六项新增消费路径控制在原准入层上1通过5失败，只说明原版本未做这项检查，不计为五个独立漏洞。三项原生组合用例（两项扩展、一项新增）尚未在 Windows 执行。测试只连接自己创建的回环服务器，使用合成服务器证书，不接触实际中转站或系统信任库。

## 本地下一步仅处理新变化

沿用 Node 26.4.0、pnpm 11.7.0 与既有依赖，安全同步同一分支，不强推、不自动 stash、不覆盖新工作。执行 `planner-tls.test.mjs`、`owner-approved-planner.test.mjs` 和 `owner-approved-planner-native.test.mjs`，当前为24/24/3；在 Windows 原生三项必须实际执行。第三组沿用真实 PowerShell／作业／门控，TLS 也为真实回环连接，签署者、密封对端、费用及隔离适配器仍是合成材料，不能推广为生产验收。

重点验证坏证书/主机名/超时阻止实际读取，未批准和重放请求连接数为零，TLS 期间控制失效不能被成功握手掩盖，真实入口保留 `transport.socketCloseObserved`。测试 CA 不得安装为系统受信根，不得使用真实 CA 私钥、生产 Key 或真实 HTTPS 中转地址。保留首次失败，按根因最小修复；不改为跳过、不关闭证书或宿主安全策略。

按影响完成类型、lint 和文档检查。两组 README/Agent Note 正文已同步，原配对程序远端未执行，核对后点名重录 `.i18n.yaml`，不用 `--write --all`。必要聚合命令保存退出码及可取回日志；未变化的旧批准21项、门控8/25/12或34/2、reader/native、版本／配置探针不机械重跑。正常提交推送同一分支，更新原 PR #8，不另建运行器。

## 真实规划仍缺什么

TLS 探测不证明实际模型请求的证书校验、无旁路环境、远端业务路由、证书撤销或后续 DNS 不变；实际 CLI 仍需核验其真正请求。费用强制、只读／范围隔离、生产签署入口、受信公钥登记、账本 ACL 与恢复仍需独立实施或部署；`acquireControls` 不能用空函数或记录字符串冒充它们。

实际路由、旧 Codex Key 供应商侧撤销确认与本人隐藏录入、金额／币种／有效期仍由用户决定。当前模型声明中的 HTTP 继续在投影阶段被拒，本轮不擅改地址或配置锁。用户不需要提供任何 Key 来做本轮测试，也不需要管理测试证书或手写内部批准记录。四套模型声明、模型锁、pnpm-lock、state.json、原申请和历史回执保持原字节。

[未批准的启动申请](../nodes/P0-B/planner-launch-request.r01.md)与[固定提示词](../nodes/P0-B/planner-prompt.r01.txt)继续作为后继准备输入，不是 plan.v4；新增代码不能由旧签名默认批准。保留[网页后台需求](../requirements/WEB_CONTROL_CONSOLE_SUPPLEMENT.v1.md)，不把整个控制面变成本节点的无限前置。只有具体真实条件齐备且获授权，才进行指定真实规划及之后的硬审核。
