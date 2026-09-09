**P0-A plan v3：补齐 Windows 原生依赖编译前提的有限修订**

当前节点仍为 **P0-A**。有效计划由 [plan.v1.md](D:/Projects/dsh861/development/nodes/P0-A/plan.v1.md)、[plan.v2.md](D:/Projects/dsh861/development/nodes/P0-A/plan.v2.md) 和本修订共同组成。本修订仅补充 v1 任务 B 的宿主 C++ 工具链处理、安装恢复步骤及对应证据；其余范围、任务顺序、`P0A-01` 至 `P0A-09` 和最终 OpenCode 硬审要求全部继承。

本轮仅进行了指定文件读取、安装日志尾部核对、已定位的 node-gyp 文件检索、宿主信息读取及 Microsoft 官方资料查询；没有下载或运行安装程序，没有修改文件，没有执行安装、构建或测试。以下命令均为 **ZCode 后续实施步骤**。

**一、当前结论：存在可验证的同机修复路径，系统级安装尚缺明确授权。**

[安装回执](D:/Temp_projects/dsh861-p0-a-baseline/r01/logs/install-ntfs-01.json) 与其引用的 [安装输出](D:/Temp_projects/dsh861-p0-a-baseline/r01/logs/install-ntfs-01.stdout.log) 确认：冻结安装退出 `1`，`fs-ext@2.1.1` 在 `node-gyp@12.4.0 configure build` 的 Visual Studio 发现阶段失败，错误为 `Could not find any Visual Studio installation to use`。下载完成、其他原生包完成安装均不能使 `P0A-03` 通过。原回执及日志保持不变。

本轮新增的只读事实如下：

| 项目 | 实测结果及意义 |
|---|---|
| 宿主产品 | 注册表 `ProductName=Windows Server 2019 Datacenter`、`EditionID=ServerDatacenter`、`InstallationType=Server`、`ProductType=ServerNT`。 |
| 宿主版本 | `CurrentBuild=17763`、`UBR=9121`。日志中的 `Windows_NT 10.0.17763` 是内核版本，不能据此将宿主判成 Windows 10 1809 客户端。 |
| OS 查询限制 | `Get-CimInstance Win32_OperatingSystem` 返回拒绝访问；上述注册表读取成功。保留这一差异，无需为重复取得同一事实提升查询权限。 |
| .NET Framework | `Release=528049`、`Version=4.8.03761`，已具备 .NET Framework 4.8；本修订不安排另行升级 .NET。 |
| 磁盘 | C、D 均为 NTFS，读取时剩余空间约为 22.3 GiB、60.3 GiB。安装前仍须核对安装器对系统盘、实例目录及缓存的实际空间要求。 |
| 重启标记 | 本轮读取的 CBS `RebootPending` 和 Windows Update `RebootRequired` 均不存在。这两项结果不能保证安装无需重启。 |

Microsoft 的 [Visual Studio 2022 系统要求](https://learn.microsoft.com/en-us/visualstudio/releases/2022/system-requirements#microsoft-visual-studio-build-tools-2022-system-requirements) 明确支持 Windows Server 2019 Standard/Datacenter。**当前 OS 产品和版本不构成选择 Build Tools 2022 的阻塞，也没有据此升级 OS 或更换验证平台的必要。**

沿用已核实的依赖事实：`fs-ext` 是持久化包的直接依赖，`lease.ts` 顶层加载它，仓库允许执行其构建脚本，源码具有 Windows 分支。此次发现阶段失败没有证明它不能在 Windows 编译；是否能在当前 Node 上编译及加载，必须在补齐工具链后取得实际结果。

**二、限定安装对象、系统影响及授权条件。**

采用 **Visual Studio Build Tools 2022 17.14.39，构建版本 `17.14.37614.0`**。这是本轮从 Microsoft [固定版本发布记录](https://learn.microsoft.com/en-us/visualstudio/releases/2022/release-history#fixed-version-bootstrappers) 核对到的版本，发布日期为 2026-08-18。使用该记录中的固定 Build Tools bootstrapper，避免通用下载入口解析到其他 Visual Studio 主版本。

仅申请以下组件及安装器必须解析的依赖：

| 显式组件 ID | 用途 |
|---|---|
| `Microsoft.VisualStudio.Workload.VCTools` | C++ Build Tools 工作负载的必需核心，包含 MSBuild 和 C++ 构建集成。 |
| `Microsoft.VisualStudio.Component.VC.Tools.x86.x64` | MSVC v143 的 x64/x86 编译、链接工具；实际构建目标为 x64。 |
| `Microsoft.VisualStudio.Component.Windows11SDK.26100` | 26100 系列 Windows SDK 的头文件、库及构建工具。 |

组件 ID 与依赖分类依据 Microsoft [Build Tools 2022 组件目录](https://learn.microsoft.com/en-us/visualstudio/install/workload-component-id-vs-build-tools?view=vs-2022#desktop-development-with-c)。不使用 `--includeRecommended`、`--includeOptional`、`--all` 或 `--allWorkloads`。工作负载的必需依赖仍会安装，包括 C++ 核心、MSBuild、Roslyn、文本模板、UCRT 和 VC++ Redistributable 等；实际包清单及版本必须保留。

SDK 选择依据 Microsoft [Windows SDK 支持与系统要求](https://learn.microsoft.com/en-us/windows/apps/windows-sdk/)：26100 系列仍受支持，Windows Server 2019 支持命令行使用；19041、22621 系列已结束支持。SDK 名称含 “Windows 11” 不表示必须升级宿主到 Windows 11。具体 SDK 修订号以该固定 Visual Studio 发行实际安装的包清单为准，不能从组件名推造。

实例目录固定为：

```text
D:\BuildTools\dsh861-p0-a-vs2022
```

安装前确认该目录不存在，且没有登记在该路径的既有实例；若存在，先核对归属，不能覆盖或修改未知实例。这个目录只固定实例文件位置。安装器仍可能在系统盘写入 Visual Studio Installer、共享组件、Windows Kits、包缓存及注册信息，并安装或更新共享 VC++ 运行库；安装器必需的 WebView2 等依赖也可能产生系统级影响。

**须由用户一次性明确批准的动作是：允许 ZCode 或宿主管理员在这台 Windows Server 2019 上，以管理员权限安装上述固定版本、三个显式组件及其必需依赖到指定实例目录，接受所列共享组件影响；失败时允许通过官方安装器卸载本次新增实例。批准不包含自动重启、OS 升级、系统策略修改、其他 Visual Studio 实例升级或关闭非自有进程。**

这项批准不能从“开始开发、安装项目依赖、修复至通过”直接推出：它超出项目目录和缓存，涉及全机共享组件，并且卸载实例不能保证还原共享运行库、安装器或注册状态。该限制对应 v1 任务 B 第 5 项的“不得自动改注册表、系统策略或安装大范围系统工具链”及[节点规则](D:/Projects/dsh861/NODE_DEVELOPMENT_RULES.md)的授权范围。本修订将待批准操作缩小并具体化，没有把系统安装视作已经获批。

**三、批准前可完成来源核验与安装准备，不执行 bootstrapper。**

ZCode 可沿用已有授权，在任务临时目录下载并核验安装文件、归档官方依据、记录安装前状态和准确组件清单。无需为这些局部准备或后续冻结依赖重试重复申请常规权限。本次只读 Codex 没有执行这些准备命令。

下载位置使用新的自有目录；若已有同名文件，先核对来源和哈希，不能覆盖不同字节：

```powershell
$P0ACppDir = 'D:\Temp_projects\dsh861-p0-a-baseline\toolchain\vs2022-17.14.39'
$P0ABootstrap = Join-Path $P0ACppDir 'vs_BuildTools.exe'
$P0ABootstrapUri = 'https://download.visualstudio.microsoft.com/download/pr/fa619120-9c0e-47e6-bfe0-3ee96fb671b2/236367b68ba9a51708263ab10a1c85546cc4a8eca78b365168811d19c4fb2f29/vs_BuildTools.exe'

if (Test-Path -LiteralPath $P0ACppDir) {
    throw '准备目录已存在；先核对归属和已有文件，不覆盖。'
}
New-Item -ItemType Directory -Path $P0ACppDir | Out-Null

Invoke-WebRequest -Uri $P0ABootstrapUri -OutFile $P0ABootstrap -MaximumRedirection 0

$P0ASignature = Get-AuthenticodeSignature -LiteralPath $P0ABootstrap
if ($P0ASignature.Status -ne 'Valid' -or
    $P0ASignature.SignerCertificate.Subject -notmatch '(^|,\s*)CN=Microsoft Corporation(,|$)') {
    throw '安装文件未通过有效 Microsoft Authenticode 签名核验。'
}

Get-FileHash -LiteralPath $P0ABootstrap -Algorithm SHA256
$P0ASignature | Select-Object Status, StatusMessage, SignerCertificate, TimeStamperCertificate
(Get-Item -LiteralPath $P0ABootstrap).VersionInfo |
    Select-Object FileVersion, ProductVersion, CompanyName
```

来源核验的成功判据是：固定 URL 与官方发布记录一致，下载成功，Authenticode 状态为 `Valid`，签名发布者为 Microsoft Corporation，版本元数据与选定发行相符；记录证书、时间戳信息和文件 SHA-256。**自行计算的 SHA-256 用于固定证据，不能单独充当来源真实性证明。**

保持 TLS、证书、签名及安装器包验证。若发生重定向、签名无法验证、版本不符或固定链接失效，先核对官方记录并保存具体原因；不得关闭校验、改用第三方重打包文件或静默切换版本。执行时若官方记录显示该修订已被新的安全维护版本取代，先固定新的准确版本及链接，交 Codex 作本节点的版本补充，不使用浮动版本继续安装。

安装前记录当前实例清单、指定目录状态、.NET 状态、待重启标记和系统盘／目标盘可用空间。官方安装器若要求超出本修订的系统前提，停止并列明具体组件或动作。

**四、取得上述批准后，执行一次受监督的限定安装。**

仅此系统安装步骤使用管理员权限。由既有命令记录器保存程序绝对路径、已核验文件哈希、完整参数、开始结束时间、PID、退出码及安装器原始日志。临时日志目录沿用本节点目录；归档对应执行时间和实例的 `dd_bootstrapper*`、`dd_setup*` 及失败包日志，不覆盖旧日志。

```powershell
$P0ABootstrap = 'D:\Temp_projects\dsh861-p0-a-baseline\toolchain\vs2022-17.14.39\vs_BuildTools.exe'
$P0AVSPath = 'D:\BuildTools\dsh861-p0-a-vs2022'

$P0AVSArguments = @(
    '--quiet'
    '--wait'
    '--norestart'
    '--installPath'
    $P0AVSPath
    '--add'
    'Microsoft.VisualStudio.Workload.VCTools'
    '--add'
    'Microsoft.VisualStudio.Component.VC.Tools.x86.x64'
    '--add'
    'Microsoft.VisualStudio.Component.Windows11SDK.26100'
)

$P0AVSProcess = Start-Process -FilePath $P0ABootstrap `
    -ArgumentList $P0AVSArguments -WindowStyle Hidden -Wait -PassThru

$P0AVSProcess.ExitCode
```

执行前再次核对 bootstrapper 哈希及有效签名，保证执行文件就是批准所对应的文件。参数与退出码依据 Microsoft [安装命令说明](https://learn.microsoft.com/en-us/visualstudio/install/use-command-line-parameters-to-install-visual-studio?view=vs-2022)。

| 安装结果 | 必须采取的处理 |
|---|---|
| `0` | 进入安装后核验；尚不能宣布工具链或依赖安装成功。 |
| `3010` | 安装要求重启后才能使用；记录为“待用户安排重启”，停止依赖安装及后续门禁。用户完成重启后重新核验。 |
| `1641` | 表示已经启动重启，不作为允许的成功路径；保留原参数及日志，核查为何 `--norestart` 未生效。 |
| `740` | 缺少所需管理员执行条件；不得通过修改策略绕过。 |
| `1001`、`1003`、`1618`、`8006` | 安装器或其他相关进程占用；记录具体占用，不能结束非自有进程或强制关闭应用。 |
| 其他非零值、包失败或安装器拒绝 OS | 保存实际错误，维持阻塞；不追加整个工作负载集合、不切换 VS 2019／2026、不绕过 OS 检查。 |

**禁止自动重启机器。** 现有 .NET 4.8 不需要本计划另行升级，但仍不能在安装前保证没有其他重启要求。

需要回退时，只对已核实属于本次安装的实例使用官方卸载：

```powershell
$P0AVSUninstallArguments = @(
    'uninstall'
    '--installPath'
    'D:\BuildTools\dsh861-p0-a-vs2022'
    '--quiet'
    '--wait'
    '--norestart'
)

$P0AVSUninstall = Start-Process -FilePath $P0ABootstrap `
    -ArgumentList $P0AVSUninstallArguments -WindowStyle Hidden -Wait -PassThru

$P0AVSUninstall.ExitCode
```

卸载后核对实例状态并记录残留。不得递归删除共享 Windows Kits、Installer、包缓存或其他实例，不自动降级共享运行库；因此回退结论只能描述实际移除和保留的内容。

**五、安装后先核验工具链，再恢复原冻结安装。**

在普通项目执行权限下，使用安装器提供的 `vswhere.exe` 检查实例：

```powershell
$P0AVSPath = 'D:\BuildTools\dsh861-p0-a-vs2022'
$P0AVsWhere = Join-Path ([Environment]::GetFolderPath('ProgramFilesX86')) `
    'Microsoft Visual Studio\Installer\vswhere.exe'

& $P0AVsWhere -all -products Microsoft.VisualStudio.Product.BuildTools `
    -version '[17.14,17.15)' `
    -requires Microsoft.Component.MSBuild `
              Microsoft.VisualStudio.Component.VC.Tools.x86.x64 `
              Microsoft.VisualStudio.Component.Windows11SDK.26100 `
    -format json -utf8

& "$P0AVSPath\MSBuild\Current\Bin\MSBuild.exe" -nologo -version

$P0AVCToolsVersion = (
    Get-Content -LiteralPath "$P0AVSPath\VC\Auxiliary\Build\Microsoft.VCToolsVersion.default.txt"
).Trim()

& "$P0AVSPath\VC\Tools\MSVC\$P0AVCToolsVersion\bin\Hostx64\x64\cl.exe" /?
```

每个外部命令分别记录退出码。核验必须同时满足：

- `vswhere` 返回指定路径的 Build Tools 实例，`isComplete=true`、`isLaunchable=true`，没有未完成安装或待重启状态。
- `catalog.productDisplayVersion` 为 `17.14.39`，`installationVersion` 为 `17.14.37614.0`；组件筛选实际命中。
- MSBuild 和 x64 编译器能执行；记录其实际版本、路径，以及 SDK 的包版本、Include/Lib 目录版本。
- 安装器日志没有必需组件失败。安装器退出零和文件存在不能代替以上结果。

随后恢复 v1 任务 B 的局部环境、局部 pnpm 路径、凭据隔离和命令记录方式，继续使用 Node `24.18.0`、Python `3.12.8`、pnpm `11.7.0`、原 store 和原锁文件。允许仅在本次自有子进程中限定 node-gyp 选择 VS 2022：

```powershell
$env:npm_package_config_node_gyp_msvs_version = '2022'
```

已定位的 node-gyp 12.4.0 代码支持该进程环境变量、VS 2022/v143 和 Windows 11 SDK 组件识别。不得将此设置写入 `package.json`、`.npmrc`、用户或机器环境。

在仓库根目录重试原 NTFS 安装：

```powershell
$P0ATemp = 'D:\Temp_projects\dsh861-p0-a-baseline'
Set-Location -LiteralPath 'D:\Projects\dsh861'
pnpm.cmd install --frozen-lockfile --store-dir "$P0ATemp\pnpm-store"
```

使用新的 `install-ntfs-02` 回执及输出文件。保留已有下载和成功构建的缓存，不清空 `node_modules` 或 store。成功必须包括安装退出 `0`、`fs-ext` 实际构建完成、其他必需 lifecycle 完成及 v1 规定的 Git 集成核验。

若重试没有产生可核对的 `fs-ext` 构建记录，可用同一个局部 pnpm 执行 `pnpm.cmd rebuild fs-ext` 补足构建证据；它不能替代完整冻结安装成功。随后从实际消费者目录验证 Node 能加载原生模块及其使用的导出：

```powershell
Set-Location -LiteralPath 'D:\Projects\dsh861\packages\session\session-persistence-jsonl'
& 'D:\Program Files\nodejs\node.exe' --input-type=module --eval `
    'import { flock } from "fs-ext"; if (typeof flock !== "function") throw new Error("fs-ext flock export unavailable");'
```

这项加载探针只证明原生绑定和导出可加载，不能替代锁行为测试或 v1 的任何测试。

若 `vswhere` 核验通过但 node-gyp 仍报告发现失败，允许在自有子进程内调用该实例的 `Common7\Tools\VsDevCmd.bat -no_logo -arch=x64 -host_arch=x64` 初始化编译环境，再通过原记录器运行同一冻结安装命令；不修改 PowerShell 执行策略、不安装全局发现模块、不关闭 sandbox。仍失败时记录发现错误。若失败推进到 C++ 编译、链接或模块加载，记录具体源文件、诊断及命令，交 Codex 继续修订 **P0-A**；本修订没有授权修改 `fs-ext`、产品源码、依赖版本或锁文件。

**六、证据、门禁与当前可继续范围。**

ZCode 保存本次 v3 原始输出、真实规划调用回执及项目内展示副本，分别记录哈希，沿用 v2 的确定性格式规则。工具链证据新增到本节点 `evidence/`，至少包含 OS 依据、官方来源、批准记录、bootstrapper 身份和哈希、准确组件及实际版本、安装参数／退出码、重启状态、安装后核验、冻结安装重试及加载探针引用。原始日志放在 `D:\Temp_projects\dsh861-p0-a-baseline\r01\logs\` 下新的明确子目录或尝试编号中。

安装前后保护原有内容；锁文件 SHA-256 仍须为：

```text
2c903ab870f821ee2db62fa9417d11b1c2b9c65fbeec30e851ddc53c4cc8c383
```

两个已完成的文档任务继续保留，只补充实际环境前提和证据引用；文档完成不等于文档门禁已通过。

只有任务 B 真正成功后，才按 v1/v2 顺序执行任务 D 的全部检查，再执行任务 E 的完整构建和真实 Windows 启动验证。`P0A-01` 至 `P0A-09` 的必需结果、测试选择、文档及双语检查、差异检查和候选固定要求全部保留。最终仍由真实 OpenCode 使用 `zhipuai-coding-plan/glm-5.3 --variant max`，对 **v1＋v2＋v3 有效计划及固定候选**逐项硬审；返工后重新固定候选并复审，直到明确 `PASS`。

**当前节点状态为阻塞：冻结安装失败，限定系统级 C++ 工具链安装尚未获明确批准。** ZCode 当前可继续完成来源核验、安装准备、已有文档整合和证据维护；取得上述一次性批准后即可沿本修订执行，无需再为常规冻结依赖安装申请权限。若用户不允许此宿主安装，替代条件是用户提供并授权使用一台具有受支持 Windows、合格 MSVC/SDK 和所需执行权限的机器，再由 Codex 补充同节点的基线迁移记录。其他平台结果不能替代本节点 Windows 验收；未运行、失败或待重启均不能记为通过。本修订不规划下一节点。
