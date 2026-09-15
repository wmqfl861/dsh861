# r36 — 五项测试契约修复：证据索引

仓库 `wmqfl861/dsh861`，分支 `chore/latest-stable-upgrade-20260912`。起点提交 `9c81b5a15d24e7971e7629982aeb0be3ddf4eba5`（r35 终态；本地与远端 ls-remote 一致，工作树起点干净）。起始 blob 核验与 PR#13 执行说明 B 节完全一致：`scripts/test-proxy-environment.spec.ts=160e607a87c97326f997071c705d751a4532a3b6`、`scripts/preview-workflow.spec.ts=f3d14ce48456ef77ef6087c50b0f44a5c5aab0bd`、`scripts/ci-compatible-selfhosted.spec.ts=619ae192f9d3f79950473291e2399efe8952bdfb`、`scripts/tests/ci-release-selfhosted.spec.ts=ade0291f5fb7cb57111f2ca012c0bf450d1cce2f`、`packages/e2b/subprocess-e2b/tests/subprocess.spec.ts=c1f1a3e4d7316ec432a5e15ed5abd6ed8994032e`、`vitest.config.ts=f65397a84550d8ec72395857ea4e488b0eaddab9`（本轮保持不变）。工具链 Node v26.8.2 + pnpm 12.4.1（`C:\dsh-r24-upgrade-20260912-01` 显式 PATH），复用依赖；本轮唯一新工作目录 `C:\dsh-r36-20260915-01`（仓库外，负控脚本与其原始日志所在地）。完整执行说明（A–F 节）与远端取证报告经 api.github.com 无凭据读取成功；CI artifacts 34931728218 未下载（本机无 gh，按说明不要求重复取证，记 NOT_RUN）。

## 基线首失（真实 vitest 5.0.0 运行，先败后过；logs/01–05）

| 文件 | 入口 | 基线 |
|---|---|---|
| scripts/test-proxy-environment.spec.ts | `pnpm exec vitest run <file>` | exit 1，1 failed \| 6 passed：发现断言失败——`setupFiles: \[...\]` 正则漏掉 `setupFiles: testSetupFiles` 共享常量，`vitest.config.ts` 被过滤出发现清单且三槽完全逃出逐槽检查 |
| scripts/preview-workflow.spec.ts | 同上 | exit 1，1 failed \| 2 passed：`PRIMARY_NODE_VERSION` 期待 '24' ≠ workflow 实际 '26' |
| scripts/ci-compatible-selfhosted.spec.ts | 同上 | exit 0，4 passed \| 2 skipped（Windows 跳过两个 Bash 测试，**不算 Linux 通过**）；@v4→@v6 漂移位于跳过用例内，由 ci.yml 实测（`pnpm/action-setup@v6` 共 8 处、无 @v4）证实 |
| scripts/tests/ci-release-selfhosted.spec.ts | 同上 | exit 1，5 failed \| 74 passed：3× `pnpm/action-setup@v4` 的 dest 断言（expected undefined）+ 2× `actions/upload-artifact@v4` toMatchObject（pack 任务尾步） |
| packages/e2b/subprocess-e2b/tests/subprocess.spec.ts | 同上 | exit 1，1 failed：Vitest 5 报 "Promise returned by `expect(actual).rejects.toThrow(expected)` was not awaited" 于原 468 行 `void` 丢弃处 |

## 修复（最小改动；不改 workflow、不全仓替换 Node 版本；修复后 blob 见下）

1. `test-proxy-environment.spec.ts`（→ `f7cb4d72d0316f2f0776239f950f90c8ced3ee13`）：`declaredSetups()` 把每个 `setupFiles:` 槽解析为其命名的数组字面量——内联字面量或同文件 `const` 标识符的初始化式；无数组字面量声明的引用显式失败（含配置名与引用名）。五配置发现期待（含根配置）、逐槽包含 `TEST_PROXY_SETUP_FILE` 检查原样保留；未放宽为全文件出现检查。
2. `preview-workflow.spec.ts`（→ `b89a92521e6d9e9d1b458fdbeff065358efe2d12`）：仅 `'24'`→`'26'` 一行；构建/缓存/权限/部署/校验断言不动；release.yml 仍 Node 24（其测试从未断言该值）。
3. `ci-compatible-selfhosted.spec.ts`（→ `a138c389ebbe22b929399f362745b605d32d52a1`）：查找对齐 `pnpm/action-setup@v6`，先 `expect(pnpmSetupIndex).toBeGreaterThanOrEqual(0)` 断言存在再比顺序；隔离与缓存检查、两个 Windows skipIf 语义不动。
4. `scripts/tests/ci-release-selfhosted.spec.ts`（→ `eb21add9cba2d212c25e24956255f9594a437b2c`）：两处精确版本对齐（`pnpm/action-setup@v6`、`actions/upload-artifact@v7`）；`actions/cache/restore@v4` 现值保持；版本字符串匹配、缓存目录、安全分流、不可变安装、pack/verify 命令、retention-days 7 断言全部保留，未放宽为任意版本。
5. `packages/e2b/subprocess-e2b/tests/subprocess.spec.ts`（→ `56edbecb9b2b2e53445246e9d7d05dbc9736f44a`）：graceMs 用例改 `async`，逐项 `await expect(...).rejects.toThrow(...)`，删除 `void` 丢弃；四个非法值、同步 spawn 抛错、远程工作前拒绝语义不变；仅本地 FakeSandbox 设施，未连接 E2B。

## 修复后复测（logs/06–10、17）

五文件全部 exit 0：8/8（proxy，`vitest.config.ts` 三槽纳入后用例数 7→8）、3/3（preview）、4 passed + 2 skipped（cicompat，Windows 跳过如实计数）、79/79（release）、70/70（e2b）。lint 修复（arrow-parens + 缩进回归至 HEAD 的 4 空格）后对文件 1、3 复跑仍绿（logs/17：12 passed \| 2 skipped）。

## 负控（真实突变 + 真实 vitest 运行 + try/finally 字节恢复 + `git hash-object` 复验；logs/11、negative-controls.mjs）

| 突变 | 突变运行 | 恢复 |
|---|---|---|
| NC1 共享常量删除代理初始化项 | exit 1，逐槽检查失败可见 | blob = f65397a8… 一致，复跑绿 |
| NC2 一槽改名 `missingSetupFiles`（未知引用） | exit 1，报 "no array-literal const declaration" | 同上 |
| NC3 process-bound 单项目改列不含代理项的自有数组（单项目断接） | exit 1，该槽失败 | 同上 |
| NC5 重新引入 `void` 丢弃 rejects 断言 | exit 1，"was not awaited" | spec blob 复验一致，复跑绿 |

四项判定 PASS：每个突变必失败、每次恢复字节一致、恢复后全绿；工作区仅余五 spec 修改，`vitest.config.ts` blob 终态仍为 `f65397a84550d8ec72395857ea4e488b0eaddab9`。

## 回归与门禁（先败后过，首失留存）

| 项 | 结果 |
|---|---|
| `scripts/vitest-project-inheritance.spec.ts`（r35 接线回归） | exit 0，3/3（logs/12） |
| `pnpm run typecheck` | exit 0（logs/13） |
| `pnpm run lint` | 首次 exit 1：本轮新代码 7 错（1× arrow-parens、6× 缩进，logs/14 首失留存）；修复后 exit 0，0 警告 0 错误（logs/16） |
| `pnpm run duplication` | exit 0，0 clones（logs/15） |
| `pnpm run test:docs` | exit 0，16 passed（logs/18 Note/证据落盘前；Note、FINDINGS.md 与全部证据文件落盘后终验 exit 0、16 passed，logs/20） |
| 中英 Note 配对 | `verify-translation-pairing --write` exit 0（logs/19） |

Agent Note：`.agents/notes/implemented/testing/2026-09-15-test-contract-alignment-r36.md`（+ `.zh.md` + `.i18n.yaml`）。

## 未执行（NOT_RUN，按红线）

CI artifacts 34931728218 未下载（本机无 gh、不安装不建）；完整插桩 coverage、全部 Web 矩阵、Linux 通道、e2e/真实 API/E2B 均未运行——文件 3 的两个 Bash 用例与文件 5 的 Linux 行为由 CI 通道最终判定，本轮 Windows 跳过数如实记录；未读生产 Key/全局认证/用户 .env；未改模型配置/provider/endpoint/思考等级/credentialRef/P0-B state/锁/pkg 补丁/workflow；未降覆盖率阈值、未扩排除；未安装 gh、未重装升级、未改认证与系统设置；未合并 PR、未进入 P0-C、未验收 P0-B。首批修复通过不等于完整 coverage 或升级阶段通过。

## P1 整改：证据物化（独立复审后）

独立复审判定：logs/01–19 与 negative-controls.mjs 共 33 个文件在首次 shell 重定向写入后呈"幽灵"态（枚举可见、读取失败），仅 FINDINGS.md 与 logs/20 真实。整改：以 Node 原生 fs 从 `C:\dsh-r36-20260915-01` 原件重新物化 33 文件（同上声明规范化，写入后同进程 readFileSync 回读字节一致，logs/21）；全新进程复验 35/35 字节一致（logs/22）；主机级（非沙箱）`ls` 逐文件可见非空 35/35、`git hash-object` 逐文件可读 35/35 且哈希入清单（logs/23）。整改验证件（21–23）亦经同一 Node 物化路径入盘，最终证据树为 38 个 logs/ 文件 + 本 FINDINGS.md。五 spec、Note 内容与 logs/20 未触碰。

## 清理与状态

`C:\dsh-r36-20260915-01` 为仓库外工作目录，仓内无临时残留；负控突变全部恢复并经 blob 复验。入库前对捕获日志做一次字节规范化（仅去行尾空格与 EOF 空行，与 r34/r35 先例一致），其余内容与捕获时一致；负控脚本 `negative-controls.mjs` 原样入库以便复现。独立全新上下文复审由主会话派发；提交/推送仅在复审 PASS 后进行。
