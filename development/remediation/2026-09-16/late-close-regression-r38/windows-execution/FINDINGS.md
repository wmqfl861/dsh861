# r38 — late-close 确定性解析计数回归：证据索引

仓库 `wmqfl861/dsh861`，分支 `chore/latest-stable-upgrade-20260912`，起点提交 `7dbad1b04fbf5e658676fa5077dfe14adfc882f7`（r37 终态；本地 HEAD 与远端 ls-remote 一致、工作树起点干净，未重复 fetch/push）。起始 blob 与 PR#13 r38 复核评论（issuecomment-5690291312，经 api.github.com 无凭据读取全文）完全一致：`scripts/run-gates.ts=664e1a0ef88f86b524dee39f684cd34e3cbba4a6`、`scripts/run-gates.spec.ts=2dfc640da375ec93c34e2e954daa2523d4b747a6`、`scripts/gate-evidence.spec.ts=ff992d38993c6c40894095dce5fedf4e32d47cf9`（第三个文件未改动）。工具链 Node v26.8.2 + pnpm 12.4.1（`C:\dsh-r24-upgrade-20260912-01` 下 node-v26.8.2-win-x64 与 pnpm-12.4.1 显式 PATH 前缀；系统 pnpm shim 指向缺失的 AppData 路径，未安装/修复任何工具，本机无 gh，评论经无凭据 REST API 读取）。本轮改动面：仅 `scripts/run-gates.spec.ts`（新增解析计数回归 + 修正两处失效注释）、新中英 Agent Note 三件套与本证据目录；`scripts/run-gates.ts` 全程保持原字节（终态 blob 复验见下）。

## 改动内容（scripts/run-gates.spec.ts，+115/-6 行量级）

1. 新增 helper `emitCloseCountingParses`：对 `String.prototype.split` 安装 `vi.spyOn` 并保留原实现，spy 范围仅覆盖同步的 fake-close 派发（不 await、不 expect、不执行其他业务）；在 `finally` 中先复制 `separator === '\n'` 的调用数（`mockRestore` 会清空调用历史，必须先复制再恢复）再 `mockRestore`；恢复后做描述符相等断言（`Object.getOwnPropertyDescriptor(String.prototype,'split')` 与安装前捕获值 `toEqual`，函数值按引用比较），证明原函数与属性未污染后续用例。
2. 新增六项接线回归（`asynchronous enumeration wiring`）：正常 close 一次/两次各恰解析一次（一次场景为正控：永远计零的观察器过不了它，且断言真实解析后代 `[2,3]`，证明真实 parser/walker 执行）；cancel 后 close 一次/两次、error 后 close 一次/两次均解析零次；全部保留结果值与 kill 次数断言。
3. 修正两处不再成立的循环表注释（'settles empty on cancel' 与 late-close protection 用例）：不再声称无守护时循环表重走永不终止——安全 BFS 在循环表上会终止；改由解析计数回归证明迟到 close 不再解析。循环表迟到 close 子进程用例本身保留（循环形状与失控隔离价值）。
4. 未加两百万行性能探针、未加墙钟阈值、未放宽任何超时；未改 `run-gates.ts`、采样、取消、清理、调度；未新增生产接缝。

## 正向运行（现行代码，最终字节）

| 命令 | 退出码 | 结果 | 日志 |
|---|---|---|---|
| `pnpm exec vitest run --project thread-safe scripts/run-gates.spec.ts -t "asynchronous enumeration"` | 0 | 11 passed \| 105 skipped（116）——过滤确实发现新增测试，非零执行 | logs/18（首轮 logs/01 同结果；轮次演进见下） |
| `pnpm exec vitest run --project thread-safe scripts/run-gates.spec.ts scripts/gate-evidence.spec.ts` | 0 | 136 passed \| 6 skipped（142；两文件 2 passed）——较 r37 的 130/6 恰增 6 项新回归；6 项跳过全为既有 Windows skipIf（run-gates 5、gate-evidence 1），不折算 Linux 通过 | logs/19（首轮 logs/02 同结果） |

迭代说明：候选历经两次门禁驱动的源码修订（typecheck 的 `Symbol.split` 重载无交集比较 → 放宽 `unknown[]`；lint 的 unbound-method → 改依描述符相等），故早于修订的 logs/01/02/05-08/13/14 是修订前候选的运行，最终字节（不再变更）由 logs/17-22 与下述 v4 突变闭环覆盖；每轮独立日志名，无复测覆盖首失。

## 突变验收（真实负控 + 真实失败 + 可靠恢复）

驱动：仓库外 Node 脚本（logs/26–29 为 v1–v4 源码）。单进程内完成：核对起点 runner git blob `664e1a0e...` → 精确字符串替换仅移除 close 回调开头的 `if (settled) return`（needle 唯一命中；突变后全文件恰余 finish 内部一处守护，安全 BFS 不动；70048→70024 字节，恰好一行）→ 运行聚焦回归 → `finally` 按保存的原字节恢复 → 复读核验逐字节相等并复算 git blob。

| 版本 | 说明 | 结果 |
|---|---|---|
| v1（logs/03、04） | 经 `cmd /s /c` 调用，引号被剥致 `-t` 过滤命中零测试（116 skipped、exit 0）——无效控制，如实保留，不作为验收 | 无效，未采信 |
| v2（logs/05、06） | 直调 `pnpm.exe`+参数数组，修正引号；对 typecheck 修订前候选运行 | vitest exit 1，**5 failed \| 6 passed \| 105 skipped**；恢复逐字节一致（驱动自身 exit 98 为其摘要解析未剥 ANSI 的伪影，已在 v3 修复，非测试结果） |
| v3（logs/11、12） | 同 v2 逻辑 + ANSI 剥离解析，对 lint 修订前候选 | 同样 5 failed \| 6 passed，exit 1，驱动 exit 0 |
| v4（logs/20、21） | 对最终冻结字节 | **vitest exit 1，5 failed \| 6 passed \| 105 skipped（116）**；恢复核验 `byte-equal=true`、sha256 `496f79f5d97731f0e9464187e8208806bcac6bb897e6bd1472927de753a4b6ae`、git blob `664e1a0ef88f86b524dee39f684cd34e3cbba4a6`；驱动 verdict `rejected-mutation`，exit 0 |

五项真实断言失败全部来自解析次数（`AssertionError: expected 2 to be 1` / `expected 1 to be +0` / `expected 2 to be +0` 等，位于 `expect(parses).toBe(...)`，最终字节行号 1361/1373/1385/1397/1409），非语法、导入、超时或环境错误；失败名单与复核评论隔离对照表完全一致（正常 close 一次两版本同为 1，通过属预期正控行为）。恢复后正向聚焦回归再次通过（logs/22：11 passed）。突变窗口内 runner 变更仅此一行且已恢复；未用 checkout/reset/stash 覆盖任何工作；工作树其余文件无并发修改。

## spy 与资源清理

spy 仅存在于单次同步 close 派发内（forks 池单 worker，文件内测试顺序执行）；`finally` 保证抛错也恢复；恢复后描述符相等断言在每项计数回归内执行；两套件合跑（logs/19）含 gate-evidence.spec.ts 全绿，证明无跨文件污染。无真实子进程枚举/终止、无真实 WMI 调用、无网络、无凭证读取；突变驱动只改仓库内 runner 一个文件并在同进程 finally 恢复；临时文件均在仓库外 `C:\Albert\r38-scratch`（原始捕获字节与驱动）与 `C:\Albert\project\r38-scratch`（v1 驱动误落位置，已拷入证据），仓内无临时残留。

## 门禁（先败后过，首失留存）

| 项 | 结果 | 日志 |
|---|---|---|
| `pnpm run typecheck` | 首失 exit 1：`TS2367`（split 的 `Symbol.split` 重载使 `call[0] === '\n'` 成无交集比较）→ 放宽回调参数为 `unknown[]` 后 exit 0；最终字节复跑 exit 0 | logs/09（首失）、10、17 |
| `pnpm run lint` | 首失 exit 1：`typescript(unbound-method)` ×2（脱离原型引用 `String.prototype.split`）→ 去掉游离函数引用、恢复核验只依描述符相等后 exit 0：0 警告 0 错误 3595 文件 | logs/15（首失）、16 |
| `./node_modules/.bin/jscpd --config .jscpd.json packages scripts` | exit 0，0 clones（经同一 jscpd 的 sh shim 直调，与 r37 等价调用面；`pnpm run duplication` 的 .cmd shim 在本机指向缺失路径） | logs/23 |
| `pnpm run test:docs` | 首失 exit 1：16 门中 `translation pairing` 一项失败（zh Note 内跨 Note 链接指向英文侧，配对规则要求同 locale 目标 `....zh.md`）→ 修正链接并重跑配对记录后 exit 0：**16 passed \| 0 failed \| 0 skipped**；markdown links、doc-standard、agent note classification/format 等均通过 | logs/25（首失）、25-gate-testdocs-2.log（通过） |
| 中英 Note 配对 | `pnpm run verify-translation-pairing --write .agents/notes/implemented/testing/2026-09-16-late-close-parse-count-regression-r38.md` 两次均 exit 0，1 record（第二次为 locale 链接修正后的重记录） | logs/24、24-pairing-write-2.log |

Agent Note：`.agents/notes/implemented/testing/2026-09-16-late-close-parse-count-regression-r38.md`（+ `.zh.md` + `.i18n.yaml`），明确区分"r37 运行修复已存在"与"本轮新增自动回归"。入库日志规范化：CRLF→LF、去 ANSI CSI 转义、去行尾空白、单一结尾换行（沿 r34–r37 先例）；原始字节留存于仓库外 scratch 目录，逐文件 raw/normalized SHA-256 对照见 logs/30-hash-manifest.txt；全部写入经 Node 原生 fs 显式 ASCII 路径落盘并回读核验非空。r37 及更早冻结证据未触碰。

## 未执行（NOT_RUN，按红线）

未提交、未推送（按本轮阶段门：实现+验证+门禁+证据+报告后止，待全新上下文独立复审 PASS 后另行执行）；PR 保持 draft、base 不变、未合并，P0-B blocked、未进入 P0-C。未跑完整插桩 coverage、全 Web 矩阵、Linux 通道、Gateway212、Loader122、exe/wheel、六个既有 Windows golden、e2e/真实 API/E2B；本轮局部通过不等于新 CI、coverage 或升级阶段整体通过。未重跑 r36 五文件、Chokidar、transform、visited/宽图负控与 r37 推送/认证收尾；未下载 CI artifact（含尚不存在的 r37 coverage ZIP）。未读生产 Key/全局认证/用户 .env；未改模型配置/provider/endpoint/思考等级/credentialRef、锁、pkg 补丁、workflow、上传策略、覆盖率阈值；未装 gh、未重装升级、未改 Git/GCM/认证/系统；未手动重跑/取消 CI。独立复审另观察到既有测试 `fail-fast scheduling > kills the child when the abort signal fires`（spec 717 行）负载敏感、逼近 Vitest 默认 5000ms 用例超时（复审 5 次重跑 4 次超时，-t 隔离重跑与 r38 代码零执行时仍超时），复审已验证其与本轮改动隔离；本轮红线禁止扩大超时，该测试未改动，留待后续轮次处理。

## 清理与状态

仓库内最终变更（未提交）：`scripts/run-gates.spec.ts`、新 Note 三件套、本证据目录；`scripts/run-gates.ts` blob 终态复验 `664e1a0ef88f86b524dee39f684cd34e3cbba4a6` 与起点逐字节一致。仓库外 scratch 目录保留原始捕获字节供追溯。全新上下文独立复审由主会话派发；提交/推送仅在复审 PASS 后进行。
