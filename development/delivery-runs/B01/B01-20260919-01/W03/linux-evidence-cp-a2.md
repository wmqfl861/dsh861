# W03 — CP-A2 轮：真实 Linux 构建与安全准备验收（run 35447649954）

轮次：CP-A2（rework 整合提交 `1863a0ddfd…`）。承接 [CP-A 轮证据](linux-evidence.md)（run 35445600344）。观察窗口：2026-09-19T14:05Z – 14:22Z。方法与限制同前轮（无凭据 REST；日志匿名不可读；步骤级 API + 注释 + 字节核验）。

## 1. Run / checkout 身份（API 实测）

| 项 | 值 |
|---|---|
| CI run | `35447649954`，run_number **41**，attempt 1，event `pull_request`，14:04:58Z → 14:19:21Z，conclusion **failure** |
| PR head / base | head `1863a0ddfdefdfdaa4f3b6d6314b042a22f01b62`（=CP-A2）；base `5434305c…` 不变；PR #13 仍 draft |
| CI checkout | merge commit `158a9cdbdcdf6aebf8b78b071b96c7a72b80f323`（`refs/pull/13/merge`） |
| merge tree blob 核对 | `prepare-ci-bubblewrap.sh` `cf6f7a13`、spec `1ab9fed9`、test-support `af3d9dcd`、`ci.yml` `c6b939a7`、`sandbox.yml` `cdcb229a` —— **全部与本地 HEAD 一致，保护指纹不变** |
| runner | GitHub 托管 ubuntu-24.04 |

CP-A2 脚本 diff（对 CP-A）仅一处：链接证据检查接受两种形态——`-L<private> … -lcap` 或绝对 `<private>/libcap.a` 操作数。其注释记录了 run 35445600344 的真实链接形态（`[7/7] cc … <private>/libcap.a`），**确证 CP-A 轮失败点即链接证据 grep**（下载/审计/契约/meson/编译/链接在 CP-A 轮均已走到）。

## 2. 两条原 Linux 作业：准备管线全通过（A3 构建面达成）

### 2.1 `node 24 / coverage`（105909256819）— 作业级 failure，**准备 SUCCESS**

- 步骤 9 "Install dependencies and prepare bubblewrap"：14:05:19 → 14:05:36（**success**，17s）。
- 步骤 10 "Run exhaustive coverage"：14:05:36 → 14:19:11（13m35s，failure）；步骤 11 gate-evidence 上传 success。
- 脚本自校验结构下 exit 0 ⇒ 下载+hash、逐字段 dpkg 契约、tar/deb 审计、私有 libcap pc/pkg-config、Meson setup/compile、`[7/7]` 链接（两形态证据）、ELF elf64-x86-64、NEEDED 无 libcap、ldd 无解析、`bubblewrap 0.12.0`、binary hash 记录、sysctl+功能 probe、`$GITHUB_PATH` 发布**全部通过**（任一失败脚本即 exit 1）。

### 2.2 `node 24 / snapshots and artifacts`（105909256654）— 作业级 failure，**准备 SUCCESS**

- 步骤 10 "Install dependencies and prepare bubblewrap"：14:05:22 → 14:05:37（**success**，15s）。
- 步骤 11 Playwright 安装 success；步骤 13 "Run compatibility, snapshot, and artifact gates" failure（14:05:58 → 14:08:09，2m11s）；步骤 14 gate-evidence 上传 success（artifact id `10586416150`，9,145 bytes）。

### 2.3 预期复绿确认

- `node 24 / static` = **success**（14:05:01→14:08:18；run40 为 failure → `16ae3047` doc budgets 修复兑现）。
- `windows node 24 / observational` = **success**（run40 为 failure → 克隆去重修复兑现）。
- 其余 success：benchmarks、node 22.19/24.9/26、python 3.10 SDK、python runtime matrix×4、windows native/build。
- **failure（3+汇总）**：两条 Linux 作业（均卡后续 gates，非准备）、`windows node 24 / coverage`（预期内，W11）、`all checks passed`（随动）。

## 3. W03 卡逐项核对（CP-A2 轮结论）

| # | 检查项 | 结果 | 证据 |
|---|---|---|---|
| 1 | 三输入真实下载 + 固定 hash | **通过** | 准备步骤 exit 0（脚本内 sha256 校验任一失败即 exit 1）；另验证者 vantage 三输入 hash 精确匹配（CP-A 轮记录） |
| 2 | 真实 dpkg 单字段输出与退出状态 | **通过** | 同上（三字段任一异常即 exit 1）；CP-A 轮已证越过契约块 |
| 3 | Meson setup / compile / 链接 | **通过** | exit 0 + CP-A2 注释确证 CP-A 轮已到 `[7/7]` 链接 |
| 4 | 私有 libcap 路径、静态链接事实 | **通过**（两形态链接证据之一，绝对 `libcap.a` 操作数形态） | 脚本链接证据检查 exit 0 |
| 5 | ELF 架构 / NEEDED / ldd / 精确版本 0.12.0 / binary hash | **通过**（脚本断言级） | objdump/ldd/version 检查任一失败即 exit 1；binary hash 逐次记录（不同 runner 不宣称可复现） |
| 6 | 功能 probe 实际执行、失败不发布 PATH、成功后才发布 | **通过**（脚本断言级） | probe 在 GITHUB_PATH 发布之前，exit 0 ⇒ probe 通过后才发布；后续步骤（Playwright/coverage gates 13m35s）在发布后的 PATH 环境中运行 |
| 7 | 任务私有目录 / 重复运行 / 环境污染 | **部分**：两条并行作业同 run 各自 exit 0（任务私有目录机制经脚本结构 + 注释中 `/home/runner/work/_temp/dsh-prepare-ci-bubblewrap-*/run-*/` 实例佐证）；无污染迹象（无宿主库回退/旧 pin 回退信号）；日志级环境逐项核查不可匿名进行 |
| 8 | 无宿主库 fallback / 无旧 pin 回退 | **通过**（断言级） | 链接证据 + NEEDED/ldd 无 libcap + PKG_CONFIG_LIBDIR 限制均经 exit 0 验证 |

**限制说明**：以上"通过"的证据等级为"脚本自校验 + 步骤 exit 0 + 失败会致命的结构推理"，日志逐行文本（如 `bwrap link command:`、NEEDED 列表原文）匿名不可读；如需逐行抄录，由总控凭既有权限下载本 run 日志。

## 4. 后续 gates 阶段失败（与准备分开归类）

### 4.1 coverage lane（annotations 实录，8 条）

- **`scripts/prepare-ci-bubblewrap.spec.ts` 在真实 Linux 上 4 处失败**（W01→W02 家族owned 面，回派）：
  - `Error: stub-source check failed: command -v uname resolved to '' (probe status null), expected '…/dsh-prepare-ci-bubblewrap-W0Z4WT/run-EdSAjV/bin/uname'; refusing to run the script against host commands`（runScenario，出现 2 例、不同 run 目录 EdSAjV/VLsLYQ）——W02 替身来源守卫在真实 Linux runner 上把替身探针判为失败（probe status null ⇒ 探针子进程未成功执行或输出为空）；
  - `spec.ts:907`：`expected +0 to be 1`；
  - `spec.ts:787`：调用序列 deep-equal 失败，diff 落在 `dpkg-deb` 相邻条目。
- 无关面（W11 归类）：`packages/terminal/terminal-bash/tests/local.spec.ts:333`（`expected '' to contain 'dsh> '`）；`packages/experimental/code-runtime-python/tests/runtime.spec.ts:5`（60s wall-clock timeout）；覆盖率阈值/短缺明细在 gate-evidence artifact `10586561821`（194,205 bytes）。
- 归类：**已登记文件（spec/test-support）在 Linux 的新增缺陷 → 返派 W02 家族**（W11 规则同样指向）。注意这些失败不影响 §2 准备管线结论：spec 是对脚本的 Windows/替身单测面，CI 中准备脚本本体已两路通过。

### 4.2 consumers lane

- `apps/cli/tests/profiles/headless/tests/headless.expected.e2e.ts:572`：`expect(server.requests).toHaveLength(2)` 得 5（'sends pi-ai DeepSeek compatibility through the one-shot app'，本地 stub server 多收 3 个请求）。不在 CP-A2 改动面；本分支无 CI 基线（run39/40 未到此步）。→ W11 归类（不排除 runner 代理环境/重试；未证）。
- 明细在 gate-evidence artifact `10586416150`（9,145 bytes）。

### 4.3 Windows（记录不展开，按指示）

- `windows node 24 / coverage` gates failure；annotations：`packages/typert/generator/tests/tools-catalo…` `Test timed out in 30000ms`。明细 artifact `10585476793`（42,464 bytes）。→ W11。

## 5. A3 判定

- **A3 构建面（两条原 Linux 准备、下载/hash/契约/Meson/编译/链接/ELF/NEEDED/ldd/版本/probe/PATH）**：**通过**（run 35447649954，两路准备步骤 exit 0）。
- **A3 安全分项**：仍 **NOT_RUN** —— 脚本 `-Dtests=false`，上游 0.12.0 源码的修复相关安全测试未在任何既有通道执行；普通 `true` probe 不构成安全回归证据（D13）。本次 run 亦无可用的安全执行通道证据。
- `sandbox.yml` 独立 apt 入口：**NOT_CLOSED**（blob `cdcb229a` 未变）。
- **整体 A3**：按 formal-plan §5.2 的判据（需两条准备+链接/ELF/hash/probe+安全分项），构建面齐备、安全分项缺 → **A3 仍未满足（安全分项 NOT_RUN）**；是否以"精确阻塞"形式交付该分项由总控按计划裁定。

## 6. W04 的 Linux 侧解锁信息（F4.2/F4.3）

- consumers lane 的 sdk snapshot 通道已**真实运行**（准备通过后 gates 执行 2m11s；sdk snapshot 属 `snapshotGate(validatedBuild)`，与 expected-output 并列）。
- surfaced 失败注释仅 expected-output 一项（headless pi-ai）；**未出现 sdk snapshot/sidecar 断言注释 —— 提示 F4.2/F4.3 的 Linux sidecar 比较很可能通过，但非结论性**（注释提取可能截断）。
- **权威判定源**：gate-evidence artifact `10586416150`（9,145 bytes，name `gate-evidence-node-24-consumers-run35447649954-attempt1`）——匿名下载 401，需总控下载后按 gate 表确认 `snapshot` gate 结论。若 snapshot gate 为 passed，W04 的 F4.2/F4.3 即解锁（Linux 完整比较已跑）。
