# W11 00-start — 最新 CI 与覆盖率归类（B01-20260919-01）

- 任务：W11（最新 CI 和覆盖率分类，不开启无界修复）。WORK_PACKAGES.md W11 卡；formal-plan.v1.md §W11。
- 执行窗口：2026-09-19（本地）；观察对象为 CI run 35447649954（CP-A2，run_number 41）两轮 W03 取证之后的只读归类。
- 约束遵守：只读分析；不修文件（工作区在 W11 期间无产品源码改动）、不推送、不做凭据操作、不调用模型；工具链 PATH 前缀（node v26.8.2 / pnpm 12.4.1 双目录，见 RUN_CONTEXT.json）；单命令 ≤60s。
- 证据源（复用已下载，未重下）：
  - `C:\dsh-b01-w03\gate-evidence-coverage\`（run 41 coverage 作业 artifact；identity：prHead `1863a0dd…`、checkout `158a9cdb…`、node 26.9.0/linux；manifest 四文件 sha256 齐备；aggregate-stdout 截断 92,109/1,140,173 bytes，保留 1,048,064）。
  - `C:\dsh-b01-w03\gate-evidence-snapshots\`（run 41 consumers 作业 artifact；identity 同上 job=node-24-consumers；含 `logs/expected-output.log` 8,696 bytes，即 W03 未能匿名读取的 artifact 10586416150 的对应内容形态）。
  - `C:\dsh-b01-w03\job-*.log`（run 40 各作业）、`job-a2-snapshots.log`（run 41 consumers 作业原始日志，100,274 bytes）。
  - 仓库内 W03 两轮取证与本 run 各工作包产物（`../W03/`）、remediation r28–r48 留痕（`development/remediation/`）。
- Windows coverage artifact（run 41 `10585476793`、run 40 `10584629291`）未下载：本轮仅以 W03 annotations + BASELINE 的 run 39 Windows artifact（10582621667，27 失败全在 prepare-spec）交叉归类，文件级判定列为待下载项（见 FINDINGS F7）。
- 方法：以 run 41 attempt 1 实际执行为准逐失败归类（准备失败/断言失败/未处理异常/coverage 阈值/被跳过），去重按根因群；git 历史以本地对象核对（HEAD=1863a0dd，工作区仅 2 处已登记修改）。

产物：`FINDINGS.md`、`failure-ledger.md`、`coverage-gaps.md`、`pi-ai-classification.md`。
