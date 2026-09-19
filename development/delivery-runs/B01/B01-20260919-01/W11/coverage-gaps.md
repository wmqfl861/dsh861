# W11 coverage-gaps — run 41 coverage 阈值短缺归因（67 文件）

证据：`C:\dsh-b01-w03\gate-evidence-coverage\aggregate-stderr.log`（198 条 `ERROR: Coverage for … does not meet global threshold (100%)`，唯一化 67 文件）；`aggregate-stdout.log` 尾部 uncovered-locations 明细（截断 92,109/1,140,173 bytes，保留部分含 agent-team/lifecycle、subagent/continuation-activation 等行级明细）。

## 1. 是否由未执行/分区失败造成 —— 否

- `DSH_COVERAGE_PARTITIONS=4` 四个分区全部执行完毕（分区汇总：p1 `1 failed|6177 passed`、p2 `4 failed|5521 passed`、p3 `1 failed|6204 passed`、合计 `6 failed|23174 passed|48 skipped`；merge 由 `scripts/run-coverage-partitions.ts` 完成）。
- 6 个失败测试所在文件（`scripts/prepare-ci-bubblewrap.spec.ts`、`packages/terminal/terminal-bash/tests/local.spec.ts`、`packages/experimental/code-runtime-python/tests/runtime.spec.ts`）与 67 短缺文件无覆盖贡献关系（不同包；scripts/ 不在 coverage include 内）。失败测试已执行的代码仍计入覆盖。
- 48 个 skipped 用例属各套件自声明 skip（如 Windows 专属/无 key），非本 run 分区失败所致。
- 结论：67 文件短缺是候选的结构性/历史性状态，在本 run 任意复跑都会同样出现；不是"本 run 特有的未执行"造成。

## 2. 67 文件构成与结构根因

### 2.1 client UI 60 文件 —— 豁免 glob 单层化缺口（结构性）

`vitest.config.ts` 的 `coverage.exclude` GUI 债豁免为单层 glob：`packages/client/ui-conversation/src/client/*`、`packages/client/ui-trajectory/src/*` 等。`*` 不匹配子目录，故以下嵌套树仍被插桩并按每文件 100% 门禁：

- ui-conversation：`src/client/contract/{snapshot,system-prompt}.ts`、`src/client/conversation/{assembler,assembly,definition-registry,event-registry,historical-images,location-index}.ts`、`src/client/input/{blocks,decorations,facade,hub,machine}.ts`、`src/client/input/editor/{DecoratorPortals,ReferenceChip}.tsx + {claim-decor,keymap,projection,reference-activation,span-map,text-ref}.ts`、`src/client/queue/QueueDock.tsx`、`src/client/skeleton/{ContextMeter,ConversationRoot,ConversationSession,EmptyHero,InputBar,PermissionSelect}.tsx`（28 文件）
- ui-layout：`src/client/index.ts`（该包无豁免条目）
- ui-tool：`src/client/tool/{ToolCallTree.tsx, components/ToolRow.tsx, models/*(10), toolviews/*(4)}`（15 文件，该包无豁免条目）
- ui-trajectory：`src/client/*`(16 文件) —— `src/*` 豁免只挡住 src 顶层，未挡 `src/client/` 子树

该配置在 base `5434305c` 已同形（`git show 5434305c:vitest.config.ts` 含同一豁免集），最后相关变更 `29626e8d96`（r35，早于 B01）→ 本分支既有。

### 2.2 core/experimental 7 文件 —— 真实分支缺口（历史路径，不折算等权百分比）

`packages/core/agent-loop/src/index.ts`、`packages/core/scope/src/invariant.ts`、`packages/experimental/agent-team/src/{index,lifecycle}.ts`、`packages/goal/goal/src/index.ts`、`packages/subagent/subagent/src/{continuation-activation,index}.ts`。

uncovered 行集中在 teardown/continuation 路径（如 `agent-team/src/lifecycle.ts:55` 分支、`subagent/src/continuation-activation.ts` 233–935 多处），形态与 r44 `9f27326b07`（transactional teardown ownership，2026-09-17，早于 B01）及其前序 r40–r46 工作吻合；均为本分支既有覆盖债。按指令：历史路径只进台账给根因群与后继责任，不给逐文件等权百分比（stderr 原始百分比可供后续阶段直接取用，不在此复制为达标目标）。

## 3. 与本阶段（B01）修改的关联 —— 无

- B01 产品面 diff 仅 `scripts/prepare-ci-bubblewrap{.sh,.spec.ts,-test-support.ts}` + `scripts/doc-budgets.manifest.json`；coverage include 为 `packages/*/*/src/**`，scripts/ 不参与门禁 → B01 新代码不可能出现在 67 清单，也无法造成清单变化。
- 67 数量与 BASELINE 记录的"历史 67 文件"一致；本地无 pre-B01 逐文件清单可做字节级集合比对（BASELINE 引用的 run 39 Windows artifact 10582621667 未在库内存档明细），本轮以构成结构性解释 + 计数一致 + 配置时序三方证据支持"同一历史集合"判定；如需逐文件比对，可下载该 artifact 复核（非必需）。

## 4. 本阶段新代码是否有真实分支缺口

- prepare spec/support（已入 CI）：无阈值面可测（scripts/ 在 include 外）；其功能缺陷（4 处 Linux 断言）已回派 W02，属行为面非覆盖面。
- sidecar：`snapshots/sdk/sdk.snapshot.ts`、`snapshots/sdk/teardown.snapshot.ts` 为未提交工作区修改 —— 不在 run 41 候选，无 CI 覆盖证据；不得预先标"历史问题"，W12 整合后按新 run 判定。
- desktop fixtures：`apps/desktop/tests/fixtures/b01-preview-{launch,model}.mjs`、`b01-preview.cordis.patch.yml` 未跟踪，同上。
- event-pair spec：`scripts/event-producer-consumer-pair.spec.ts` 未跟踪（且 scripts/ 在 coverage 门禁外），同上；其门禁面是 `pnpm run test` 单测行为，属 W08/W12 验证范围。
- 结论：**本阶段新代码在现有 CI 证据下无可归因的真实分支缺口清单（空）**；三项未提交面留待 W12。

## 5. 后继责任

- 60 个 client UI 文件：后续阶段结构化补齐豁免 glob 或补 jsdom/browser 级测试（B01 不扩大 exclude、不降阈值）。
- 7 个 core/experimental 文件：后续阶段按 r44 teardown/continuation 语义补真实分支测试（回派对象为对应包的后续工作，非 B01 工作包）。
- W12：整合 sidecar/desktop fixtures/event-pair 后重跑受影响门禁，按新 run 归类，不得引用本文件百分比。
