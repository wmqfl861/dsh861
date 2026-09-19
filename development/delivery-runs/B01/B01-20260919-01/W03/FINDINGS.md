# W03 FINDINGS — B01-20260919-01

## CP-A3 收尾轮（run 35450138445，2026-09-19T14:55Z；详见 [linux-evidence-cp-a3.md](linux-evidence-cp-a3.md)）

- **A3-1 W02 返工实测转绿**：coverage annotations 中 `prepare-ci-bubblewrap.spec.ts` 4 处失败零出现（CP-A2 曾浮现 stub-source×2、:907、:787）；逐文件权威表在 artifact `10587360084`。
- **A3-2 准备管线两路保持通过**（各 17s exit 0）；A3 判定口径不变（构建面已证、安全分项 NOT_RUN 精确阻塞、sandbox.yml NOT_CLOSED）。
- **A3-3 pi-ai 失败未按预期出现**：本轮 consumers 无 pi-ai 注释；test:expected 结论以 gate 表为准（artifact `10585733512`）。
- **A3-4 W04 关键变化**：sdk snapshot 通道**真实执行且比较失败**——`subagent-teardown: session 1 header 1`（config 多字段）与 `agent-team-teardown: session 0 header 1`（工具 schema 区）deep-equal 失败。F4.2/F4.3 Linux 证据存在且为不匹配，交 W04 处置。
- **A3-5 Windows coverage 仍 failure**（`gen-client-catalog.spec.ts:200` 30s timeout，W11）；coverage 残留：inspector CDP timeout（新）、python-runtime 60s timeout（复现）→ W11。
- **A3-6 CP1 C1–C3+G5 已落实**（见 linux-evidence-cp-a3.md §6）：C1 snapshot-gate 实测改记+撤销旧表述、C2 轮一归因指针与措辞降准、C3 双 digest 卫生缺口标注、G5 sysctl 告警式修正。

---

## CP-A2 轮（run 35447649954，2026-09-19T14:05Z；详见 [linux-evidence-cp-a2.md](linux-evidence-cp-a2.md)）

- **A2-1 两条 Linux 准备管线全通过（确证）**：coverage/consumers 两路 "Install dependencies and prepare bubblewrap" 均 success（17s/15s，exit 0 = 脚本自校验全链通过：下载+hash→逐字段 dpkg 契约→审计→Meson→编译→[7/7] 链接（绝对 libcap.a 形态证据）→ELF/NEEDED/ldd→版本 0.12.0→probe→GITHUB_PATH 发布）。A3 构建面达成。
- **A2-2 CP-A 轮失败点确证**〔C2 措辞修正，2026-09-19 收尾轮〕：CP-A2 脚本注释实录 run 35445600344 的链接形态（`[7/7] cc … <private>/libcap.a`）——CP-A 轮失败仅在链接证据 grep 拒绝绝对路径形态。轮一本轮仅给出"失败落在 Meson setup/compile 附近窗口"的**推算**（无日志），该推算窗口被此实录**部分证实**（编译/链接确已走完），但轮一并未定位到链接证据检查这一精确点；"与轮一归因一致"的旧措辞高估了轮一结论的精度，特此降准。
- **A2-3 预期复绿兑现**：static（`16ae3047` doc budgets）success；windows observational（克隆去重）success。
- **A2-4 后续 gates 失败（与准备分开归类）**：① `prepare-ci-bubblewrap.spec.ts` 在真实 Linux 4 处失败（stub-source 守卫 2 例 probe status null、:907、:787 序列 diff）→ **返派 W02 家族**；② headless pi-ai expected（requests 2 vs 5）→ W11；③ terminal-bash、python-runtime timeout → W11；④ coverage 短缺明细在 artifact `10586561821`（194,205 bytes）。
- **A2-5 Windows coverage gates 仍失败（预期内）**：annotations 见 typert tools-catalog 30s timeout；artifact `10585476793` → W11。
- **A2-6 A3 判定**：构建面通过；安全分项 **NOT_RUN**（`-Dtests=false`，无上游安全测试通道）；sandbox.yml **NOT_CLOSED** → A3 整体仍未满足（安全分项缺）。
- **A2-7 W04 F4.2/F4.3**〔C1 修正版，2026-09-19 收尾轮；初版结论错误，已撤销〕：初版称"sdk snapshot 通道已真实运行、未浮现 sidecar 断言（提示通过）"——**错误**。CP1 下载并哈希验证的 gate-evidence（artifact `10586416150`，展开于 `C:\dsh-b01-w03\gate-evidence-snapshots\`）实测：`ci-consumers` aggregate **failFast=true**，`snapshot`（test:snapshot）gate **skipped**，error `aborted by fail-fast: test:expected failed`；同批 skipped：lint-and-duplication、web-snapshot、built-bin-smoke；6 passed / 1 failed（expected-output，99.6s）/ 4 skipped。**F4.2/F4.3 在 CP-A2 轮未解锁**（sdk snapshot 通道从未执行）；解锁条件：后续候选中 test:expected 先绿、snapshot gate 实际执行且通过。

---

## CP-A 轮（run 35445600344，2026-09-19T13:23Z；详见 [linux-evidence.md](linux-evidence.md)）

观察对象：CP-A commit `8d0dc41139…` 触发的 CI run `35445600344`。

## F1 — 新 run 身份链闭合（确证）
CI run 35445600344 / number 40 / attempt 1 / event pull_request；PR #13（draft 不变）head `8d0dc411`、base `5434305c`、CI checkout merge commit `1d286a59`。merge tree 中 4 个任务关键文件 blob 与 CP-A 本地 HEAD 完全一致；保护面 workflow 指纹（ci/ci-master/e2e/sandbox.yml）全部不变。CI 执行的就是 CP-A 候选，无合并分歧、无 workflow 改动。

## F2 — 两条原 Linux 作业再次 failure，仍在准备步骤（确证）
`node 24 / coverage`（105903866831）与 `node 24 / snapshots and artifacts`（105903866688）均在 "Install dependencies and prepare bubblewrap" 步骤 exit 1（17–18s），后续 coverage/consumers 阶段全部 skipped。A3 两条准备路径均未通过。

## F3 — W01 契约修复在真实 Linux 上生效（间接确证）
旧首失签名（dpkg-deb 多字段带标签输出在 control 校验 exit 1）未复现；失败注释行深 coverage 137→206（+69）、consumers 141→212（+71），即脚本越过整个逐字段 control 块又输出约 70 行才失败。r48→CP-A 的脚本 diff 恰为 control 块替换，其余管线字节不变 —— 修复本身工作正常。

## F4 — 剩余失败位于 CI 首次真实执行的构建管线（归因，精确点未定）〔C2 补指针，2026-09-19 收尾轮〕
失败窗口按耗时（步骤 17–18s，含并行 pnpm install ≈12s）与行深推算落在 fsys-tarfile 审计 / Meson setup / compile 区间；精确失败行因日志不可匿名读取（见 F5）无法抄录。分类：**普通构建/解析问题 → 回派 W01**；无缺系统包/内核权限/workflow 改动的证据，不升级范围。
**后续取代**：本推算已被授权通道日志取代——CP-A2 脚本注释实录 run 35445600344（CP-A 轮）真实日志显示 `[7/7]` 编译/链接已全部完成，失败点收敛为**链接证据 grep 拒绝绝对 `libcap.a` 形态**（见 A2-2 / CP-A2 轮证据 §1）。

## F5 — 日志匿名不可读（访问事实，非推诿）
api logs 403；站点 step-log 端点（含 cookie/CSRF/UA 变体）404；渲染页显示 "Sign in to view logs"。Linux 无 gate-evidence artifact（上传步骤 skipped）。若需日志级定位，须由总控以既有权限下载本 run 日志。

## F6 — 三输入可用性与 pin 正确性独立核验通过（确证）
验证者 vantage 逐一下载三 URL，SHA-256 与 pin 精确一致（bubblewrap 0.12.0 `9760d007…`、meson 1.12.0 `88afe0c2…`、libcap-dev 1:2.66-5ubuntu2.4 `07f24628…`）。排除"来源失效/hash 错"作为本次失败原因；来源 hash 未变，无换 pin 迎合下载的问题。

## F7 — static 作业回归（确证，回派）
run39 static 为 success；本次 "Run static gates" failure。CP-A 是唯一变量（新增 test-support.ts 226 行 + spec +594 行 + 新增 markdown 证据文件）；候选门禁：export-jsdoc / markdown 系列 / module-graph。精确门禁需日志 → 与 F4 一并回派 W01/W02 家族复检。

## F8 — Windows 侧上下文（留 W11）
`windows node 24 / observational` 由 run39 success 转为 gates 步骤 failure（回归）；`windows node 24 / coverage` gates 步骤 failure（12m14s），gate-evidence artifact id `10584629291`（152490 bytes）已产出待凭据下载。W02/A2 的 CI 兑现情况需文件级结果方可判定。

## F9 — 安全分项（判定）
上游安全回归 **NOT_RUN**（build 未走完、`-Dtests=false`、probe 未执行）；`sandbox.yml` **NOT_CLOSED**（独立 apt 入口未迁移，blob 不变）；**A3 保持未满足（not_run）**。

## F10 — W04 Linux 侧未解锁
consumers 通道死于准备步骤，sdk snapshot 未启动；F4.2/F4.3 的 Linux 证据无法产生。W04 维持 `wait_ci`。

## F11 — 其余触发 workflow（记录）
E2E skipped（无 key，符合预期）；三个 release/addon workflow success；issue-lifecycle/issue-policy/build-preview-cloudflare failure —— 非 W03 范围，W11 归类。
