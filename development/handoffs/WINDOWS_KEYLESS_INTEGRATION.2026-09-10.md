# Windows 验证、凭据接入与 P0-B 规划交接

仅处理 `wmqfl861/dsh861`，本地项目为 `C:\Albert\project\dsh861`。PR #8 已合入开发分支，合并提交 `decfb608ed52374db4dfa7c02491cc3e9f39534c` 接收 `2f5c328f92477bc4a98f88ef2de68d34fb07c606`，不再向已关闭的批准修复分支追加旧任务。P0-B 仍 blocked，master 未合并，不进入 P0-C，不签发真实执行批准或指定审核。

## 已接收结果与新范围

[r18/r19 Windows 回执](../remediation/2026-09-12/r18-r19-win/verification.json)记录 TLS 24/24、消费与读取完成31/31、原生6/6及类型、lint、完整文档检查通过。接收审查读取了实际提交差异和结构化回执，没有在当前 Linux 会话重跑 Windows 或独立解包该九文件日志。原提交没有产品源码修复；这些测试不再因合并或后继文档提交机械重跑。查询该提交的 Actions 返回0次运行，不算CI通过。

新任务分支 `feat/p0b-input-snapshot-20260912` 只处理固定输入快照与原规划入口的连接，不另写启动器、签名或TLS服务。[快照实现](../../scripts/p0-b/windows-credentials/planner-input-snapshot.mjs)从固定提交的获准普通blob创建独立目录，不读取工作区修改，不复制`.git`或未列入的文件。返回的prepared对象保留源码身份并改用快照路径，现有投影明确采用非Git目录选项而保留read-only和审批限制。批准必须在准备后绑定完整请求，旧目录的签名不能认证新目录。

本次目录快照不是ACL或OS沙箱。`verify()`只是整树完整性检查，生产控制仍须保护父目录、文件和运行身份，阻止读到快照外部。不得把“目录只导出了两份文件”说成“进程只能读两份文件”。[r20记录](../remediation/2026-09-12/input-snapshot-r20/verification.json)区分实测和未执行项。

## 本地下一步

沿用现有Node26.4.0、pnpm11.7.0、Git和依赖，安全同步新任务分支；不复活PR #7/#8、不应用旧ZIP、不自动stash或强制覆盖。先运行新快照43项和受影响投影19项，再运行已写好的Windows原生快照组合1项。后者使用真实临时Git、已有批准／TLS／门控入口，但签署者、凭据对端、金额与OS控制仍为合成；不认证生产模型或隔离。

```sh
node --test scripts/p0-b/windows-credentials/planner-input-snapshot.test.mjs scripts/p0-b/windows-credentials/codex-launch-projection.test.mjs
node --import tsx/esm --test scripts/p0-b/windows-credentials/planner-input-snapshot-native.test.mjs
```

核验Git for Windows支持本次使用的`--no-lazy-fetch`等选项；不支持就明确阻塞，不删除禁止拉取的限制。核验Windows只读文件清理、junction精确解链、目录身份与原生cwd；缺失或跳过不能记为通过。只处理临时测试资源，不修改源仓库状态、hooks或全局Git配置。核对钉版Codex帮助中非Git目录选项，必要的解析探针使用隔离配置和无凭据环境且不得请求网关；不重复完整模型兼容性探针。该选项不关闭sandbox或approval。

本轮改动了投影和入口输入类型，所以需受影响的类型、lint、文档检查；旧TLS／凭据／签名／作业实现未改时不全量重跑。README与现有Agent Note两对正文一起核对后用原程序点名重录i18n记录，不用`--write --all`，不关闭项目钩子。发生新失败，保留首次输出并最小修复。正常提交推送本任务分支，提供可取回日志、实际退出码及最终SHA。

## 真实运行仍需决定和落实

本轮不需要API Key，不读写或枚举生产凭据、不访问用户中转、不安装CA、不登记生产签署身份，不代写plan.v4或OpenCode硬审核。现行HTTP配置继续拒绝。模型声明、模型锁、pnpm-lock和state.json保持原字节。

生产签署入口／信任登记、账本ACL／恢复、OS只读与范围隔离、实际CLI连接保护、金额强制仍须落实；快照使输入可固定，不替代它们。实际路由、旧Key服务商撤销和本人私录、费用／币种／有效期由所有者决定，不要求用户手工维护内部哈希或提供新Key到聊天。保留[网页控制台需求](../requirements/WEB_CONTROL_CONSOLE_SUPPLEMENT.v1.md)及[未批准的启动申请](../nodes/P0-B/planner-launch-request.r01.md)，不扩大为本轮完整后台开发。
