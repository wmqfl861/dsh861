# Windows 专用凭据桥

[English](README.md) | 中文

这个 P0-B 支持组件为四个专用 Windows 凭据管理器目标提供录入，并向现有[凭据租约](../credential-ref.ts)提供显式授权的读取器。它不启动模型、不激活[模型配置](../../../config/agents/README.zh.md)、不确认 Key 轮换、不实现公网设置界面，也不是多租户凭据服务。Windows 原生执行仍是必须完成的验证步骤。

## 所有者操作入口

以将来运行可信规划服务的 Windows 账号，在可信本机交互式 PowerShell 中使用 [manage.ps1](manage.ps1)。`Set` 通过 `Read-Host -AsSecureString` 隐藏输入并要求输入两次，不接受值为 Key 的命令行参数。不得把真实 Key 写入 `cmdkey /pass:...`、脚本、agent 消息、终端记录或普通 `.key` 文件。不要为运行脚本而关闭宿主安全策略。

```powershell
Set-Location -LiteralPath 'C:\Albert\project\dsh861'
.\scripts\p0-b\windows-credentials\manage.ps1 -Action Status -Provider codex
.\scripts\p0-b\windows-credentials\manage.ps1 -Action Set -Provider codex
```

输入真实 Key 前先完成原生无密钥测试。`Set` 在写入前要求确认；已有条目必须显式加 `-Replace`。`Remove` 经确认只删除选中的专用条目。录入要求单一写入者：Windows `CredWrite` 是创建或覆盖操作，不是原子比较交换。状态只返回固定目标及存在性／格式状态，不返回值、末尾片段、长度或由 Key 派生的哈希。

| Provider 参数 | 固定引用 | Windows 目标 |
|---|---|---|
| `codex` | `secret-reference:providers/codex` | `dsh861/providers/codex` |
| `claude-code` | `secret-reference:providers/claude-code` | `dsh861/providers/claude-code` |
| `grok` | `secret-reference:providers/grok` | `dsh861/providers/grok` |
| `opencode` | `secret-reference:providers/opencode` | `dsh861/providers/opencode` |

后端使用应用定义的通用凭据、格式标识和当前 Windows 用户的本机持久化。相同账号在本机后续登录中可以读取，另一个服务账号或机器不会自动继承。用 `cmdkey` 创建的条目格式不同，不静默导入。提供商变更、轮换确认和执行授权仍与存储分开。

Key 必须是 1–384 个可打印、非空格 ASCII 字节。长度或字符不支持时拒绝，不截断。这是有明确范围的 API Key 组件，不是任意密码或大令牌的凭据库。SecureString 和临时缓冲区清理减少保留副本，但不能抹除全部操作系统／运行时内存，也不能防御管理员、窃取凭据的代码或运行在同一用户下的被攻陷进程。

## 可信读取器接入

[reader.ts](reader.ts) 将 `createWindowsBridge(spec)` 与 `createSealedCredentialReaders(invoke, allowedIds)` 组合。将结果传给 `resolveCredentialReferences(requests, grants, readers)`；来源到目标变量的授权和引用允许集合都继续生效。不提供环境变量或文件回退。可信调用方提供 PowerShell 的绝对程序路径、helper 目录、该程序及两个 helper 源文件的已批准 SHA-256、自有临时路径和时限。不能从不可信任务可改写的文件推导生产批准。

[bridge.ps1](bridge.ps1) 调用 [native-credential.cs](native-credential.cs)。Node 父进程每次读取时生成新的 RSA-4096 密钥对，stdin 只传公钥参数；原生进程用 RSA-OAEP-SHA256 封装凭据，父进程在内存中解密。明文 Key 不会被有意写入 helper stdout。读取器检查响应身份、大小、格式和密文块长度；缺失保持缺失，错误不包含原始进程输出或异常原因。响应与明文缓冲区在使用后清理。落盘不使用自制加密：存储归 Windows 凭据管理器负责。

私有通道使用 `-NoProfile`、`-NonInteractive`、`shell: false`、精确 helper 哈希，以及仅含 `SystemRoot`、`TEMP`、`TMP` 的显式环境。不继承全局提供商 Key、不加载 PowerShell profile、不绕过执行策略、不枚举凭据，也不提供明文导出命令。可信所有者必须在执行全过程控制相关文件和临时目录；启动前哈希不能消除并发修改竞态。

加密封装防止偶然采集管道输出时暴露 Key，但不能对同一 Windows 用户实施授权隔离，因为该用户仍可直接调用凭据管理器。因此，不可信产品 agent 仍需要独立执行身份或已验证的操作系统隔离。只有可信服务取得读取器和租约。不得把此 API 暴露成通用 agent 工具，也不得把解密结果写入诊断通道。

## 验证

在已安装仓库钉版依赖的工作副本中运行：

```sh
node --import tsx/esm --test scripts/p0-b/windows-credentials/reader.test.mjs
node --import tsx/esm --test scripts/p0-b/windows-credentials/native.test.mjs
```

第一组测试明确模拟原生通道，验证协议、真实 RSA 运算、引用限制和现有租约。可选的 `P0B_WINDOWS_CREDENTIAL_MODULE_ROOT` 仅供离线验证选择独立编译的 JavaScript；正常仓库执行不能设置它。

第二组只在 Windows 执行。它验证 helper 完整性拒绝，创建一个唯一 `dsh861/selftest/` 目标，拒绝隐式覆盖，显式替换合成数据，封装结果，并在接受成功前核实删除。不使用生产引用或真实模型。日志只打印精确合成目标，不打印值。进程终止或宿主崩溃可能阻止清理；只检查记录的那个目标并报告残留。时限终止的是直接 helper，不是已验证的 Windows 后代进程树。交互式隐藏输入、持久账号行为、ACL 隔离与完整规划接线需要另行本地检查，非 Windows 跳过不能证明它们。

远端验证边界及实际测试文件哈希见 [r07 回执](../../../development/remediation/2026-09-10/credential-store-r07/verification.json)。Linux 测试不被描述为隐藏输入或原生凭据存储已经成功。

## 规划前置条件

凭据绑定包含实现及原生验证工作，不完全是所有者的任务。对伪造 effort 同样回显的 CLI banner 只证明配置层接受，不证明实际请求或网关行为。现有 `WRAPPER_READY` 标签不能证明规划包装器已经执行权限、完整输出脱敏、取消或费用限制。

只有所有者能够确认提供商侧撤销，并批准新的 HTTPS 路由。书面接受 HTTP 风险不是受保护传输证据，本次修改也不提供这种授权。等待决定时保持已批准配置及锁文件不变。第一次获准规划只使用 Codex 凭据，其余提供商可以后续录入。不得为一个规划者要求一次提供全部四个 Key；调用前置条件真正成立前不得读取真实 Key。

## 参考资料

Windows 持久化及通用凭据语义：[CREDENTIALW](https://learn.microsoft.com/en-us/windows/win32/api/wincred/ns-wincred-credentialw)、[CredWriteW](https://learn.microsoft.com/en-us/windows/win32/api/wincred/nf-wincred-credwritew) 和 [CredReadW](https://learn.microsoft.com/en-us/windows/win32/api/wincred/nf-wincred-credreadw)。隐藏输入：[Read-Host](https://github.com/MicrosoftDocs/PowerShell-Docs/blob/main/reference/7.5/Microsoft.PowerShell.Utility/Read-Host.md)。设计依据：[凭据桥决策](../../../.agents/notes/implemented/architecture/2026-09-10-windows-credential-bridge.zh.md)。
