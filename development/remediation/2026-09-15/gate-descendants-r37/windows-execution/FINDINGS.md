# r37 — gate runner 后代遍历与迟到 close 修复：证据索引

仓库 `wmqfl861/dsh861`，分支 `chore/latest-stable-upgrade-20260912`。起点提交 `0eb7dc890e0e46e5336310aa9885857aaefe74ed`（r36 终态；本地 HEAD 与远端 ls-remote 一致，无 stash、无多余 worktree、工作树起点干净，未重复取件）。起始 blob 核验与 PR#13 r37 执行说明 A 节完全一致：`scripts/run-gates.ts=736e8e1ea7af9a3c4ea144edf6ed20d2001606bb`、`scripts/run-gates.spec.ts=a5ad767c32312fcca3621746cc8806f42a364401`、`scripts/gate-evidence.spec.ts=ff992d38993c6c40894095dce5fedf4e32d47cf9`（第三个文件本轮无实际回归需要，未改动）。工具链 Node v26.8.2 + pnpm 12.4.1（`C:\dsh-r24-upgrade-20260912-01` 显式 PATH），复用依赖；本轮唯一新工作目录 `C:\dsh-r37-20260915-01`（仓库外，原始捕获字节与负控探针驱动所在地）。完整执行说明与 r36 远端取证报告经 api.github.com 无凭据读取成功；Linux ZIP 10401264725 未下载（远端已取证，本机无 gh，按说明记 NOT_RUN）；Windows job 104423422677 日志未重复读取（主会话已读，实施不要求）。

## 定位（Windows 真实崩溃 + 仓库实际实现）

崩溃事实来自任务说明引用的 run 34981717505/job 104423422677（`RangeError: Maximum call stack size exceeded` 于 `collectDescendants`）。仓库实现复核（起点 blob）：`collectDescendants` 队列别名 `byParent.get(root)` 并以 `queue.push(...children)` 扩队——出队 pid 的宽孩子列表超出实参数量上限；无 visited，环/重复行无限重复入队；环回到 root 时队列到达自身、把自身展开追加给自身。异步枚举 `close` 回调把 `collectDescendants(root, parsePidPpidLines(stdout))` 作为实参在 `finish` 调用前求值，cancel/error settle 后迟到 close 仍整套重解析+重走。本轮无原始 CIM 行，不虚构历史 PID 环；全部以构造进程表复现（异常进程表仅用测试数据，未操纵真实 WMI，未杀任意系统/用户进程）。

## 基线首失（真实 vitest 5.0.0 对仓库实际实现，先加最小接缝、算法未修；logs/03、04）

接缝先行（行为不变）：`collectDescendants` 加 `export`；异步接线抽为 `wireDescendantEnumeration`（保留原始急切 close 语义）。接缝本身经字节对照验证不改行为（见 logs/01、02 归因）。

首轮（logs/03）：exit 1，7 failed | 97 passed | 5 skipped——重复行 `[2,2,3,3]≠[2,3]`、多路径 `[2,3,2]≠[2,3]`、自环/回 root 环/支回 root 环（子进程死亡）、迟到 close（子进程死于 `RangeError: Maximum call stack size exceeded`，堆栈落在 `queue.push(...)`——与 CI 崩溃同类）；另 1 项既有 `kills the child when the abort signal fires` 超时（见"归因"节，非本轮代码所致）。

修正测试形状后（logs/04）：exit 1，8 failed | 97 passed | 5 skipped（110）——新增宽列表命中（非 root 父节点 200000 孩子 → `RangeError: Maximum call stack size exceeded`，即 CI 崩溃形状；root 级宽列表在原算法下本可通过，已拆成守护用例）与种子随机表失败（root 行入表后根环自然出现）。宽/深/环用例区分：宽表命中 spread 维度、环表命中 visited 维度，互不偶然覆盖。

## 修复（scripts/run-gates.ts 最小改动）

1. `collectDescendants`：保留邻接表构建；遍历改为独立 `[root]` 队列 + `seen` 预置 root 的去重 BFS——首次发现序输出、每可达 PID 恰一次、root 不入返回值、环与重复行跳过不弃其他后代、孩子逐个入队（无 spread/递归/深度或数量上限/遇环返回空）。
2. `wireDescendantEnumeration`：settled 检查移至 close 回调最前，迟到 close 在触碰捕获输出前返回；`finish` 一次性保护、settle 即 SIGTERM 枚举子进程、cancel/error `[]` 语义、stdout 累积全部保留。`descendantPidsAsync` 变为 spawn+委托，命令/超时/stdio 不变。
3. 采样 5 秒节奏、缓存合并、fail-fast/abort 区分、退出码/信号、输出排空、终止期限、Windows taskkill root 优先语义不变。

## 修复后复测（logs/05、15）

`pnpm exec vitest run --project thread-safe scripts/run-gates.spec.ts scripts/gate-evidence.spec.ts` exit 0：**130 passed | 6 skipped（136）**。跳过全部为既有 Windows skipIf（run-gates 5、gate-evidence 1），不折算 Linux 通过。C.6 无 Key 小验证由套件内真实子进程用例承担（runGate 真实退出/信号/streamOutput/kill-on-abort、gate-evidence 真实导出/manifest/哈希/短命子进程与临时目录清理）；在途枚举随 gate 结束取消的接线行为由 `wireDescendantEnumeration` 的 cancel/迟到 close 回归与既有 POSIX 树杀集成用例共同覆盖。

## 负控（真实突变 + 真实运行 + 字节恢复 + `git hash-object` 复验；logs/06–10、16）

| 突变 | 运行 | 恢复 |
|---|---|---|
| NC-A 去 visited（保留独立队列、逐项入队、close 守护） | exit 1，6 failed：重复行、多路径、自环、回 root 环、支回 root 环、种子随机表（环/去重维度；宽表通过，维度分离成立） | blob 复验与修复态一致，A-RESTORED-BYTE-EXACT |
| NC-B 恢复别名队列+无界 spread+无 visited（完整原算法） | exit 1，7 failed：NC-A 六项 + 宽非 root 列表 `RangeError`（新增 spread 维度） | 同上 B-RESTORED-BYTE-EXACT |
| NC-C 恢复急切 close（遍历器保持修复态） | 探针（logs/09）：2,000,000 行链表在迟到 close 内同步重走 **2631ms**（result 弃置、kills 不变）——证明无守护时 parse/walk 真实发生，非"没有抛异常"式验收；守护态同探针 **0ms**（logs/08），恢复后复测 **0ms**（logs/10） | 同上 C-RESTORED-BYTE-EXACT |

修复态 `run-gates.ts` blob `664e1a0ef88f86b524dee39f684cd34e3cbba4a6`；三次恢复后均复验一致。探针子进程由驱动自身 `spawnSync` 超时（120s）保护，场景子进程超时 10s/30s，临时目录 finally 删除；无后台残留进程依赖该契约。

## 门禁（先败后过，失败细节留存）

| 项 | 结果 |
|---|---|
| 两套件（受影响检查） | exit 0，130 passed \| 6 skipped（logs/05 首次修复后、logs/15 终态候选） |
| `pnpm run typecheck` | 首次 exit 1：spec 4 错（宽表 `Array.from` mapfn 元组注记、noUncheckedIndexedAccess 下索引访问）；修复后 exit 0（logs/11）。期间一次 exit 1 为瞬时环境故障（见"归因"） |
| `pnpm run lint` | 两次 exit 1：`no-unnecessary-type-parameters`（runScenarioInChild 单用途泛型）、`no-unnecessary-type-conversion`（对已是 string 的表达式再 String()）、`no-unsafe-assignment`（Array.isArray(unknown) 收窄产生 any 赋值）；整改（去泛型改 unknown+isNumberTable 守卫、去多余 String()）后定向 lint 0 错（logs/14）、全量 exit 0：0 警告 0 错误 3595 文件（logs/12） |
| `./node_modules/.bin/jscpd --config .jscpd.json packages scripts` | exit 0，0 clones（logs/13）。`pnpm run duplication` 的 .cmd shim 在本机指向已缺失的用户级 AppData pnpm 路径，故经同一 jscpd 5.2.0 的 sh shim 直调（与 r36 等价调用面）；未安装/修复任何工具 |
| `pnpm run test:docs` | exit 0，16 passed \| 0 failed \| 0 skipped（含 translation pairing、markdown links；logs/19） |
| 中英 Note 配对 | `verify-translation-pairing --write` exit 0，1 record（logs/18） |

Agent Note：`.agents/notes/implemented/bug-fix/2026-09-15-gate-descendants-traversal-r37.md`（+ `.zh.md` + `.i18n.yaml`）。

## 归因记录（非本轮缺陷，如实区分）

- **既有 abort 测试超时**（logs/03 内）：`kills the child when the abort signal fires` 在全量首失运行中超 5s 预算。字节精确临时还原（保存 WIP→还原 HEAD 两文件→单测→恢复→hash-object 复验一致）证明：纯净 HEAD 隔离运行通过（3198ms）、接缝在场隔离运行通过（4266ms）——该测试本机实测 3.2–4.3s（Windows 同步 CIM 枚举），负载下可超预算，属既有 Windows 边际事实，本轮不改其契约；终态候选两轮全量运行均通过。
- **typecheck 瞬时失败**：一次 `pnpm run typecheck` 启动即失败于 `"C:\Users\Joyce Gu\AppData\Local\pnpm\.tools\pnpm\12.4.1\..."` 不存在（该目录实际存在 `12.4.1@` 与 `_tmp_` 链接，疑为瞬时链接切换）；原命令重试 exit 0。失败日志被重试覆盖，以本节叙述留存。
- **lint 首失日志覆盖**：两次 lint 失败全文被后续通过运行覆盖重定向；失败规则与位置以本节所引为准（规则名+行为+行号在过程中逐条摘录），定向整改复验见 logs/14。

## 未执行（NOT_RUN，按红线）

Linux ZIP 10401264725 未下载（远端已核验 SHA-256/manifest，不重复取证）；Windows job 日志未重读；完整插桩 coverage、全 Web 矩阵、Linux 通道、Gateway212、Loader122、exe/wheel、六个既有 Windows golden、e2e/真实 API/E2B 均未运行——Linux 9 失败、3 个 session.lock FileHandle 异常、64 文件覆盖短缺、Windows adapter idle-watchdog 失败与崩溃前后不完整测试结论均未解决，本轮局部通过不等于完整 CI 或升级阶段完成。未读生产 Key/全局认证/用户 .env；未改模型配置/provider/endpoint/思考等级/credentialRef/P0-B state/锁/pkg 补丁/workflow/上传策略/覆盖率阈值；未装 gh、未重装升级、未改 Git/GCM/认证/系统；未手动重跑/取消 CI、未合并、未进入 P0-C、未验收 P0-B。

## 清理与状态

`C:\dsh-r37-20260915-01` 为仓库外工作目录（原始字节留存），仓内无临时残留；负控突变全部恢复并经 blob 复验。入库日志规范化范围：CRLF→LF、去 ANSI CSI 转义、去行尾空白、单一结尾换行（与 r34–r36 先例一致）；原始字节与规范化后字节的 SHA-256 逐文件对照见 logs/17；全部写入经 Node 原生 fs 显式 ASCII 路径落盘并回读校验，新进程复核 17/17 非空可读，未触碰 r29–r36 证据目录。全新上下文独立复审由主会话派发；提交/推送仅在复审 PASS 后进行。
