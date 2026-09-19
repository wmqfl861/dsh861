# r34 — Chokidar 写稳定候选真实 Windows 验证：证据索引

仓库 `wmqfl861/dsh861`，分支 `chore/latest-stable-upgrade-20260912`。取件提交 `33d82004f536bf54881e2f96f07ac06a541fa398`（父 `b6b7c7585dfbe537653846711d36c694b524783e`，fetch 后核对，工作树起点干净，`--ff-only` 快进，未 reset/强推/stash/重复 clone）。任务文件 blob `140121cdae31f0e6860cf07ef6c53169be2c3a33`、候选 spec blob `07fef9ee2ffb9fb32c8c3a2fdf760048f5a1eb69`，均与交接一致。工具链 Node v26.8.2 + pnpm 12.4.1（`C:\dsh-r24-upgrade-20260912-01` 显式 PATH），复用既有依赖，未升级/重装。根 `.env` 不存在（仅查存在性，未加载任何生产认证）。本机无 gh（按红线不安装、不索取 Token、不读 GCM/全局认证）——原 CI ZIP 未取得，按任务许可以已核验摘要（verification.json artifact 节）继续定向复现，如实记录 NOT_RUN。

## 真实验证（logs/01、02）

`pnpm exec vitest run packages/experimental/webworker-runtime/tests/node/chokidar.spec.ts`（仓库正常 vitest.config.ts，未改配置）：exit 0，2 个测试文件通过（thread-safe + process-bound 两 project 各 1），28 用例通过（每 project 14 = Chokidar 4（settings/credentials 消费方）×7 + Chokidar 5（skill-filesystem 消费方）×7）。verbose（logs/02）逐条确认两夹具两 project 全部执行，含 CI 失败用例 `waits for a write burst to stabilize before publishing one add` 与新增控制用例 `publishes a later stabilized write as change instead of suppressing it`。受控时钟下：`watchWriteFinishWithClock` 内 fake 时钟（仅 Date/setTimeout/clearTimeout/setInterval/clearInterval，nextTick/queueMicrotask/setImmediate 原生）先 `advanceTimersByTimeAsync(0)` 再等 ready；add 读到完整 `abc`（异步 stat 路径真实执行）；事件断言按 30ms/5ms 原值；afterEach 在恢复真实时钟前关闭全部 watcher。真实时钟用例（fs.watch 生命周期、watchFile 轮询、atomic 归一、close 静默）在同文件内随后运行且全部通过。

## 负控（真实突变，logs/03→04；非 polling 模型替代）

1. 基线三重核验（blob `07fef9ee…`、SHA-256 `4d9b1169…`、10309 字节，与 verification.json afterBlob/afterSha256/afterBytes 一致）后备份至 `C:\dsh-r34-20260915-01\chokidar.spec.ts.baseline-backup`（本轮唯一新工作目录）。
2. 最小突变：仅 `watchWriteFinishWithClock` 内 `awaitWriteFinish: { stabilityThreshold: 30, pollInterval: 5 }` → `awaitWriteFinish: false`（一行）。
3. 首失（logs/03，exit 1，已保留）：8 failed | 20 passed——两条写稳定用例 × 两夹具 × 两 project 全失败；`AssertionError: expected [ 'add' ] to deeply equal []`（真实安装包未等待稳定即发 add，"稳定前无事件"断言被证伪）与 `expected [ 'add', 'change' ] to deeply equal [ 'add' ]`。其余 20 条真实时钟用例不受影响。
4. 恢复原字节（备份回写），复核 blob `07fef9ee…`/SHA-256 `4d9b1169…` 一致；复验（logs/04）：28/28 通过，exit 0。

## 污染与残留检查

- 4 份 vitest 日志（logs/01–04）grep `unhandled|rejected|leak` 均为 0；vitest 对未处理拒绝会判失败，均正常退出（exit 0，约 2s 收尾）。
- fake 时钟用例之后运行的真实时钟用例（含 close 静默）每次运行通过；afterEach 按"先关 watcher 再 `vi.useRealTimers()`"次序清理，`openWatchers` 清空。
- 无计时器泄漏迹象：无挂起进程、无超时报告；未追加任意长 sleep、未改 90000ms/并发预算/测试超时。

## 门禁（先败后过，首失保留）

| 门禁 | 首次 | 复测 |
|---|---|---|
| `pnpm run typecheck` | logs/05 exit 0 | logs/11 exit 0（整改后复跑） |
| `pnpm run duplication` | logs/07 exit 0（0 clones） | — |
| `pnpm run lint` | logs/06 exit 1：oxlint `typescript(no-invalid-void-type)` 于候选新增行 chokidar.spec.ts:126 `onceEvent<void>(watcher, 'ready')` | logs/09 exit 0（0 warning 0 error） |
| `pnpm run test:docs` | logs/08 exit 1：translation pairing（新 Note 配对未录） | logs/13 exit 0（16 过 0 败）；handoff 更新后终验 logs/14 exit 0（16 过 0 败） |

### 最小整改（不改规则、不放宽、不动产品源码）

- lint 首失根因：远端 Git Data API 候选未跑本地门禁，其新增 helper 用了显式 `<void>` 泛型实参，触发仓库 oxlint 规则。整改仅一行：`const ready = onceEvent<void>(watcher, 'ready')` → `const ready = onceEvent(watcher, 'ready')`（推断 `Promise<unknown>`，与同文件既有 ready 等待写法一致，语义等价）。整改后重跑 vitest（logs/10：28/28，exit 0）、lint（logs/09）、typecheck（logs/11）。
- Note 配对按任务点名命令生成：`pnpm run verify-translation-pairing --write .agents/notes/implemented/testing/2026-09-15-chokidar-controlled-time.md`（logs/12，写入 `.i18n.yaml` 1 条记录）→ test:docs 16/16（logs/13）。
- spec 整改后 blob：`b8458db29e24c59d23e7b3f897bc8483b7ae8110`（SHA-256 `e583aa56de3713f540926aad85326cb8a489824b5f71bbfdc0d9156ac1b237c1`）。远端候选原 blob/摘要保持于 verification.json 未改；本次差异仅该一行类型标注。

## 未执行（NOT_RUN，按红线）

全部 Web 矩阵、完整 coverage、Gateway212、Loader122、exe/wheel、六个既有 Windows 命令 golden、r33 已过项复跑（consumers 11/0/0、Web 主批次 100 文件等——本轮不重做）；原 CI ZIP 下载（无 gh 且按红线不装不索取，摘要以 verification.json 已核验值为准）；模型/凭据/endpoint/思考等级/lock/pkg/工作流/覆盖阈值/分区/超时均未触碰；不读生产 Key、不请求真实模型、不进 record、不改系统安全设置。新源码 CI 尚未发生，不提前宣布通过；Linux coverage 维持无最终结论。

## 清理与状态

负控突变已恢复并哈希复验；临时备份留存于 `C:\dsh-r34-20260915-01`（仓库外）。入库前按 r33 先例对 logs 做了唯一一次字节规范化：仅去除行尾空格与 EOF 空行以满足 whitespace 钩子（lefthook 首次拒收，如实记录），其余内容与捕获时一致；钩子运行（lint/配对/清单/whitespace）均正常开启。工作树本轮改动：spec 一行整改、新 Note `.i18n.yaml` 配对、本证据目录（logs/01–14 + 本文件）；现行 handoff 同步更新。敏感扫描：日志仅含路径/计时/用例名，无凭据类内容。独立全新上下文复审：主会话派发并转达结果 9/9 全项 PASS、无需整改（2026-09-15）；据此按 LOCAL_AGENT_TASK.md 交付规则以正常 hooks 分组提交、非强推同分支（本文件"当前状态"段即交付时序的如实记录）。
