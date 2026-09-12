# Windows 验证、凭据接入与 P0-B 规划交接

仅处理 `wmqfl861/dsh861`，本地项目 `C:\Albert\project\dsh861`。PR #9 已以 `f070a85554ba82fd30f89d7300e86645609081f7` 合入开发分支，接收 `4997b13f36fcc2473ec15112d5003b6943c8e1ea`。原快照、批准／TLS 和门控轮已结束，不向已关闭 PR #7/#8/#9 追加旧任务。P0-B 仍 blocked，master 未合并，不进入 P0-C，不授予真实模型调用或指定硬审核权限。

## 接收范围

[r20 Windows 回执](../remediation/2026-09-12/input-snapshot-r20-win/verification.json)记录 Git 空配置路径修复、62/62 快照和投影、1/1 Windows 组合及类型／lint／文档门禁。接收审查读取实际差异和代码，没有在当前会话重新执行 Windows 或独立解包15份日志。原始失败、最小修复、模型声明／模型锁／pnpm-lock／节点状态均保留。无新输入变化时不重跑已完成检查；GitHub Actions按候选查询为0次，不能把本地通过改称CI通过。

## r21：先测钉版已有沙箱，不另建运行器

新任务分支 `test/p0b-native-sandbox-20260912` 提供[无模型诊断](../../scripts/p0-b/windows-credentials/sandbox-qualification.zh.md)。当前钉版源码的 CLI 提供宿主 `sandbox` 命令、`--permission-profile` 和 `--include-managed-config`；此处只编排合成文件和检查结果，复用既有Windows作业属主。不改生产模型投影，不增加另一套原生隔离实现，不把最新文档能力假定为本机二进制已经兑现。

[r21 记录](../remediation/2026-09-12/native-sandbox-r21/verification.json)的18项观察器检查在Linux执行通过；包括真实未受限Node父子进程正控及明确模拟的拒绝回执。1项真正执行钉版Codex沙箱的Windows测试已写好但未执行。只有后者能回答所测原生权限是否成立；前18项不认证操作系统隔离。

### r21 Windows 实测结果（2026-09-12）

在 `test/p0b-native-sandbox-20260912`（f1edc65）上，Windows 实测完成：钉版 codex.exe 哈希复算一致，隔离无凭据 CODEX_HOME 下 `sandbox --help` 确认宿主 `sandbox` 命令与 `--permission-profile`／`--include-managed-config`／`--cd` 旗标存在、无 `sandbox windows` 子命令；18 项观察器检查全部通过；原生用例两次确定性失败，沙箱本体以 `windows sandbox failed: Restricted read-only access requires the elevated Windows sandbox backend` 拒绝受限读策略（exit 1）。钉版源码（rust-v0.149.1）核对：unelevated 后端在 profile 缺少全盘读时直接退出；elevated 后端需专用沙箱登录账号、capability SID 与管理员上下文本机 ACL 变更。结论：原生限制成立，验证 BLOCKED，不放宽策略、不改测试求绿。证据、最小追加授权与门禁结果见 [r21-win 回执](../remediation/2026-09-12/native-sandbox-r21-win/verification.json)。

## 本地的有限任务

安全同步新分支，沿用Node26.4.0、pnpm11.7.0及依赖，不重装、不自动stash或强制覆盖。先点读钉版程序的 `sandbox --help`，确认命令存在性；程序摘要继续是 `a395030b56b126f608f2403036dddb654a9c063213e9c2b5f85d954cf490ebe6`。不升级或切到全局Codex。

```sh
node --test scripts/p0-b/windows-credentials/codex-sandbox-qualification.test.mjs
node --import tsx/esm --test scripts/p0-b/windows-credentials/codex-sandbox-qualification-native.test.mjs
```

原生测试只用自建可读写文件和子进程，不接模型、不读生产凭据、不探中转。它先证明普通进程能够读取／写入目标，再经既有作业启动实际Codex沙箱，检查获准输入可读、目录外父子读取被拒、目录内外写入被拒及宿主字节／标记。EOF、超时、启动失败或ENOENT不能算拒绝；若确实不支持该策略或需要初始化，记录BLOCKED和准确原因，不能为了绿灯删断言、切full-access或改成不启动目标。

方案选用unelevated并保留受管要求。不得创建系统账号、修改现有用户目录或系统范围ACL／防火墙，不得UAC提权或安装沙箱。若受管策略要求其他模式，或必须初始化，先停止原生执行并给出具体影响范围与最小所需授权；不能用忽略受管配置的方式继续。只在自有临时目录内进行可逆操作，不跟随目录链接清理其他位置。

这是新的原生命令验证，不是重跑r20快照、旧TLS／凭据／门控或版本全套探针。完成新增脚本的必要lint／文档检查。两个新文档对用原配对程序点名创建记录：`scripts/p0-b/windows-credentials/sandbox-qualification.md`、`.agents/notes/implemented/testing/2026-09-12-native-codex-scope-qualification.md`；不用`--write --all`，旧README／说明未变，无需重录旧对。保存最初失败、实际命令及退出码；正常推送同一分支，证据可从远端取回。

## 结果之后的边界

即使本次测量成功，也只说明合成命令及子进程的所测文件操作；主CLI、配置发现和生产工作区接线仍需单独落实。失败或阻塞则明确该原生方案缺什么，不额外堆叠一轮通用框架。本次不把诊断回执送入生产批准层。生产签署／身份登记、账本ACL／恢复、实际CLI TLS、费用强制，以及用户的真实路由、旧Key撤销／本人私录、金额／币种／有效期仍分别保留。不代写plan.v4，不改[网页后台需求](../requirements/WEB_CONTROL_CONSOLE_SUPPLEMENT.v1.md)，不把整个后台扩大为准备工作的前置。
