# r35 — Vitest 5 内联项目继承修复：证据索引

仓库 `wmqfl861/dsh861`，分支 `chore/latest-stable-upgrade-20260912`。取件提交 `b5e6fd857ca737aa32196c02a3707a99d3703b54`（fetch 后远端无新提交，本地领先，无需快进，工作树起点干净）。基线 blob 核对一致：`vitest.config.ts=51e2c74c409f21c254cd21d6658008745577409c`、`scripts/coverage-partitions.ts=a2d0a2b503474d42214a5b5138ef563a96ef9057`、`scripts/coverage-partitions.spec.ts=b720e539ed7000072edd1231688f7c90d965babd`。工具链 Node v26.8.2 + pnpm 12.4.1（`C:\dsh-r24-upgrade-20260912-01` 显式 PATH），复用依赖；本轮唯一新工作目录 `C:\dsh-r35-20260915-01`（仓库外）。r34 历史证据目录与本文件之外的历史日志保持原字节未动。

## 根因（Vitest 5.0.0 实测源码 + 真实输出）

Vitest 5 内联项目默认 `extends` 声明它的配置文件，继承经 Vite `mergeConfig` 合并、数组串联（`inheritRootViteOverrides` → `mergeConfig(inherited, options)`；不可继承项仅 `name/projects/root`）。因此两项目各自在自身 include 之外并入根 `test.include`，且根插件与项目自身插件叠加注册。coverage 不受影响：`resolveTestConfig` 对每个项目一律 `resolved.coverage = globalConfig.coverage`，根 coverage include/exclude/阈值/reporter 与 `extends` 无关。

## 基线与修复后清单（真实 `pnpm exec vitest list --filesOnly`，logs/01–08）

| 模式 | 项目 | 修复前 | 修复后 |
|---|---|---|---|
| 普通 | thread-safe / process-bound | 1229 / 1236 | 1229 / 7 |
| 普通 | 唯一并集 / 重复归属 | 1236 / 1229 | 1236 / 0 |
| 豁免 | thread-safe / process-bound | 1184 / 1191 | 1184 / 7 |
| 豁免 | 唯一并集 / 重复归属 | 1191 / 1184 | 1191 / 0 |

两模式修复前后唯一文件并集逐一比较：零丢失、零新增（07/08 号 JSON 全量差分）；两项目交集为空；`process-bound` 修复后恰为声明清单中 win32 当前允许的 7 个文件（`spawn.spec.ts` 按平台规则排除）。修复前两模式 stderr 各含 2 条 Vitest 重复插件警告，修复后为 0。`DSH_COVERAGE_EXEMPT_HEAVY=1` 仅以命令前缀临时生效，未写入任何持久配置。真实解析探针（实际安装 Vitest 的 `createVitest`，logs/09–10）：两项目各解析 2 个初始化脚本（无重复无丢失），解析插件管线中 `vite-tsconfig-paths` 与 `dsh-standard-decorators` 各出现 1 次。

## 修复内容

1. `vitest.config.ts`（修复后 blob `f65397a84550d8ec72395857ea4e488b0eaddab9`）：两个 setup 脚本提取为共享常量 `testSetupFiles`；根 `test.setupFiles` 用常量；两内联项目**顶层** `extends: false` 且各自 `test.setupFiles` 显式引用同一常量；项目插件/esbuild/execArgv/forks/include-exclude/平台规则与根 coverage include-exclude/阈值/reporter/分区模式不变。
2. `scripts/coverage-partitions.ts` `parseListOutput`（修复后 blob `a26c1740f68029ddfa6a7027e2f83af28c7c0349`）：豁免选择器前置展开→逐行正则→反斜杠归一→豁免跳过→同文件异项目抛错（错误含文件与两项目名）→同项目重复幂等→files 排序 + projectOf 映射；JSDoc 同步更新（唯一项目归属契约）。其余实现未替换。
3. 新增 `scripts/vitest-project-inheritance.spec.ts`（最终 blob 见交付记录）：真实子进程探针断言每项目解析两个 setup 脚本、两目标插件各 1 次；过滤 `vitest list` 断言本 spec 唯一归属 thread-safe；协调器实际生成分区配置后用真实 Vitest CLI 枚举，证明缩小分区不重新继承根部宽泛 include、空文件一侧不扩展为运行全部（配置回归入 scripts 测试发现范围，临时目录自建自清理）。

## 解析器回归（先对原函数真实首失，logs/03→04）

新增回归先对**原函数**运行：3 failed | 41 passed（44）——异项目同文件两种行序均未抛错（原实现静默覆盖归属）、反斜杠与正斜杠两种拼写未归一。应用修复后同文件 44/44 通过。新增回归同时钉住：同项目重复幂等、` > ` 测试级分隔行（含以 `.spec.ts` 结尾的用例名）不可绕过、CRLF/.tsx/排序正常、七项豁免选择器原行为、豁免文件不因归属检查重回清单。

## 负控（真实突变执行，非日志安静检查；logs/14、15、17、18）

1. 恢复隐式继承（仅移除两处顶层 `extends: false`）：接线/重叠回归失败（对最终版 spec：4 failed | 2 passed——解析 setupFiles 变 4 项、清单双行，且 spec 自身被两项目双跑）；真实 `vitest list` 输出经仓库真实 `parseListOutput`（tsx 直跑原模块）抛出 `...is claimed by projects "thread-safe" and "process-bound"...`（exit 2）。恢复后 blob 复验 `f65397a8…` 一致，复跑绿。
2. 仅移除两项目级 `setupFiles` 接线：对最终版 spec 失败（解析 setupFiles 为空 ≠ 两脚本）；真实解析探针显示两项目 setupFiles=0（根脚本在 `extends: false` 下不再到达项目）。恢复后 blob 一致、3/3 绿。
3. 如实记录一次恢复事故：一次 NC1 恢复脚本将 `setupFiles` 行重复插入，blob 校验（`22576ae6…` ≠ `f65397a8…`）当场拦截，修正后恢复一致；该状态未经任何验证步骤使用。

## 定向测试（真实输出数量，未预填；logs/19、28）

`pnpm exec vitest run scripts/coverage-partitions.spec.ts packages/experimental/webworker-runtime/tests/node/chokidar.spec.ts packages/context/time-context/tests/time-context.spec.ts scripts/vitest-project-inheritance.spec.ts`：最终版 4 个测试文件、82 用例全部通过、exit 0。chokidar 仅在 thread-safe 下运行（14 用例，r34 同命令为两项目双跑 28 用例）；time-context 仅在 process-bound 下运行（21 用例）；coverage-partitions 44；新配置回归 3。r34 受控时间/30ms-5ms/真实 Chokidar/Worker loader/VFS/关闭清理等夹具语义未改动。

## 门禁（先败后过，首失留存；logs/12、22–25）

| 门禁 | 首次 | 复测 |
|---|---|---|
| `pnpm run typecheck` | logs/12 exit 1：新回归首版静态 `import '../vitest.config.ts'` 触发 TS6307（该文件不在 tsconfig.host.json 文件清单）并连带暴露其未被 tsc 检查的既有 `thresholds \| undefined` exactOptionalPropertyTypes 摩擦 | logs/20 exit 0（spec 重写为真实子进程探针，不再把 vitest.config.ts 拉入 tsc 程序） |
| `pnpm run lint` | logs/22 exit 1：探针字符串一处双引号违反 `@stylistic(quotes)` | logs/23 exit 0（一行改单引号；0 warning 0 error） |
| `pnpm run duplication` | logs/21 exit 0（0 clones） | — |
| `pnpm run test:docs` | logs/24 exit 0（Note 未建前 16/16）；logs/25 exit 1：新 Note 配对未录 + FINDINGS.md 尚未落盘致 md-links 断链 | 配对按点名命令写入、证据目录落盘后终验见交付记录 |

首版 spec（静态导入，logs/11：2/2 过）保留为整改轨迹；最终版（logs/13：3/3 过）以解析级断言替代声明级断言，且负控按最终版重跑。

## 未执行（NOT_RUN，按红线）

完整 coverage（含插桩/分区实跑）、全部 Web 矩阵、Gateway212、Loader122、exe/wheel、既有 Windows 命令 golden；未改分区数/调度算法/并发/超时/覆盖率阈值；未迁移 Vite tsconfigPaths/esbuild/oxc、未升级任何依赖；未以 `extends: true` 隐藏警告；未运行 record；未调用真实模型；未读生产 Key/全局认证/用户 .env；未改模型配置两文件/provider/endpoint/思考等级/credentialRef/P0-B state/锁/pkg 补丁；未安装 gh；未合并、未验收 P0-B、未进入 P0-C；不提前宣布升级阶段完成。新源码 CI 尚未发生；Linux coverage 与 r34 相同维持无最终结论。

## 清理与状态

所有临时目录（`C:\dsh-r35-20260915-01` 为仓库外工作目录，仓内无临时残留；分区回归的临时根由测试自清理）无未清 watcher/进程；`DSH_COVERAGE_EXEMPT_HEAVY` 用后即 unset。入库前对捕获日志做一次字节规范化（仅去行尾空格与 EOF 空行以满足 whitespace 钩子，与 r34 先例一致），其余内容与捕获时一致。主会话"10/10、162 组差分"属隔离验证，未作为仓库测试结果复用；本轮全部结论来自仓库内对原函数/真实配置/实际安装 Vitest 的执行。独立全新上下文复审由主会话派发，结果与交付时序按 LOCAL_AGENT_TASK 规则另行转达；提交/推送仅在复审 PASS 后进行。
