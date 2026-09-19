# W12 候选 Manifest — 89dce53b80 相对 7f63d035

运行: B01-20260919-01 / W12。日期: 2026-09-19/20。执行者: ZCode（只读 Git 观测）。

## 1. 候选身份

| 项 | 值 |
|---|---|
| 候选提交 | `89dce53b805241d9ec38f8c8ea7bde1109dac4b4`（CP-A4，已在远端，STATUS 证据行） |
| 源码基线 | `7f63d03538759306f8363d5a912c1e99fbe015bf`（r48，formal-plan §1.1） |
| 差异总量 | `git diff --name-status 7f63d035..89dce53b80` = **338 文件（322 A / 16 M），+84,212 / −119 行** |
| 工作树 vs 候选 | 仅 `STATUS.run.json`、r48 `comment-draft.md` 两处已跟踪漂移（均为运行簿记/keep-local 面），**候选源码面零漂移**（`git diff HEAD --name-only` 复核） |
| 提交链 | f5ab2fed62(计划采纳,17 文件) → 6528141bc9(AGENTS 指令,1) → 8d0dc41139(CP-A,38) → 16ae3047dd(doc 预算,2) → 1863a0ddfd(CP-A2,16) → 1d412762eb(CP-A3,25) → 89dce53b80(CP-A4,256) |

原始清单: `C:\dsh-b01-w12\raw\diff-name-status-full.txt`。

## 2. 产品/测试源码面（development/ 之外，48 文件）

### 2.1 按工作包归属

| 工作包 | 文件 | 状态 | HEAD blob（实测） | 与 FINDINGS 终态一致性 |
|---|---|---|---|---|
| W01/W02（+W02 Linux 返工） | `scripts/prepare-ci-bubblewrap.sh` | M | `cf6f7a13811e7c0fdcabd6a74dd989d195c94af7` | = W01 rework-2 记录（cf6f7a13） |
| W01/W02 | `scripts/prepare-ci-bubblewrap.spec.ts` | M | （CP-A3 终态） | W02 返工 blobs 7c5dfc42 → CP-A3 提交态 |
| W01/W02 | `scripts/prepare-ci-bubblewrap-test-support.ts` | A | （CP-A3 终态） | W02 返工 blob 4558bf48 → CP-A3 提交态 |
| W04/W05（+W04 轮二） | `snapshots/sdk/sdk.snapshot.ts` | M | `1463e72a924fc1974e208c7946b30e200e0d2e21` | = W04 轮二自检记录（1463e72a） |
| W04 | `snapshots/sdk/teardown.snapshot.ts` | M | `911fc5fc092ccd93d33c797b8d8c655d48b76de0` | = W04 冻结交接（911fc5fc，+4 行 initializeTimeoutMs） |
| W04 轮一（win32 sidecars，4 文件） | `snapshots/sdk/{subagent-teardown,agent-team-teardown}/tool-schemas{,.1}.win32.expected.json` | A | — | 与 W04 F2 表（3b51e300×2 / e55ca1d0×2）核验见 §4 |
| W05（prompt sidecars，2 文件） | `snapshots/sdk/{…}/system-prompt.win32.expected.md` | A | — | 与 W05 F2（SHA-256 30580d96 / cbf4d28e）核验见 §4 |
| W04 轮二（default sidecars，6 文件） | `snapshots/sdk/{…}/tool-schemas{,.1}.default.expected.json` + `system-prompt{,.1}.default.expected.md` | A | — | 与 W04 轮二 §2 表核验见 §4 |
| W05 | `apps/cli/tests/profiles/headless/tests/subagent-diagnostic.expected.e2e.ts` | M | `0e1e6ffa218393f9e92654836e14705c36b1d9a9` | = W05 终态记录 |
| W11-F | `apps/cli/tests/profiles/headless/tests/headless.expected.e2e.ts` | M | `653c14f74d870b6be0af48b0bff709d16d4d69b8` | = W11-F 终态记录 |
| W11-F | `apps/cli/tests/profiles/headless/tests/fixtures/pi-ai-defaults.patch.yml` | M | `cf0ac2825c4dfd0316b44663ed3915068d91a8ca` | = W11-F 终态记录 |
| W06（fixture，3 文件） | `apps/desktop/tests/fixtures/b01-preview-{model.mjs,launch.mjs}`、`b01-preview.cordis.patch.yml` | A | — | formal-plan §3.5 预登记 N 路径 |
| W07（F5 修复面） | `apps/desktop/scripts/prepare-runtime.ts` | M | — | F4 修复（pnpm 子路径解析） |
| W07（F5 修复面） | `apps/desktop/scripts/runtime-file-policy.ts` | M | — | fs-ext 排除规则清理 |
| W07（F5 修复面） | `apps/desktop/src/project-manager.ts` | M | — | workspaceFile fs-ext allowBuilds 残留清理 |
| W07（F5 修复面） | `apps/desktop/tests/fixtures/runtime-payload-smoke.mjs` | M | — | checkFsExt → flockGate |
| W07（F5 修复面） | `apps/desktop/tests/runtime-file-policy.spec.ts` | M | — | 中性 native-sample fixture + NC |
| W08 | `docs/event-producer-consumer.zh.md` | M | `a612f9939a1c10eb8dad2196f0b18296e9fc12d1` | = W08 §6 终态 |
| W08 | `docs/event-producer-consumer.i18n.yaml` | M | `f720b5be0d9a5b61b09ace807ccf8a5c27c3935e` | = W08 §6 终态 |
| W08 | `scripts/event-producer-consumer-pair.spec.ts` | A | `a168c30a15197e80402ee9ec184b3d01463c17c4` | = W08 §7 返工终态 |
| 指令面（非工作包） | `AGENTS.md` | M | — | 6528141bc9（并行指令）+ 16ae3047dd（精简+预算）；owner 指令提交，STATUS 证据行在案 |
| 指令面（非工作包） | `scripts/doc-budgets.manifest.json` | M | — | 16ae3047dd 预算上限提升（W03 static 失败归因后的修复） |

### 2.2 明确不在候选中的源码面（负向核验）

- `vendor/`：0 文件。
- `.github/`（全部 workflow YAML）：0 文件。
- `packages/`：0 文件。
- `pnpm-lock.yaml`：无变化（blob 复核见 §3）。
- 密钥/凭据/`.env`/auth 类文件：0（唯一名称含 "AUTH" 的命中是计划包文件 `SCOPE_AND_AUTHORITY.md`）。

## 3. 保护面核验（应零；实测零 + 两项说明）

### 3.1 formal-plan §6 指纹表逐项复验（`git rev-parse 89dce53b80:<path>`）

| 路径 | 计划指纹 | 候选实测 | 判定 |
|---|---|---|---|
| `packages/subagent/tool-subagent-control/tests/owned-contexts.ts` | `7713e57d…` | `7713e57d18adab01b5ed4ceb59c08ebb66e3bfd5` | OK |
| `packages/core/agent/src/index.ts` | `17a35d1b…` | `17a35d1bf113e5dc2cbca4f0e3c1f940cab8ca07` | OK |
| `packages/core/agent-loop/src/index.ts` | `6df307be…` | `6df307bee573a93ddbf97a6dc87b86965a568c5f` | OK |
| `packages/core/agent-loop/src/agent.ts` | `321fc0c1…` | `321fc0c13625579711eb998c20a375402b3770b9` | OK |
| `packages/subagent/subagent/src/continuation-activation.ts` | `6b9968ba…` | `6b9968ba2dc47dd266ca86f48253a85697afc771` | OK |
| `packages/subagent/subagent/src/index.ts` | `f68fe09f…` | `f68fe09fc73c1e438c698f9de64296390d60745e` | OK |
| `packages/experimental/agent-team/src/index.ts` | `2ccbbe95…` | `2ccbbe95cafadf727ceb8c93376f8bd0a8e82bb3` | OK |
| `pnpm-lock.yaml` | `0ccbeeee…` | `0ccbeee70bc0477b81ae1f669f5e52d6c57d7bf0` | OK |
| `.github/workflows/ci.yml` | `c6b939a7…` | `c6b939a7b65be4df7287a28b31b045481d864dc8` | OK |
| `.github/workflows/ci-master.yml` | `5d7f4200…` | `5d7f420024ea423a67eb51d1c86b26ab5850ace5` | OK |
| `.github/workflows/e2e.yml` | `ecc2e77d…` | `ecc2e77d37f9f26bf3b237e243efceb89f832119` | OK |
| `.github/workflows/sandbox.yml` | `cdcb229a…` | `cdcb229ab0faf1e9bc0e6dceb88edf692b6d14ad` | OK（NOT_CLOSED 既有结论不变） |

r44 六文件 + r43 observer 涉及的 `packages/` 全域：diff 零命中（§2.2），即 r44 修复文件与 observer 字节对基线不变；上表逐 blob 复验为显式证据。

### 3.2 正式状态与运行文件

| 路径 | 结果 | 说明 |
|---|---|---|
| `development/nodes/P0-B/state.json` | **字节不变**（基线=采纳点=候选三读一致，`4fa1dd1ab8f34e620a14e83fe4c9c7beea12665f`） | formal-plan §3.6 表内指纹文本有一处 1 字符转写差（`…a14e83be4…` vs 实际 `…a14e83fe4…`，第 24 位 b/f）；文件本身自 r48 起未动，保护属性成立。登记为计划表转写勘误，非候选问题。 |
| `development/delivery-runs/B01/B01-20260919-01/STATUS.run.json` | 有变化（计划内 W 面） | 该文件在计划 §3.6 为 `W，仅真实状态更新`，由总控随 CP 提交演进（f5ab2fed 创建，CP-A/A2/A3/A4 各更新一次）；初始指纹 `4b3cbef7…` 是计划时点值。非保护面违例。 |
| `NODE_DEVELOPMENT_RULES.md` | `995d1d6b…` 不变 | OK |
| `RUN_CONTEXT.json` | `ef3c4d92…` 不变 | OK（候选内为创建态基线） |

### 3.3 keep-local（不进入候选）

工作树 4 个未跟踪项均为 r44/r47s 既有保留材料（formal-plan §1.1 判定沿用）：`development/remediation/2026-09-17/production-teardown-r44/planning/cli-availability-probe.md`、`review/BLOCKED-opencode-hard-review.md`、`windows-execution/01-first-failure.normalized.log`、`development/remediation/2026-09-19/ci-bubblewrap-acquisition-r47/windows-execution/r47s/`。另有本任务产物目录 `W12/`（未跟踪，按派发由总控并入 CP-F）。r48 `comment-draft.md` 为已登记修改项（deliverable_modified，STATUS/计划在案）。

## 4. 证据面（development/delivery-runs/B01/B01-20260919-01/，290 文件）

| 目录 | 文件数 | 归属 |
|---|---:|---|
| W01 | 17 | prepare 契约修复证据 |
| W02 | 39 | Windows 替身来源 + Linux 返工证据 |
| W03 | 8 | Linux 构建验收（CP-A/A2/A3 三轮） |
| W04 | 63 | 平台 sidecar 契约（轮一+轮二） |
| W05 | 19 | Windows cwd/expected 收口 |
| W06 | 40 | 桌面旅程（含 INCIDENT-1 返工） |
| W07 | 55 | 产物模式预览（含补采） |
| W08 | 12 | 双语事件表 |
| W09 | 5 | AC-01—32 盘点 |
| W10 | 1 | P0-B 准入 |
| W11 | 5 | CI 归类 |
| W11F | 21 | pi-ai 守护修复 |
| run-root | 5 | RUN_CONTEXT/STATUS/analysis-parallelization/plan×2 |
| （另）development/delivery-plan/ | 15 | f5ab2fed 计划包采纳（00-README 等 15 份） |

## 5. 组合完整性交叉核验（W12 补充）

关键源码 blob 与各包 FINDINGS 记录的终态身份全部一致（§2.1 右列 + 实测）：sdk.snapshot.ts=1463e72a、teardown.snapshot.ts=911fc5fc、prepare 脚本=cf6f7a13、headless.expected.e2e.ts=653c14f7、pi-ai fixture=cf0ac282、subagent-diagnostic=0e1e6ffa、W08 三件=a612f993/f720b5be/a168c30a。即：**CP-A4 整合提交携带的正是各包复核通过的终态字节，无中间态混入**。
