# Agent Note: 以解析器 split 入口计数拒绝迟到 close 的重复解析

Status: implemented

[English](2026-09-16-late-close-parse-count-regression-r38.md) | 中文

## Problem

r37 的后代遍历修复（见[遍历 Note](../bug-fix/2026-09-15-gate-descendants-traversal-r37.zh.md)）把 settled 检查放在 `wireDescendantEnumeration` close 回调最前，但 [run-gates.spec.ts](../../../../scripts/run-gates.spec.ts) 的 late-close 回归只固定了结果值与 kill 次数。这些断言在有无该守护时都成立：迟到 close 重新解析并重走捕获表得到的仍是同一个空 settle 与同一次 kill，因为安全遍历会终止、`finish` 内部守护丢弃重复值。r37 的急切 close 负控测出了被丢弃的工作量（2000000 行表在迟到 close 内重走 2631 ms），证明重走确实发生，但那是性能探针，不是常规套件回归。规格文件里还有两处注释声称循环表会让无守护的迟到 close 永不终止；带守护的广度优先遍历在循环表上会终止，这些注释描述的不是现行代码的行为。

## Decision

接线回归现在直接计数真实解析器的入口调用。一个 helper 对 `String.prototype.split` 安装 spy 并保留原实现；spy 范围只覆盖同步的 fake-close 派发——不 await、不断言、不执行其他工作——解析器经 `parsePidPpidLines` 内的 `output.split('\n')` 进入，因此计数恰为解析趟数。`mockRestore` 会清空调用历史，所以先复制计数再恢复；恢复放在 `finally`，close 抛错也能恢复；恢复后做描述符相等断言，证明原函数及其属性回到原型上（描述符相等内部按引用比较函数）。固定六种通知顺序并保留结果与 kill 断言：正常 close 一次与两次都恰解析一次——单次正常 close 是正控，永远计零的观察器过不了它，解析出的后代证明真实 parser/walker 确实执行——cancel 后 close 一次或两次、error 后 close 一次或两次都解析零次。失效的循环表注释改为陈述带守护遍历在循环上会终止，并由这些计数回归证明迟到 close 不再解析；循环表迟到 close 子进程用例因循环形状与失控隔离价值而保留。

## Alternatives considered

**只断言结果。** 两种版本的 close handler 下都通过；下文的突变验收表明仅删除守护时它们保持绿，而计数断言六项中五项失败。

**大表性能探针加墙钟阈值。** 在 CI 机器上受负载影响，且 r38 执行说明禁止其进入常规套件；解析计数是确定性的，不需要时间预算，也不放宽任何超时。

**对模块导出的 parse 函数做 spy。** `wireDescendantEnumeration` 经模块内部引用调用解析器，导出 spy 会观察到零次调用——正是正常 close 正控要拒绝的永远计零观察器。对原型方法做 spy 能截获内部调用，因为调用时经 `String.prototype` 做方法查找。

**mock walker 或把算法复制进测试。** 观察必须驱动仓库实现；副本或 mock 只能观察自己。

**检查源码字符串里有没有守护。** 静态字符串匹配证明不了运行中的 close 路径。

## Consequences

`-t "asynchronous enumeration"` 过滤现在在接线范围内执行 11 个测试（既有 5 个、新增 6 个）。现行代码上聚焦运行 11 项通过，两套受影响套件 136 通过、6 项为既有 Windows 跳过（共 142）。突变验收：仅移除 close 回调的 settled 守护（安全遍历与 `finish` 内部守护保留）时，聚焦运行 exit 1，五项计数断言失败（`expected 2 to be 1`、`expected 1 to be +0`、`expected 2 to be +0`，error 后再两次），而全部结果与 kill 断言仍通过；单次正常 close 在突变下仍通过，因为两种版本在此场景都恰解析一次。突变 runner 在 `finally` 中按保存字节恢复，经 git blob `664e1a0ef88f86b524dee39f684cd34e3cbba4a6` 复验逐字节一致，随后正向聚焦运行再次通过。最终字节上 typecheck、lint、duplication 与快速文档门禁通过；typecheck 首失（split 的 `Symbol.split` 重载使分隔符比较成为无交集错误，需放宽为 `unknown[]`）与 lint 首失（对被剥离的原型方法报 unbound-method，改依描述符相等修复）均留存于证据日志。spy 只在单个 fork worker 的一次同步派发内改变进程全局原型，两套件重跑确认无跨文件影响。`scripts/run-gates.ts` 保持 r37 原字节；采样、取消、清理与调度未动。证据与提出本轮要求的复核见 [windows-execution/FINDINGS.md](../../../../development/remediation/2026-09-16/late-close-regression-r38/windows-execution/FINDINGS.md) 与 [PR #13 复核评论 5690291312](https://github.com/wmqfl861/dsh861/pull/13#issuecomment-5690291312)。
