# Windows 专用凭据桥

[English](README.md) | 中文

这个 P0-B 支持组件为四个专用 Windows 凭据管理器目标提供录入，并向现有[凭据租约](../credential-ref.ts)提供显式授权的读取器。管理命令不启动模型，也不激活[模型配置](../../../config/agents/README.zh.md)。独立调用的规划函数在前置条件通过后可以启动传入的 CLI；它不是轮换确认、公网设置界面或多租户凭据服务。

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

## 规划调用接线

[planner-invocation.ts](planner-invocation.ts) 将密封读取器连接到传入的可执行程序。可信调用方必须核验所有者决定、模型锁，将批准路由投影到实际 CLI 参数／配置，并提供有效的沙箱及隔离 home 设置。非空的批准或传输记录名称只是引用，不证明记录真实、TLS 已验证或 CLI 使用了该路由。本函数不是不可信 JSON 接口、批准服务或完整 Codex 适配器。

读取凭据前，函数私有复制调用输入、比较传入的对象与路由、解析不含用户信息或片段的 HTTPS URL、核验提示／程序哈希，并校验显式进程边界。当前批准的 HTTP 路由继续被拒绝。既有租约提供子进程环境；既有参数扫描器在启动前拒绝 argv 中已知的租约值。可信所有者必须持续控制文件及原生桥；输入副本不保护可变部署文件或被攻陷的桥。

`maxChannelBytes` 分别限制 stdout、stderr 保留的 UTF-8 字节，包括 EOF 时脱敏器延迟输出的尾部。可能超限的片段在保存前丢弃并取消调用；后续输入继续排空，不再累积文本。提示写入错误触发取消，不报告输入已完成。`capturedBytes` 记录保留字节；`captureComplete=false` 区分截断或中断输出。即使脱敏片段放不下，泄漏检测仍保持锁存。

`deadlineMs` 限制启动后的进程阶段，不包含启动前哈希或凭据解析。取消请求终止直接子进程，至多按显式的 `terminationGraceMs` 等待进程／stdio 关闭。管道仍打开时，包装器关闭自己持有的管道端并返回取消结果；已经观察到子进程退出后，不再向该 PID 发信号。`cleanup` 分别记录直接子进程退出、stdio 关闭、强制关闭管道及 `descendantState=NOT_VERIFIED`；发出终止请求或有界返回都不能认证后代进程树静止。可信执行所有者必须另行验证资源所有权及静止状态，才能认定运行已安全清理。

一个 CLI 可以发送多次模型请求；这些边界不是金额或逐请求限额。进程完成，即使退出零，也不等于可用计划、已验证模型身份或产品验收。调用方必须检查终止／采集状态、退出码／信号、泄漏、原生事件、返回计划及所需外部证据。合成测试不包含真实模型调用。

## 无密钥 Codex 启动配置生成

[codex-launch-projection.mjs](codex-launch-projection.mjs)调用实际模型锁校验器，将获准 Codex 路由转换为固定 argv、TOML 配置和显式隔离路径环境。它拒绝 HTTP、锁不匹配、未知输入字段、工作区与运行目录重叠以及不安全路径。提供商、模型、思考等级和凭据引用只来自已批准声明；生成配置只有环境变量名，没有其值。Shell 环境排除密钥，不继承模型进程的环境。

结果为 `CODEX_LAUNCH_PROJECTED_NOT_AUTHORIZED`。该函数不读取凭据、不写配置、不创建目录、不批准请求，也不启动进程。可信调用方必须准备自有目录，并在执行前核验钉版 CLI 的配置发现、原生设置与操作系统强制只读范围。批准引用、HTTPS 字符串、生成的 `CODEX_HOME` 或配置生成成功，都不是授权、证书验证、隔离、金额预算控制或后代静止的证明。生产调用方及这些运行时控制仍需接入；合成 HTTPS fixture 不改变所有者当前的 HTTP 路由。

## 验证

在已安装仓库钉版依赖的工作副本中运行：

```sh
node --import tsx/esm --test scripts/p0-b/windows-credentials/reader.test.mjs
node --import tsx/esm --test scripts/p0-b/windows-credentials/native.test.mjs
node --import tsx/esm --test scripts/p0-b/windows-credentials/planner-invocation.test.mjs scripts/p0-b/windows-credentials/planner-invocation-bounds.test.mjs
node --test scripts/p0-b/windows-credentials/codex-launch-projection.test.mjs
```

第一组测试明确模拟原生通道，验证协议、真实 RSA 运算、引用限制和现有租约。可选的 `P0B_WINDOWS_CREDENTIAL_MODULE_ROOT` 仅供离线验证选择独立编译的 JavaScript；正常仓库执行不能设置它。

第二组只在 Windows 执行。它先在内置 Windows PowerShell 下解析两个脚本，验证 helper 完整性拒绝，让一个唯一 `dsh861/selftest/` 目标经历隐式覆盖拒绝、显式替换、封装与核实删除，经真实存储路径拒绝合成的隐藏输入确认不一致、再存入一致的合成值对，并检查 `Set` 拒绝重定向输入、`Remove -WhatIf` 取消而不执行。不使用生产引用或真实模型。日志只打印精确合成目标，不打印值。进程终止或宿主崩溃可能阻止清理；只检查记录的目标并报告残留。时限终止的是直接 helper，不是已验证的 Windows 后代进程树。真实 Key 的交互式隐藏录入、持久账号行为、ACL 隔离与完整规划接线仍需另行本地检查，非 Windows 跳过不能证明它们。

远端验证边界及实际测试文件哈希见 [r07 回执](../../../development/remediation/2026-09-10/credential-store-r07/verification.json)；Windows 本机原生结果、修复后的解析兼容行布局及本轮文件哈希记录在 [r08 回执](../../../development/remediation/2026-09-10/credential-store-r08/verification.json)。Linux 测试不被描述为隐藏输入或原生凭据存储已经成功。

规划测试使用合成 Node 进程和模拟密封对端。POSIX 保留继承管道断言，包括 `forcedPipeClosure`；detached 后代用于验证直接子进程退出后仍存活的情形。心跳创建后才发布就绪，观察器要求心跳实际推进。心跳缺失、不可读或冻结都不能证明终止。清理要求测试所属进程确认停止，不以过期时间戳替代。包装器保持 `descendantState=NOT_VERIFIED`；fixture 的协作清理不代表产品进程树限制。[r11 回执](../../../development/remediation/2026-09-10/planner-observer-r11/verification.json)限定了保留原样的 [r10 回执](../../../development/remediation/2026-09-10/planner-windows-r10/verification.json)中的生命周期结论。

## 规划前置条件

凭据绑定包含实现及原生验证工作，不完全是所有者的任务。对伪造 effort 同样回显的 CLI banner 只证明配置层接受，不证明实际请求或网关行为。现有 `WRAPPER_READY` 标签不能证明规划包装器已经执行权限、完整输出脱敏、取消或费用限制。

只有所有者能够确认提供商侧撤销，并批准新的 HTTPS 路由。书面接受 HTTP 风险不是受保护传输证据，本次修改也不提供这种授权。等待决定时保持已批准配置及锁文件不变。第一次获准规划只使用 Codex 凭据，其余提供商可以后续录入。不得为一个规划者要求一次提供全部四个 Key；调用前置条件真正成立前不得读取真实 Key。

## 参考资料

Windows 持久化及通用凭据语义：[CREDENTIALW](https://learn.microsoft.com/en-us/windows/win32/api/wincred/ns-wincred-credentialw)、[CredWriteW](https://learn.microsoft.com/en-us/windows/win32/api/wincred/nf-wincred-credwritew) 和 [CredReadW](https://learn.microsoft.com/en-us/windows/win32/api/wincred/nf-wincred-credreadw)。隐藏输入：[Read-Host](https://github.com/MicrosoftDocs/PowerShell-Docs/blob/main/reference/7.5/Microsoft.PowerShell.Utility/Read-Host.md)。设计依据：[凭据桥决策](../../../.agents/notes/implemented/architecture/2026-09-10-windows-credential-bridge.zh.md)。
