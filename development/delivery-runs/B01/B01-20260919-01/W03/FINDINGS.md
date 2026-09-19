# W03 FINDINGS — B01-20260919-01

观察对象：CP-A commit `8d0dc41139…` 触发的 CI run `35445600344`（详见 [linux-evidence.md](linux-evidence.md)）。

## F1 — 新 run 身份链闭合（确证）
CI run 35445600344 / number 40 / attempt 1 / event pull_request；PR #13（draft 不变）head `8d0dc411`、base `5434305c`、CI checkout merge commit `1d286a59`。merge tree 中 4 个任务关键文件 blob 与 CP-A 本地 HEAD 完全一致；保护面 workflow 指纹（ci/ci-master/e2e/sandbox.yml）全部不变。CI 执行的就是 CP-A 候选，无合并分歧、无 workflow 改动。

## F2 — 两条原 Linux 作业再次 failure，仍在准备步骤（确证）
`node 24 / coverage`（105903866831）与 `node 24 / snapshots and artifacts`（105903866688）均在 "Install dependencies and prepare bubblewrap" 步骤 exit 1（17–18s），后续 coverage/consumers 阶段全部 skipped。A3 两条准备路径均未通过。

## F3 — W01 契约修复在真实 Linux 上生效（间接确证）
旧首失签名（dpkg-deb 多字段带标签输出在 control 校验 exit 1）未复现；失败注释行深 coverage 137→206（+69）、consumers 141→212（+71），即脚本越过整个逐字段 control 块又输出约 70 行才失败。r48→CP-A 的脚本 diff 恰为 control 块替换，其余管线字节不变 —— 修复本身工作正常。

## F4 — 剩余失败位于 CI 首次真实执行的构建管线（归因，精确点未定）
失败窗口按耗时（步骤 17–18s，含并行 pnpm install ≈12s）与行深推算落在 fsys-tarfile 审计 / Meson setup / compile 区间；精确失败行因日志不可匿名读取（见 F5）无法抄录。分类：**普通构建/解析问题 → 回派 W01**；无缺系统包/内核权限/workflow 改动的证据，不升级范围。

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
