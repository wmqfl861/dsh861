# B01：可信基线与 Windows 桌面预览——正式执行计划

**计划标识：`B01-20260919-01 / formal-plan v1`**
**日期：2026-09-19**
**形成方式：由指定规划者经真实 Codex CLI 调用形成。调用身份、参数、退出码及原始输出证据见同目录 `codex-invocation.md`；本计划不以模型自述证明调用身份。**
**输入计划包：HEAD `f5ab2fed621988c559b1c7299a60562bba558e96` 采纳版。**
**执行性质：B01 工程交付批次；不改变 P0-B 正式状态，不启动 P0-C。**

本计划确认 W01—W13 的总体目标，并固定实施选择、文件所有权、调度条件、验证入口和停止边界。执行者为 ZCode，总控是唯一整合者和 Git 写入者；阶段最终硬审核使用真实 OpenCode `zhipuai-coding-plan/glm-5.3 --variant max`。普通范围内的实施、直接测试辅助、返工和精确文件登记按既有授权推进；受保护面、验收含义或正式节点顺序发生变化时，按本计划的停止规则处理。

本次规划只执行了仓库读取、Git 对象与路径核对、工具路径发现及版本查询。没有修改文件、运行测试或构建、查询远端、发起网络请求或调用其他模型。所有实施期命令均是后续执行要求，不能作为本次已经通过的证据。

## 1. 固定输入与环境核对结论〔对应 d〕

### 1.1 源码与计划包身份

| 项目 | 本次核对结论 |
|---|---|
| 工作目录 | `C:\Albert\project\dsh861` |
| 分支 | `chore/latest-stable-upgrade-20260912` |
| 当前 HEAD | `f5ab2fed621988c559b1c7299a60562bba558e96` |
| 当前 tree | `69d777c0fae3d57cb82b1d5535e19e75e7123b9f` |
| HEAD parent / r48 源码基线 | `7f63d03538759306f8363d5a912c1e99fbe015bf` |
| 采纳提交内容 | 新增 15 份计划包文件及两份 B01 运行记录；没有改变 r48 产品源码 |
| 输入计划分支提交 | `c210773637b5e2f2a7205cb5589c4ff311b9efdc` |
| 计划包字节核对 | 已比较 15 个 Git blob；原 `README.md` 映射为 `00-README.md` 后全部相同 |
| 当前计划包目录 tree | `1eda53df7dbb865f5ebffffcdc14a584e13075b9` |
| prepare 脚本 blob | `7d2428e2fa84b7fda9aeec24fa1de661cb90cb46` |
| prepare spec blob | `91bcd7fa4833b8687ebf66e8a136a65fe0c78e66` |
| 正式节点 | `P0-B/state.json` 为 `blocked`、计划 `v3`、`next_node_allowed: false`，产品验收完成列表为空 |
| 本次运行状态 | W00 `running`；W01—W13 `planned`；B01-A1—A9 全部 `not_run` |

PR #13 的 draft 状态和 base `feat/multi-agent-company-nodes` 作为用户及运行记录提供的固定输入保留。本次没有远端查询，因此不声称重新核验了 GitHub 当前状态；总控在实际 Git 检查点按既有权限核对。

工作树核对结果与 `RUN_CONTEXT.json` 的分类相符：r48 `comment-draft.md` 是已登记修改项；三个 r44 原件和 r47s 材料仍是保留项。它们不属于 B01 待清理内容，也不得混入 B01 白名单提交。

### 1.2 工具与运行环境

| 项目 | 结论及执行要求 |
|---|---|
| 本机系统 | 实测 `win32 10.0.26200 x64` |
| 实施用 Node | 实测 `v26.8.2`；绝对入口 `C:\dsh-r24-upgrade-20260912-01\node-v26.8.2-win-x64\node.exe` |
| 实施用 pnpm | 实测 `12.4.1`；绝对入口 `C:\dsh-r24-upgrade-20260912-01\pnpm-12.4.1\pnpm.exe` |
| PATH | Node 与 pnpm 两个目录必须同时置于任务子进程 PATH 前部；不修改机器或用户全局 PATH |
| 系统 pnpm shim | 沿用 r45 已记录的损坏结论；本次未调用损坏 shim，也未尝试修复 |
| Bash | 已发现并查询 `C:\Program Files\Git\usr\bin\bash.exe`，报告 `GNU bash 5.3.15(1)-release (x86_64-pc-cygwin)`；同时存在其他 `bash.exe` 路径，测试不得依靠裸名称的偶然解析 |
| Vitest | `node_modules/vitest/vitest.mjs` 存在；本机正式验证采用指定 Node 直连该入口 |
| 单测归属 | prepare spec、headless identity spec、列出的 Desktop specs 均进入 `thread-safe`；该名称下实际使用 `forks` |
| expected / snapshot | 分别使用 `vitest.expected.config.ts`、`vitest.snapshot.config.ts`；不得用修改 include/exclude 解决发现或运行问题 |
| CI Node | 当前 PR workflow 配置为 `PRIMARY_NODE_VERSION: '26'`；`26.9.0` 是已记录 run 的实际版本，不是未来每次 run 的固定保证 |
| 已记录 Linux 环境 | Node 26.9.0、pnpm 12.4.1、Ubuntu 24.04.5、Python 3.12.3；本次仅复核仓库记录，未重新执行 |
| Desktop 打包运行时 | `prepare-runtime.ts` 固定下载 Node `24.17.0`；不得把它误报为本机 Node 26.8.2 |
| Desktop 包身份 | 当前 Desktop 与 Desktop Host package version 为 `0.1.5-rc.2`；实际产物还须核对 CLI 和 release metadata |
| 重型检查 | `typecheck`、`lint` 都先执行 Host 构建，不是纯轻量读取；必须纳入共享 build 锁 |
| 系统工具 | Python、Visual C++、NSIS、打包缓存及实际 Electron 可运行性尚未形成 B01 验收证据；W06/W07 逐项核对已有安装，不安装新系统工具 |

### 1.3 首失与源码事实

Linux 首失仍是 `dpkg-deb --field archive Package Version Architecture` 的多字段输出带字段名，脚本按裸值数组比较而退出。当前源码还使用 `mapfile < <(...)`，因此 W01 同时必须解决子命令退出状态的传播，不能只修改 mock 或剥掉字符串前缀。

Windows 27 项失败及部分空输出沿用 run `35436610274` 的已证记录。当前 spec 确实复制整个 `process.env`、写入 `env.PATH`、通过裸 `bash` 启动；这些是需要验证的风险点，尚不能证明 CI 中实际执行了宿主 `uname` 或证明所有空输出具有同一原因。

共享 SDK 自动入口的 `hydrateReplayFixtures()` 当前直接把 `cwd` 替换进 JSONL 文本；专用 teardown adapter 已使用 `JSON.stringify(cwd).slice(1, -1)`。这为 W05 提供了明确的源码定位。它与 expected diagnostic 的比较问题须分别验证，不能合并为一个未经验证的根因。

## 2. W01—W13 正式任务卡〔对应 a〕

以下任务的证据目录统一位于：

`C:\Albert\project\dsh861\development\delivery-runs\B01\B01-20260919-01\`

其中 `WNN/` 表示对应任务目录。目录尚未生成时记为计划产物，不填成功结果或虚构 hash。

### W01：修正真实 deb 控制字段协议

**前置与责任：** W00 正式计划保存、文件锁登记及 CP0 完成；基础设施实施者持有 `prepare-script`、`prepare-spec`。

**实施决定：** 采用逐字段读取 `Package`、`Version`、`Architecture` 的协议，每次命令调用都直接捕获 stdout 和真实退出状态。成功值分别精确匹配 `libcap-dev`、`1:2.66-5ubuntu2.4`、`amd64`。拒绝空值、缺字段、带标签或多记录的异常输出、错误身份，以及“stdout 看似正确但命令非零”的结果。不得继续依赖多字段输出顺序或通过 process substitution 丢失退出状态。

保留三个输入的版本、URL、SHA-256、解包审计、静态私有 libcap、平台条件、功能 probe 和最后发布 PATH 的顺序。原下载错误、编译错误及 probe 错误不得被统一吞成成功。

**验证与完成：**

- 保留原 36 项行为，新增字段协议和错误传播回归；mock 根据实际 argv 返回真实单字段/多字段语义。
- 覆盖无末尾 LF 的合法单值、带标签或换序的多字段输出、空值、错值、多余记录、非零退出。
- 两个独立负控：恢复旧多字段裸值假设；忽略字段读取的非零退出。必须由目标断言拒绝。
- Windows 无真实 dpkg 时，明确将真实 pinned deb 的控制字段读取留给 W03。
- 本地直接回归与 CP1 通过后交接 W02；A1 的真实 Linux 部分仍待 W03。

**失败与停止边界：** 若当前 Windows 启动问题使字段测试根本未到目标命令，不把测试归为字段修复通过；先保留首失和实际调用来源。需要改变输入 pin、no-apt、workflow、系统包或安全策略时停止该分支。产物为 `W01/report.md`、契约 fixture、原始日志、负控及恢复 hash、CP1 记录。

### W02：证明 Windows 替身来源并修复启动环境

**前置与责任：** W01 固定输出及 CP1 通过，prepare spec 锁已正式移交。W01/W02 不同时写 spec 或其辅助。

**实施决定：** 在测试所属进程内使用确认过的 Bash 绝对路径，以不加载用户启动脚本的方式启动；构造必要变量白名单，显式处理 Windows 环境变量名称的大小写唯一性。Windows PATH 的分号语义与 Bash 内 POSIX PATH 的冒号语义分别处理，不按冒号拆分 Windows 磁盘路径。

每次场景执行保存 Bash 身份、`command -v uname`、替身 sentinel，以及被触发的外部命令身份。来源检查失败必须在可能调用真实 `curl`、`sudo` 或编译器之前拒绝。对故意缺少工具的场景，证明到达预期 preflight 拒绝，不能从宿主 PATH 找到替代工具而假绿。

**验证与完成：**

- Windows 原 36 项逐项实际执行，加上 W01 和 W02 新增用例；选中用例不能 skip，零发现不算完成。
- 覆盖同一输入对象中同时出现 `Path`/`PATH`、不同顺序、空格与非 ASCII 临时目录、替身缺失或不可执行。
- 保存 `spawnSync` 的 error、status、signal、stdout/stderr 字节数及替身调用记录，分别解释空输出。
- 恢复旧环境拼接的负控必须失败；移除来源保护不能允许宿主命令混入而通过。
- 保持原 30 秒预算，不能用扩大 timeout 作为根因修复。

**失败与停止边界：** 缺少可用既有 Bash、需要 WSL 或新系统工具、无法证明替身闭包时记为阻塞；不得修改生产脚本的 Linux 拒绝条件。CP1 和 CP-A 组合检查通过后，由总控形成待 CI 候选；跨平台证据仍为 `wait_ci`。产物为 `W02/report.md`、来源诊断、完整文件级结果及 CP-A 输入。

### W03：真实 Linux 构建与安全准备验收

**前置与责任：** W02 通过，CP-A 本地验证与候选准入审核完成，总控按既有权限发布明确候选。验证者只读 CI 证据，不占源码写入槽。

**执行要求：** 对新的原 CI run 记录 run/attempt、PR head/base、实际 checkout commit/tree、runner、工具版本及脚本 blob。若 CI checkout 是合并提交，须核对该 tree 中的任务文件，而不是仅比较 PR head 字符串。

两条原 Linux 准备路径分别核验：

1. 三个输入真实下载及固定 hash。
2. 真实 dpkg 单字段输出与退出状态。
3. Meson setup、compile 和链接命令。
4. 私有 libcap 路径、静态链接事实。
5. ELF 架构、NEEDED、ldd、精确 bwrap 版本、独立 binary hash。
6. 功能 probe 实际执行、失败不发布 PATH、成功后才发布。
7. 任务私有目录、重复运行及环境污染情况。

**安全证据限制：** 当前脚本使用 `-Dtests=false`，普通 `true` 功能 probe 不能替代上游安全回归。W03 要检查既有获准 Linux 通道能否执行固定 0.12.0 源码中与修复相关的有限上游测试及正反检查，限定在任务自有临时树。没有执行通道或缺现成工具时，明确记录安全分项 `NOT_RUN`；不得为此修改受保护 workflow、安装包或编写针对未知共享目录的漏洞 PoC。`sandbox.yml` 的独立入口始终记为 `NOT_CLOSED`。

**失败与停止边界：** 普通解析、构建和链接缺陷返派 W01，重新完成 W02 受影响组合检查后形成新候选。来源 hash 改变、需新系统包/内核权限/workflow 修改时停止并集中报告。两条准备通过与后续 coverage/expected/snapshot 是否通过分别报告。产物为 `W03/linux-evidence.md` 和逐 run/job 证据索引。

### W04：为两个共享 teardown 场景建立完整平台预期

**前置与责任：** W00 完成；快照实施者持有 `shared-sdk-snapshots`。本地分析可提前进行，Linux 验收依赖 W03。

**实施决定：** 采用**平台专属完整 tool-schema 预期**，保留现有平台 shell 选择。`packages/bundle/base/cordis.patch.yml` 在 Windows 启用 pwsh、其他适用平台启用 bash；本任务不改该生产配置，也不强制 Windows 使用 Linux shell。

仅为 `subagent-teardown`、`agent-team-teardown` 增加明确的 Windows 父/子 schema sidecar，并在 `sdk.snapshot.ts` 中建立精确的场景与平台选择。默认 sidecar、共享 `session/text-turn` 来源及所有 Session JSONL 保持冻结。选择必须发生在完整 header 比较之前；缺少应选 sidecar、未知映射或读取失败必须报错，不能回退到任意可用文件。比较保留工具名称、描述、全部参数、必填字段及变化序列。

新 sidecar 只能来自真实 keyless 场景捕获的请求 header，使用现有格式化能力处理；保存原始捕获和候选身份。不运行全仓 record/refresh，不从旧 bash schema 手工改名生成 pwsh schema。

**验证与完成：**

- 两个共享自动场景分别完成完整 Session 和 header 比较。
- 专用 `teardown.snapshot.ts` 的两个真实关闭用例继续通过。
- r46 的 queued/delivered 顺序、真实 delivery、取消和写锁接管断言保持。
- 修改一个真实 description、输入 schema 字段或删除应有 delivery 证据时，目标回归必须拒绝。
- Windows cwd 水合阻断时，冻结 W04 候选并交 W05；W05 完成后重新取得锁，补齐 W04 验证。不得把专用 adapter 成功当作自动场景成功。

**失败与停止边界：** 发现真实生产事件缺失、需要修改 provider/公共 normalizer/Session 代次时暂停对应修改。Linux 或 Windows 必需路径未运行，W04 不得 accepted。产物为 `W04/platform-contract.md`、捕获来源、完整比较和负控记录。

### W05：关闭 Windows cwd、expected 与 profile 启动问题

**前置与责任：** W04 已 accepted，或已给出有证据的阻塞结论并冻结交接；快照锁只能由 W04 或 W05 一方持有。

**实施决定：**

- 先处理已定位的 SDK 自动 adapter：JSONL 文本中的 cwd 水合采用正确 JSON 字符串转义，参考同仓专用 teardown adapter，输出只落到运行期临时 fixture。
- 对两个 headless expected 用例，分别追踪原始持久日志、所选父子 identity、cwd 上下文、token 水合和比较输入；只修测试调用或 fixture 使用方式，不另造宽松 normalizer。
- 正式本机入口使用指定 Node 直连 Vitest。r45 的 `pnpm exec` 等待问题另列原因与适用限制；直连成功不能写成原 pnpm-exec 路径已修复。
- 保留 identity helper 的严格父子选择和原 15 项行为，避免回到全文包含匹配或任意 `parentSession` 选择。

**验证与完成：** 两个 expected 用例、identity 文件、两个共享自动场景及专用 teardown 场景具有适用 Windows 证据。覆盖空格、Unicode、反斜杠路径和同一自有 home 的顺序重开；每次先等待真正退出与锁释放，再开始下一次。负控分别证明错误 JSON 转义、错误日志身份和未释放资源不能被容忍。

**失败与停止边界：** 必須修改 `packages/test-support/session-snapshot`、loader/profile 公共实现、持久化或 lease 才能继续时，给出精确最小扩围与首失，不自行修改。仍失败的必需 Windows 场景阻止相应 A4/A8 完成；无关任务继续。产物为 `W05/report.md`、逐问题因果记录和清理证明。

### W06：实际 Electron 窗口与隔离任务流程

**前置与责任：** W00 完成；Desktop 实施者持有 Desktop 源码、runtime、home、窗口与调试端口资源；构建由总控持 heavy-build 锁。

**执行要求：** 先运行既有五个目标 spec，再用 `dev:desktop` 或已构建的 `start:desktop` 确认真正 Electron 窗口。`start:desktop` 仍会重建 development project，不能把放在该目录中的手工 patch 当成稳定输入。

为 keyless 交互登记测试专用模型 fixture、profile patch 和启动辅助。辅助只组装任务所属测试 profile，并启动同一个 Electron main 和私有 Desktop Host；不创建另一套网页、Node 应用或传输。开发模式需在 project 准备完成之后、Host 启动之前装配测试配置；产物模式在自有 Desktop profile 内装配，不能改打包资源、用户 profile 或生产默认模型。临时 profile 及说明明确标注“B01 测试模式”。

**逐动作验收：**

1. 显示真实窗口和中文空态。
2. 打开本次创建的临时项目。
3. 发起固定 keyless 测试任务，看到流式及最终结果，并与真实 Session/事件对应。
4. 发起可保持运行的测试任务，执行取消，确认任务与自有子进程停止。
5. 关闭窗口，等待 Host 退出和句柄释放。
6. 重开同一测试 home，读取此前会话及结果。
7. 注入测试自有 backend 失败，显示真实失败而非 ready/成功状态。

保存实际进程身份、版本、home、窗口截图或可重复自动化、Session 关联及退出记录。现有 host-process 测试使用测试子进程，不能独自满足实际 Electron 验收。

**失败与停止边界：** 只在登记文件内修复已复现局部问题。需要改 IPC/transport、安全策略、核心生命周期、用户隔离策略或安装新工具时停止相应修改。GUI 操作能力不足时，列明已程序验证与待交互验证的动作，A5 保持未满足。产物为 `W06/journey.md`、真实截图/交互记录和启动说明。

### W07：产物模式 Windows 预览

**前置与责任：** W06 通过；Desktop 实施者继续持有 runtime，heavy-build 独占。

**实施决定：** 首选生成并验证未签名可运行目录；条件允许时生成 unsigned NSIS 安装包。可运行目录必须使用 `--unsigned --dir` 组合，普通 `package:win:x64:dir` 仍会进入签名要求。

使用本项目专有测试 app-id，不冒用生产应用标识；若没有已确认的测试 app-id，由总控登记一个测试用途标识，仅作为本次打包参数。保留现有 unsigned 路径的 `publish: never`、无自动更新配置和不生成 release completion record 的行为。

**验收与交付：**

- 核对本机已存在的 Python、Visual C++、Electron builder 与锁定依赖；禁止安装新系统工具。
- 记录源码候选、构建命令、依赖、Node 24.17.0/pnpm/dsh/release metadata 和文件清单。
- 从实际生成的目录启动，重放 W06 必需旅程；不得用开发服务器替代。
- 验证重复启动、退出和自有 junction 清理，保留 target 未被删除的证据。
- 目录用逐文件清单及 manifest hash 标识；安装包记录实际文件名、bytes、SHA-256。
- 分列“目录已运行”“安装包已构建”“安装未验证”“签名未做”“发布未做”。

**失败与停止边界：** 缺系统工具、需新增网络/产物权限、运行时缺资源或版本不一致时停止对应步骤，不退回全局 Node/pnpm。安装器没有有效安装授权不运行。只有 development 源码或未启动过的 exe 不满足 A6。产物为 `W07/preview.md`、产物 manifest、启动说明与限制。

### W08：修正双语事件表并建立内容级校验

**前置与责任：** W00 完成；文档实施者持有事件表文件锁。生成器由总控串行执行。

本次已核对的五处差异如下：

| 事件 | 中文现值 | 当前源码与英文值 |
|---|---:|---:|
| `agent-preset/selected` | 80 | 82 |
| `subagent/provider-added` | 142 | 144 |
| `subagent/provider-removed` | 148 | 150 |
| `subagent/start` | 159 | 161 |
| `subagent/end` | 168 | 170 |

英文表当前这五项正确，不需要人为制造英文修改。执行期仍须以固定候选重新核对所有机器字段：事件 key、mode、声明位置、dispatcher/consumer 集合。

`gen-doc-graphs.ts` 一次会写六份文档，没有单文件生成入口。在隔离生成目录运行原生成器，核对全部输出，再由总控只整合已登记事件表的必要差异；不能在共享工作树直接运行后顺手接受其他输出。

增加直接内容校验 spec，使中英文机器字段的差异由已存在的顶层单测入口执行检查。检查不能仅比较 pairing hash。只重录本次受影响 pairing。

**失败与停止边界：** 恢复一处旧行号或删去 listener 后，内容检查必须拒绝，即使 pairing 已重新记录。若其他生成输出发生非机械变化，停止整合这些文件并登记原因；不修改生成逻辑以忽略差异。产物为 `W08/fact-diff.md`、生成/语义/配对检查与负控记录。

### W09：AC-01—AC-32 产品证据盘点

**前置与责任：** W00 完成；产品分析者只读产品源码，只写独占执行产物。

每项记录实现位置、真实消费者、数据路径、测试、真实环境、产物身份、产品验收、未知或阻塞原因、后继阶段。状态只使用 `unassessed`、`reusable_code`、`partial_evidence`、`product_accepted`、`blocked`，32 行不得缺失。

保留四种 harness、数据库/GBrain、知识权限、设计美工、网站、Android、iOS、微信小程序及恢复/升级/性能要求。开发工具调用证据不算交付系统的受管 harness 产品验收。本任务不重复实施全部产品，也不从包目录存在推导完成。

**失败与停止边界：** 未读到实际消费者就保持未盘点；缺证据不能填 `product_accepted`。不写产品源码、不改正式节点状态。独立复核全部 `product_accepted` 项及关键阻塞归因。产物为 `W09/requirements-matrix.md`、`reuse-and-gaps.md`、`capability-summary.md`。

### W10：P0-B 准入缺件与后继输入

**前置与责任：** W09 accepted；产品分析者和总控。

对照 P0-B state、plan.v3、r02 修订请求及已有非秘密授权证据，将历史阻断、已解决的开发工具条件、仍缺的产品接入条件分别登记。每条包含责任者、准确输入、授权依据或缺口、验证方法及受阻任务。

本次 B01 规划调用不能反向更新 P0-B 产品状态，也不能证明旧 state 中各项条件已经解决。不重复 `auth list`、收费试问、密钥或全局配置探测。

**失败与停止边界：** 缺授权或证据时交集中准入清单，P0-B 保持原状态；不生成 P0-C 的详细实施计划。产物为 `W10/p0-b-readiness.md`。

### W11：最新 CI 与覆盖率归类

**前置与责任：** W03 accepted，或已有明确阻塞结论；验证者只读检查点结果。

按最新 run/attempt/checkout 重新分类准备失败、断言失败、未处理异常、coverage 阈值和被跳过步骤。下载证据先验证 bytes/digest、manifest、成员路径与截断，不把未下载内容写成已核验。

历史 67 文件只作为分类输入；最新短缺必须按本次实际执行和分区失败情况计算。已登记文件导致的新增缺陷返派原任务；其余历史缺陷形成统一台账，不降低 100% 阈值、不扩大 exclude、不追加无界修复。

**失败与停止边界：** 无法取得最新 CI 时记录精确缺件和待核对项，不重复推送相同候选获取一次绿。产物为 `W11/ci-matrix.md`、`failure-register.md`。

### W12：组合候选、用户旅程与证据收敛

**前置与责任：** W03—W11 均有完成或证据支持的阻塞/延期结论；总控唯一整合。

核对工作包起始 blob、交接 hash、实际整合字节和共享消费者；只重跑受整合影响或尚无可靠证据的检查。重放必需安全准备、expected/shared snapshot 和实际 Windows 产物旅程。保护面和旧 Session 代次逐项检查。

manifest 包含全部新增未跟踪候选文件；keep-local 不进入候选。自有进程、server、gate 和句柄全部有停止记录，不能只删除目录当作退出。

**失败与停止边界：** 共享输入变化、产物来自其他候选、清理未完成或必需证据缺失时返工或形成 `PARTIAL_WITH_BLOCKERS`。产物为 `W12/candidate-manifest.json`、`validation-index.json`、`artifact-index.md`、`open-items.md` 及 CP2 结论。

### W13：固定候选硬审与集中交付

**前置与责任：** W12 固定候选及结论；所有实施写入冻结。指定真实 OpenCode 审核，总控交付。

审核输入包括本计划、适用修订、全部候选文件、需求矩阵、CP0—CP2、首失及负控、实际命令与退出码、GUI/产物、CI 身份和所有未运行项。调用记录必须包含程序绝对路径/版本、真实 argv、model/variant、开始结束、退出码、提示词 hash 和输出位置。

**失败与停止边界：**

- `FAIL`：原实施者返工，形成新候选，补验并用同一指定工具复审。
- `BLOCKED`：保留缺件，不换模型、不降低思考等级、不以内部审核代替。
- 退出码 0 而无明确裁决不算 PASS。
- 缺少 B01 必需正确性或验收证据时不能给 B01 PASS。

总控按白名单、正常 hooks、同分支非强制快进完成获准提交/推送；hooks 改变候选字节则重新验证受影响部分。PR 维持 draft、base 不变，不合并。最终按 `REPORT_TEMPLATE.md` 交一份报告；不以无必要的回执提交触发重复 CI。产物为 `W13/` 下调用/审核记录及运行根目录的阶段报告。

## 3. FILE_OWNERSHIP 执行表〔对应 b〕

### 3.1 表的效力与锁规则

下表列出初始源码白名单和关键冻结输入。**文件路径均为完整绝对路径，blob 均指 HEAD `f5ab2fed…` 的 Git blob。** `NEW` 表示当前不存在、尚无 blob；不是已创建文件。

权限定义：

- `R`：只读。
- `W`：本任务计划修改。
- `W?`：只在本任务复现出必要局部缺陷后修改；修改前将原因和候选登记到任务记录。
- `N`：允许新增的明确路径；只有实际需要才创建。
- `R/F`：冻结输入，任何 B01 任务不得改写。
- `E/WNN`：产物目录 `C:\Albert\project\dsh861\development\delivery-runs\B01\B01-20260919-01\WNN\`。
- `C`：总控；`I`：基础设施实施者；`S`：快照实施者；`D`：Desktop 实施者；`T`：文档实施者；`P`：产品盘点者。这些是调度角色，不是声称已有代理在运行。

同一时刻同一文件只有一个写锁。W01→W02、W04→W05→必要的 W04 补验、W06→W07 均按冻结 manifest 交接。总控整合时取得原任务锁，不与原写者同时编辑。新增同职责局部测试可由总控在写入前追加完整路径、起始身份和锁；公共 API、保护面或验收变化须正式修订，不能借“追加文件”扩大范围。

### 3.2 基础设施

| 任务 | 完整路径 | 当前 blob | 权限 | 产物 | 锁持有者 |
|---|---|---|---|---|---|
| W01；W03 读 | `C:/Albert/project/dsh861/scripts/prepare-ci-bubblewrap.sh` | `7d2428e2fa84b7fda9aeec24fa1de661cb90cb46` | W；R | E/W01、E/W03 | I/W01 |
| W01→W02 | `C:/Albert/project/dsh861/scripts/prepare-ci-bubblewrap.spec.ts` | `91bcd7fa4833b8687ebf66e8a136a65fe0c78e66` | W | E/W01、E/W02 | I，串行移交 |
| W01→W02 | `C:/Albert/project/dsh861/scripts/prepare-ci-bubblewrap-test-support.ts` | NEW | N，仅直接启动/fixture 辅助 | E/W01、E/W02 | I，串行移交 |
| W01—W03、W12 | `C:/Albert/project/dsh861/scripts/ci-workflow.spec.ts` | `fcdcb6f85796f904621b5bad6a2ff01b70193285` | R/F | E/W03 | C 保护 |

### 3.3 SDK 共享入口、平台预期与冻结数据

| 任务 | 完整路径 | 当前 blob | 权限 | 产物 | 锁持有者 |
|---|---|---|---|---|---|
| W04→W05 | `C:/Albert/project/dsh861/snapshots/sdk/sdk.snapshot.ts` | `cd62c0e4b78140f8279cc2fdc743e77a92f90324` | W | E/W04、E/W05 | S，串行移交 |
| W04→W05 | `C:/Albert/project/dsh861/snapshots/sdk/teardown.snapshot.ts` | `a7584b0d0bab54533ba037ae895f69133fee791d` | W?；保留关闭断言 | E/W04、E/W05 | S，串行移交 |
| W04/W05 | `C:/Albert/project/dsh861/snapshots/sdk/subagent-teardown/snapshot.yml` | `0d14236cdd3679e66661011a06f2a691f7baa076` | R | E/W04 | C 保护 |
| W04/W05 | `C:/Albert/project/dsh861/snapshots/sdk/subagent-teardown/cordis.yml` | `087e75fbd9c3c1f6da60c6c11f6200051986de5f` | R | E/W04 | C 保护 |
| W04/W05 | `C:/Albert/project/dsh861/snapshots/sdk/subagent-teardown/cordis.snapshot.yml` | `017237f40280f8cdd70ea949b9b837e94ff06aa6` | R | E/W04 | C 保护 |
| W04/W05 | `C:/Albert/project/dsh861/snapshots/sdk/subagent-teardown/teardown-trigger.mjs` | `3e0e412487e9a10f81aa174407704cbca1b6f398` | R/F | E/W04 | C 保护 |
| W04/W05 | `C:/Albert/project/dsh861/snapshots/sdk/subagent-teardown/llm-replay-entry.mjs` | `1ce67f68d36b036690c9791966e622d3f20d8488` | R/F | E/W04 | C 保护 |
| W04/W05 | `C:/Albert/project/dsh861/snapshots/sdk/subagent-teardown/session.v3.jsonl` | `75d90991d7311ab7fa07aec7f76f6f76350e79d9` | R/F | E/W04、E/W05 | C 保护 |
| W04/W05 | `C:/Albert/project/dsh861/snapshots/sdk/subagent-teardown/session.1.v3.jsonl` | `63ae4f2c283d2471f9af96c2957a175ed7cd6c5f` | R/F | E/W04、E/W05 | C 保护 |
| W04 | `C:/Albert/project/dsh861/snapshots/sdk/subagent-teardown/system-prompt.1.expected.md` | `6c8864e07c5c6bcb01b139f77e66a3d23769bf49` | R/F | E/W04 | C 保护 |
| W04 | `C:/Albert/project/dsh861/snapshots/sdk/subagent-teardown/tool-schemas.1.expected.json` | `3b51e3002f91bc2d5820a386d79aec8120d20457` | R/F | E/W04 | C 保护 |
| W04 | `C:/Albert/project/dsh861/snapshots/sdk/subagent-teardown/tool-schemas.win32.expected.json` | NEW | N | E/W04 | S/W04 |
| W04 | `C:/Albert/project/dsh861/snapshots/sdk/subagent-teardown/tool-schemas.1.win32.expected.json` | NEW | N | E/W04 | S/W04 |
| W04/W05 | `C:/Albert/project/dsh861/snapshots/sdk/agent-team-teardown/snapshot.yml` | `596255b7d9b92c385e53e4e08280851860172421` | R | E/W04 | C 保护 |
| W04/W05 | `C:/Albert/project/dsh861/snapshots/sdk/agent-team-teardown/cordis.yml` | `0e62a6f1eee8f62d41b3240dff197f8e824b56d7` | R | E/W04 | C 保护 |
| W04/W05 | `C:/Albert/project/dsh861/snapshots/sdk/agent-team-teardown/cordis.snapshot.yml` | `893136629eab10ca678e735d6fec4e8de092b01e` | R | E/W04 | C 保护 |
| W04/W05 | `C:/Albert/project/dsh861/snapshots/sdk/agent-team-teardown/teardown-trigger.mjs` | `2e404c687214931f2906df67e3a32cc6ef1bba92` | R/F，保留 r46 delivery fence | E/W04 | C 保护 |
| W04/W05 | `C:/Albert/project/dsh861/snapshots/sdk/agent-team-teardown/llm-replay-entry.mjs` | `1ce67f68d36b036690c9791966e622d3f20d8488` | R/F | E/W04 | C 保护 |
| W04/W05 | `C:/Albert/project/dsh861/snapshots/sdk/agent-team-teardown/agent-team-entry.mjs` | `a3b2f5ca03aca63963d1fd5af6709adaa04b968a` | R/F | E/W04 | C 保护 |
| W04/W05 | `C:/Albert/project/dsh861/snapshots/sdk/agent-team-teardown/tool-agent-team-entry.mjs` | `2d7fe702ff01498c2e0accc496c72f49ad11a184` | R/F | E/W04 | C 保护 |
| W04/W05 | `C:/Albert/project/dsh861/snapshots/sdk/agent-team-teardown/replay.override.json` | `418b2a3d8e9b09fc05405d08f86c4d19135a8e44` | R/F | E/W04 | C 保护 |
| W04/W05 | `C:/Albert/project/dsh861/snapshots/sdk/agent-team-teardown/session.v3.jsonl` | `9c5e55515eb6a74b5fbd150cb90ed99527fa59ba` | R/F | E/W04、E/W05 | C 保护 |
| W04/W05 | `C:/Albert/project/dsh861/snapshots/sdk/agent-team-teardown/session.1.v3.jsonl` | `7937d330c6db62e2f180a905a831acdbf0f5e042` | R/F | E/W04、E/W05 | C 保护 |
| W04 | `C:/Albert/project/dsh861/snapshots/sdk/agent-team-teardown/system-prompt.1.expected.md` | `ec2a637086258bf9df40696cbec64dc860c833f8` | R/F | E/W04 | C 保护 |
| W04 | `C:/Albert/project/dsh861/snapshots/sdk/agent-team-teardown/tool-schemas.1.expected.json` | `e55ca1d010350dcd288839b0967761ee932c24e3` | R/F | E/W04 | C 保护 |
| W04 | `C:/Albert/project/dsh861/snapshots/sdk/agent-team-teardown/tool-schemas.win32.expected.json` | NEW | N | E/W04 | S/W04 |
| W04 | `C:/Albert/project/dsh861/snapshots/sdk/agent-team-teardown/tool-schemas.1.win32.expected.json` | NEW | N | E/W04 | S/W04 |
| W04 | `C:/Albert/project/dsh861/snapshots/session/text-turn/system-prompt.expected.md` | `b3c8e3db4b83cd62c6bc35f9b97f086153606e59` | R/F | E/W04 | C 保护 |
| W04 | `C:/Albert/project/dsh861/snapshots/session/text-turn/tool-schemas.expected.json` | `1531215c7fcf48877edd891862e08414a2504914` | R/F | E/W04 | C 保护 |
| W04/W12 | `C:/Albert/project/dsh861/scripts/session-snapshot-corpus.corpus.ts` | `dce4cda1000bea2bc673ae6bce61292277a8eb60` | R，执行现有检查 | E/W04、E/W12 | C |
| W04/W12 | `C:/Albert/project/dsh861/scripts/tests/agent-team-teardown-trigger.spec.ts` | `1c752d74f264afcfea5778a31e9423aa1f5aea0e` | R/F | E/W04 | C 保护 |

### 3.4 Windows expected 文件

| 任务 | 完整路径 | 当前 blob | 权限 | 产物 | 锁持有者 |
|---|---|---|---|---|---|
| W05 | `C:/Albert/project/dsh861/apps/cli/tests/profiles/headless/tests/subagent-diagnostic.expected.e2e.ts` | `6ea72244b0acc322c29a27824702f3da224450e9` | W | E/W05 | S/W05 |
| W05 | `C:/Albert/project/dsh861/apps/cli/tests/profiles/headless/tests/subagent-inheritance.expected.e2e.ts` | `e83a60a96849e52a3b90339a6995bb7f7190a852` | W? | E/W05 | S/W05 |
| W05 | `C:/Albert/project/dsh861/apps/cli/tests/profiles/headless/tests/session-log-identity.ts` | `efb67536b82b664551614ab9d173ecc4c7cf4f19` | W?，不得弱化选择 | E/W05 | S/W05 |
| W05 | `C:/Albert/project/dsh861/apps/cli/tests/profiles/headless/tests/session-log-identity.spec.ts` | `1c213fd770a8ef23431f7662fb1a3519f823ceaa` | W? | E/W05 | S/W05 |
| W05 | `C:/Albert/project/dsh861/apps/cli/tests/profiles/headless/subagent-diagnostic-snapshot.patch.yml` | `ac47e8d5a26ff0be38c1bb20552fafe84c965660` | R | E/W05 | C 保护 |
| W05 | `C:/Albert/project/dsh861/apps/cli/tests/profiles/headless/subagent-inheritance-snapshot.patch.yml` | `352841f745f868e02dc8aa79d57b428f216e1423` | R | E/W05 | C 保护 |
| W05 | `C:/Albert/project/dsh861/apps/cli/tests/profiles/headless/tests/expected/subagent-diagnostic/parent.expected.jsonl` | `ac7306cfdd38f4858f2aee674d062296787fb84f` | R/F | E/W05 | C 保护 |
| W05 | `C:/Albert/project/dsh861/apps/cli/tests/profiles/headless/tests/expected/subagent-diagnostic/replay.override.json` | `2b9facf71fe63fed0cc5a4dec9df136004fc4202` | R/F | E/W05 | C 保护 |
| W05 | `C:/Albert/project/dsh861/apps/cli/tests/profiles/headless/tests/expected/subagent-inheritance/parent.expected.jsonl` | `44d31a36ab5e907ad061ad5a34a991749d92f244` | R/F | E/W05 | C 保护 |
| W05 | `C:/Albert/project/dsh861/apps/cli/tests/profiles/headless/tests/expected/subagent-inheritance/child.expected.jsonl` | `70c18341156718aee8f4d3df9970e864ac46d3a0` | R/F | E/W05 | C 保护 |
| W05 | `C:/Albert/project/dsh861/apps/cli/tests/profiles/headless/tests/expected/subagent-inheritance/child.replay.jsonl` | `08b87f3e9b7493d315c7ea5e2ef43b65d5b59234` | R/F | E/W05 | C 保护 |
| W05 | `C:/Albert/project/dsh861/apps/cli/tests/profiles/headless/tests/expected/subagent-inheritance/child.replay.v3.jsonl` | `00dd06b51b48d3daec674433b70ec04f55ac928d` | R/F | E/W05 | C 保护 |
| W05 | `C:/Albert/project/dsh861/apps/cli/tests/profiles/headless/tests/expected/subagent-inheritance/replay.override.json` | `1c0fe9ffad698996d0864e597c182bee0d345f03` | R/F | E/W05 | C 保护 |
| W05 | `C:/Albert/project/dsh861/packages/test-support/session-snapshot/src/normalize.ts` | `bb1a50745358ecb495475d050c4f8cad5082497a` | R/F | E/W05 | C 保护 |
| W05 | `C:/Albert/project/dsh861/packages/test-support/loader-smoke/src/index.ts` | `a760a8eea3e2787d49e4cace7380e659dde56d59` | R/F | E/W05 | C 保护 |

### 3.5 Desktop

本计划不预判存在 Desktop 生产缺陷。`W?` 是受限修复位置；没有复现就保持原字节。安全传输、profile/包管理策略、签名与更新配置只有读权限。

| 任务 | 完整路径 | 当前 blob | 权限 | 产物 | 锁持有者 |
|---|---|---|---|---|---|
| W06 | `C:/Albert/project/dsh861/apps/desktop/src/backend-controller.ts` | `648de0397572020759ebae6af9639047eb040f5b` | W?，局部生命周期 | E/W06 | D/W06 |
| W06 | `C:/Albert/project/dsh861/apps/desktop/src/host-process.ts` | `7442c711727b22f528b288e3b69863fe07b57fb1` | W?，退出/失败传播；不改协议 | E/W06 | D/W06 |
| W06 | `C:/Albert/project/dsh861/apps/desktop/scripts/dev.ts` | `85bea68633a3d76944c3dc9e1c7beeac063a629f` | W?，局部启动问题 | E/W06 | D/W06 |
| W06 | `C:/Albert/project/dsh861/apps/desktop/scripts/development-project.ts` | `275373fffe8dcaa00390e3d04e8c7d9ef801aa61` | W?，自有目录准备/清理 | E/W06 | D/W06 |
| W06 | `C:/Albert/project/dsh861/apps/desktop/tests/backend-controller.spec.ts` | `abdc78a9e761513c0435a65c8a4219531cd1d84f` | W? | E/W06 | D/W06 |
| W06 | `C:/Albert/project/dsh861/apps/desktop/tests/host-process.spec.ts` | `f41650c26ea9bff5187d3b4a122b62ff6a146137` | W? | E/W06 | D/W06 |
| W06 | `C:/Albert/project/dsh861/apps/desktop/tests/development-project.spec.ts` | `dbdfa09347a0ef3264562316f0d9267ed9a04636` | W? | E/W06 | D/W06 |
| W06 | `C:/Albert/project/dsh861/apps/desktop/tests/host-protocol.spec.ts` | `b0455f2c6ff5a1b5fb2da5e774d64d3dd5f38f4a` | R | E/W06 | C |
| W06 | `C:/Albert/project/dsh861/apps/desktop/tests/main-startup.spec.ts` | `2b2e47d66d8cd1ccb01846d807c4cea87ffde4f5` | R | E/W06 | C |
| W06 | `C:/Albert/project/dsh861/apps/desktop/tests/fixtures/b01-preview-model.mjs` | NEW | N，测试模型行为 | E/W06 | D/W06 |
| W06 | `C:/Albert/project/dsh861/apps/desktop/tests/fixtures/b01-preview.cordis.patch.yml` | NEW | N，测试 profile 配置 | E/W06 | D/W06 |
| W06 | `C:/Albert/project/dsh861/apps/desktop/tests/fixtures/b01-preview-launch.mjs` | NEW | N，测试装配与现有 Electron 启动 | E/W06 | D/W06 |
| W07；W06 先读测 | `C:/Albert/project/dsh861/apps/desktop/scripts/runtime-file-policy.ts` | `9e6722009dfe03f4744b33f983b2cbbdcdc4bc12` | W? | E/W07 | D/W07 |
| W07；W06 先读测 | `C:/Albert/project/dsh861/apps/desktop/tests/runtime-file-policy.spec.ts` | `837fd54bf1cff1bf3b834a7ebf3fa522183824c4` | W? | E/W07 | D/W07 |
| W07 | `C:/Albert/project/dsh861/apps/desktop/scripts/package-target.ts` | `22c303d2bc88df88655e81152da6f29256af9b1c` | W?，不改签名/发布策略 | E/W07 | D/W07 |
| W07 | `C:/Albert/project/dsh861/apps/desktop/tests/package-target.spec.ts` | `d284747e863eb82622c830394899def518226b86` | W? | E/W07 | D/W07 |
| W07 | `C:/Albert/project/dsh861/apps/desktop/tests/owned-directory.spec.ts` | `081e5adc76aa43e5a01e8007736c31c5f84d1db9` | R | E/W07 | C |
| W07 | `C:/Albert/project/dsh861/apps/desktop/tests/single-instance.spec.ts` | `220f0d5a30e5f362f6f936d079820326d79f491f` | R | E/W07 | C |
| W06→W07 | `C:/Albert/project/dsh861/apps/desktop/README.md` | `c053e4894714d10cba2a9d9c1ebed71b53457c37` | W?，仅实际改变的契约 | E/W06、E/W07 | D，串行移交 |
| W06→W07 | `C:/Albert/project/dsh861/apps/desktop/README.zh.md` | `e27554fe8a91ee8a918380ef5a860b0838351aa5` | W?，配对 | E/W06、E/W07 | D，串行移交 |
| W06→W07 | `C:/Albert/project/dsh861/apps/desktop/README.i18n.yaml` | `b7ab466b8d043fbc992678dcd17a949dffb76fb6` | W?，机械配对 | E/W06、E/W07 | C/生成器 |
| W06/W07 | `C:/Albert/project/dsh861/apps/desktop/src/main.ts` | `a73a6223a5bb03c7f568686b75a34c40197347c0` | R | E/W06 | C |
| W06/W07 | `C:/Albert/project/dsh861/apps/desktop/src/host-protocol.ts` | `d057d6d16df65a52b01c86c7f9db38ba6759de0e` | R/F | E/W06 | C 保护 |
| W06/W07 | `C:/Albert/project/dsh861/apps/desktop-host/src/index.ts` | `3abebfc3c6689042a681b289f557b2eb20b5f73c` | R；需局部修复先精确追加 | E/W06 | C |
| W06/W07 | `C:/Albert/project/dsh861/apps/desktop-host/src/wire.ts` | `d5b2127c49fad6f7c8ff36ea322c8813e25ff0d1` | R/F | E/W06 | C 保护 |
| W06/W07 | `C:/Albert/project/dsh861/apps/desktop-host/config/desktop.cordis.patch.yml` | `92f4df6ddfee715f08233ba80dcda5ecf6b72520` | R/F | E/W06 | C 保护 |
| W07 | `C:/Albert/project/dsh861/apps/desktop/scripts/prepare-runtime.ts` | `1b22293c23d04ed30b5c9a791335e801c2d403d3` | R | E/W07 | C |
| W07 | `C:/Albert/project/dsh861/apps/desktop/scripts/prepare-package-set.ts` | `f67d767e8189b8055f6b58249ebf9f6159f5b458` | R | E/W07 | C |
| W07 | `C:/Albert/project/dsh861/apps/desktop/scripts/prepare-dsh.ts` | `d3f9dae8a387a8b423fc6e928ebb499783262b38` | R | E/W07 | C |
| W07 | `C:/Albert/project/dsh861/apps/desktop/scripts/desktop-build-paths.mjs` | `770b3333e326800dce1061e2fe77938802f52458` | R | E/W07 | C |
| W07 | `C:/Albert/project/dsh861/apps/desktop/electron-builder.config.mjs` | `4dfb36369383dc66090600020d2112156e4863c5` | R/F | E/W07 | C 保护 |
| W06/W07 | `C:/Albert/project/dsh861/apps/desktop/package.json` | `4f8f83a2f51bec37ea9a8de637ec16ef23cd3668` | R/F | E/W07 | C 保护 |
| W06/W07 | `C:/Albert/project/dsh861/apps/desktop-host/package.json` | `83b1ed2a5bf4294c8c70bef0d520f7ee0cf8ec5f` | R/F | E/W07 | C 保护 |

Desktop 构建产物由总控独占 `C:\Albert\project\dsh861\apps\desktop\.desktop-build\development\` 和 `C:\Albert\project\dsh861\apps\desktop\.desktop-build\targets\win-x64\`。这些是生成目录，没有源码 blob；执行前检查旧内容归属，不自动清理未知产物。大型二进制不进入源码 Git。

### 3.6 文档、盘点与运行状态

| 任务 | 完整路径 | 当前 blob | 权限 | 产物 | 锁持有者 |
|---|---|---|---|---|---|
| W08 | `C:/Albert/project/dsh861/docs/event-producer-consumer.md` | `4f42fe342086af1bbe7c71dd48a4e30d469b34f5` | W?，仅原生成器必要输出 | E/W08 | C/生成器 |
| W08 | `C:/Albert/project/dsh861/docs/event-producer-consumer.zh.md` | `714564a8ad9c0e067aa6c29a3c83aa2d61f99872` | W | E/W08 | T/W08 |
| W08 | `C:/Albert/project/dsh861/docs/event-producer-consumer.i18n.yaml` | `c38a0c3e742c1f665c79f68f0e51c1e892662f1a` | W | E/W08 | C/生成器 |
| W08 | `C:/Albert/project/dsh861/scripts/event-producer-consumer-pair.spec.ts` | NEW | N | E/W08 | T/W08 |
| W08 | `C:/Albert/project/dsh861/scripts/gen-doc-graphs.ts` | `242ce910ec2ce9eeb41d34c0d6dc27fe2ed6bbd1` | R/F | E/W08 | C |
| W08 | `C:/Albert/project/dsh861/docs/capability-seams.md` | `9cc7a6fc50b81e9f82d58600c84d1ff6494634c9` | R，隔离生成后核对不变 | E/W08 | C |
| W08 | `C:/Albert/project/dsh861/apps/cli/composition.md` | `406edb45579894ff624989c2e8e5a86e15f8b705` | R，隔离生成后核对不变 | E/W08 | C |
| W08 | `C:/Albert/project/dsh861/docs/agent-lifecycle.md` | `6ffe3c2b47e766ac985b3192a1c08787821fc46e` | R，隔离生成后核对不变 | E/W08 | C |
| W08 | `C:/Albert/project/dsh861/docs/tool-execution-pipeline.md` | `f9d3d145bb3d7c271882942b4adc100f53a55290` | R，隔离生成后核对不变 | E/W08 | C |
| W08 | `C:/Albert/project/dsh861/docs/graph-atlas.md` | `e37719c45e164aa004257c53afc0e996e1880619` | R，隔离生成后核对不变 | E/W08 | C |
| W09/W10 | `C:/Albert/project/dsh861/MULTI_AGENT_REQUIREMENTS.md` | `3c1b02299c412311fbc0f333a94f5b7a155cb8a1` | R/F | E/W09 | P |
| W09/W10 | `C:/Albert/project/dsh861/MULTI_AGENT_DEVELOPMENT_ROADMAP.md` | `a2e61dc136826d03641d509846b26052caeea90f` | R/F | E/W09 | P |
| W00/W10/W13 | `C:/Albert/project/dsh861/NODE_DEVELOPMENT_RULES.md` | `995d1d6bbd58b6d42f333ce886fc515135c67c4a` | R/F | E/W10 | C 保护 |
| W09/W10 | `C:/Albert/project/dsh861/development/CURRENT_NODE.json` | `a36d66255ccbaa276c61249299c47809f9792153` | R/F | E/W10 | C 保护 |
| W09/W10 | `C:/Albert/project/dsh861/development/NODE_STATUS.md` | `475447e51b96732fe2634617ef53a3f170cad570` | R/F | E/W10 | C 保护 |
| W09/W10 | `C:/Albert/project/dsh861/development/nodes/P0-B/state.json` | `4fa1dd1ab8f34e620a14e83fe4c9c7beea12665f` | R/F | E/W10 | C 保护 |
| W10 | `C:/Albert/project/dsh861/development/nodes/P0-B/plan.v3.md` | `2d6f8e6abd757c50eaecce81a02d6e7db980dbc1` | R/F | E/W10 | C 保护 |
| W10 | `C:/Albert/project/dsh861/development/nodes/P0-B/plan-revision-request.r02.md` | `4d559ba2c4a0816db2a846095f820db4cd06b280` | R/F | E/W10 | C 保护 |
| W09/W10 | `C:/Albert/project/dsh861/development/nodes/P0-B/acceptance-map.r01.json` | `cb1f0a8df4b61b9943d26758a1ce2ac0f3718cc1` | R/F | E/W09 | C 保护 |
| W00—W13 | `C:/Albert/project/dsh861/development/delivery-runs/B01/B01-20260919-01/RUN_CONTEXT.json` | `ef3c4d920f122a67a25c47aa9f1053eb4f96a7cf` | R；补充事实另留版本 | 运行根目录 | C |
| W00—W13 | `C:/Albert/project/dsh861/development/delivery-runs/B01/B01-20260919-01/STATUS.run.json` | `4b3cbef7336241c21cfac36b06006c7433a383f9` | W，仅真实状态更新 | 运行根目录 | C |

W09 后续发现的只读消费者和测试，以完整路径、固定 commit/blob 逐项登记到执行版矩阵；这不授予产品源码写权。W11 只写 CI 归类，W12 只整合已有白名单并写证据，W13 审核者对候选只读。

### 3.7 新增说明与 Agent Note 所有权

非平凡改动的 Note 随对应变更族交付，不能等提交前临时补入未经审核的文件。以下三组均为 `NEW`，由总控唯一整合；各任务提供事实。只有确有独立决策价值时创建，先检查已有活动 Note 的重叠和取代关系，历史与 archived 记录不改。

| 任务族 | 明确新增路径 | 权限 / 锁 | 产物 |
|---|---|---|---|
| W01/W02 | `C:/Albert/project/dsh861/.agents/notes/implemented/testing/2026-09-19-prepare-command-contracts.md`<br>`C:/Albert/project/dsh861/.agents/notes/implemented/testing/2026-09-19-prepare-command-contracts.zh.md`<br>`C:/Albert/project/dsh861/.agents/notes/implemented/testing/2026-09-19-prepare-command-contracts.i18n.yaml` | N / C | E/W02 |
| W04/W05 | `C:/Albert/project/dsh861/.agents/notes/implemented/testing/2026-09-19-sdk-platform-fixtures.md`<br>`C:/Albert/project/dsh861/.agents/notes/implemented/testing/2026-09-19-sdk-platform-fixtures.zh.md`<br>`C:/Albert/project/dsh861/.agents/notes/implemented/testing/2026-09-19-sdk-platform-fixtures.i18n.yaml` | N / C | E/W05 |
| W06/W07 | `C:/Albert/project/dsh861/.agents/notes/implemented/testing/2026-09-19-desktop-preview-evidence.md`<br>`C:/Albert/project/dsh861/.agents/notes/implemented/testing/2026-09-19-desktop-preview-evidence.zh.md`<br>`C:/Albert/project/dsh861/.agents/notes/implemented/testing/2026-09-19-desktop-preview-evidence.i18n.yaml` | N / C；仅在有非平凡实现/fixture 决策时创建 | E/W07 |

本计划自身由调用总控保存至 `C:/Albert/project/dsh861/development/delivery-runs/B01/B01-20260919-01/plan/formal-plan.v1.md`；该文件当前无 blob。调用证据、CP0、各次 manifest、日志、审核和报告均为运行目录内新增产物，由所属任务目录隔离；正式状态文件只由总控写。

## 4. 前置、执行波次与资源预算〔对应 c〕

### 4.1 精确依赖

| 任务 | 开始条件 | 验收附加条件 |
|---|---|---|
| W00 | 当前固定输入 | 计划保存、调用证据、所有权表、CP0 |
| W01 | W00 完成 | 字段直接回归、负控、CP1；真实 dpkg 证据归 W03 |
| W02 | W01 输出通过并交锁 | Windows 原 36 项及新增项执行；CP1、CP-A 组合 |
| W03 | W02、CP-A 发布候选可用 | 两条原 Linux 准备及必需安全证据 |
| W04 | W00 完成 | W03 的 Linux 证据；如 Windows 水合受阻，还需 W05 修复后的补验 |
| W05 | W04 accepted 或有证据的冻结/阻塞结论 | expected、identity、适用共享快照及资源释放 |
| W06 | W00 完成 | 实际窗口逐动作证据 |
| W07 | W06 accepted | 实际产物模式复验；只有缺件结论时维持阻塞 |
| W08 | W00 完成 | 内容、生成、配对检查及负控 |
| W09 | W00 完成 | 32 行盘点及独立实质复核 |
| W10 | W09 accepted | 准入清单完整；不要求在 B01 内解除所有产品阻塞 |
| W11 | W03 accepted 或有证据的阻塞结论 | 最新可用 CI 全貌及缺件 |
| W12 | W03—W11 全部有已知结论 | 组合候选、CP2、A1—A7 实际状态 |
| W13 | W12 固定候选及结论 | CP3、Git/产物/CI 一致性及集中报告 |

`conclusion_only` 只解除调度等待，不免除验收。W04 的 Windows 水合阻塞可交给 W05；修复后 W04 再验，形成文件锁的顺序交接，不形成并行双写或互相等待 accepted 的死锁。

### 4.2 预算与调度

| 资源 | 预算 | 约束 |
|---|---:|---|
| 实施流 | 起步 2，最多 3 | 第三流必须同时满足真实独立任务、文件互斥、机器资源和既有调用额度 |
| 独立审核 | 1 | CP0/CP1/CP2 排队；审核者不实施被审文件 |
| 重型 build / 打包 / 全量文档检查 | 1 | 包括共享 Host/Client 输出及其必要准备 |
| 轻型测试进程 | 2 | 两个进程不能共写输出、profile、端口或临时目录 |
| 共享生成器 | 1 | 由总控执行；W04、W08 及配对写回互斥 |
| Git 写入者 | 1 | 仅总控；包含 index、ref、commit 和 push |
| Desktop runtime | 1 | W06→W07；独占窗口、home、development project、target 输出 |
| 最终候选写入 | 0 | W13 CP3 期间全部冻结 |

默认先派发 **W01 与 W06**。W01 完成后该流进入 W02；Desktop 等待重型资源时，可将空出的实施槽用于 W04、W08 或 W09。若获准增加第三流，优先 W04；产品盘点仍计入实际实施/分析调用预算，不凭“只读”无限扩代理。

CP-A 推送进入 CI 等待后，基础设施流可转 W09→W10。W03/W11 的只读观察不阻塞 Desktop、文档或快照准备。W08 只在生成器空闲时执行写回。W12/W13 不再开启新的独立变更族。

测试进程数上限同时约束内部并发：资源紧张时为本次任务设置明确的 worker/concurrency 上限，并记录实际值；不得为掩盖缺陷修改仓库全局并发配置。共享 `node_modules`、`lib`、Client bundles 和 Desktop target 输出不能由多个构建写入，也不能在读取该产物的测试运行期间覆盖。

## 5. 验证入口与 A1—A9 对照〔对应 e〕

### 5.1 执行期命令

以下命令在仓库根运行。`node`、`pnpm` 均指第 1 节确认的绝对工具入口，任务启动器负责双目录 PATH。正式记录写实际展开 argv，不能只保存简称。

单测采用：

```text
node node_modules/vitest/vitest.mjs run --project thread-safe scripts/prepare-ci-bubblewrap.spec.ts scripts/ci-workflow.spec.ts

node node_modules/vitest/vitest.mjs run --project thread-safe apps/cli/tests/profiles/headless/tests/session-log-identity.spec.ts

node node_modules/vitest/vitest.mjs run --project thread-safe apps/desktop/tests/backend-controller.spec.ts apps/desktop/tests/host-process.spec.ts apps/desktop/tests/host-protocol.spec.ts apps/desktop/tests/development-project.spec.ts apps/desktop/tests/runtime-file-policy.spec.ts

node node_modules/vitest/vitest.mjs run --project thread-safe apps/desktop/tests/package-target.spec.ts apps/desktop/tests/owned-directory.spec.ts apps/desktop/tests/single-instance.spec.ts

node node_modules/vitest/vitest.mjs run --project thread-safe scripts/event-producer-consumer-pair.spec.ts
```

Bash 语法检查使用已确认的绝对 Bash：

```text
"C:\Program Files\Git\usr\bin\bash.exe" --noprofile --norc -n scripts/prepare-ci-bubblewrap.sh
```

expected 与 snapshot 使用任务专有 home，并明确 `DSH_SNAPSHOT=replay`。依照现行 subprocess 政策，正式 assembled 验收使用 `DSH_EXAMPLE_MODE=lib`，前置共享构建必须有相同输入的有效记录；source 模式只作为明确注明的诊断，不替代 built 证据。

```text
node node_modules/vitest/vitest.mjs run --config vitest.expected.config.ts apps/cli/tests/profiles/headless/tests/subagent-diagnostic.expected.e2e.ts apps/cli/tests/profiles/headless/tests/subagent-inheritance.expected.e2e.ts

node node_modules/vitest/vitest.mjs run --config vitest.snapshot.config.ts snapshots/sdk/teardown.snapshot.ts

node node_modules/vitest/vitest.mjs run --config vitest.snapshot.config.ts snapshots/sdk/sdk.snapshot.ts -t "replays (subagent-teardown|agent-team-teardown) through dsh --profile sdk"

node node_modules/vitest/vitest.mjs run --config vitest.snapshot.config.ts scripts/session-snapshot-corpus.corpus.ts

node node_modules/vitest/vitest.mjs run --project thread-safe scripts/tests/agent-team-teardown-trigger.spec.ts
```

共享自动 filter 必须实际选中两个目标场景；其他未选择场景与选中场景被 skip 分别报告。每个新 spec 要证明被当前测试配置发现。

Desktop 入口：

```text
pnpm run dev:desktop
pnpm run start:desktop
pnpm --filter @deepseek-ai/dsh-desktop run package:win:x64:unsigned --dir
pnpm run package:desktop:win:x64:unsigned
```

最后一条只在具备现成工具和原授权时执行。完整打包命令包含 `build:official` 及准备过程，不能按轻量命令调度。

文档与集成检查：

```text
pnpm run verify-doc-graphs
pnpm run verify-translation-pairing --write docs/event-producer-consumer.md
pnpm run test:docs
pnpm run doc-sync
pnpm run typecheck
pnpm run lint
pnpm run duplication
git diff --check
```

`--write` 仅由配对责任者在持锁时执行。生成操作使用原生成器，在隔离目录完成。因本阶段实际增加 Note、pairing 或文档，执行相应 doc-sync；输入未变且覆盖充分的已有证据可以引用，不能引用采纳计划包的 16 项文档结果代替后来的源码/Note 检查。

若同一候选已完成 `build:lib:host`，可按当前脚本展开结果复用该构建并运行 `typecheck:contracts-ready`、`lint:contracts-ready`，记录实际执行链；不能声称运行了未运行的顶层命令。完整 coverage 和平台矩阵交由原 CI，禁止默认在本机重复全仓。

所有负控在持锁的隔离副本或明确拥有的文件中执行，保存原字节、目标失败及 finally 恢复 hash。导入失败、超时、网络失败和零发现不构成有效负控。

### 5.2 必需验收

| 验收 | 责任任务与证据来源 | 当前缺口及完成判据 |
|---|---|---|
| B01-A1 | W01 字段/退出回归；W03 真实 pinned deb 控制字段 | 当前 `not_run`。旧 CI 证明首失，不证明修复。必须有真实字段协议及非零/缺字段拒绝 |
| B01-A2 | W02 本机完整 spec、替身来源；新 Windows CI 文件级结果 | 当前 `not_run`。已有 9/36 通过、27 失败；根因及空输出尚未完整证明。原 36 项和新增项必须实际执行 |
| B01-A3 | W03 两条原 Linux 准备、链接/ELF/hash/probe、安全分项 | 当前 `not_run`。r48 未到编译；当前脚本未执行上游测试。mock、版本或下载成功均不足 |
| B01-A4 | W04/W05 两个共享自动场景、两个专用 teardown、两个 expected、identity | 当前 `not_run`。Windows 自动入口水合和平台 schema、diagnostic 比较仍需处理；Linux 新通道尚未到此 |
| B01-A5 | W06 实际窗口、临时项目、可见结果、取消、退出重开、数据读取 | 当前 `not_run`。代码和单测不能代替动作证据；测试模型必须明确标识 |
| B01-A6 | W07 可运行目录或预览包、文件 hash、依赖、说明、产物模式旅程 | 当前 `not_run`。工具链和产物未形成 B01 证据。安装包可选；已验证的可运行目录是最低可交付形式，安装状态仍单列 |
| B01-A7 | W09 32 行矩阵、真实消费者/证据、独立抽查；W10 缺件 | 当前 `not_run`。计划种子不算实际盘点，不要求把未知强行归为无实现或通过 |
| B01-A8 | 各直接回归、CP1、W12 CP2、文档与组合检查、W13 指定硬审 | 当前 `not_run`。尚无 B01 修改候选、测试和硬审；本计划本身不满足 A8 |
| B01-A9 | W11 CI 全貌、W12 完整索引、W13 阶段报告及 Git/产物身份 | 当前 `not_run`。最终候选、产物与新 CI 未形成；所有未关闭项必须保留 |

只有 A1—A9 的必需内容齐备，才能给出 `READY_FOR_OWNER_PREVIEW`。缺环境或授权等外部条件而已有可交付成果时用 `PARTIAL_WITH_BLOCKERS`；存在待修复的本阶段正确性问题时用 `REWORK`。完整 CI 的红绿单独报告，不因预览可用将 CI 标绿，也不将本阶段必需失败归为无关历史问题。

## 6. 与既有规则的兼容性及保护面〔对应 f〕

本计划保持 `NODE_DEVELOPMENT_RULES.md` 的指定分工、真实 CLI 参数证据、固定候选硬审及前置节点顺序。B01 的 CP0/CP1/CP2 不冒充指定规划或硬审；CP3 不授予凭据、费用、安装或发布权限。B01 通过也不更新 P0-B 为 approved，不激活 P0-C。

保护面包括：

- `vendor/`、依赖锁、全部 workflow YAML、分支保护、根测试阈值及现有 no-apt 断言。
- r43 observer、r44 六个生产修复文件、scope/core inbox/session-projection 框架、持久化与 lease。
- 模型、provider、endpoint、思考等级和 credentials；明确测试 profile 中的 keyless fixture 不得改变生产或用户默认配置。
- P0-B 状态、所有旧候选、原始日志、manifest、审核回执和已登记 keep-local 材料。
- 所有已提交 Session 代次：不得覆盖、移动或删除，也不得通过 refresh 改写为当前输出。
- Desktop 的 IPC/transport、签名、自动更新目标、生产应用标识及用户 profile 隔离策略。

关键保护指纹如下，供 W12 核对：

| 完整路径 | 当前 blob |
|---|---|
| `C:/Albert/project/dsh861/packages/subagent/tool-subagent-control/tests/owned-contexts.ts` | `7713e57d18adab01b5ed4ceb59c08ebb66e3bfd5` |
| `C:/Albert/project/dsh861/packages/core/agent/src/index.ts` | `17a35d1bf113e5dc2cbca4f0e3c1f940cab8ca07` |
| `C:/Albert/project/dsh861/packages/core/agent-loop/src/index.ts` | `6df307bee573a93ddbf97a6dc87b86965a568c5f` |
| `C:/Albert/project/dsh861/packages/core/agent-loop/src/agent.ts` | `321fc0c13625579711eb998c20a375402b3770b9` |
| `C:/Albert/project/dsh861/packages/subagent/subagent/src/continuation-activation.ts` | `6b9968ba2dc47dd266ca86f48253a85697afc771` |
| `C:/Albert/project/dsh861/packages/subagent/subagent/src/index.ts` | `f68fe09fc73c1e438c698f9de64296390d60745e` |
| `C:/Albert/project/dsh861/packages/experimental/agent-team/src/index.ts` | `2ccbbe95cafadf727ceb8c93376f8bd0a8e82bb3` |
| `C:/Albert/project/dsh861/pnpm-lock.yaml` | `0ccbeee70bc0477b81ae1f669f5e52d6c57d7bf0` |
| `C:/Albert/project/dsh861/.github/workflows/ci.yml` | `c6b939a7b65be4df7287a28b31b045481d864dc8` |
| `C:/Albert/project/dsh861/.github/workflows/ci-master.yml` | `5d7f420024ea423a67eb51d1c86b26ab5850ace5` |
| `C:/Albert/project/dsh861/.github/workflows/e2e.yml` | `ecc2e77d37f9f26bf3b237e243efceb89f832119` |
| `C:/Albert/project/dsh861/.github/workflows/sandbox.yml` | `cdcb229ab0faf1e9bc0e6dceb88edf692b6d14ad` |

五个 prepare 调用点保持不变：

| 文件 | 当前调用行 |
|---|---|
| `.github/workflows/ci.yml` | 195、361 |
| `.github/workflows/ci-master.yml` | 172、495 |
| `.github/workflows/e2e.yml` | 84 |

`.github/workflows/sandbox.yml:87` 仍为独立 `sudo apt-get install -yq bubblewrap` 入口。本批次不迁移它、不修改它，也不宣布全仓 CVE 关闭。

不安装 WSL、VM、Docker、系统编译工具或数据库；不改 UAC、ACL、注册表、全局 PATH、AppArmor 或用户全局 agent 配置。本机 Windows 不裸跑含 sudo/sysctl 的 prepare 脚本。原 CI probe 只按现有 runner 规则执行。

不读取密钥、`.env`、`auth.json`、全环境或用户全局配置，不调用 `git credential fill`。测试启动器只传递必要变量，测试 home/profile/cwd 由任务拥有，日志不记录秘密。缺凭据和产品真实模型授权时保留阻塞，不发起替代请求。

若实际发生 GUI 行为变化，除直接测试外还须登记相应 keyless Session/预期与真实界面交互证据；按适用 GUI 证据规则录制实际运行 GIF。所用测试模型必须明示，不能为满足录制要求越权调用付费模型。若变更触及 loop、Session 生命周期或事件定义，则已经越过本计划初始白名单，必须先扩围，并同步规划两种 SDK 的证据。

## 7. 与输入计划包的差异点

| 编号 | 差异或补订 | 执行影响 |
|---|---|---|
| D01 | 计划包已在 `f5ab2fed…` 采纳，入口是 `00-README.md` | 不再执行计划分支获取、切换或重复采纳；旧文字保留为输入历史 |
| D02 | 本次唯一交付为 final 中的计划，FILE_OWNERSHIP 采用计划内表格 | 不额外生成 JSON；总控可生成等义机读投影，不能改变权限 |
| D03 | W01 从两种候选方案中选定逐字段读取、直接捕获命令退出 | 不保留宽松多字段解析分支；fixture 必须模拟真实 argv 协议 |
| D04 | W04 选定平台专属完整 schema sidecar | 不改变平台 shell 配置，不删除 schema，不只替换工具名；明确登记四个 Windows 新预期路径 |
| D05 | W04/W05 的 Windows 水合依赖具体化 | W04 可冻结阻塞结论后交锁给 W05；修复后 W04 补验，不能要求双方先 accepted |
| D06 | 自动 SDK 水合存在 raw cwd 替换，专用 adapter 已有正确转义 | W05 先修 adapter 局部问题；expected diagnostic 另查，不扩大公共 normalizer |
| D07 | Desktop development project 每次由 dev/start 重建 | keyless 配置必须由登记辅助在正确时点装配，不能依赖重建前手工文件 |
| D08 | 本机、CI、Desktop bundled Node 是三个不同身份 | 分别记录 26.8.2、该 run 的 26.9.0、打包 pin 24.17.0；不顺手升级 |
| D09 | 未签名目录须组合 `--unsigned --dir` | 不使用会要求签名的普通 `:dir` 路径；无签名和无更新 origin 的 unsigned 行为已由源码确认 |
| D10 | `gen-doc-graphs` 会写六份文档 | 先隔离生成，仅整合白名单差异；新增内容级 spec，避免 pairing hash 掩盖中文事实错误 |
| D11 | 五处中文行号已由当前源码核实 | 修正准确五项；英文无需为形式配对而制造修改 |
| D12 | typecheck/lint 内含 Host build；assembled CI 使用 lib 模式 | 按 heavy-build 管理并复用有效产物；直连 Vitest 不等于改成任意 source 启动 |
| D13 | prepare 当前禁用上游 tests，现有功能 probe 不足以独自证明安全回归 | W03 必须给出安全分项真实证据或精确阻塞，不能据普通 probe 宣称 CVE 关闭 |

上述差异只修订 B01 执行参考，不改写输入计划包、正式节点规则或其他权威文件。

## 8. 证据、恢复与最终状态

每次物理运行保存一份原始日志和索引，至少包含：任务、完整命令与 cwd、工具路径/版本、开始结束、真实 exit、signal/timeout、选中/通过/失败/跳过数量、输入候选、输出 bytes/hash 和截断情况。manifest 不自包含其自身 hash。脱敏或规范化副本单独命名，保留原始与发布副本两种身份；复制日志不计新运行。

本阶段开始状态继续保留：W00 `running`，W01—W13 `planned`，A1—A9 `not_run`。总控保存本计划及调用证据、完成 CP0 后，才能推进 ready 队列；规划文本不会自动修改任何状态。

每波结束保存以下恢复信息：

- 当前 HEAD、计划版本、候选 manifest、各任务状态及锁交接 hash。
- 实际运行或待结束的自有进程、home、端口、构建输出和 push。
- 已通过且输入未变的证据，以及必须补验的变化。
- 精确阻塞、授权依据、可继续的独立任务。
- 全部 keep-local 与 deliverable_modified 项的归属。

恢复时先核对现场，再取得锁；不 reset、rebase、amend、stash、clean 或覆盖未知工作。外部动作没有回执时先判断是否发生，不能直接重发 push、安装或发布。同一方法连续两次没有新证据后更换诊断方法；三轮无进展时进入总控根因检查或集中决定，不隐藏失败，也不无限重复。

最终交付目录必须能直接定位计划、manifest、验证索引、最后硬审、Windows 实际产物、CI 全貌、AC 矩阵和未关闭项。报告保留 `sandbox.yml` 未迁移入口、P0-B 未完成、未运行的真实模型/数据库验证、安装与发布状态，以及任何本阶段必需失败。只有证据满足本计划时才标记 `READY_FOR_OWNER_PREVIEW`；否则准确交付 `PARTIAL_WITH_BLOCKERS` 或 `REWORK`。