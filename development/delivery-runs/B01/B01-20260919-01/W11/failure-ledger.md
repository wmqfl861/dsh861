# W11 failure-ledger — run 35447649954（run 41 / attempt 1 / checkout 158a9cdb / PR head 1863a0dd）失败统一台账

按本 run 实际执行计数，不做历史减法；去重以根因群为单位。分类三择一：【本阶段引入 / 本分支既有 / 上游环境】（"上游环境"= runner/工具链漂移为主因的敏感性，无相关源变更）。后继责任三择一：B01 内 / 后续阶段 / 上游（凭据下载/所有者登记类行动标"总控"）。

## 1. CI 矩阵（job 级）

| 作业 | 结论 | 首失位置 | 根因群 |
|---|---|---|---|
| node 24 / coverage（105909256819） | failure（准备 success，"Run exhaustive coverage" 13m35s） | test:coverage gate | G1+G2+G3+G4 |
| node 24 / snapshots and artifacts（105909256654） | failure（准备 success，gates 2m11s） | test:expected gate | G5 |
| windows node 24 / coverage | failure（gates 步骤） | annotation: typert tools-catalog 30s timeout | G6 |
| node 24 / static | success | — | — |
| windows node 24 / observational | success | — | — |
| benchmarks / node 22.19 / 24.9 / 26 / python 3.10 / python runtime ×4 / windows native / windows build | success | — | — |
| E2E | skipped（无 key，预期） | — | — |
| all checks passed | failure（随动汇总） | — | 随 G1–G6 |
| issue-lifecycle / issue-policy / build-preview-cloudflare | run 41 无证据（run 40 为 failure） | — | 未核验，不计数 |

## 2. 根因群台账（去重后 7 群）

### G1 — prepare-ci-bubblewrap.spec.ts Linux 4 处失败【本阶段引入】→ B01 内（W02，已回派，勿重复）

- 证据：coverage aggregate `::error` 注释三条 + 用例行：`spec.ts:663`（stub-source check failed: `command -v uname resolved to '' (probe status null)`，Path-first 与 PATH-first 两变体，run 目录 `run-VLsLYQ`）；`spec.ts:787`（调用序列 deep-equal，diff 落 `dpkg-deb` 相邻条目顺序）；`spec.ts:907`（expected 1 got 0，缺构建工具时不失败分支）。
- 类型：断言失败/错误传播（非准备失败——run 41 两条 Linux 准备管线本身 exit 0）。
- 归属：W01→W02 家族登记文件（spec/test-support）在真实 Linux runner 的新增缺陷；W03 A2-4 已回派，本台账仅登记不重派。

### G2 — terminal-bash pwsh motd 空输出【本分支既有】→ 后续阶段

- `packages/terminal/terminal-bash/tests/local.spec.ts:333`：`expect(created.motd).toContain('dsh> ')` 得 `''`；仅 `hold command: false` 变体失败（1,406ms），`hold: true` 通过（3,409ms）。分区 3/4。
- 类型：断言失败（真实 pwsh 引导时序：motd 未及写入即被读取的形态）。
- 本阶段关联：无。`terminal-bash` 测试/src 最后变更 `0348599f04`、`237b3d5edf`（远早于 B01 分叉点 7f63d035）；B01 diff 不含 terminal。
- 备注：BASELINE"coverage…间歇失败"群成员之一；Linux 专属面，本机（Windows）不复现通道。

### G3 — code-runtime-python O(depth) 60s 超时【上游环境·本分支既有敏感性】→ 后续阶段/上游

- `packages/experimental/code-runtime-python/tests/runtime.spec.ts:5158`：`expected { kind: 'timeout', … } to be undefined`，`wall-clock ceiling reached (60000ms)`；用例 60,110ms；姊妹 `validates wide binding arguments in O(depth)` 35,944ms 通过（同文件其余 249 用例过）。
- 类型：未处理超时（性能上界类，非功能断言）。
- 本阶段关联：无。该测试/src 最后变更 `0963bdd7d3`、`f45ca2d9ac`（早于 B01）；B01 diff 不含 code-runtime。
- 环境因子：4-CPU runner、coverage 4 分区并发 + tsx 转换负载；`f45ca2d9ac` 本身即"drop two host-paced assumptions the hosted image exposes"的历史同类处理。

### G4 — coverage 每文件 100% 阈值 67 文件短缺【本分支既有】→ 后续阶段

- 证据：aggregate-stderr 198 条 `ERROR: Coverage … does not meet global threshold (100%)`，唯一化 67 文件（60 client UI 嵌套 + 7 core/experimental）。
- 非未执行/分区失败造成：4 分区全部完成（1/4/1/? 分布：p1 1 失败、p2 4 失败、p3 1 失败，合计 6，全在 G1–G3 文件）；失败测试与 67 文件无覆盖贡献关系。
- 详见 coverage-gaps.md。

### G5 — pi-ai headless expected 计数失败【本分支既有·环境敏感 flake 家族】→ 总控登记/所有者（建议已出）

- `apps/cli/tests/profiles/headless/tests/headless.expected.e2e.ts:572`：`toHaveLength(2)` got 5；26,374ms（姊妹场景 4–6s）；其余 30 expected 用例全过。
- 连坐：`lint and duplication`、`test:snapshot`、`web browser snapshot`、`built-bin smoke` 4 gates skipped（gate-results.json：`aborted by fail-fast: test:expected failed`）→ **W04 Linux 证据（sdk snapshot/sidecar 比较仍未运行）阻塞于此**；并更正 W03 A2-7"已真实运行"表述。
- 定性与修复建议：pi-ai-classification.md。不在 B01 FILE_OWNERSHIP，B01 内不修。

### G6 — Windows typert tools-catalog 30s 超时【上游环境·本分支既有敏感性】→ 总控下载 artifact 后终判

- annotation：`packages/typert/generator/tests/tools-catalo…` `Test timed out in 30000ms`（W03 A2-5 转录）。
- 本阶段关联：无（typert 最后变更 `a7d4cd8e1b` 早于 B01；B01 无 timeout 参数/typert 改动；Windows observational 绿）。
- 交叉：run 39（B01 前，run 35436610274，artifact 10582621667）Windows 27 失败全在 prepare-spec，无 typert → 本 run 新浮现但无相关源变更 → 负载/超时类敏感性。Linux 同域测试在 coverage-exempt-heavy 以 90s 超时通过（316.6s）。
- 待办：artifact `10585476793`（42,464 bytes）下载后按 gate 表完成文件级归属（annotation 10 条上限，需确认无隐藏失败）。

### G7 — 汇总/随动项（不计新失败）

- `all checks passed` failure：随 G1–G6。
- E2E skipped：无 key（预期）。
- run 40 记录的旁路 workflow（issue-lifecycle/issue-policy/build-preview-cloudflare）在 run 41 无本地证据，未核验不计数；B01 未触任何 workflow（保护面指纹不变，W03 F1）。

## 3. 分类统计（本 run）

| 分类 | 根因群 | 数量 |
|---|---|---|
| 本阶段引入（回派 B01 工作包） | G1 | 1 群（4 用例） |
| 本分支既有 | G2、G4、G5 | 3 群（1 用例 + 67 文件阈值 + 1 用例及 4 gate 连坐） |
| 上游环境/敏感性 | G3、G6 | 2 群（1 用例 + Windows 待终判） |
| 随动/未核验 | G7 | — |

精确未运行项（本 run 实际 skipped 且非无 key 预期）：consumers lane 的 `lint and duplication`、`test:snapshot`、`web browser snapshot`、`built-bin smoke`（fail-fast 连坐，根因 G5）。

## 4. 后继责任汇总

- B01 内：G1（W02 已回派；其通过与否决定 coverage lane 是否复绿于该 4 用例）。
- 总控行动：下载 artifact 10585476793（G6 终判）；pi-ai 修复的工作包登记/所有者确认（G5；建议见 pi-ai-classification.md §4）。
- 后续阶段：G2（terminal-bash pwsh 时序）、G3（python O(depth) 性能上界）、G4（67 文件覆盖债：60 个 client 豁免 glob 结构化补齐 + 7 个 core 文件真实分支补测）。
- 上游/环境：G6 若 artifact 证实纯超时类，归环境敏感性台账（Windows 慢机 30s 默认超时 vs Linux 90s 豁免通道的不对称是既有事实，如需改动属后续阶段决策，B01 不动阈值）。
