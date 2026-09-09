# P0-A：Windows 构建与启动基线记录

## 摘要

本记录对应 [P0-A 计划 v1](plan.v1.md) 的任务 C，当前有效计划由 v1 及 [v2](plan.v2.md)、[v3](plan.v3.md)、[v4](plan.v4.md)、[v5](plan.v5.md)、[v6](plan.v6.md)、[v7](plan.v7.md)、[v8](plan.v8.md)、[v9](plan.v9.md)、[v10](plan.v10.md) 修订共同组成，供主执行者复现当前 Windows 基线并固定审核证据。范围是冻结依赖安装、公开检查、完整构建、限定启动验收及源码复用核实，另按 v6–v9 修复已复现的文档测试与站点检查问题；本文件不改变验收标准，也不宣布 P0-A、P0 阶段或产品 AC 通过。

本记录的限定源码、配置和测试声明由内置实施子任务核对；该子任务未执行安装、构建或产品测试。主执行者负责之后的真实环境验证，工具链、冻结安装及原生模块加载结果见 [依赖恢复证据](evidence/dependency-resolution-summary.json)。本文区分源码断言、已执行命令和待完成验证，逐轮结果以命令回执为依据。

首轮冻结安装因缺少 Visual Studio C++ 工具链失败，原始证据保存在 [首轮验证记录](verification.r01.json) 和 [失败记录](evidence/install-failure.r01.json)。用户 [授权依赖安装](evidence/dependency-install-authorization.json)后，Build Tools 17.14.39 安装退出0且不需重启；[v5工具链验证](evidence/build-tools-verification-02.json)、第二次冻结安装和 fs-ext 加载已通过，见 [安装后检查](evidence/dependencies-installed-02.json)。v4 根目录导航压缩的 [限定预检查](evidence/doc-budget-v4-precheck.json)通过，正式文档门禁、完整构建和硬审核结果仍由后续真实记录判定。

完整类型检查和原定16个基线测试已通过。首轮 [文档聚合检查](evidence/doc-quick-failure-01.json) 在两个全库用例超时，单独运行仍 [复现元数据用例超时](evidence/doc-standard-isolated-failure-01.json)。按 v6 将相同枚举结果改为逐README用例后，[覆盖核验](evidence/doc-standard-v6-coverage.json)确认612份元数据、510份结构检查与原清单逐项一致，总计1145用例通过；[真实文件负向对照](evidence/doc-standard-v6-negative-validated.json)仅触发预定的三项错误，临时文件已逐字节恢复。完整 test:docs 的第二次运行已15/15通过；之后 doc-sync 的站点检查失败，原始记录见 [站点聚合失败](evidence/doc-sync-site-failure-01.json)。

v7 引入共享投影迭代器、逐页落盘与链接检查，并复用 HTML 解析环境；正式测试的两份英文大目录仍超时，见 [476/478 结果](evidence/site-v7-large-page-failure.json)。v8 保留完整 GFM 解析，用一次拼接组装重写结果，仅为四个完整配置/工具目录落盘用例设置15秒局部预算。[v8正式覆盖核验](evidence/site-v8-coverage.json)记录479用例全部通过且原478个身份逐一保留。v8 的 [完整docs:check](evidence/docs-check-v8-completed.json) 已通过，确认2590个内部片段引用、197个Markdown和llms.txt。随后测得 HTMLCollection 迭代每步读取length会重复扫描全体元素，见 [受限探针](evidence/site-v8-fragment-collection-cost.json)。v9 改为静态NodeList索引遍历，并新增重复坏片段顺序的精确断言；[v9覆盖核验](evidence/site-v9-coverage.json)确认480用例全部通过且保留原479个身份。v9站点构建与2590条引用检查通过，但[跨构建输入哈希对照](evidence/site-v9-rebuilt-html-mismatch.json)失败：185个HTML路径和长度相同，SHA均不同，旧HTML字节未保存。v10将验收限定为旧、新检查器各读取同一份[已保存的847文件站点](evidence/site-after-v9-bytes-preserved.json)，[完整报告对照](evidence/site-v10-equivalence.json)已通过：两份报告精确为2590条有效引用、空broken数组，运行前后847文件哈希相同，临时模块与辅助目录已删除。VitePress全站哈希映射只提供差异传播机制，不证明这次历史差异的完整原因；原失败证据保留。后续门禁及硬审核由独立证据判定；当前有效状态以 [state.json](state.json) 为准。

## 目录

- [范围与责任](#范围与责任)
- [环境前提](#环境前提)
- [命令复现入口](#命令复现入口)
- [成功判据](#成功判据)
- [失败处理](#失败处理)
- [限定源码复用清单](#限定源码复用清单)
- [证据引用与集成](#证据引用与集成)

## 范围与责任

本节点对应 [开发路线 P0-A](../../../MULTI_AGENT_DEVELOPMENT_ROADMAP.md) 和 [主规格](../../../MULTI_AGENT_REQUIREMENTS.md) 的 REQ-001、REQ-022 基线要求，并为身份隔离、工具、流程、记忆及真实性要求提供限定源码依据。四种 harness 的专用安装与配置隔离、真实模型任务、岗位权限、PostgreSQL/GBrain、持久工作流、升级和三端业务交付属于后续产品验收范围；AC-01 至 AC-32 不因本节点完成自动改变状态。

文件所有权按 [计划第 3、5 节](plan.v1.md) 执行：本子任务只写本文件；Agent Note 及双语配对由另一文档任务负责；主执行者独占运行环境、依赖、共享构建产物、验证记录、候选和节点状态。所有候选内容冻结后，主执行者按 [节点规则](../../../NODE_DEVELOPMENT_RULES.md) 组织真实 OpenCode 硬审。内置实施子任务的核查不构成独立硬审。

## 环境前提

以下起点和工具事实引用已生成的 [preflight.json](evidence/preflight.json)，版本要求另以源码声明为据；它们由主执行者运行并记录，本子任务只读取证据。安装后状态仍须由主执行者另行核对，不能用安装前记录替代。

| 项目 | 已有证据或源码声明 | 复现要求与证据限制 |
|---|---|---|
| 仓库与源码 | `D:\Projects\dsh861`；preflight 记录分支 `feat/multi-agent-company-nodes`、HEAD `d347e703908d0406b7a7ef80e3a0e594d86b2215`。 | preflight 列出已有修改、未跟踪文件和保护副本哈希；没有远端检查证据，不声称最新上游。 |
| Node | preflight 记录 `D:\Program Files\nodejs\node.EXE`、`v24.18.0`；[根包](../../../package.json) 声明 `^22.19.0 || >=24.0.0`。 | 已有版本命令退出零记录；满足根包引擎范围不等于依赖或构建成功。 |
| pnpm 与 Corepack | 根包固定 `pnpm@11.7.0`；preflight 记录 Corepack `0.35.0`；[依赖恢复证据](evidence/dependency-resolution-summary.json)引用局部 pnpm 版本与冻结安装日志。 | 使用本节点 `toolchain/bin/pnpm.cmd`；安装和运行证明分别来自独立命令回执。 |
| PowerShell 与 Python | preflight 记录 `D:\Program Files\PowerShell\7\pwsh.exe` 为 `7.6.5`、`C:\Python312\python.exe` 为 `Python 3.12.8`。 | 已有版本命令退出零记录；Windows 验证使用 PowerShell 7，Python 用于主执行者真实代理包装。 |
| 锁文件 | preflight 记录根 `pnpm-lock.yaml` 为 768436 字节，SHA-256 为 `2c903ab870f821ee2db62fa9417d11b1c2b9c65fbeec30e851ddc53c4cc8c383`。 | 本子任务未重新计算；主执行者安装后及封存时校验字节一致，不重生成锁文件消除失败。 |
| 依赖与环境文件 | preflight 的安装前记录为 `node_modules_present: false`、`root_env_present: false`。 | 只检查存在性，不读取 `.env`；[e2e 配置](../../../vitest.e2e.config.ts) 声明调用 `process.loadEnvFile`，运行前必须确认无密钥条件仍成立。 |
| 文件系统与原生依赖 | preflight 的 `Get-Volume` 输出为 D 盘 `NTFS`，当时剩余空间 `66519789568` 字节；[Session 包](../../../packages/session/session-persistence-jsonl/package.json) 依赖 `fs-ext` 与 `koffi`。 | 当前安装选择 NTFS 分支；原生依赖、构建工具链及生命周期脚本结果仍待安装日志确认。 |
| 临时资源 | `D:\Temp_projects\dsh861-p0-a-baseline`；当前轮次为其 `r01` 子目录。 | 先核对归属；工具链、缓存、运行 home、临时脚本和原始日志均使用计划规定的自有位置。 |

局部环境的完整准备由 [计划任务 A/B](plan.v1.md) 规定。主执行者先保护已有文档和 tracked diff，再在专用 PowerShell 子进程设置缓存、临时目录、`DSH_HOME`、`DSH_AGENTS_HOME` 与遥测开关，清除真实密钥、认证 token、模型路由覆盖及未知 `DSH_CLIENT_*` 环境继承，只记录变量名，不输出值。真实 OpenCode 审核使用独立环境；构建验证的临时设置不写入用户级或机器级配置。

## 命令复现入口

以下命令仅供主执行者按 [计划任务 A 至 E](plan.v1.md) 顺序执行。每个外部命令分别保存绝对程序路径、参数、工作目录、版本、非敏感环境覆盖、起止时间、退出码、signal、timeout、stdout/stderr 位置和哈希；一组命令最后返回零不能代替逐条成功。这里不增加产品源码或根配置的修改权限。

### 1. 核对并保护起点

使用 PowerShell 7，并先完成计划任务 A 的已有工作保护和目录归属检查。

```powershell
$P0ARepo = 'D:\Projects\dsh861'
$P0ATemp = 'D:\Temp_projects\dsh861-p0-a-baseline'
$P0ARun = Join-Path $P0ATemp 'r01'
Set-Location -LiteralPath $P0ARepo
git rev-parse --show-toplevel
git branch --show-current
git rev-parse HEAD
git status --short --branch --untracked-files=all
git diff --stat
git diff --cached --stat
Get-FileHash -LiteralPath pnpm-lock.yaml -Algorithm SHA256
node --version
git --version
& 'D:\Program Files\nodejs\corepack.cmd' --version
& 'D:\Program Files\PowerShell\7\pwsh.exe' -NoProfile -Command '$PSVersionTable.PSVersion.ToString()'
& 'C:\Python312\python.exe' --version
Test-Path -LiteralPath node_modules
Test-Path -LiteralPath .env
Get-Volume -DriveLetter D | Select-Object DriveLetter,FileSystem,SizeRemaining
```

若 `.env` 已出现，不读取、移动或删除它；主执行者按计划解决无密钥运行条件，必要时取得真实 Codex 的计划修订后再执行依赖该条件的步骤。

### 2. 提供局部 pnpm 并冻结安装

下列入口以计划任务 B 的目录创建和局部环境准备已完成为前提，包括 `COREPACK_HOME`、`TEMP/TMP/TMPDIR`、npm 缓存、node-gyp 目录及隔离运行 home。Corepack 下载或版本解析失败时保留原始输出。

```powershell
& 'D:\Program Files\nodejs\corepack.cmd' enable --install-directory "$P0ATemp\toolchain\bin" pnpm
$env:PATH = "$P0ATemp\toolchain\bin;$env:PATH"
& "$P0ATemp\toolchain\bin\pnpm.cmd" --version
Get-Command pnpm.cmd | Select-Object Name,Source
```

只有版本为 `11.7.0` 且入口位于本任务临时目录，才继续按实测文件系统选择其中一条安装命令；不要同时运行两个分支。NTFS 使用以下入口。

```powershell
pnpm.cmd install --frozen-lockfile --store-dir "$P0ATemp\pnpm-store"
```

ReFS 使用计划规定的 clone 入口；未知文件系统或 clone 所需条件缺失时保留阻塞，不擅自改换安装方式。

```powershell
pnpm.cmd install --frozen-lockfile --store-dir "$P0ATemp\pnpm-store" --package-import-method=clone
```

安装后核对锁文件、中央文件差异和计划指定的 Git 集成字段；生命周期脚本及原生绑定的判据详见计划任务 B，不能仅以安装退出零推定启动成功。

```powershell
Get-FileHash -LiteralPath pnpm-lock.yaml -Algorithm SHA256
git diff -- package.json pnpm-lock.yaml pnpm-workspace.yaml
git config --show-origin --get core.hooksPath
git config --show-origin --get merge.dsh-translation-pairing.driver
```

### 3. 基础检查与文档检查

以下命令提供首次复现入口；已有通过证据的恢复执行按有效修订决定重验范围。v10复用v9已通过的双语配对、限定fragment类型检查、480个站点用例和独立站点构建。旧、新检查器在同一保留站点上各运行一次，比较完整JSON报告并核对运行前后847文件的完整字节与哈希；随后依次执行`docs:check`、`test:docs`、`doc-sync`、`lint`及本节后续构建与启动验收。v8的201文件投影对照和原始Markdown负向控制在相关源码哈希不变时复用。完整公开typecheck不重复；源码工具类型由限定检查与lint自带的Host构建覆盖。

```powershell
pnpm.cmd exec vitest run scripts/pnpm-invocation.spec.ts apps/cli/tests/windows-shell.spec.ts
pnpm.cmd run typecheck
pnpm.cmd run verify-translation-pairing --write .agents/notes/implemented/process/2026-09-08-fixed-node-candidate-review.md
pnpm.cmd run test:docs
pnpm.cmd run doc-sync
pnpm.cmd run lint
git diff --check
git diff --cached --check
```

[根包脚本](../../../package.json) 表明 `typecheck` 和 `lint` 会先构建 Host；计划还要求 `doc-sync` 位于最终完整构建之前。这些会改写共享产物的命令不在同一工作区并行启动，聚合脚本内部既有调度保持原样。节点目录不在普通双语自动发现范围，主执行者还须检查本文件的相对链接、段落物理行、结尾换行以及新增未跟踪文档；不能把 `doc-sync` 结果当作所有节点文档都被自动覆盖。

### 4. 完整构建、hygiene 与受支持入口

前述必需检查通过后运行完整构建，再检查必需产物；生成路径本身不是成功证据。

```powershell
pnpm.cmd run build
if (-not (Test-Path -LiteralPath apps/cli/lib/bin.js -PathType Leaf)) {
  throw 'P0-A: apps/cli/lib/bin.js is missing'
}
if (-not (Test-Path -LiteralPath .dsh-build/client-build-environment.json -PathType Leaf)) {
  throw 'P0-A: complete client build record is missing'
}
Get-FileHash -LiteralPath apps/cli/lib/bin.js,.dsh-build/client-build-environment.json -Algorithm SHA256
pnpm.cmd run hygiene
pnpm.cmd dsh --help
node .\apps\cli\lib\bin.js --version
```

[scripts/build.ts](../../../scripts/build.ts) 先运行 `build:lib`，再运行 `build:web`，成功后写完整构建记录；[根包](../../../package.json) 将 `build:lib` 拆为 Host tsc、Host tsdown、Client tsc、Client tsdown，随后才是 Web build。[构建记录声明](../../../scripts/client-build-environment.ts) 指定 `.dsh-build/client-build-environment.json`。不能用单独 Host 构建、仅 tsc 成功或失败残留文件代替完整构建。

源码帮助走根包声明的 `node --import tsx/esm apps/cli/src/bin.ts`；构建版走 [CLI 包](../../../apps/cli/package.json) 声明的正式 `dsh` bin，并应输出该包当前版本 `0.1.3-alpha.1`。应用行为验证使用 `dsh --profile`；下节 Loader driver 只是仓库测试入口，不是新增的正式应用启动方式。

### 5. 五个 built-bin 必选用例与 Loader smoke

确认构建产物存在后设置 built 模式，准确选择计划列出的五个用例。

```powershell
$env:DSH_EXAMPLE_MODE = 'lib'
$P0ABinCases = 'requires --profile and rejects removed commands|routes help and usage errors without activating startup-dependent rows|runs the headless profile through its app-owned task positional|fails loud on a nonexistent profile with the plugin-command hint|reports a patch-overlay boot failure without hanging'
pnpm.cmd exec vitest run --config vitest.e2e.config.ts apps/cli/tests/built-bin.e2e.ts -t $P0ABinCases
pnpm.cmd exec vitest run --config vitest.e2e.config.ts apps/cli/tests/profiles/headless/tests/keyless-smoke.e2e.ts
```

[built-bin 测试](../../../apps/cli/tests/built-bin.e2e.ts) 的 suite 使用 `describe.skipIf(!existsSync(dshBin))`。必须核对五个必选用例全部实际执行；必选项 skip、todo、零匹配或缺产物导致整组跳过均不通过。过滤器未选中的其他用例按计划记录为范围外，不用它们的跳过数量掩盖必选项缺失。[e2e 配置](../../../vitest.e2e.config.ts) 声明 `retry: 2`，主执行者必须保留实际重试和首次失败，不能只记录最后一轮绿色结果。

正式 headless 用例启动 built CLI，并使用本地 mock HTTP 服务断言任务位置参数进入请求、服务实际收到请求以及输出和退出码；它不是实际供应商推理证据。[Loader smoke](../../../apps/cli/tests/profiles/headless/tests/keyless-smoke.e2e.ts) 则通过测试 driver 取得内部事件和压缩 Session 记录。[测试 patch](../../../apps/cli/tests/profiles/headless/tests/fixtures/cli.patch.yml) 禁用真实 DeepSeek provider，指定 `cli-mock`，并设置隔离 Session 与 skill 路径；其模型输出和 usage 属于夹具。生产 shell、Loader 组装和 Session 落盘的证明以本轮实际执行日志及对应断言为限。

## 成功判据

下表是 [计划第 7.1 节](plan.v1.md) 的验收证据索引，不填写当前通过状态。主执行者须以真实逐命令记录逐项判断，只有 `P0A-01` 至 `P0A-09` 全部通过且硬审绑定当前候选，才能更新节点状态。

| 验收 | 必需可观察结果 |
|---|---|
| P0A-01、P0A-02 | Git 分支、HEAD、锁文件与计划对应；已有工作有保护清单及哈希，临时目录和资源归属可核对。 |
| P0A-03 | 局部 pnpm `11.7.0` 冻结安装成功；完整日志说明原生依赖、生命周期脚本和 Git 集成，锁文件不变。 |
| P0A-04 | 指定的两个单元测试文件实际执行通过，公开 `typecheck` 成功，必需项无跳过。 |
| P0A-05 | 完整 `build`、`hygiene`、源码帮助和 built 版本命令成功；五个 built-bin 必选用例及一个 Loader smoke 实际执行通过，产物和构建记录有哈希。 |
| P0A-06 | 本文件列出的命令和前提可复现；限定复用清单有需求、源码、测试、证据等级和缺口，服务声明与 mock 不冒充产品能力。 |
| P0A-07 | Agent Note 双语及配对、`test:docs`、`doc-sync`、`lint`、差异检查及节点文档专项检查完成。 |
| P0A-08 | 候选包含未跟踪文件，清单、文件哈希、日志哈希和最终构建记录完整且固定。 |
| P0A-09 | 真实 OpenCode 使用 `zhipuai-coding-plan/glm-5.3`、`--variant max`，对固定候选明确返回 `PASS`，且有程序身份、版本、调用参数和逐项审核证据。 |

Loader smoke 的源码判据包括 Windows 实际选择 `pwsh` 工具、工具结果和最终输出含 `CLI_TOOL_ROUND_TRIP`、stderr 为空、产生可解析且无截断帧的 `.jsonl.zstd`、首条为 Session header、持久化 request header 含 `web_fetch` 与 `web_search` 工具名。它不验证真实网页抓取、供应商计费、完整权限拒绝、跨进程锁恢复或四种 harness 接入；usage 的固定断言也不能作为实际模型用量。

负向 built-bin 用例的应用退出码 `1` 是测试预期，外层测试应通过；超时、未执行或只有 CLI 退出零而没有有效结果不能判成功。运行完成后，主执行者还须确认本轮自有子进程和 mock server 结束；若测试清理了原始 Session，只记录保留的日志及源码断言，不补造运行时 Session。

## 失败处理

失败保留原始命令、输出、退出事实和轮次，不覆盖旧日志。处理边界以 [计划第 7 节](plan.v1.md) 为准，本子任务不修改源码、配置、检查脚本或测试语义。

| 失败或缺少条件 | 当前节点处理要求 |
|---|---|
| Git 起点、既有文件、锁文件或资源归属不明 | 暂停依赖这些事实的执行并交主执行者核对，保留并发内容；不 reset、clean 或覆盖用户工作。 |
| Corepack、冻结安装、原生绑定、hooks 或宿主工具链失败 | 保存具体错误和警告分类；不换 pnpm 版本、关完整性检查、忽略脚本、重写锁文件、设置 `CI=true` 或启用 hooks 覆盖开关。缺少系统条件时记录阻塞。 |
| 出现根 `.env` 或无密钥环境无法确认 | 只报告存在性和缺少条件，不读取凭据或在未知环境启动 e2e；按计划取得适用的执行环境修订。 |
| 必需检查失败、跳过或未运行 | 保留 `FAIL`、`BLOCKED` 或 `NOT_RUN`，不挑选通过叶子替代聚合结果。允许文档范围内的问题可由其所有者修复；扩大文件范围或改变验收语义交真实 Codex 修订计划。 |
| Windows shell、原生持久化或启动失败 | 保存实际错误并区分工具链、权限、文件系统、脚本或产品问题；不切换 bash、关闭 sandbox、扩大权限或 timeout、删除断言换取成功。 |
| 产品源码、依赖版本、根配置或既有测试需要修改 | 保持当前节点失败或阻塞，交真实 Codex 修订当前计划，保留 v1 原文，不由本子任务先改后补手续。 |
| OpenCode 身份、指定模型、max 或回执无法核实 | 不降级、不使用内置代理替代硬审；主执行者记录阻塞。`FAIL` 或 `BLOCKED` 不能解释为通过。 |
| 固定候选变化或审核发现问题 | 修改后使用新轮次补验、重新封存并复审，不复用旧候选的结论，不在审核进行中继续改候选。 |

清理和回退只涉及已确认属于本轮的资源；不得按 `node`、`pwsh`、`codex` 等名称批量终止进程，不删除未知锁，不沿 junction/symlink 清理其他目录。计划、失败日志和历轮审核回执始终保留。

## 限定源码复用清单

下面逐项核对了计划任务 C 指定文件的存在性和相关声明；同一包内缩写的文件名均链接到其实际文件。为核准复现入口，另定点读取了根包、CLI 包、e2e 配置、built-bin 必选用例、Loader smoke 与其 patch，并检索完整构建记录常量；没有全仓穷尽检索。MCP 测试只读取目录同步、调用和 transport 的相关段落，built-bin 只读取启动 helper、跳过条件和必选断言，不声称审查了这两个测试文件的所有路径。

证据等级沿用计划：`源码或配置已核实` 只表示已读到相应声明与测试；`本节点命令已验证` 需要本轮运行日志，本文件编写时没有可归入该级别的安装、检查或启动结果；`可复用但需要适配与验证` 表示现有基础不能直接等同需求完成；`需求需要新增实现` 标记尚待交付的需求行为；`验证条件缺失` 标记本次未取得的运行条件或证据。清单中的新增/调整内容是需求缺口记录，不是本节点获准实施的产品变更。

### 构建与包管理调用

| 字段 | 核实记录 |
|---|---|
| 需求引用 | [REQ-001、REQ-022](../../../MULTI_AGENT_REQUIREMENTS.md)；[路线 P0-A](../../../MULTI_AGENT_DEVELOPMENT_ROADMAP.md)。 |
| 源码位置 | [build.ts](../../../scripts/build.ts)、[pnpm-invocation.ts](../../../scripts/pnpm-invocation.ts)，脚本顺序由 [根包](../../../package.json) 声明。 |
| 测试位置 | [pnpm-invocation.spec.ts](../../../scripts/pnpm-invocation.spec.ts)：JS 入口经 Node、可执行入口直接启动、包含空格或特殊字符的参数保持数组传递、缺少 `npm_execpath` 拒绝。该测试不执行完整构建。 |
| 证据等级 | 源码或配置已核实；验证条件缺失。 |
| 可复用内容 | `pnpmInvocation()` 使用 lifecycle 的 `npm_execpath` 生成无 shell 的子进程参数；`build.ts` 通过它调用公开包脚本，并在 lib/Web 完成后写构建记录。 |
| 需新增/调整内容 | 本节点只需局部工具链配置和真实执行证据；发现必须改变构建脚本、依赖或根配置时超出 v1 实施范围。 |
| 尚缺运行条件 | 精确 pnpm、冻结安装、原生依赖、完整构建和 hygiene 的本轮日志；本子任务没有运行这些命令。 |

### Profile 组装

| 字段 | 核实记录 |
|---|---|
| 需求引用 | [REQ-001、REQ-003、REQ-015](../../../MULTI_AGENT_REQUIREMENTS.md)。 |
| 源码位置 | [profile.ts](../../../packages/boot/app-boot/src/profile.ts)、[CLI bin.ts](../../../apps/cli/src/bin.ts)。 |
| 测试位置 | [profile.spec.ts](../../../packages/boot/app-boot/tests/profile.spec.ts) 有 profile 初始化不覆盖、bundle 查找、patch 顺序、模块回退和错误配置断言；正式启动另由 [built-bin.e2e.ts](../../../apps/cli/tests/built-bin.e2e.ts) 的五个选定用例提供待运行证据。 |
| 证据等级 | 源码或配置已核实；可复用但需要适配与验证。 |
| 可复用内容 | `loadProfile()` 从 `DSH_HOME/profiles` 读取配置，按 bundle 声明和顺序解析 patch；`composeEntries()` 从空列表组合；bundle 包优先从安装锚点解析，再从 profile 目录解析。CLI 的 profile 分支调用正式 profile 启动入口。 |
| 需新增/调整内容 | 产品仍需经验证的系统专用配置发现、扩展来源和成员身份/权限管理；profile 目录及模块解析机制本身不证明外部四种 harness 的全局安装隔离。 |
| 尚缺运行条件 | 主执行者的源码帮助与 built-bin 日志；`profile.spec.ts` 仅作源码依据，不在本计划的必选单元测试命令中。四种 harness 的隔离样本属于后续节点。 |

### Codex

| 字段 | 核实记录 |
|---|---|
| 需求引用 | [REQ-002、REQ-003、REQ-010、REQ-017；AC-01 至 AC-04、AC-23](../../../MULTI_AGENT_REQUIREMENTS.md)。 |
| 源码位置 | [package.json](../../../packages/subagent/subagent-codex/package.json)、[index.ts](../../../packages/subagent/subagent-codex/src/index.ts)、[run.ts](../../../packages/subagent/subagent-codex/src/run.ts)。 |
| 测试位置 | [real-product.spec.ts](../../../packages/subagent/subagent-codex/tests/real-product.spec.ts) 声明真实 package-local CLI、版本及 argv 检查、本地 Responses 夹具、缺平台 payload 不回退到 PATH、命名实例、拒绝路径和取消后进程退出断言；本节点不运行这些产品测试。 |
| 证据等级 | 源码或配置已核实；可复用但需要适配与验证；验证条件缺失。 |
| 可复用内容 | 包带 `dsh.bundle.patch` 声明，精确依赖 `@openai/codex@0.149.1`；`codexAppServerArgv()` 从该包 manifest 解析 wrapper，使用 Node 启动 `app-server --stdio`，不是任意 PATH CLI。Provider 以父 Session cwd 执行一次性文本任务，不继承父对话；公开 run 前先初始化并创建 ephemeral thread，经共享 subprocess 管理取消和释放。 |
| 需新增/调整内容 | 产品专用安装与配置发现隔离、稳定成员身份、获准模型/工具提供、步骤交接和实际拒绝证据仍需交付；可选 `model` 未配置时保留 Codex 设置，不能从包存在推定满足本项目指定模型/max 的治理要求。 |
| 尚缺运行条件 | 后续节点的专用运行目录、平台 payload、获授权模型与认证以及正反向隔离验证；本次只有源码和测试声明，无真实产品或供应商执行结果。 |

### Claude Code

| 字段 | 核实记录 |
|---|---|
| 需求引用 | [REQ-002、REQ-003、REQ-010、REQ-017；AC-01 至 AC-04、AC-23](../../../MULTI_AGENT_REQUIREMENTS.md)。 |
| 源码位置 | [package.json](../../../packages/subagent/subagent-claude-code/package.json)、[index.ts](../../../packages/subagent/subagent-claude-code/src/index.ts)、[run.ts](../../../packages/subagent/subagent-claude-code/src/run.ts)。 |
| 测试位置 | [real-product.spec.ts](../../../packages/subagent/subagent-claude-code/tests/real-product.spec.ts) 声明真实 SDK/分发 CLI 身份、SDK `0.3.241` 与 CLI `2.1.241` 的预期版本、本地 Messages 夹具、命名实例、权限和取消断言；这里只确认测试期待值，不是已安装版本证据。 |
| 证据等级 | 源码或配置已核实；可复用但需要适配与验证；验证条件缺失。 |
| 可复用内容 | 包带 bundle 声明，精确依赖官方 `@anthropic-ai/claude-agent-sdk@0.3.241`；`startClaudeCodeRun()` 调用官方 `query()`，使用共享 subprocess 接管 SDK 启动的 CLI。一次性执行设置 `persistSession: false`，只接受非错误、非空的 SDK success 结果及正常流结束；默认非交互权限模式为 `dontAsk`。 |
| 需新增/调整内容 | 仍需产品专用安装、原生配置发现隔离、成员授权和真实步骤交接证据；源码允许可选 `model` 并继承原生设置，不能把 SDK 路径误认为指定审核模型和思考参数的回执。 |
| 尚缺运行条件 | 后续节点的专用配置、平台 CLI、获授权模型与认证以及完整隔离/取消验证。本节点不运行产品探针，也不把本地响应夹具当真实模型审核。 |

### ACP

| 字段 | 核实记录 |
|---|---|
| 需求引用 | [REQ-002、REQ-006、REQ-015、REQ-017、REQ-018](../../../MULTI_AGENT_REQUIREMENTS.md)。 |
| 源码位置 | [index.ts](../../../packages/subagent/subagent-acp/src/index.ts)、[run.ts](../../../packages/subagent/subagent-acp/src/run.ts)。 |
| 测试位置 | [loader-composition.e2e.ts](../../../packages/subagent/subagent-acp/tests/loader-composition.e2e.ts) 使用测试 ACP server，断言父 cwd 进入真实子进程和 `session/new`、remote-limit 诊断与部分输出进入持久 Session；本节点不执行该文件。 |
| 证据等级 | 源码或配置已核实；可复用但需要适配与验证。 |
| 可复用内容 | 以配置的 command/args 经共享 subprocess 创建子进程，ACP 初始化后新建 Session，再发 prompt；默认拒绝权限请求，取消和释放由 provider 与进程所有者处理。它是 ACP subprocess provider。 |
| 需新增/调整内容 | 具体 OpenCode/Grok 入口、身份、配置隔离和统一工具连接需要单独实现及验证。此 provider 声明不支持父侧 toolFilter、persona 等 start 能力，`session/new` 传 `mcpServers: []`；其存在不证明 OpenCode、Grok 或 A2A 已接入。 |
| 尚缺运行条件 | 后续节点的具体产品协议支持、专用程序/配置及真实适配日志；ACP mock 的 cwd 或诊断断言不能替代四种产品验收。 |

### Workflow

| 字段 | 核实记录 |
|---|---|
| 需求引用 | [REQ-006、REQ-013、REQ-018、REQ-020；AC-19、AC-21、AC-22](../../../MULTI_AGENT_REQUIREMENTS.md)。 |
| 源码位置 | [index.ts](../../../packages/workflow/workflow/src/index.ts)、[README](../../../packages/workflow/workflow/README.md)。 |
| 测试位置 | [workflow.spec.ts](../../../packages/workflow/workflow/tests/workflow.spec.ts) 使用 `StubEngine` 核对错误类型、注册与生命周期事件监听失败隔离，其 `start()` 不执行 workflow。 |
| 证据等级 | 源码或配置已核实；可复用但需要适配与验证；需求需要新增实现。 |
| 可复用内容 | 抽象 `WorkflowEngine`、运行类型导出、错误分类和只读生命周期事件可供消费者与执行引擎共用。README 明确该包不带执行引擎，并列出无 journaling/resume、无已保存或嵌套 workflow 的限制。 |
| 需新增/调整内容 | PostgreSQL 控制状态与检查点、可编辑计划/模板、重启恢复、等待批准及外部副作用核实等需求不能由抽象服务或事件声明完成；本次未核查其他执行引擎全部实现。 |
| 尚缺运行条件 | 后续节点的数据库、持久执行组合及崩溃/恢复/重试场景；本次没有运行 workflow 单元或组合测试。 |

### Agent Teams

| 字段 | 核实记录 |
|---|---|
| 需求引用 | [REQ-005、REQ-006、REQ-010、REQ-013、REQ-018、REQ-020；AC-05、AC-21、AC-23](../../../MULTI_AGENT_REQUIREMENTS.md)。 |
| 源码位置 | [package.json](../../../packages/experimental/agent-team/package.json)、[index.ts](../../../packages/experimental/agent-team/src/index.ts)、[journal.ts](../../../packages/experimental/agent-team/src/journal.ts)、[README](../../../packages/experimental/agent-team/README.md)。 |
| 测试位置 | [persistence.spec.ts](../../../packages/experimental/agent-team/tests/persistence.spec.ts) 用 JSONL 后端与 MockAdapter，销毁并重建 Context 后核对成员 provisioning 恢复、冷续接队列和已记录/待处理消息去重；不等同多个真实服务进程并发验收。 |
| 证据等级 | 源码或配置已核实；可复用但需要适配与验证。 |
| 可复用内容 | 包为 `private: true` 实验包；服务提供 roster、mailbox、任务 CAS 和恢复入口。`TeamJournal` 在进程内按 Lead ID 串行事务，向准确的 Lead Session append 后 `sessions.flush()`，再通知提交；不能笼统宣称没有团队持久化基础。 |
| 需新增/调整内容 | README 明确单进程、共享 cwd、无 worktree/远程成员/文件系统锁，`writeScopes` 只提示重叠且不授权写入。产品仍需符合成员空间隔离、PostgreSQL 公司控制状态、多执行节点及升级要求；现有 Session 恢复不自动满足这些要求。 |
| 尚缺运行条件 | 本次未执行持久化测试；后续节点需独立工作副本、真实并发/进程故障、取消所有权和版本连续性证据。实验包存在不代表转正或正式发布。 |

### MCP 与 Skills

| 字段 | 核实记录 |
|---|---|
| 需求引用 | [REQ-003、REQ-011、REQ-015、REQ-020；AC-06 至 AC-10、AC-26](../../../MULTI_AGENT_REQUIREMENTS.md)。 |
| 源码位置 | [MCP index.ts](../../../packages/mcp/mcp-client/src/index.ts)、[Skill index.ts](../../../packages/skill/skill/src/index.ts)。 |
| 测试位置 | [mcp-client.spec.ts](../../../packages/mcp/mcp-client/tests/mcp-client.spec.ts) 的工具同步/调用相关断言使用 mock client，transport 段检查构造，不证明真实服务身份或完整凭据隔离；[skill.spec.ts](../../../packages/skill/skill/tests/skill.spec.ts) 核对内存 provider、同名优先级、作用域、目录失效和取消。 |
| 证据等级 | 源码或配置已核实；可复用但需要适配与验证；需求需要新增实现。 |
| 可复用内容 | MCP client 声明 stdio/Streamable HTTP 配置，连接外部服务后把工具注册到 dsh `ctx.tools`，名称含 server namespace，卸载释放连接及注册。SkillRegistry 合并 provider 目录、按作用域与 rank 选择同名项、按需读取正文，并分别声明模型/用户可调用性；具体来源由 provider 负责。 |
| 需新增/调整内容 | 系统向四种 harness 提供统一资源、真实身份授权、版本固定、直接猜测工具名的拒绝及原生工具限制仍需实现和验证。MCP 的 `failOnStartupError` 默认 `false`，Skill 目录可返回 `complete: false`；所需能力缺失的产品启动判定不能只看目录中还有部分条目。 |
| 尚缺运行条件 | 后续节点的真实中央能力服务、四种产品连接、岗位许可和撤销/拒绝场景；本节点没有执行这两个测试文件或连接外部 MCP。 |

### Session 与 Windows shell

| 字段 | 核实记录 |
|---|---|
| 需求引用 | [REQ-010、REQ-016、REQ-017、REQ-018、REQ-022；AC-23、AC-28](../../../MULTI_AGENT_REQUIREMENTS.md)。 |
| 源码位置 | [Session package.json](../../../packages/session/session-persistence-jsonl/package.json)、[lease.ts](../../../packages/session/session-persistence-jsonl/src/lease.ts)、[win32.ts](../../../packages/session/session-persistence-jsonl/src/win32.ts)。 |
| 测试位置 | [windows-shell.spec.ts](../../../apps/cli/tests/windows-shell.spec.ts) 组合发布 bundle 并用平台参数核对 pwsh/bash 行及 preset；它不单独启动真实 shell。真实 shell 与压缩记录由 [Loader smoke](../../../apps/cli/tests/profiles/headless/tests/keyless-smoke.e2e.ts) 待运行；正式 CLI 另见 [built-bin](../../../apps/cli/tests/built-bin.e2e.ts)。 |
| 证据等级 | 源码或配置已核实；可复用但需要适配与验证；验证条件缺失。 |
| 可复用内容 | JSONL 包继续承担原生 Session 持久化；`SessionWriteLease.acquire()` 的 Windows 分支使用命名内核 semaphore，POSIX 分支使用 `fs-ext` flock；Win32 经 Koffi 调用 `MoveFileExW` 的 write-through 发布。shell 测试声明 Windows 组合使用 pwsh，POSIX 使用 bash。 |
| 需新增/调整内容 | 新平台数据需要与原生 Session 建立关联并保留已发布记录及相邻迁移规则，不以统一 PostgreSQL 为由搬移覆盖旧 Session。本次 smoke 不证明所有 lease 争用、崩溃恢复及 sandbox 拒绝路径。 |
| 尚缺运行条件 | Windows PowerShell 7、可用原生绑定及本轮真实启动/落盘日志；跨进程锁故障与完整权限验收仍缺相应运行证据。 |

### PostgreSQL / GBrain

| 字段 | 核实记录 |
|---|---|
| 需求引用 | [REQ-007、REQ-016、REQ-018、REQ-023；AC-16 至 AC-18、AC-29、AC-30](../../../MULTI_AGENT_REQUIREMENTS.md)。 |
| 源码或资料位置 | 本项按任务 C 只复核 [主规格](../../../MULTI_AGENT_REQUIREMENTS.md) 与 [GBrain 评估](../../../GBRAIN_MEMORY_ASSESSMENT.md)，没有重新访问 GBrain 上游源码，也未搜索全仓数据库实现。 |
| 测试位置 | 限定输入未给出本仓库 PostgreSQL/GBrain 联合测试文件；[路线 P0-C](../../../MULTI_AGENT_DEVELOPMENT_ROADMAP.md) 与评估列出待验证场景，属于验收要求，不是已存在或已执行测试。 |
| 证据等级 | 需求需要新增实现；验证条件缺失。既有评估仅作为来源明确的调研输入。 |
| 可复用内容 | 需求已选定 GBrain 与受管理的 PostgreSQL 服务；评估记录 GBrain 在提交 `2efaaf8f8a817b5b82e023383618fdcdb1cc5f7d` 的接口、source 授权和版本 `0.48.4.0`、Bun `>=1.3.10` 声明。这些是评估引用，不是本轮安装版本或兼容性结论。 |
| 需新增/调整内容 | 平台与 GBrain 采用独立逻辑数据库、账号及迁移记录；公司/项目/成员 source 授权、跨 harness 读写、更正、失联和恢复需集成验证。评估指出同 source 的文件夹不提供读取隔离，`private` 不直接等于跨 harness 成员私有记忆；GBrain 不作为流程或授权的唯一事实来源。 |
| 尚缺运行条件 | 经验证的 PostgreSQL/pgvector/GBrain 版本、部署节点、受控账号、获授权的模型与认证、正反向数据权限、并发/失联/恢复及中文检索证据。本节点不安装服务，不依据有限检查宣称全仓绝无相关代码。 |

## 证据引用与集成

静态结论以上述实际源码、测试和需求相对链接为依据；[首轮验证记录](verification.r01.json) 已归档依赖安装失败及后续未运行状态，修复和重验使用新回执保留历史。各阶段实际结果由主执行者的命令证据记录，不在本文复制另一套成功判定。

[计划调用记录](evidence/planning-invocation.json) 已保存真实 Codex 的程序路径、`codex-cli 0.153.4` 版本、`gpt-6-astra` 与 `model_reasoning_effort="max"` 参数、退出零记录及计划/原始输出哈希；[运行前记录](evidence/preflight.json) 已保存起点、保护清单、工具版本和磁盘信息。它们证明各自记录的前置事实，不证明依赖安装、节点必需检查或硬审通过。

[开发工具核验摘要](../../AGENT_TOOL_VERIFICATION.md) 记录 OpenCode `1.18.27` 探针退出零、输出 `OPENCODE_PROBE_OK`，且会话导出中的模型、provider、variant 分别为 `glm-5.3`、`zhipuai-coding-plan`、`max`。本子任务只读取该摘要，没有重跑探针或复核原始会话导出；探针只验证工具调用条件，没有生成当前候选审核结论。开发工具使用也不构成交付产品的专用 harness 隔离验收。

按 [计划第 6 节](plan.v1.md)，主执行者的验证记录引用 `D:\Temp_projects\dsh861-p0-a-baseline\r01\logs` 下实际输出及其哈希。候选以 `candidate.r01.json` 列出包含未跟踪文件的实际内容，清单自身哈希另写 `candidate.r01.sha256`；`state.json` 与 `reviews/r01.md`、`reviews/r01.json` 是候选绑定的后续记录，不构成候选自引用。旧安装失败和验证脚本失败回执均保留；完整门禁及当前候选的审核结果尚未产生。

节点规则及工具摘要说明真实 CLI 包装位于 `D:\Temp_projects\dsh861-node-governance\src\ops\real_agents.py`，是本轮治理新建的临时 subprocess 包装。本子任务未调用或独立核查包装；正式硬审的程序路径/版本/哈希、模型/variant 参数、起止时间、退出事实和输出由主执行者另行封存。模型名称文本、退出零或内置子任务自检均不能替代指定真实 OpenCode 对当前固定候选的明确 `PASS`。
