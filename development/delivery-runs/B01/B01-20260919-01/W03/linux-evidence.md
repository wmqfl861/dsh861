# W03 — 真实 Linux 构建与安全准备验收：CI 观察证据

观察窗口：2026-09-19T13:25:39Z – 13:44:00Z（UTC）。验证者：只读远端观察；无凭据 REST + 公开页面；未安装 gh、未取 token、未干预 CI、未本地构建。原始查询输出全量存 `C:\dsh-b01-w03\raw\`（文件名含查询时间戳）；本目录 `raw-json/` 存摘要。

## 1. Run / attempt / checkout 身份（全部 API 实测）

| 项 | 值 | 来源 |
|---|---|---|
| CI run | `35445600344`，run_number 40，attempt 1 | `actions/runs?head_sha=8d0dc411…` |
| 事件 / 触发 | `pull_request`（CP-A push 到 PR 分支的 synchronize）；actor `wmqfl861` | runs API |
| workflow | `.github/workflows/ci.yml`（name "CI"） | runs API |
| 生命周期 | started 2026-09-19T13:23:04Z → completed 13:37:02Z，conclusion **failure** | runs API |
| PR head | `8d0dc41139827f0dd1e3c4a82178dc6ad8bb3b7e`（`chore/latest-stable-upgrade-20260912`）= CP-A | pulls/13 |
| PR base | `5434305c5dcf7ddc3ebf939226647b7b608335e6`（`feat/multi-agent-company-nodes`）；PR #13 仍 open/**draft** | pulls/13 |
| CI checkout | merge commit `1d286a592b26b84dfad6a70d66b771e56f777b13` = `refs/pull/13/merge`（pull_request 事件 checkout 对象） | ls-remote + pulls/13 |
| runner | GitHub 托管 `ubuntu-24.04`（labels 实测）；coverage runner `GitHub Actions 1000001809`、consumers `1000001803` | jobs API |

**合并提交 tree 中任务文件 blob 核对**（contents API @ `1d286a59`，与本地 `HEAD=8d0dc411` blob 逐一比对）——无合并分歧，CI 执行的就是 CP-A 候选：

| 文件 | merge tree blob | 本地 HEAD blob | 一致 |
|---|---|---|---|
| `scripts/prepare-ci-bubblewrap.sh` | `4c03966fd769a3075a086a6a7daa1cbdfba413a3` | 同 | 是（W01 修复版；r48 旧 blob 为 `7d2428e2`） |
| `scripts/prepare-ci-bubblewrap.spec.ts` | `d0f3e6a640be3bba4a1bdccd9d328290998098c1` | 同 | 是 |
| `scripts/prepare-ci-bubblewrap-test-support.ts` | `04fbb27dea525c19cf5bcb4d8e05e892b6f03b03` | 同 | 是 |
| `.github/workflows/ci.yml` | `c6b939a7b65be4df7287a28b31b045481d864dc8` | 同 | 是（保护指纹不变） |

保护面其余指纹（merge tree 实测 = 计划 §6 保护表 = 本地 HEAD）：`sandbox.yml` `cdcb229a…`、`e2e.yml` `ecc2e77d…`、`ci-master.yml` `5d7f4200…` —— 全部未动。

远端脚本字节另经 raw.githubusercontent.com @ `8d0dc411` 拉取，sha256 `0ded0a117fa5d3d7510b0ae4d3ec63cffb9e12875258fa8701bef1ee692f312a`，与本地工作树完全一致。

## 2. 日志获取限制（实测，属证据事实）

- `GET api.github.com/…/actions/jobs/{id}/logs`：匿名 **HTTP 403**（需凭据）。
- 站点侧 step 日志端点（`/commit/{sha}/checks/{id}/logs/{n}` 等多种形态，含会话 cookie/CSRF/浏览器 UA 变体）：匿名 **HTTP 404**。
- 渲染读取（web reader）：页面显示 **"Sign in to view logs"** —— 本仓库 Actions 日志对未登录用户不开放。
- Artifacts：Linux 两作业的 "Upload gate failure evidence" 因失败发生在 install+prepare 步骤而 **skipped**，无 Linux gate 证据产物。全 run artifacts 仅 4 件：两个 python wheel、win_amd64 wheel、`gate-evidence-windows-coverage-run35445600344-attempt1`（id `10584629291`，152490 bytes，2026-09-19T13:36:54Z）。artifact 下载同样需凭据（留给 W11/总控）。
- 结论：Linux 侧失败点的**精确行**本次无法匿名取证；改用步骤级 API 元数据 + 注释行深度差 + 字节/输入核验做归因（下文）。

## 3. 两条原 Linux 作业结果

### 3.1 `node 24 / coverage`（job `105903866831`）— **failure**

- 步骤 9 "Install dependencies and prepare bubblewrap"：13:23:24Z → 13:23:41Z（17s），conclusion **failure**，exit 1（annotation："Process completed with exit code 1."，挂于日志行 **206**）。
- 步骤 10 "Run exhaustive coverage"、11 "Upload gate failure evidence"：skipped。
- 前置步骤（checkout/pnpm-setup/setup-node/cache）全部 success —— 失败不在环境装配。

### 3.2 `node 24 / snapshots and artifacts`（job `105903866688`）— **failure**

- 步骤 10 "Install dependencies and prepare bubblewrap"：13:23:23Z → 13:23:41Z（18s），conclusion **failure**，exit 1（annotation 挂于日志行 **212**）。
- Playwright 安装、compatibility/snapshot/artifact gates、evidence 上传全部 skipped。

### 3.3 与原失败（run 35436610274）深度对照

| 作业 | 原失败注释行 | 新失败注释行 | 行深增量 |
|---|---|---|---|
| coverage | 137 | 206 | **+69** |
| consumers | 141 | 212 | **+71** |

原首失签名（`libcap-dev control Package is 'Package: libcap-dev'`）**未复现**。注释行=日志末行（exit-code 注释挂日志末尾），故 +69/+71 表明新脚本在旧失败点之后又产出了约 70 行输出才失败 —— 越过了 control 块（其后紧接 fsys-tarfile 审计→extract→私有 pc→pkg-config 解析→Meson setup→compile）。

## 4. W03 卡逐项核对结果

| # | W03 卡检查项 | 结果 | 证据 |
|---|---|---|---|
| 1 | 三输入真实下载 + 固定 hash | **输入侧核验通过；run 内完成度间接成立** | 验证者 vantage（2026-09-19T13:32Z）逐一 curl 三 URL，SHA-256 全部精确匹配：bubblewrap `9760d007…a3314`、meson `88afe0c2…886c`、libcap-deb `07f24628…abee`（`C:\dsh-b01-w03\raw\inputs-check-*.log`）。run 内下载在本步骤之前无法直接观测（无日志），但：旧 run39 已实证 runner 侧三输入可下载；新失败深度远过 control 块（脚本顺序上下载在 control 之前）→ 间接成立 |
| 2 | 真实 dpkg 单字段输出与退出状态 | **间接通过（W01 修复在真实 Linux 上生效）** | 旧多字段首失签名未复现；失败点后移约 70 行，越过整个逐字段块（r48→CP-A 脚本 diff 即该块替换，其余管线字节不变）。单字段裸值输出的精确文本无日志不可直接抄录 |
| 3 | Meson setup / compile / 链接命令 | **未走完（失败最可能落在此窗口）** | 步骤 17–18s 含并行 pnpm install（对照 static 作业约 12s）；按脚本阶段耗时推算失败落在 Meson setup/compile 区；精确失败行不可匿名取得 |
| 4 | 私有 libcap 路径、静态链接事实 | **NOT RUN**（build 未完成，链接命令 grep/`-L…libcap` 校验未到达或未通过，不可区分） |
| 5 | ELF 架构/NEEDED/ldd/精确版本 0.12.0/binary hash | **NOT RUN**（同上；相关 echo 输出无从取得） |
| 6 | 功能 probe 实际执行、失败不发布 PATH、成功后才发布 | **NOT RUN**（probe/`$GITHUB_PATH` 发布未到达；无 PATH 污染迹象——后续步骤仅 skipped） |
| 7 | 任务私有目录 / 重复运行 / 环境污染 | **NOT RUN**（脚本字节上全部落 `RUNNER_TEMP/dsh-bubblewrap-private`；行为未走完，无重复运行观察） |
| 8 | 无宿主库 fallback / 无旧 pin 回退 | **字节侧成立；行为侧 NOT RUN** | merge tree 与本地 HEAD 字节一致，pins（三 hash、版本、URL）与计划输入一致；但静态私有链接/无 fallback 的运行时证明未取得 |

## 5. 同 run 其余作业（上下文，供 W11）

run 35445600344 终态 **failure**；16 作业 + 汇总：

- **failure（6）**：两条 Linux 准备路径（上）；`node 24 / static`（步骤 "Run static gates"，13:23:44→13:25:05，**run39 中该作业为 success → CP-A 引入的回归**）；`windows node 24 / coverage`（步骤 "Run Windows coverage" 12m14s failure，gate-evidence artifact 已产出）；`windows node 24 / observational`（步骤 "Run Windows observational gates" 5m4s failure，**run39 为 success → 回归**）；`all checks passed`（汇总，随动失败）。
- **success（10）**：benchmarks、node 22.19/24.9/26 兼容、python 3.10 SDK、python runtime matrix×4、windows native tests、windows build。
- 同 push 触发的其他 workflow：`E2E` skipped（无 key，符合预期）；`Release (dsh)`/`Release (vendor)`/`Node Addon System` success；`Issue lifecycle`/`Issue policy`/`Build PR preview` failure（非 W03 范围，留 W11 归类）。

## 6. 失败归因与回派

1. **两条 Linux 准备路径**：W01 契约修复实证生效（首失越过 control 块）；剩余失败位于 r48→CP-A 未变、但**在 CI 中首次真实执行**的构建管线（fsys-tarfile 审计→Meson setup/compile 区间最可能）。按 W03 卡规则属**普通构建/解析问题 → 回派 W01**（含：修复后须重做受影响组合检查并形成新候选；本 run 证据保留为原始证据；不重复推送未改变候选）。未出现需要新系统包/内核权限/workflow 修改的证据；若回派方在复盘中需要日志级定位，需总控以既有权限下载本 run 日志（匿名不可得，见 §2）。
2. **static 回归**：CP-A 仅改 3 个脚本文件 + 新增运行记录 markdown；static 门禁面（`check:ci:static` = ciSharedStaticGates + docSyncLeafGates（含 export-jsdoc、markdown 系列）+ module-graph）中，最可能由新 `prepare-ci-bubblewrap-test-support.ts`（226 行，export JSDoc 契约）或新增 markdown 证据文件触发。**精确门禁不可匿名判定 → 一并回派 W01/W02 家族**，由总控复检。
3. **windows observational 回归 + windows coverage gate 失败**：文件级结果在 artifact `10584629291` 内，需凭据下载；W02/A2 是否在 CI 兑现留给 W11 归类（本任务仅记录步骤事实）。

## 7. 安全分项与 A3 判定

- **上游修复相关安全回归**：**NOT_RUN**。脚本 `-Dtests=false`；本次 run 连编译都未走完，普通 `true` probe 亦未执行。不据任何版本号或下载成功宣称安全行为。
- **`sandbox.yml` 独立 apt 入口**：**NOT_CLOSED**（blob `cdcb229a…` 未变，独立 `sudo apt-get install -yq bubblewrap` 入口仍在，未迁移）。
- **A3 = 未满足（not_run）**：两条原 Linux 准备路径本次均 failure；链接/ELF/hash/probe/PATH 发布全部未取得证据。

## 8. W04 的 Linux 侧解锁信息

**未解锁。** W04 的 F4.2（agent-team 父 sidecar 默认平台在 Linux 的选择）与 F4.3（子 sidecar 在 Linux 再生成）依赖 consumers 通道（sdk snapshot 测试），该通道本次死于准备步骤、从未启动。W04 维持 `wait_ci`，等待回派修复后的下一次候选 CI。
