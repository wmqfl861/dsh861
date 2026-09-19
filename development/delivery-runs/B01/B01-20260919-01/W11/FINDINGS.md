# W11 FINDINGS — run 35447649954（run 41，attempt 1，checkout 158a9cdb）最新 CI 全貌归类

## F1 — run 身份与证据完整性（确证）

CI run 35447649954（number 41，pull_request，PR #13 head `1863a0dd` / base `5434305c`，merge checkout `158a9cdb`，ubuntu-24.04，node 26.9.0，pnpm 12.4.1）。两份 gate-evidence 的 identity/manifest 与 W03 记录一致（coverage aggregate-stdout 保留 1,048,064/1,140,173 bytes，截断 92,109 已按原样保留声明，不称完整输出）。B01 候选 diff（`7f63d035..1863a0dd`）产品面仅 `scripts/prepare-ci-bubblewrap.sh`、`scripts/prepare-ci-bubblewrap.spec.ts`、新增 `scripts/prepare-ci-bubblewrap-test-support.ts`、`scripts/doc-budgets.manifest.json`；无任何 `packages/`、`apps/` 改动 —— 这是本轮全部"是否本阶段引入"判定的基线。

## F2 — 作业级红/绿清单（本 run 为准）

红（4）：`node 24 / coverage`（gates 步骤）、`node 24 / snapshots and artifacts`（gates 步骤）、`windows node 24 / coverage`（gates 步骤）、`all checks passed`（汇总随动）。
绿：`node 24 / static`（16ae3047 兑现）、`windows node 24 / observational`（克隆去重兑现）、benchmarks、node 22.19/24.9/26 矩阵、python 3.10 SDK、python runtime 矩阵×4、windows native/build。
两条 Linux 作业的 bubblewrap 准备步骤均 success（A3 构建面，W03 已结论，不重述）。
E2E：无 key 跳过（预期）。issue-lifecycle/issue-policy/build-preview-cloudflare 三个旁路 workflow 在 run 41 的状态本轮无证据（run 40 为 failure，W03 F11）；留待需要时由总控取 run 41 对应作业，不计入本台账。

## F3 — 失败逐项归类（6 项测试失败 + 1 组阈值 + 1 组连坐，详表见 failure-ledger.md）

coverage lane（job 105909256819，test:coverage gate，814.2s，4 分区全部执行完毕）：
- `scripts/prepare-ci-bubblewrap.spec.ts` 4 处断言/错误（:663×2 stub-source probe status null、:787 调用序列 dpkg-deb 相邻 diff、:907 expected 1 got 0）→【本阶段引入·W02 已登记文件】→ 已回派 W02（W03 A2-4），本轮不重复派。
- `packages/terminal/terminal-bash/tests/local.spec.ts:333`（`created.motd` 为空，未含 `dsh> `；hold:false 变体失败、hold:true 通过）→【本分支既有】断言失败；pwsh-on-Linux 时序敏感。
- `packages/experimental/code-runtime-python/tests/runtime.spec.ts:5158`（O(depth) 宽完成值，60s wall-clock 超时 `{kind:'timeout', message:'wall-clock ceiling reached (60000ms)'}`；姊妹用例 35.9s 通过）→【上游环境·本分支既有敏感性】超时类，4-CPU 满载分区并发。
- coverage 阈值 67 文件短缺 →【本分支既有】结构 + GUI 债，见 F5 与 coverage-gaps.md。

consumers lane（job 105909256654）：
- `test:expected` gate 失败，唯一失败 `headless.expected.e2e.ts:572` pi-ai（2 vs 5，26,374ms；其余 30 用例全过）→【本分支既有·环境敏感 flake 家族】定性链见 pi-ai-classification.md。
- fail-fast 连坐 4 gates skipped（lint-and-duplication、test:snapshot、web-snapshot、built-bin-smoke）→ 非独立失败，根因=pi-ai。**更正 W03 A2-7/§6 的"已真实运行"表述**：gate-results.json 明确 `snapshot` gate 为 `skipped: aborted by fail-fast`，W04 F4.2/F4.3 的 Linux sdk snapshot 判定源在 run 41 并未执行。

Windows coverage（artifact 10585476793 未下载）：annotations 仅 `packages/typert/generator/tests/tools-catalog.spec.ts` `Test timed out in 30000ms` →【本分支既有敏感性·超时类】（typert 最后变更 `a7d4cd8e1b` 前 B01；run 39 Windows 27 失败全在 prepare-spec、无 typert → 属新浮现但无相关源变更；Windows observational 绿说明 W02 修复未回退）。文件级判定待 artifact。

## F4 — pi-ai 定性结论（最高优先，详证 pi-ai-classification.md）

**本分支既有，非 B01 引入。** 要点：B01 diff 零 `packages//apps/` 改动；pi-ai 场景测试体、`pi-ai-defaults.patch.yml`、`packages/llm/llm-pi-ai`、lockfile 在"最后一次 Linux 通过（run 14，head ccc5aa51，2026-09-13，30/31 过、pi-ai 过）"至本次失败之间字节不变；差异仅为环境（node 26.8.2→26.9.0、runner 镜像）与其余应用提交（仅 r44 `9f27326b07` 触 core agent-loop teardown，非 title/retry 面）。失败机制属 r29 已立案的"幻影请求=STREAM_IDLE_TIMEOUT 重试"家族（同文件姊妹场景 run 14 即 2 vs 3）。最早可追溯的 pi-ai 自身失败即本轮 run 41；本分支无 CI 绿基线（见核验）。最小修复路径建议已给出（证据先行，r29 同款；不在 B01 FILE_OWNERSHIP，需总控登记）。

## F5 — coverage 67 文件短缺归因（详证 coverage-gaps.md）

67 文件全部非 B01 登记面（B01 只改 `scripts/`，coverage include glob 为 `packages/*/*/src/**`，scripts/ 不参与门禁）。非"未执行/分区失败"造成：4 分区全部完成，6 个失败测试位于 scripts/terminal/code-runtime-python，与 67 文件无覆盖贡献关系。构成：60 个 client UI 嵌套文件（vitest.config.ts 的 GUI 债豁免 glob 为单层 `src/client/*`、`src/*`，未覆盖 `contract/ conversation/ input/editor/ queue/ skeleton/` 及 ui-trajectory/src/client/ 子目录；ui-tool/ui-layout 无豁免条目）+ 7 个 core/experimental 文件（agent-loop、scope invariant、agent-team×2、goal、subagent×2，未覆盖行集中在 r44 teardown/continuation 路径）。豁免 glob 在 base `5434305c` 已同形 → 本分支既有结构性短缺。

## F6 — 本阶段新代码覆盖缺口判定

无 CI 可测缺口：prepare spec/support 在 scripts/（门禁外，功能缺陷已回派 W02）；sidecar（`snapshots/sdk/sdk.snapshot.ts`、`teardown.snapshot.ts` 修改未提交）、desktop fixtures（`apps/desktop/tests/fixtures/b01-preview-*` 未跟踪）、`scripts/event-producer-consumer-pair.spec.ts`（未跟踪）均不在 run 41 候选内 —— 归类为"尚未进入 CI"，其覆盖判定属 W12 整合后的重跑，不得预先标"历史问题"。

## F7 — 需总控下载的 artifact 清单

1. run 35447649954 windows coverage gate-evidence artifact `10585476793`（42,464 bytes）—— Windows 文件级失败明细（annotation 有 10 条上限，需确认是否有隐藏失败）。
2. （可选，用于 pi-ai 修复前取证）run 41 consumers 作业原始日志中 `test:expected` 的完整 vitest 输出已由 `job-a2-snapshots.log` 覆盖；如需 run 14 原始日志复核 30/1 计数，需另行凭据下载（本轮以 r29 verification.json 留痕为准，未列为必需）。

## F8 — 与交付目标的关系

- A3（安全分项）不变：NOT_RUN（W03 结论，本轮无新证据）。
- W04 Linux 侧：仍阻塞于 pi-ai 失败的 fail-fast 连坐（test:snapshot 未运行）——pi-ai 修复是解锁前提。
- W02 回派的 4 处 Linux 失败是 B01 内唯一"本阶段引入"缺陷群；其余全部为本分支既有或环境类，进统一台账，不开启无界修复。

## CP1 corrections folded in (controller, per W11 CP1 accepted)

- N1: G6 mechanism restated - the 30s is the test-local { timeout: 30_000 } per-test option (tools-catalog.spec.ts:20, pre-B01), which overrides the gate 90s budget on BOTH platforms; the real difference is machine speed against one pinned budget, not a cross-platform timeout asymmetry. This strengthens the pre-B01/environment-sensitive classification.
- N2: 'typert last change a7d4cd8e1b' refers to the failing TEST FILE; the typert package-level last change is 93959964c2 (also pre-B01). Both support the conclusion.
- N3: 00-start recorded HEAD=1863a0dd; by W11 write time HEAD was already 1d412762eb (CP-A3). All substantive claims are hash-pinned; timeline noted.
- N4: formal-plan names ci-matrix.md/failure-register.md; delivered as FINDINGS F2 + failure-ledger.md (W09 renaming precedent). Name mapping recorded.
- G6 final classification (closed via artifact 10585476793): single typert tools-catalog timeout, 1 annotation only, no hidden failures, coverage gate skipped by fail-fast. Pre-B01 pinned per-test budget x slow Windows runner; not B01-introduced.
