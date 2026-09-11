# Windows 专用凭据桥

[English](README.md) | 中文

这个 P0-B 支持组件保存 Windows 专用凭据，并连接显式授权的读取器、Codex 配置投影和有属主的进程启动器。它不是公网设置界面、多租户凭据库、用户认证服务或产品验收机制。[模型配置](../../../config/agents/README.zh.md)保持独立版本管理。

## 所有者操作

以运行可信规划服务的 Windows 账号，在可信交互式 PowerShell 中使用 [manage.ps1](manage.ps1)。`Set` 通过两次 `Read-Host -AsSecureString` 提示录入，不接受值为 Key 的参数。不要把 Key 写入聊天、脚本、终端记录、`cmdkey /pass:...` 或普通 `.key` 文件。不要绕过宿主安全策略。

```powershell
Set-Location -LiteralPath 'C:\Albert\project\dsh861'
.\scripts\p0-b\windows-credentials\manage.ps1 -Action Status -Provider codex
.\scripts\p0-b\windows-credentials\manage.ps1 -Action Set -Provider codex
```

真实录入前完成原生无密钥验证。写入需要确认；替换已有条目需要 `-Replace`。`Remove` 只确认删除选中的目标。录入要求单一写入者：Windows CredWrite 是创建或覆盖，不是比较交换。状态只有目标和存在性／格式信息，不含值、后缀、长度或 Key 派生哈希。

| Provider | 固定引用 | Windows 目标 |
|---|---|---|
| `codex` | `secret-reference:providers/codex` | `dsh861/providers/codex` |
| `claude-code` | `secret-reference:providers/claude-code` | `dsh861/providers/claude-code` |
| `grok` | `secret-reference:providers/grok` | `dsh861/providers/grok` |
| `opencode` | `secret-reference:providers/opencode` | `dsh861/providers/opencode` |

应用定义的通用凭据格式供同一用户在同一机器跨登录持久使用。其他机器和服务账号不继承；cmdkey 条目格式不同，不隐式导入。Key 必须为 1–384 个可打印、非空格 ASCII 字节，不支持时拒绝而不截断。SecureString 和缓冲区清理不保证彻底抹除内存，也不能防御管理员或被攻陷的同用户代码。

## 可信读取

[reader.ts](reader.ts) 把 `createWindowsBridge`、`createSealedCredentialReaders` 与现有[一次性租约](../credential-ref.ts)组合。凭据引用及来源到环境变量的授权均显式提供。不枚举全局凭据、不回退到环境变量，不提供明文导出或面向普通 agent 的通用秘密读取器。

可信部署钉扎 PowerShell 绝对路径、[bridge.ps1](bridge.ps1)、[native-credential.cs](native-credential.cs)及其哈希。桥使用 `-NoProfile`、`-NonInteractive`、`shell: false`、私有管道和仅含 `SystemRoot`、`TEMP`、`TMP` 的环境，限制响应大小与时间并丢弃原始诊断。每次读取使用 Node 持有的新 RSA-4096 密钥对：stdin 传公钥参数，原生 stdout 传 RSA-OAEP-SHA256 封装，父进程在内存解密。落盘由 Windows 保护；封装防止管道意外采集明文，不防止同用户窃取凭据。

执行期间持续保护部署文件和临时目录的父目录。启动前哈希不消除并发修改竞态；路径隔离或 POSIX 权限位不建立 Windows ACL。不可信 agent 需要独立身份或已验证的操作系统隔离。轮换、存储、传输批准与运行授权是独立事实。

## Codex 投影与调用

[codex-launch-projection.mjs](codex-launch-projection.mjs) 校验实际模型锁，并生成唯一固定的 argv／TOML／环境参数集。HTTP、锁不匹配、不安全路径、未知输入字段、工作区与运行根目录重叠都会被拒绝。结果为 `CODEX_LAUNCH_PROJECTED_NOT_AUTHORIZED`：投影不读 Key、不建目录、不启动进程。配置只含凭据变量名而非值；工具 Shell 环境排除模型凭据。

[planner-entry.ts](planner-entry.ts) 独占预留新运行根目录、创建隔离目录并以 `wx` 写配置。已有根目录包括预置链接都会被拒绝；父目录保护仍归调用方负责。入口把投影生成的参数提供给 [planner-invocation.ts](planner-invocation.ts) 和既有凭据租约。空批准引用和主题不匹配会被拒绝，但非空引用不认证背后的所有者决定或传输证据。

包装器私有复制输入，在读取凭据前检查提示／程序哈希和显式限制，并在 spawn 前检查 argv 中的已知租约密钥。两个返回通道均先脱敏。`maxChannelBytes` 限制保留的 UTF-8 字节，包括 EOF 延迟片段及替换标记膨胀；超限片段在保留前丢弃。输入投递失败导致取消，泄漏标记持续锁存，不完整采集保持显式状态。

`deadlineMs` 覆盖启动后阶段，不覆盖哈希或凭据解析；`terminationGraceMs` 限制取消等待。强制关闭管道不是进程树退出。结果区分直接子进程退出、管道关闭、保留字节和 `descendantState=NOT_VERIFIED`。一次 CLI 可发起多个模型请求，这些限制不是金额上限。退出零不代表计划可用或产品通过。

## 有属主的启动与失败生命周期

[job-owner.ps1](job-owner.ps1) 持有一个不带脱离标志的显式 Windows 作业。[windows-job-owner.ts](windows-job-owner.ts) 核验程序／helper／启动器哈希及有界、与操作匹配的 JSON 回应。钉版 [launch-gate.mjs](launch-gate.mjs) 在创建目标 CLI 前加入作业。标准入口使用该门控；未提供门控启动的可选 ownership 实现仍有启动后指派间隙。

属主跟踪一个启动器，仅在其精确且存活的 PID 得到成功指派回应后允许放行一次。错误 PID、失败或迟到的指派、取消、helper 退出、协议失败与销毁都不能授权放行。失败会写 abort 标记并请求直接终止，即使门控尚未指派；不按进程名扫描。helper 使用单调等待，取消优先于放行，过期后才首次观察到的 go 标记不能启动目标。错误或超大的启动记录返回固定退出码，不暴露内容。目标 stdio 不用作控制消息通道。

销毁要求有效的 helper 正常关闭以及被观察到的启动器关闭。超时保持失败；启动器关闭未知时保留标记文件。目录被替换为链接时只解除链接，不递归进入目标。入口记录指派、终止确认、活动计数和销毁。缺失指派、终止／销毁失败或计数非零／未知均返回 `PROJECTED_PLANNER_CLEANUP_BLOCKED`；调用失败保留清理事实。这些事实均不建立 ACL、不认证用户，也不认证未观察到的后代。

入口显式把作业属主的 `launchGated`、`releaseGated`、`abortGated` 映射到调用接口的 `launch`、`release`、`abort`。适配器要求提供全部 `PlannerProcessOwnership` 方法，不能因底层接口可选而在此入口静默遗漏门控。指派与终止仍使用同一个属主实例。[planner-entry-gate.test.mjs](planner-entry-gate.test.mjs) 直接观察这条入口组合，不在测试内另行组装不同的适配器。

## 所有者批准的启动准入

[owner-approved-planner.ts](owner-approved-planner.ts) 是既有投影入口的生产准入调用方，不是第二套启动器。准备阶段固定公开调用输入、提示词摘要和声明的文件哈希清单。请求摘要绑定源码版本、读取清单、投影配置／参数／环境、程序与辅助脚本哈希、路径和进程限制。改变任一绑定值都需要新的所有者决定；生成说明既不批准也不执行调用。

[planner-approval.mjs](planner-approval.mjs) 使用带用途前缀的 Ed25519 签名，对照受信服务独立提供的所有者公钥验证。信封不能提供自己的信任公钥。决定指定唯一请求、有效期、已确认的轮换引用、传输引用、币种、正整数最小货币单位上限和费用强制记录。在外部预约或使用凭据前，受保护的本地账本通过独占创建消费一次尝试。重放、过期、变更、未批准或非规范记录都被拒绝。失败不会删除已消费标记来授权自动重试。账本恢复、父目录保护、原生 ACL 和所有者公钥登记仍由部署端负责；本地独占创建不是分布式或防断电账本。

服务必须提供经过审查且有界的在线控制适配器，实际验证传输、只读／范围隔离及金额强制限制。准入层核对预约是否绑定相同决定和请求，并在凭据读取入口再次检查有效期、文件哈希及在线控制。签名验证和记录名称本身不实现这些控制。缺失或失败的适配器必须拒绝；即使签名有效，也不能在缺少控制时读取 Key。控制清理失败继续保持阻塞。原低层投影入口是受信内部组件，不是绕过准入的公共入口。

签署端及信任登记与模型 API 凭据不同，测试不会部署它们。所有者签名只记录其对 Key 轮换的确认，不查询或证明服务商实际撤销。源码版本是签名引用，部署端仍负责已验证的工作副本和不可变的获准文件。本模块不交付真实费用记账、TLS 或原生隔离。

批准测试使用真实临时签名和本地文件。调用方套件加载实际准入与投影代码，模拟原生入口、凭据对端及外部控制，不是操作系统证据。独立的 Windows 原生套件调用实际既有入口及作业机制，但仍使用合成签署者、密封对端和强制适配器，只证明组合接线；两项已在 Windows 实跑。见[准入回执](../../../development/remediation/2026-09-11/approval-admission-r17/verification.json)与[Windows 执行回执](../../../development/remediation/2026-09-11/approval-admission-r17-win/verification.json)。

## 验证

使用钉版依赖在仓库运行；正常验证不要设置模块覆盖变量。

```sh
node --import tsx/esm --test scripts/p0-b/windows-credentials/reader.test.mjs
node --import tsx/esm --test scripts/p0-b/windows-credentials/native.test.mjs
node --import tsx/esm --test scripts/p0-b/windows-credentials/planner-invocation.test.mjs scripts/p0-b/windows-credentials/planner-invocation-bounds.test.mjs
node --import tsx/esm --test scripts/p0-b/windows-credentials/planner-entry.test.mjs
node --test scripts/p0-b/windows-credentials/codex-launch-projection.test.mjs
node --experimental-vm-modules --test scripts/p0-b/windows-credentials/ownership-failures.test.mjs
node --test scripts/p0-b/windows-credentials/planner-approval.test.mjs
node --experimental-vm-modules --test scripts/p0-b/windows-credentials/owner-approved-planner.test.mjs
node --import tsx/esm --test scripts/p0-b/windows-credentials/owner-approved-planner-native.test.mjs
node --experimental-vm-modules --test scripts/p0-b/windows-credentials/planner-entry-gate.test.mjs
node --experimental-vm-modules --test scripts/p0-b/windows-credentials/gate-owner-failures.test.mjs scripts/p0-b/windows-credentials/launch-gate.test.mjs
node --experimental-vm-modules --test scripts/p0-b/windows-credentials/gate-owner-native.test.mjs
```

读取器测试使用明确的合成对端和真实 RSA／租约代码。可选的 `P0B_WINDOWS_CREDENTIAL_MODULE_ROOT` 仅用于有记录的离线编译副本。原生凭据测试使用唯一 `dsh861/selftest/` 目标而非生产 Key；崩溃可能留下残余，只检查记录中的目标。它们不认证真实 Key 交互录入、服务账号持久性或 ACL。

规划测试区分真实 Node fixture 与模拟操作系统接口。心跳缺失或冻结不是退出证明；就绪要求创建并推进，fixture 自行清理不代表产品包含能力。[gate-owner-failures.test.mjs](gate-owner-failures.test.mjs) 使用实际属主源码、模拟子进程和真实标记文件。[launch-gate.test.mjs](launch-gate.test.mjs) 组合真实 Node 运行和确定性时钟控制。[gate-owner-native.test.mjs](gate-owner-native.test.mjs) 观察精确的真实 Windows 子进程句柄，验证 helper 在指派前后死亡。非 Windows 跳过不是原生验收。

[r13 Windows 回执](../../../development/remediation/2026-09-10/planner-gate-r13/verification.json)保留先前原生结果；[r14 回执](../../../development/remediation/2026-09-10/gate-abort-r14/verification.json)记录当前控制与未执行项。[决策说明](../../../.agents/notes/implemented/architecture/2026-09-10-windows-credential-bridge.zh.md)链接较早证据及其限定。通过证据只能复用于它实际覆盖且未变化的输入。

## 生产前置条件

只有所有者能确认提供商侧撤销、私下录入替代值，并批准真实受保护路由和费用限制。首次规划只需 Codex 凭据，不要求四套同时提供。接受 HTTP 风险不是加密证据。具体配置变更得到授权前，保持模型声明及锁不变。

实现方必须认证授权记录，并落实有效沙箱、输出、生命周期及预算约束；用户确认本身不提供这些机制。CLI banner、HTTPS 字符串或隔离 CODEX_HOME 路径不证明网关行为、证书验证或操作系统强制。真实调用条件满足前，不读生产凭据、不调用模型。本组件不签发指定 Codex 计划或 OpenCode 审核。
