# W13 硬审输入准备 — 提示词草稿（W12 交付）

运行: B01-20260919-01 / W12。日期: 2026-09-19/20。用途: 总控发起 B01 最终硬审（W13/CP3）时的调用与提示词底稿。本文件是**草稿**：调用由总控执行，占位符（如 CP-A4 CI run id）由总控在发起前以并行 CI 终验任务的实际结果填充。

## 1. 调用要求（不可妥协项）

| 项 | 要求 |
|---|---|
| 程序 | 真实 OpenCode CLI（r44-B 就绪核验的在案二进制，sha256 `0242a0dc…`；如二进制已更新，按 r44b5 惯例重验摘要并在调用记录注明） |
| 模型/变体 | `zhipuai-coding-plan/glm-5.3`，**`--variant max`**（argv 必须实际携带；r44 第三轮缺 `--variant` 的 PARAMETERS_NONCONFORMING 先例在案） |
| 调用记录必须包含 | 程序绝对路径/版本、真实完整 argv、model/variant、开始/结束时间、退出码、提示词 hash、输出位置（原样 stdout 归档 + 脱敏副本分列） |
| 裁决规则 | 输出必须含明确 `PASS` / `FAIL` / `BLOCKED`；**退出码 0 而无明确裁决不算 PASS**；`FAIL`→原实施者返工形成新候选后同工具复审；`BLOCKED`→保留缺件，不换模型、不降思考等级、不以内部审核代替 |
| PASS 门槛 | 缺少 B01 必需正确性或验收证据时不能给 B01 PASS（formal-plan W13） |

## 2. 提示词正文（草稿；交总控按占位符填充后使用）

---

你是 B01（可信基线与 Windows 桌面预览）阶段的最终指定硬审核者。审核对象是固定候选提交 **`89dce53b805241d9ec38f8c8ea7bde1109dac4b4`**（分支 `chore/latest-stable-upgrade-20260912`，基线 `7f63d03538759306f8363d5a912c1e99fbe015bf`）。仓库：`C:\Albert\project\dsh861`。你只读，不实施。

### 2.1 必读输入（按序）

1. **正式计划**: `development/delivery-runs/B01/B01-20260919-01/plan/formal-plan.v1.md`（W01—W13 任务卡、FILE_OWNERSHIP、保护面指纹、A1—A9 判据）+ 同目录 `codex-invocation.md`（规划调用身份）。
2. **候选 manifest**: `development/delivery-runs/B01/B01-20260919-01/W12/candidate-manifest.md`（338 文件全量 `git diff --name-status 7f63d035..89dce53b80` 归属 + 保护面逐 blob 复验 + keep-local 边界）。可自行重跑 git 命令复核。
3. **A1—A9 状态**: `development/delivery-runs/B01/B01-20260919-01/W12/acceptance-status-A1-A9.md`（逐项证据指针与判定）+ `STATUS.run.json`（任务与证据全 history）。
4. **各包证据**: `development/delivery-runs/B01/B01-20260919-01/W01…W11F/` 各 FINDINGS 与产物（W01 report/rework-2、W02 report/rework-linux、W03 linux-evidence×3、W04 platform-contract/round-2、W05 logs 索引、W06 journey/INCIDENT-1、W07 preview/artifact-index/journey-replay、W08 fact-diff 于 FINDINGS、W09 requirements-matrix/reuse-and-gaps、W10 p0-b-readiness、W11 failure-ledger/coverage-gaps/pi-ai-classification、W11F FINDINGS）。
5. **组合核验（W12）**: `W12/integration-checks.md`（跨包重跑 run-01…05 真实数量/退出码 + src 模式超时归因）。
6. **CI 身份**: 已观察 run 40 `35445600344`（CP-A 轮）、run 41 `35447649954`（CP-A2）、run 42 `35450138445`（CP-A3）、Windows gate-evidence artifacts `10584629291`/`10586561821`/`10585476793`/`10586416150`/`10585733512`/`10587360084`。**CP-A4（89dce53b80）触发的最新 CI run:【占位——由并行 CI 终验任务填充 run id/结论/五项清单】**。
7. **未运行项**: `W12/open-items.md`（U1—U6 + G 群台账 + 簿记注记；含 -Dtests=false 安全分项、A5 人验子路径、NSIS 缺件、sandbox.yml NOT_CLOSED、pi-ai 终验、W07 O1-O3）。
8. **Agent Note**: `.agents/notes/implemented/testing/2026-09-19-{prepare-command-contracts,sdk-platform-fixtures,desktop-preview-evidence}.{md,zh.md}`（三组双语 Note，随候选族决策）。

### 2.2 审核问题（逐项回答）

1. 候选是否只包含 formal-plan FILE_OWNERSHIP 登记面与运行证据（对照 manifest；保护面 vendor/workflow/锁/r44 六文件/r43 observer/P0-B 状态应为零变化——含 manifest §3.2 记录的 P0-B 指纹转写勘误是否属实且不影响保护属性）。
2. 每波复核与返工是否闭环（W01 rework-2 两形态链接证据；W02 Linux 返工 4 处；W06 INCIDENT-1 三硬条件 + CP1 修正；W08 TS18048 返工；W03 C1—C3/G5 收尾；W04 轮二 + blob 标签更正；W11 N1—N4；W11-F C1/O1）。返工是否引入弱化。
3. 负控链是否有效（各包 NC 的突变体、失败签名、恢复 hash 是否自洽；抽查可重放）。
4. A1—A9 判定与证据是否相符（acceptance-status 表 vs 各包 FINDINGS；`product_accepted=0` 是否被如实呈现而非缺陷掩盖）。
5. W12 组合核验是否充分（重跑矩阵、src 模式超时归因是否成立、lib 模式前置构建记录是否合规）。
6. CI 身份与结论是否支撑 A4 Linux 侧与 W11-F 终验【按占位填充后的实际 run 裁决】；G 群既有失败是否与 B01 引入面正确隔离。
7. 未运行项清单是否完整、归因精确、无被降级为"已完成"的项。
8. 三组 Agent Note 是否忠实于交付事实（抽查与 FINDINGS 的一致性）。

### 2.3 输出要求

- 裁决行（第一行）: `PASS` / `FAIL` / `BLOCKED` 之一。
- 逐项结论 + 引用的文件/命令/退出码证据。
- `FAIL` 时列出每个缺陷的精确位置与最小返工面；`BLOCKED` 时列出精确缺件。
- 不得因预览可用而将 CI 必需失败标绿；不得建议降低阈值、换模型或以内部审核代替指定硬审。

---

## 3. 发起前检查清单（总控）

1. 填充 §2.1 第 6 项占位（CP-A4 CI run id + 五项清单结论，来自并行 CI 终验任务）。
2. 复核候选字节未漂移（`git rev-parse HEAD` 仍为 89dce53b80 或按 CP-F 决定的最终候选；若 Note/产物先行合入形成新提交，以新候选 hash 重跑 manifest 增量核对）。
3. 记录提示词 hash（对填充后的最终文本）。
4. 冻结全部实施写入（W13 CP3 期间候选写入=0）。
