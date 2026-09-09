# P0-A：Windows 构建与可复现启动基线

计划版本：**v1**\
前置节点：无，这是首个开发节点。\
计划保存位置：`D:\Projects\dsh861\development\nodes\P0-A\plan.v1.md`\
实施责任：ZCode。\
硬审核：真实 OpenCode，`zhipuai-coding-plan/glm-5.3`，`--variant max`。

**本节点交付可复现的依赖安装、完整构建、限定范围的真实启动验证和基线证据。只有必需检查全部通过，且 OpenCode 对固定候选明确给出 `PASS`，才算 P0-A 完成。P0-A 完成不代表 P0 阶段完成，也不将任何产品级 AC 标为完整通过。**

本计划中的安装、构建和测试命令均为后续实施步骤。本轮只进行了文件读取、限定源码检索、Git 状态检查以及工具路径、版本或帮助信息核实，没有执行安装、构建、测试或外部代理调用。

## 1. 范围与前置证据

### 1.1 本节点范围

本节点落实[开发路线](../../../MULTI_AGENT_DEVELOPMENT_ROADMAP.md)中 P0-A 的构建与现状基线：

1. 固定当前源码、锁文件、工具链和已有未提交内容。
2. 在任务临时目录提供仓库指定版本的 pnpm，安装冻结锁文件对应的依赖。
3. 完成仓库公开入口的类型检查、文档检查、lint、完整构建和 hygiene。
4. 验证源码 CLI 帮助入口、构建后的正式 `dsh` 入口，以及既有无密钥 headless 组装测试。
5. 形成限定范围的源码复用清单，区分已验证事实、可复用基础和仍缺失的产品能力。
6. 保存原始计划、执行证据、固定候选、Agent Note 和逐轮硬审结果。

这是环境与验收基线节点。**v1 不安排产品源码、依赖版本、根构建配置或测试语义的修改。** 安装配置和节点文档可以在本计划范围内修复；发现必须修改产品代码或检查实现的问题时，保留失败证据，交回 Codex 修订当前节点计划。

路线图中“给出每个子项目的具体设计”在本节点只落实到上述基线任务，不展开后续产品子项目的详细设计。

### 1.2 不在本节点范围

以下要求继续保留，但不作为 P0-A 的交付声明：

- 四种 harness 的专用安装、配置发现隔离、真实模型任务、取消、续接、系统工具连接和正反向权限验证。
- PostgreSQL、pgvector、GBrain 的安装、数据库账号隔离、记忆读写、失联和恢复验证。
- 公司、岗位、成员、工作流、审批、预算、组件升级及控制台的产品实现。
- Agent Teams 转正、跨进程协调、工作副本隔离或持久工作流改造。
- 网站、App、小程序业务交付，以及 GUI、浏览器交互或 GIF 录制。
- 全量覆盖率、全部真实 API e2e、全部 Session 快照、Python 打包和跨平台矩阵。
- Git 提交、暂存交付文件、推送、PR、发布、生产部署。
- 自动修改全局模型、provider、endpoint、API Key、全局 agent 配置或系统服务。

仓库依赖安装可能安装已声明的 Codex、Claude SDK 等依赖。这只计入仓库依赖闭包，不构成四种产品专用安装与隔离的验收。

### 1.3 已核实事实

| 项目 | 本轮核实结果 | 对实施的约束 |
|---|---|---|
| 分支与 HEAD | `feat/multi-agent-company-nodes`；`d347e703908d0406b7a7ef80e3a0e594d86b2215` | 复用现有分支，不重新切分支、同步或改写基线。 |
| 已有修改 | `AGENTS.md` 有 5 行新增；六份需求、调研、规则文档未跟踪 | 安装前保存清单和哈希；这些内容属于既有工作。 |
| Node | `v24.18.0`；程序为 `D:\Program Files\nodejs\node.exe` | 满足根包声明的 `^22.19.0 || >=24.0.0`。 |
| pnpm | 根包声明 `pnpm@11.7.0`；当前 PATH 未发现 pnpm | 必须提供该精确版本，不能改用 npm 安装整个 workspace。 |
| Corepack | `D:\Program Files\nodejs\corepack.cmd` 存在；`enable --help` 明确支持 `--install-directory` | 可在任务目录生成 shim，不需要写入全局 Node 安装目录。 |
| PowerShell | `D:\Program Files\PowerShell\7\pwsh.exe`；版本 `7.6.5` | Windows shell 验证使用真实 PowerShell 7，不能以 Windows PowerShell 5.1 代替。 |
| Python | 发现 `C:\Python312\python.exe` | 实施时记录版本，用于既有真实代理包装。 |
| 依赖与环境文件 | 根 `node_modules` 不存在；根 `.env` 不存在 | 当前没有安装成功证据；可以准备无密钥验证。执行前重新检查存在性，不读取密钥内容。 |
| 锁文件 | `pnpm-lock.yaml`，768436 字节 | 安装前后保持字节一致。 |
| 锁文件 SHA-256 | `2c903ab870f821ee2db62fa9417d11b1c2b9c65fbeec30e851ddc53c4cc8c383` | 与本计划基线核对，不能用重生成锁文件消除安装失败。 |
| 完整构建入口 | `package.json` → `tsx scripts/build.ts` | 必须通过 `pnpm run build`，保留脚本的生命周期环境。 |
| 构建顺序 | Host tsc → Host tsdown → Client tsc → Client tsdown → Web build | 不能把只完成 Host 或只完成 tsc 写成完整构建成功。 |
| 构建记录 | 完整构建写入 `.dsh-build/client-build-environment.json` | `typecheck`、`lint`、`doc-sync` 放在最终完整构建之前，避免随后部分构建改写产物。 |
| built-bin 测试 | `apps/cli/tests/built-bin.e2e.ts` 在 built bin 不存在时自行跳过 | 必须先断言 `apps/cli/lib/bin.js` 存在，再检查必选用例确实执行。 |
| 无密钥 headless 测试 | 实际检查生产 shell 工具、输出标记和压缩 Session 记录 | 可验证组装、执行与落盘；模型响应和 usage 来自测试夹具。 |
| 真实代理包装 | 已读取 `D:\Temp_projects\dsh861-node-governance\src\ops\real_agents.py` | 使用现有参数接口；该包装是本轮治理工作新建的临时包装。 |

六份既有未跟踪文件为：

- `NODE_DEVELOPMENT_RULES.md`
- `MULTI_AGENT_REQUIREMENTS.md`
- `MULTI_AGENT_DEVELOPMENT_ROADMAP.md`
- `MULTI_AGENT_REQUIREMENTS_SUPPLEMENT.md`
- `MULTI_AGENT_WORKFLOW_RESEARCH.md`
- `GBRAIN_MEMORY_ASSESSMENT.md`

用户提供的 Codex 最小探针成功、OpenCode 版本及模型发现结果属于前置输入。本轮没有再次调用这些代理。**OpenCode 最小探针仍须由 ZCode 核对最终回执，不能将“正在核实”改写为已成功。**

## 2. REQ、AC 与节点验收的对应

本节点采用独立的 `P0A-01` 至 `P0A-09` 验收编号，避免把基础验证与产品验收混用。

| 需求或验收 | P0-A 提供的证据 | 本节点不完成的部分 |
|---|---|---|
| REQ-001；路线 P0-A | 当前 dsh 源码的安装、构建和启动基线 | 软件开发公司平台本身。 |
| REQ-022 | 当前 Windows 执行节点的工具链、构建和 shell 启动事实 | Linux 服务部署、macOS/iOS、容量及性能目标；AC-13、AC-14、AC-15、AC-32。 |
| REQ-010；AC-05、AC-23 | 既有修改保护、任务临时目录及自有资源清单，属于先行操作验证 | 产品中的多成员并发隔离、冲突处理和取消子树。 |
| REQ-017；AC-03、AC-31 | 开发命令、工具版本、候选、测试及审核证据，属于先行记录验证 | 控制台中的真实配置观测与审计功能。 |
| REQ-012、REQ-014；AC-09、AC-20 | 本次开发沿用已有授权；真实独立硬审绑定候选 | 产品里的批准记录、授权失效和审核状态管理。 |
| REQ-002、REQ-003、REQ-004；AC-01 至 AC-04 | 核对现有适配器的源码、包来源和证据限制 | 四种 harness 的真实接入与隔离验收，留在 P0 的后续验证范围。 |
| REQ-015；AC-10 | 核对 MCP client、skill registry 的现有职责与复用可能 | 向四种 harness 集中提供并实际执行岗位权限。 |
| REQ-007、REQ-016；AC-16 至 AC-18 | 引用已读 GBrain 评估及需求的数据归属要求 | PostgreSQL/GBrain 服务、账号隔离、跨 harness 记忆和拒绝路径。 |
| REQ-006、REQ-013、REQ-018、REQ-020 | 记录现有 workflow、Agent Teams 与 Session 的职责限制 | 可编辑持久流程、恢复、外部副作用去重和平滑升级。 |

**P0-A 完成时，产品 AC-01 至 AC-32 的完成状态不因本节点自动改变。** 后续阶段必须使用自己的真实产品证据完成适用 AC。

## 3. 文件、产物和责任边界

### 3.1 本节点拟新增文件

正式产物遵循[节点规则](../../../NODE_DEVELOPMENT_RULES.md)，放在 `development/nodes/P0-A/`。

| 文件 | 性质与职责 | 责任者 |
|---|---|---|
| `development/nodes/P0-A/plan.v1.md` | 拟新增；保存本次 Codex 最终计划原文，记录其原始文件哈希。不得由实施者改写。 | ZCode 整合者 |
| `development/nodes/P0-A/baseline.md` | 拟新增；中文基线操作记录，包含环境、复现命令、限定复用清单、证据位置和未完成范围。结果通过验证记录引用，不维护第二套相互矛盾的状态。 | 基线文档任务 |
| `development/nodes/P0-A/state.json` | 拟新增；当前节点状态、计划版本、候选编号、有效审核回执引用及阻塞原因。 | ZCode 整合者 |
| `development/nodes/P0-A/evidence/preflight.json` | 拟新增；起点、既有文件哈希、工具路径和版本、目录归属、前置探针引用。 | ZCode 整合者 |
| `development/nodes/P0-A/evidence/planning-invocation.json` | 拟新增；本次 Codex 调用回执及版本、程序哈希等补充证据的索引。 | ZCode 整合者 |
| `development/nodes/P0-A/verification.r01.json` | 拟新增；首轮逐命令结果、测试选择、预期退出码、跳过项、原始输出位置与哈希。后续轮次新增文件。 | 验证任务，整合者封存 |
| `development/nodes/P0-A/candidate.r01.json` | 拟新增；固定候选文件清单、内容哈希、基线、工具链与验证证据引用。 | ZCode 整合者 |
| `development/nodes/P0-A/candidate.r01.sha256` | 拟新增；候选清单文件本身的 SHA-256，避免清单自引用。 | ZCode 整合者 |
| `development/nodes/P0-A/reviews/r01.md` | 拟新增；原样保存或可追溯提取的 OpenCode 可读审核结论。 | ZCode 整合者 |
| `development/nodes/P0-A/reviews/r01.json` | 拟新增；结构化审核结果及调用证据索引，保留原始输出哈希。 | ZCode 整合者 |
| `.agents/notes/implemented/process/2026-09-08-fixed-node-candidate-review.md` | 拟新增；记录固定候选、真实代理分工和证据约束的流程决定及代价。 | 决策文档任务 |
| 同名 `.zh.md`、`.i18n.yaml` | 拟新增；Agent Note 中文 counterpart 和配对记录。 | 同一决策文档任务 |

`r02`、`r03` 等是发生返工后的新轮次，不预先创建空成功记录。

### 3.2 既有文件的处理

- 原样保留六份需求、调研和节点规则文件，纳入候选清单。
- 保留 `AGENTS.md` 已有节点入口。
- 如果 `verify-doc-budgets` 证明新增节点入口造成超限，可仅压缩该新增段落，保留真实分工、固定模型、修复复审和链接义务。不得删除其他既有规则。
- 不为通过检查修改 `package.json`、`pnpm-lock.yaml`、`pnpm-workspace.yaml`、根 tsconfig、Vitest 配置、CI 配置或检查脚本。
- 不修改产品包、测试夹具、已发布 Session 数据或 `vendor/`。

需要超出这些文件边界时，进入当前节点计划修订。

### 3.3 临时目录与资源所有权

本节点临时根目录采用：

```text
D:\Temp_projects\dsh861-p0-a-baseline\
  toolchain\bin\
  corepack\
  pnpm-store\
  npm-cache\
  node-gyp\
  r01\
    tmp\
    dsh-home\
    agents-home\
    logs\
    review\
    preservation\
```

既有治理包装继续位于：

```text
D:\Temp_projects\dsh861-node-governance\src\ops\real_agents.py
```

目录已存在时先核对归属。不得覆盖其他任务的文件；每次重试使用新的日志文件或轮次目录。

仓库规定位置的 `node_modules`、`lib/`、Web 构建输出和 `.dsh-build/` 是依赖与构建产物，按真实脚本生成。临时脚本、运行 home、试验项目、缓存和原始日志放在上述临时目录。

## 4. 可独立验收的实施任务

以下命令默认在 **PowerShell 7** 中执行。每个外部命令独立记录退出码、开始结束时间和输出；不要整段执行后只检查最后一个命令。

### 任务 A：保护起点并完成运行前检查

**输入：** 当前工作区、已有治理回执、本计划。\
**输出：** `preflight.json`、既有内容保护副本、工具信息、节点初始状态。\
**验收：** `P0A-01`、`P0A-02`。

1. 设置本轮目录变量：

```powershell
$P0ARepo = 'D:\Projects\dsh861'
$P0ATemp = 'D:\Temp_projects\dsh861-p0-a-baseline'
$P0ARun = Join-Path $P0ATemp 'r01'
Set-Location -LiteralPath $P0ARepo
```

2. 核对起点：

```powershell
git rev-parse --show-toplevel
git branch --show-current
git rev-parse HEAD
git status --short --branch --untracked-files=all
git diff --stat
git diff --cached --stat
Get-FileHash -LiteralPath pnpm-lock.yaml -Algorithm SHA256
```

预期分支、HEAD、锁文件哈希与第 1 节一致。出现新内容时先识别并保护；不能用 reset、clean、checkout 覆盖它。

3. 将当前 `AGENTS.md`、六份既有文档及当前 tracked diff 保存到本轮 `preservation/`，记录原始路径、字节数和 SHA-256。检查 index 状态，后续不擅自暂存文件。

4. 核对工具与无密钥条件：

```powershell
node --version
git --version
& 'D:\Program Files\nodejs\corepack.cmd' --version
& 'D:\Program Files\PowerShell\7\pwsh.exe' -NoProfile -Command '$PSVersionTable.PSVersion.ToString()'
& 'C:\Python312\python.exe' --version
Test-Path -LiteralPath node_modules
Test-Path -LiteralPath .env
Get-Volume -DriveLetter D | Select-Object DriveLetter,FileSystem,SizeRemaining
```

`.env` 只检查存在性。若实施前出现该文件，不读取、移动或删除它。由于 `vitest.e2e.config.ts` 会尝试加载根 `.env`，必须先解决无密钥验证环境问题；必要时由 Codex 修订为内容一致且排除私有环境文件的隔离验证副本，不能在未知凭据环境中直接启动本节点测试。

5. 保存本次 Codex 原始计划及调用回执。核对已有 OpenCode 最小探针：

- 程序、模型和 variant 与节点规则一致。
- 有真实退出码和有效输出。
- 如果当前探针尚未结束，保持“待核实”。
- 没有合格回执时，ZCode 通过既有包装完成探针；不得换模型或用内置代理替代。

6. 记录当前基线是指定的本地提交。未查询远端时不得声称“已是最新上游”。

### 任务 B：提供局部 pnpm 并安装冻结依赖

**输入：** 任务 A 的固定起点和磁盘类型。\
**输出：** pnpm 11.7.0、依赖安装日志、安装警告分类、Git 集成记录。\
**验收：** `P0A-03`。

1. 在专门用于构建验证的 PowerShell 子进程中设置局部环境。不得把这些设置写入用户或机器级环境：

```powershell
$env:COREPACK_HOME = Join-Path $P0ATemp 'corepack'
$env:COREPACK_ENABLE_DOWNLOAD_PROMPT = '0'
$env:TEMP = Join-Path $P0ARun 'tmp'
$env:TMP = $env:TEMP
$env:TMPDIR = $env:TEMP
$env:npm_config_cache = Join-Path $P0ATemp 'npm-cache'
$env:npm_config_devdir = Join-Path $P0ATemp 'node-gyp'
$env:DSH_HOME = Join-Path $P0ARun 'dsh-home'
$env:DSH_AGENTS_HOME = Join-Path $P0ARun 'agents-home'
$env:DSH_TELEMETRY_DISABLED = '1'
```

先创建这些自有目录。构建验证子进程不继承真实密钥、认证 token、外部模型路由覆盖或不明 `DSH_CLIENT_*` 值；只记录被移除的变量名，不打印值。该环境与真实 OpenCode 审核环境分开。

不得设置 `CI=true` 来改变本地安装行为，也不得启用已有 hooks 覆盖开关绕过安装保护。

2. 在临时目录生成 pnpm shim：

```powershell
& 'D:\Program Files\nodejs\corepack.cmd' enable --install-directory "$P0ATemp\toolchain\bin" pnpm
$env:PATH = "$P0ATemp\toolchain\bin;$env:PATH"
& "$P0ATemp\toolchain\bin\pnpm.cmd" --version
Get-Command pnpm.cmd | Select-Object Name,Source
```

预期版本精确为 `11.7.0`，命令入口位于本节点临时目录。后文用 `pnpm.cmd` 显式调用该入口；仓库内部脚本保持原样。

Corepack 下载、签名或版本解析失败时保存原始错误。不能通过关闭完整性校验、换版本或写全局配置消除失败。

3. 根据任务 A 实测文件系统选择安装命令。

NTFS：

```powershell
pnpm.cmd install --frozen-lockfile --store-dir "$P0ATemp\pnpm-store"
```

ReFS：

```powershell
pnpm.cmd install --frozen-lockfile --store-dir "$P0ATemp\pnpm-store" --package-import-method=clone
```

该分支依据[Windows 安装记录](../../../.agents/notes/implemented/process/2026-08-30-windows-refs-store-block-clone-install.md)与现有 CI：ReFS 上的默认硬链接可能导致 native realpath 指向 store；NTFS 不能直接假定支持 clone。未知文件系统或 clone 原生模块缺失时保留诊断，不能把未经验证的替代方式写为既定成功路径。

4. 安装必须执行仓库声明的 lifecycle scripts。不得使用：

- `--ignore-scripts` 安装 workspace；
- 非冻结锁文件安装；
- `--force` 掩盖依赖问题；
- 修改 `allowBuilds`、补丁或版本范围绕过失败。

重点核对实际涉及的原生依赖：`fs-ext`、`koffi`、`node-pty`、`esbuild`，以及 `scripts/install-lefthook.mjs`。

5. 分类记录安装输出：

| 输出情况 | 处理 |
|---|---|
| 普通 deprecated、peer 或其他警告 | 保存完整输出，说明是否影响当前依赖闭包及后续验证。安装退出零不能证明产品已可运行。 |
| 仓库显式配置为不执行的 dependency script | 对照 `pnpm-workspace.yaml` 记录，不擅自放开。 |
| 必需原生绑定缺失、编译失败、未批准的必需脚本被阻止 | 本任务失败或阻塞。 |
| 缺 Python、MSVC、SDK、符号链接权限等宿主条件 | 保存具体失败命令和诊断；不得自动改注册表、系统策略或安装大范围系统工具链。 |
| hooks 安装拒绝既有配置或锁 | 按诊断确认归属；不覆盖用户配置、不删除未知锁。 |

6. 检查安装后的锁文件和 Git 集成：

```powershell
Get-FileHash -LiteralPath pnpm-lock.yaml -Algorithm SHA256
git diff -- package.json pnpm-lock.yaml pnpm-workspace.yaml
git config --show-origin --get core.hooksPath
git config --show-origin --get merge.dsh-translation-pairing.driver
```

预期锁文件不变，三个中央文件没有新差异；hooks 与 pairing merge driver 的实际配置来源符合安装器的工作树作用域。只查询这些明确字段，不输出完整 Git 配置。

### 任务 C：形成有源码依据的基线记录和 Agent Note

**输入：** 本计划、固定源码、任务 A/B 已取得的事实。\
**输出：** `baseline.md`、Agent Note 三件套。\
**验收：** `P0A-06`、`P0A-07`。

`baseline.md` 必须包含环境前提、复现步骤、成功判据、失败处理、验证记录引用和下表范围内的复用清单。未执行的命令写成待执行步骤，不写成已通过。

限定检查以下位置，不进行全仓穷尽扫描：

| 主题 | 已核实入口和测试位置 | 需要记录的结论 |
|---|---|---|
| 构建与包管理调用 | `scripts/build.ts`、`scripts/pnpm-invocation.ts`、`scripts/pnpm-invocation.spec.ts` | 完整构建由公开脚本负责；子命令依赖 pnpm lifecycle 中的 `npm_execpath`。 |
| Profile 组装 | `packages/boot/app-boot/src/profile.ts`、`tests/profile.spec.ts`；`apps/cli/src/bin.ts` | profiles、bundles 和 patch 的现有复用入口；测试入口与正式入口分别说明。 |
| Codex | `packages/subagent/subagent-codex/package.json`、`src/index.ts`、`src/run.ts`、`tests/real-product.spec.ts` | 当前包是带 bundle 声明的一次性 provider，依赖 `@openai/codex@0.149.1`，通过 package-local app-server 启动。不得沿用“只是任意 PATH CLI 调用”的描述。 |
| Claude Code | `packages/subagent/subagent-claude-code/package.json`、`src/index.ts`、`src/run.ts`、`tests/real-product.spec.ts` | 当前包依赖官方 Agent SDK `0.3.241`，提供一次性执行；不在本节点运行产品探针。 |
| ACP | `packages/subagent/subagent-acp/src/index.ts`、`src/run.ts`、`tests/loader-composition.e2e.ts` | 这是 ACP subprocess provider；它的存在不能证明 OpenCode、Grok 或 A2A 已接入。 |
| Workflow | `packages/workflow/workflow/src/index.ts`、`tests/workflow.spec.ts`、README | 该包声明抽象服务、运行类型和事件，不能仅凭服务存在认定有 PostgreSQL 检查点和流程恢复。 |
| Agent Teams | `packages/experimental/agent-team/package.json`、`src/index.ts`、`src/journal.ts`、`tests/persistence.spec.ts`、README | private 实验包；Lead Session 日志、单进程和共享 cwd 的约束仍存在；write scopes 是提示。 |
| MCP、Skills | `packages/mcp/mcp-client/src/index.ts`、`tests/mcp-client.spec.ts`；`packages/skill/skill/src/index.ts`、`tests/skill.spec.ts` | MCP client 负责连接外部服务并注册工具；skill 包是 provider registry。不能据此认定已实现对四种 harness 的统一能力服务。 |
| Session 与 Windows shell | `packages/session/session-persistence-jsonl/package.json`、`src/lease.ts`、`src/win32.ts`；`apps/cli/tests/windows-shell.spec.ts` | 原有 Session 持久化保持其职责；Windows 组装选择 pwsh。无密钥 smoke 提供限定运行证据。 |
| PostgreSQL/GBrain | 根需求、`GBRAIN_MEMORY_ASSESSMENT.md` | 记录已选方案与未验证事项；不安装服务，不据有限扫描宣称全仓绝无相关代码。 |

清单每项至少有：需求引用、源码位置、相关测试位置、证据级别、可复用内容、需要新增或调整的内容、尚缺运行条件。

允许的证据级别为：

- 源码或配置已核实；
- 本节点命令已验证；
- 可复用但需要适配与验证；
- 需求需要新增实现；
- 验证条件缺失。

“已满足”只能用于本节点确实验证过的具体性质。

Agent Note 按 `dsh-archive-agent-notes` 做同主题 active note 检查，保留已有独立有效的决定，不为凑数量归档或删除记录。新 note 使用 `implemented/process` 格式：

```text
# Agent Note: …
Status: implemented
## Problem
## Decision
## Alternatives considered
## Consequences
```

它记录已采用的开发流程，不预先宣称节点审核通过。理由限于真实产品调用、固定候选、未跟踪文件覆盖及先行验证的证据限制；完整操作步骤留在节点计划和基线记录。

### 任务 D：执行基础检查和文档门禁

**依赖：** 任务 B 完成；任务 C 的候选文字冻结。\
**输出：** 逐命令结果及完整日志。\
**验收：** `P0A-04`、`P0A-07`。

按以下顺序执行：

```powershell
pnpm.cmd exec vitest run scripts/pnpm-invocation.spec.ts apps/cli/tests/windows-shell.spec.ts
pnpm.cmd run typecheck
```

预期两个指定测试文件确实执行并通过；类型检查完成公开脚本中的 Host 准备与 Client 检查。

完成 Agent Note 双语内容后，执行一次明确命名的配对记录：

```powershell
pnpm.cmd run verify-translation-pairing --write .agents/notes/implemented/process/2026-09-08-fixed-node-candidate-review.md
```

然后执行：

```powershell
pnpm.cmd run test:docs
pnpm.cmd run doc-sync
pnpm.cmd run lint
git diff --check
git diff --cached --check
```

所有命令必须实际成功。`doc-sync` 包含文档站构建、类型与目录生成物检查等，本节点不再另跑同义的 `website:build`。

文档要求：

- Agent Note 两种语言及 sidecar 一起维护，结构、链接、代码块和物理行数对齐。
- 每个自然语言段落一条物理行；文字文件恰好一个结尾换行。
- 只运行日常配对工作，不调用 `dsh-translate-docs`。
- 不手改生成目录或生成英文 catalog。
- 不降低预算、扩大豁免或缩窄检查范围掩盖失败。

当前 bilingual 自动发现范围不包含普通 `development/nodes/` 文档；本计划和 `baseline.md` 可保持中文。不要把 `doc-sync` 成功解释为这些文件已经被所有 Markdown 检查覆盖。ZCode 还须逐一核对节点文档的相对链接、段落换行及文件结尾，并将新增未跟踪文件纳入检查记录。

若门禁失败涉及本计划允许的新增文档或新增 `AGENTS.md` 段落，可直接修复并重跑受影响检查。需要修改其他现有文档、生成器、配置或源码时，提交失败位置与最小修复建议给 Codex 修订计划。

### 任务 E：完整构建与限定真实启动验收

**依赖：** 任务 D 全部通过。\
**输出：** 完整构建记录、hygiene 结果、源码与 built 入口验证、headless smoke 结果。\
**验收：** `P0A-05`。

1. 执行最终完整构建：

```powershell
pnpm.cmd run build
```

预期 Host、Client、Web 各阶段全部成功，并生成完整构建记录。检查必需产物：

```powershell
if (-not (Test-Path -LiteralPath apps/cli/lib/bin.js -PathType Leaf)) {
  throw 'P0-A: apps/cli/lib/bin.js is missing'
}
if (-not (Test-Path -LiteralPath .dsh-build/client-build-environment.json -PathType Leaf)) {
  throw 'P0-A: complete client build record is missing'
}
Get-FileHash -LiteralPath apps/cli/lib/bin.js,.dsh-build/client-build-environment.json -Algorithm SHA256
```

不能将失败后残留文件视为成功产物，也不能用 `build:lib:host` 代替完整构建。

2. 检查构建产物与 workspace：

```powershell
pnpm.cmd run hygiene
```

预期公开聚合命令全部成功，包括 package exports、built invariants、NodeNext consumer、依赖与入口约束。该命令失败时不能只挑选其中通过的叶子并宣称 hygiene 通过。

3. 验证源码入口及构建版本：

```powershell
pnpm.cmd dsh --help
node .\apps\cli\lib\bin.js --version
```

源码入口应显示 `dsh` 的受支持用法；构建版本应与 `apps/cli/package.json` 一致。

4. 使用 built 模式运行五个明确选择的正式入口用例：

```powershell
$env:DSH_EXAMPLE_MODE = 'lib'
$P0ABinCases = 'requires --profile and rejects removed commands|routes help and usage errors without activating startup-dependent rows|runs the headless profile through its app-owned task positional|fails loud on a nonexistent profile with the plugin-command hint|reports a patch-overlay boot failure without hanging'
pnpm.cmd exec vitest run --config vitest.e2e.config.ts apps/cli/tests/built-bin.e2e.ts -t $P0ABinCases
```

验收含义：

| 必选用例 | 预期事实 |
|---|---|
| 必须提供 profile，拒绝已移除命令 | 正确帮助返回零；无 profile 和移除入口返回预期非零。 |
| 帮助与用法错误 | profile 帮助成功；缺 headless task 等错误按现有断言拒绝。 |
| 正式 headless 位置参数 | 真实 built CLI 接收完整任务，经本地 mock HTTP 服务完成响应，且服务实际收到请求。 |
| 不存在的 profile | 返回非零，并提供现有诊断。 |
| 无效 patch 启动 | 返回预期错误，不挂起。 |

必须核对五个必选用例全部执行且通过。`-t` 未选中的用例属于预先声明的不在本节点测试范围；**五个必选用例中的 skip、todo、零匹配或 suite 因缺产物而跳过均不通过。**

5. 执行真实 Loader、生产 shell 工具及落盘 smoke：

```powershell
pnpm.cmd exec vitest run --config vitest.e2e.config.ts apps/cli/tests/profiles/headless/tests/keyless-smoke.e2e.ts
```

该文件的一个用例必须实际执行，并按现有断言证明：

- Windows 使用 `pwsh` 工具路径；
- 工具结果和最终输出包含 `CLI_TOOL_ROUND_TRIP`；
- 产生可解析的压缩 Session 文件及 session header；
- 持久化 request header 包含既有工具目录；
- 子进程正常结束，stderr 符合现有断言。

这里的 Loader driver 是仓库既有测试入口，用来取得内部事件和持久化证据。正式 public CLI 的证明由前面的 built-bin 用例承担。两者不能互相替代。

6. 完成后核对自有进程和临时资源：

- 等待本轮命令、测试及其自有子进程退出。
- 本地 mock server 应由既有测试关闭；不得留下持续监听。
- 仅检查和处理本轮拥有的 PID、句柄和目录。
- 不按 `node`、`pwsh`、`codex` 等进程名称批量终止进程。
- 测试自动清理了原始 Session 时，在证据中明确：保留的是测试执行日志和源码断言，未另外保存运行时 Session 文件；不得补造一份 Session 当作原始产物。

**Windows 失败处理：** 先保存实际错误，区分工具链缺失、文件系统、权限、原生绑定、脚本调用或产品缺陷。不得换为 bash、关闭 sandbox、设置更宽权限模式、扩大 timeout 或删除断言来使测试变绿。确需修改执行方案或代码时，修订当前节点计划。其他操作系统上的成功结果不能替代本节点的 Windows 验收。

## 5. 并行任务及整合顺序

| 任务 | 可写文件或目录 | 前置依赖 | 可并行关系 |
|---|---|---|---|
| 环境、依赖与执行负责人 | 本节点临时工具链、缓存、日志；仓库依赖与正常构建输出 | 任务 A | 安装期间可与两项文档准备并行。 |
| 基线文档任务 | 仅 `development/nodes/P0-A/baseline.md` | 固定源码和本计划 | 可独立核查限定源码；运行结论等待执行负责人提供证据。 |
| 决策文档任务 | 仅新 Agent Note 三件套 | 节点规则、本计划、同主题检查 | 与基线文档任务文件不重叠；同一执行者完成双语内容。 |
| ZCode 整合者 | 原始计划、证据 JSON、候选、状态及审核记录；允许范围内的 `AGENTS.md` 新增段落 | 各任务产物 | 负责最终组合，不允许多个任务共同维护中央文件。 |

中央锁文件、根配置、Git 工作树集成和最终构建输出由 **ZCode 整合者单一负责**；其他任务只能报告问题。

`typecheck`、`lint`、`doc-sync`、完整 `build` 会生成或改写共享产物，不在同一工作区并行启动。`run-gates.ts` 内部已有的调度保持原样。

所有实施任务结束、候选封存后再启动最终硬审。审核期间停止候选写入。并行任务的自检不能替代 OpenCode 硬审。

## 6. 验证记录、候选封存与硬审核

### 6.1 执行记录的最低字段

每条实际命令记录：

- 节点、轮次、所属任务和验收编号；
- 可执行程序绝对路径、参数数组、工作目录；
- 工具版本及必要的非敏感环境覆盖；
- 开始和结束时间；
- `exitCode`、`signal`、`timedOut`，分别记录；
- stdout、stderr 原始位置与 SHA-256；
- 预期结果、实际结果；
- 测试文件、必选用例、skip 和 retry 情况；
- 结果状态：`PASS`、`FAIL`、`BLOCKED`、`NOT_RUN` 或 `OUT_OF_SCOPE`。

负向测试中的应用退出码非零是预期行为，外层测试应通过；不能只按子进程非零机械判失败。超时后退出零也不能判成功。

安装警告、Vitest 自动重试以及聚合命令未启动的叶子都须保留。重试后成功不删除第一次失败；出现不稳定结果时先解释并解决，不能靠重复执行挑选绿色日志。

### 6.2 固定候选

封存前：

```powershell
git rev-parse HEAD
git status --short --branch --untracked-files=all
git diff --check
git diff --cached --check
Get-FileHash -LiteralPath pnpm-lock.yaml -Algorithm SHA256
```

候选至少包含：

1. 固定基线 HEAD。
2. 当前 tracked diff。
3. 六份既有未跟踪文档。
4. 本轮新增计划、基线记录和 Agent Note。
5. 工具链、验证记录和完整构建记录的引用及哈希。
6. 所有新增、修改或删除文件的明确清单，包含未跟踪文件。

每个文件记录规范化相对路径、类型、字节数和 SHA-256。删除必须显式列出；本计划没有预定源码或既有文档删除。

`candidate.r01.json` 不包含自身哈希；其字节哈希写入 `candidate.r01.sha256`，并作为审核输入中的候选标识。

`state.json` 和本轮审核回执属于绑定候选的后续记录，单独登记，不形成清单自引用。它们只能记录状态与审核事实，不能改变已封存的范围、实现、依赖或测试证据。其他候选内容变化必须产生新轮次。

### 6.3 硬审核输入

审核提示词至少引用：

- `plan.v1.md`；
- 主需求、补充追踪、路线和节点规则；
- `baseline.md`；
- `preflight.json`、`verification.r01.json`；
- `candidate.r01.json` 及其预期 SHA-256；
- Agent Note 三件套；
- 原始测试输出位置；
- 前轮问题及修复证据，首轮写明无前轮。

审核必须读取实际文件，不能只评审 ZCode 的总结。

已核实的包装将 OpenCode 作为独立 subprocess 启动，使用：

```text
run --pure --model zhipuai-coding-plan/glm-5.3 --variant max --agent plan --format json
```

并在调用级设置中禁止 edit、bash、webfetch、websearch。该审核环境用于只读审查；需要重新执行检查时，由 ZCode 在独立验证轮次执行，再重新封存。

包装没有自行记录所有程序版本和文件哈希。因此 ZCode 必须另外保存 Codex、OpenCode 的真实版本输出、程序绝对路径和 SHA-256，不能凭包装中的模型字段补写缺失证据。

### 6.4 实际审核调用

提示词保存到：

```text
D:\Temp_projects\dsh861-p0-a-baseline\r01\review\prompt.txt
```

提示词以明确路径和审核要求为主，不把整份计划及全部日志拼成超长 Windows 命令行参数。

在治理包装目录执行：

```powershell
Set-Location -LiteralPath 'D:\Temp_projects\dsh861-node-governance'
& 'C:\Python312\python.exe' -m src.ops.real_agents opencode --cwd 'D:\Projects\dsh861' --prompt-file 'D:\Temp_projects\dsh861-p0-a-baseline\r01\review\prompt.txt' --output-dir 'D:\Temp_projects\dsh861-p0-a-baseline\r01\review' --label 'p0-a-r01'
```

使用新的 label 保存每轮回执，不覆盖旧轮次。

要求 OpenCode 返回：

- 节点 ID、计划版本、候选标识；
- 调用模型及 variant 的证据引用，区分传参与可观测运行事实；
- `PASS | FAIL | BLOCKED`；
- `P0A-01` 至 `P0A-09` 逐项判定；
- 问题、严重度、文件位置、证据和修复要求；
- 未完成的产品级 AC 范围；
- 明确的最终结论。

CLI 退出零、只输出“完成”或没有绑定候选的认可都不算通过。结构化 JSON 可以由 ZCode从原始结果机械提取，但不能替审核者补充判定；无法无歧义提取时重新取得明确审核结果。

## 7. 验收表、停止条件与回退

### 7.1 节点验收表

| 编号 | 必需结果 | 通过证据 |
|---|---|---|
| P0A-01 | 指定分支、HEAD、锁文件与计划对应 | Git 输出、锁文件哈希、`preflight.json`。 |
| P0A-02 | 既有工作受到保护，临时资源归属明确 | 安装前后文件清单与哈希；允许修改的新增段落单独说明；无提交、推送、发布。 |
| P0A-03 | 局部 pnpm 11.7.0 冻结安装成功 | 精确版本、局部程序路径、完整安装日志、原生依赖情况、Git 集成记录，锁文件不变。 |
| P0A-04 | 两个限定单元测试文件和公开 typecheck 成功 | 真实执行日志，无必需测试跳过。 |
| P0A-05 | 完整 build、hygiene、源码帮助、built 入口五项测试和 Loader smoke 成功 | 最终构建记录、产物哈希、五个必选用例与一个 smoke 的实际通过结果。 |
| P0A-06 | 基线可复现，复用结论有准确源码依据 | `baseline.md`，每项结论的证据级别和缺口；没有把服务声明或 mock 当作完整产品能力。 |
| P0A-07 | 文档、双语、Agent Note 和全部规定门禁完成 | 配对记录、`test:docs`、`doc-sync`、`lint`、差异检查及节点文档专项核对。 |
| P0A-08 | 候选和证据完整且固定 | 包含未跟踪文件的清单、候选哈希、日志哈希；无候选外的隐藏实现变更。 |
| P0A-09 | 指定真实 OpenCode 对当前候选明确 `PASS` | 程序身份、版本、模型/variant 参数、原始回执、逐项审核和候选绑定。 |

只有九项全部通过才能将 `state.json` 更新为“审核通过”。

### 7.2 停止和修订条件

以下情况保持当前节点失败或阻塞，不进入下一节点：

- 分支、基线、锁文件或既有工作出现无法解释的变化。
- 依赖安装失败，或者必需原生依赖、hooks、工具链未完成。
- 必需测试、构建、hygiene、文档或 lint 检查失败、跳过或未运行。
- 需要改产品源码、现有测试语义、根配置、依赖版本或未列入范围的文档。
- Windows 当前环境不能满足选定的真实入口。
- 需要修改系统策略、全局配置、凭据或引入未授权服务。
- 指定模型、max、程序身份或审核输出不能核实。
- 候选在审核中变化，或审核结论对应旧候选。
- OpenCode 返回 `FAIL` 或 `BLOCKED`。

ZCode 可以直接修复本计划允许文件内的问题及局部环境配置问题。**扩大文件范围、改变验收语义或替换验证环境由真实 Codex 修订当前节点计划**，保存 `plan.v2.md` 及修订原因，不修改 v1 原文。

OpenCode 发现的问题逐项修复、补验、重新封存并复审。没有通过时不能用“后续建议”关闭本节点必需缺口。

### 7.3 回退范围

回退只覆盖本节点拥有的新增文件、当前轮引入的允许范围内修改，以及已确认自有的临时资源：

- 既有需求、调研文件和用户修改始终保留。
- 恢复文件前核对当前内容是否仍由本轮拥有；出现并发变化时停止覆盖。
- Git hooks 和工作树配置按实际变更字段处理，不整份恢复可能已变化的 Git 配置。
- 不使用 `git reset --hard`、`git clean -fdx` 或面向整个临时根目录的清理。
- 删除或移动 Windows 目录前核实绝对路径、归属和 junction/symlink；不能沿链接递归进入其他目录。
- 保留失败日志、计划版本和审核回执。可保留已记录的依赖与构建缓存供修复使用，不必为“回退”进行无必要的大规模删除。

## 8. 节点完成后的交付清单

P0-A 完成时，ZCode 交付：

1. 原样保存的 Codex 计划 v1，以及存在时的后续计划修订。
2. 固定源码、既有内容保护清单、精确工具链和冻结锁文件证据。
3. 可按记录重现的 pnpm 安装、公开检查、完整构建及最小启动步骤。
4. 所有必需命令的实际结果、原始输出位置、哈希及限制说明。
5. 有源码与测试位置依据的限定复用清单。
6. 通过检查的 Agent Note 英文、中文和配对记录。
7. 包含未跟踪文件的最终候选清单及候选哈希。
8. 指定真实 OpenCode 对该候选的明确 `PASS`、逐项验收结果和历轮问题闭环。
9. 节点状态说明：**P0-A 已通过；P0 其余能力验证及产品 AC 尚未由本节点完成。**
10. 无提交、无推送、无发布，以及本轮自有进程已结束的事实记录。
