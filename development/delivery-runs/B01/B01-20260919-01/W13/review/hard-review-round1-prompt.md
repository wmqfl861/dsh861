你是 B01（可信基线与 Windows 桌面预览）阶段的最终指定硬审核者：真实 OpenCode CLI，模型 zhipuai-coding-plan/glm-5.3，variant max（既定安排，不更换；本运行实际 argv 已包含 --variant max，见文末调用身份）。仓库：`C:\Albert\project\dsh861`，分支 `chore/latest-stable-upgrade-20260912`。审核对象是**冻结候选提交 `9fec63de9056c140c155ab51da52a41b2fcd6a72`**（本地 HEAD，未推送；源码基线 `7f63d03538759306f8363d5a912c1e99fbe015bf`）。候选提交链在 W12 manifest 对象之上还有两层，均可自行用 git 复核：

- `89dce53b805241d9ec38f8c8ea7bde1109dac4b4`（CP-A4，已在远端）— W12 candidate-manifest 的 338 文件全量归属对象；
- `e1e31b080b35d29186fbb6ebf52ffeff695560ec`（CP-A5，已在远端）— 唯一 lint 失败的微修复（16 文件：`scripts/prepare-ci-bubblewrap-test-support.ts` 一处源码修复 + run-43 终验证据树与 W02/W03 簿记）；
- `9fec63de90`（冻结层，未推送）— W12 产物 + 三组双语 Agent Note + STATUS 簿记（18 文件，全部为 `development/delivery-runs/B01/…` 与 `.agents/notes/implemented/testing/2026-09-19-{prepare-command-contracts,sdk-platform-fixtures,desktop-preview-evidence}.{md,zh.md,i18n.yaml}` 证据/文档面，无产品源码）。

全量 `git diff --name-status 7f63d035..9fec63de90` = 363 文件。你只读，不实施，不修改任何文件。

### 0.1 工作树状态申报（供你核对，不构成候选面）

当前工作树相对 HEAD 的漂移仅为 keep-local 面（RUN_CONTEXT.json `worktree_classification` 在案：r48 `comment-draft.md` 一处已跟踪修改 + r44 探针/BLOCKED/normalized log、r47s 等未跟踪文件，均在 `development/remediation/` 下）；外加本硬审自身的证据目录 `development/delivery-runs/B01/B01-20260919-01/W13/`（总控侧执行者写入，非候选改动）。候选源码面零漂移（`git diff HEAD --name-only` 可复核）。W13 期间全部实施者写入已冻结，候选写入=0。

### 0.2 操作约束（必读；r44-B round4 先例在案——headless 模式下任何权限请求都会被自动拒绝并使运行中辍、无裁决）

1. 本运行的一切读写仅限本仓库 `C:\Albert\project\dsh861` 之内：禁止读取或写入仓库外任何路径（包括 `C:\dsh-b01-w13\`、`C:\dsh-b01-w12\`、`C:\dsh-r24-upgrade-20260912-01\*` 等仓库外 raw/工具链目录与其他盘符）；仓库外原件的哈希已记录在仓库内证据文件中，无需也无法直接读取。
2. 不使用 Write/Edit 工具向任何路径写文件（候选冻结中）；需要校验脚本时一律 bash 内联完成（`node -e` / `node --input-type=module -e` / 带引号 heredoc / 管道），输出打印在你的回复中，不落盘任何新文件。
3. 不读取任何密钥、凭据、`.env`、auth 文件；不调用其他代理；不改模型/变体/思考等级。
4. 不要请求任何权限（安装依赖、外网抓取等）——它们会被自动拒绝并终止本次审核。

### 1. 必读输入（按序）

1. **正式计划**: `development/delivery-runs/B01/B01-20260919-01/plan/formal-plan.v1.md`（W01—W13 任务卡、FILE_OWNERSHIP、保护面指纹、A1—A9 判据）+ 同目录 `codex-invocation.md`（规划调用身份）。
2. **候选 manifest**: `development/delivery-runs/B01/B01-20260919-01/W12/candidate-manifest.md`（338 文件全量 `git diff --name-status 7f63d035..89dce53b80` 归属 + 保护面逐 blob 复验 + keep-local 边界）。可自行重跑 git 命令复核；并按上文申报的两层增量（89dce53b80→e1e31b080b→9fec63de90）用 `git diff --name-status` 逐一核对增量面确属申报范围（CP-A5 一处源码修复 + 证据面；冻结层纯证据/文档面）。
3. **A1—A9 状态**: `development/delivery-runs/B01/B01-20260919-01/W12/acceptance-status-A1-A9.md`（逐项证据指针与判定）+ `STATUS.run.json`（任务与证据全 history；其最后两条即 CP-A4 终验与 CP-A5 交付）。
4. **各包证据**: `development/delivery-runs/B01/B01-20260919-01/W01…W11F/` 各 FINDINGS 与产物（W01 report/rework-2、W02 report/rework-linux、W03 linux-evidence×3、W04 platform-contract/round-2、W05 logs 索引、W06 journey/INCIDENT-1、W07 preview/artifact-index/journey-replay、W08 fact-diff 于 FINDINGS、W09 requirements-matrix/reuse-and-gaps、W10 p0-b-readiness、W11 failure-ledger/coverage-gaps/pi-ai-classification、W11F FINDINGS）。
5. **组合核验（W12）**: `W12/integration-checks.md`（跨包重跑 run-01…05 真实数量/退出码 + src 模式超时归因）。
6. **CI 身份**: 已观察 run 40 `35445600344`（CP-A 轮）、run 41 `35447649954`（CP-A2）、run 42 `35450138445`（CP-A3）、Windows gate-evidence artifacts `10584629291`/`10586561821`/`10585476793`/`10586416150`/`10585733512`/`10587360084`（清单在 W03/FINDINGS）。**CP-A4（89dce53b80）触发的终验权威结论：CI run `35460812553`（gate 表为权威）——`test:expected` PASSED 92.05s（pi-ai 确定性，W11-F 终验 GREEN）；`test:snapshot` PASSED 142.24s（五项平台 sidecar 清单 GREEN，A4 Linux 侧关闭，双平台均已取证）；prepare 管线第 4 次连续通过。该 run 聚合唯一失败 = `lint:contracts-ready` 4 处 no-unnecessary-condition（W02 测试支撑面；本地 lint 变体不含该类型感知规则的规则差），已在 CP-A5 `e1e31b080b` 修复——本地双 lint 变体验证 0/0（contracts-ready 与 full 两变体各 0 warnings 0 errors，3615 文件，`W02/logs/mf-run-01/02-*.exit/.out` 在案）且 spec 套件不变（64 passed | 1 exec-bit-gated skip）。CP-A5 推送后 CI 再验证按 STATUS 证据行为触发中、预期 consumers 聚合绿或仅余 W11 分级过的既有 G 群红。候选冻结 SHA `9fec63de90`。**
7. **未运行项**: `W12/open-items.md`（U1—U6 + G 群台账 + 簿记注记；含 -Dtests=false 安全分项、A5 人验子路径、NSIS 缺件、sandbox.yml NOT_CLOSED、pi-ai 终验、W07 O1-O3）。
8. **Agent Note**: `.agents/notes/implemented/testing/2026-09-19-{prepare-command-contracts,sdk-platform-fixtures,desktop-preview-evidence}.{md,zh.md}`（三组双语 Note，随候选族决策）。

### 2. 审核问题（逐项回答）

1. 候选是否只包含 formal-plan FILE_OWNERSHIP 登记面与运行证据（对照 manifest；保护面 vendor/workflow/锁/r44 六文件/r43 observer/P0-B 状态应为零变化——含 manifest §3.2 记录的 P0-B 指纹转写勘误是否属实且不影响保护属性）。
2. 每波复核与返工是否闭环（W01 rework-2 两形态链接证据；W02 Linux 返工 4 处；W06 INCIDENT-1 三硬条件 + CP1 修正；W08 TS18048 返工；W03 C1—C3/G5 收尾；W04 轮二 + blob 标签更正；W11 N1—N4；W11-F C1/O1；CP-A5 lint 微修复）。返工是否引入弱化。
3. 负控链是否有效（各包 NC 的突变体、失败签名、恢复 hash 是否自洽；抽查可重放）。
4. A1—A9 判定与证据是否相符（acceptance-status 表 vs 各包 FINDINGS；`product_accepted=0` 是否被如实呈现而非缺陷掩盖）。
5. W12 组合核验是否充分（重跑矩阵、src 模式超时归因是否成立、lib 模式前置构建记录是否合规）。
6. CI 身份与结论是否支撑 A4 Linux 侧与 W11-F 终验（以 run 35460812553 gate 表为权威 + CP-A5 处置：本地双 lint 变体 0/0 与推送后再验证预期）；G 群既有失败是否与 B01 引入面正确隔离。
7. 未运行项清单是否完整、归因精确、无被降级为"已完成"的项。
8. 三组 Agent Note 是否忠实于交付事实（抽查与 FINDINGS 的一致性）。

### 3. 输出要求

- 裁决行（第一行）: `PASS` / `FAIL` / `BLOCKED` 之一。
- 逐项结论 + 引用的文件/命令/退出码证据。
- `FAIL` 时列出每个缺陷的精确位置与最小返工面；`BLOCKED` 时列出精确缺件。
- 不得因预览可用而将 CI 必需失败标绿；不得建议降低阈值、换模型或以内部审核代替指定硬审。
- 缺少 B01 必需正确性或验收证据时不能给 B01 PASS（formal-plan W13 门槛）。

### 4. 本轮调用身份

真实程序 `C:\Users\Joyce Gu\AppData\Roaming\npm\node_modules\opencode-ai\bin\opencode.exe`（opencode-ai@1.18.31，179998248 bytes，SHA-256 `0242a0dc705af67c90882b456a36b619883c1c786aad8fe071a1bc64e5d1d440`——与 r44-B 就绪核验在案二进制逐字节一致，无需重验）；工作目录 `C:\Albert\project\dsh861`；argv：`run --model zhipuai-coding-plan/glm-5.3 --variant max --title b01-w13-hard-review-round1 -`；本提示词经 stdin 注入（文件哈希随 invocation 归档）；完整调用记录（argv/双流哈希/真实 exit/起止时间）在运行结束后归档于 `W13/review/`。请在证据中注明本轮为参数合规调用（argv 实际携带 `--variant max`）。
