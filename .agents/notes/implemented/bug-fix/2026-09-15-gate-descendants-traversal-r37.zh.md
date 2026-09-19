# Agent Note：限定 gate runner 后代遍历边界并停止迟到 close 的重复遍历

Status: implemented

[English](2026-09-15-gate-descendants-traversal-r37.md) | 中文

## 问题

Windows coverage runner 崩溃（run 34981717505，job 104423422677），在 [run-gates.ts](../../../../scripts/run-gates.ts) 的 `collectDescendants` 内抛出 `RangeError: Maximum call stack size exceeded`：广度优先队列别名到 root 自己的孩子数组并用 `queue.push(...children)` 扩充，被出队的 pid 一旦拥有过宽的孩子列表就超出函数实参数量上限；又因为没有 visited 集合，环会无限重复入队——当环回到 root 时队列到达自身，把自身展开追加给自身。重复行也会使后代重复出现。另一处，异步枚举的 close 回调在调用 `finish` 之前就求值 `collectDescendants(root, parsePidPpidLines(stdout))`，因此 cancel 或 error 已 settle 之后，迟到的 close 仍会同步地重新解析并重走整张已捕获的表。原始 CIM 行未被捕获，因此缺陷以构造的进程表复现，不以历史 pid 图复现。

## 决策

`collectDescendants` 保留邻接表构建，随后从自己的 `[root]` 队列执行去重的迭代式广度优先遍历，`seen` 集合预置 root：每个可达 pid 在首次发现时恰好入队并输出一次，root 本身绝不出现在返回值中；环与重复行被跳过而不是中止遍历；孩子逐个入队——不用 spread、不用递归、不设深度或数量上限。异步接线抽为 `wireDescendantEnumeration`，stdout 累积、一次性 settle、settle 时终止枚举子进程、cancel/error 语义均保持不变；settled 检查移到 close 回调最前面，迟到的 close 在触碰已捕获输出之前返回，`finish` 自身的一次性保护保留。采样节奏、缓存合并、fail-fast 与 abort 区分、退出码与信号报告、输出排空、终止期限、Windows taskkill root 优先语义均未改动。

## 备选方案

深度上限或最大后代数上限会在 gate 树最宽的时候截断真实树。检测到环就返回空列表会丢掉 root 的其他后代。递归只是把实参上限换成栈上限。仅保留 `finish` 内部保护被证据否决：该检查在实参表达式求值之后才运行，下方探针显示重走仍然发生。

## 后果

[run-gates.spec.ts](../../../../scripts/run-gates.spec.ts) 新增回归：空表、多层广度优先顺序、root 自身无行、重复行、同 pid 多路径、输入行不变、200000 宽的 root 与非 root 孩子列表、100000 深链、自环、回到 root 的环、无关环、一支成环其余不成环、以及固定种子随机表与逐 pid 祖先链独立可达性计算的交叉核对。无界遍历无法完成的输入在短命 tsx 子进程中行走，由测试自身的 `spawnSync` 超时终止，回归不会阻塞 forked worker。异步接线覆盖正常 close、分块 stdout、error 后迟到 close、cancel 后迟到或重复 close，并固定 settle 与 kill 次数。对仓库实际实现记录了真实首失（8 项失败，含与 CI 崩溃相同的 `RangeError`）；字节校验恢复的负控：移除 visited 使 6 项环与去重测试失败；恢复别名加 spread 使 7 项失败并新增宽列表 `RangeError`；在修复后的遍历器上恢复急切 close 使迟到 close 内部同步重走 2000000 行表耗时 2631ms，而有守护时为 0ms。Windows（Node 26.8.2、pnpm 12.4.1）验证：两套件 130 通过、6 项既有 Windows 跳过，typecheck、lint、duplication 通过。证据：[windows-execution/FINDINGS.md](../../../../development/remediation/2026-09-15/gate-descendants-r37/windows-execution/FINDINGS.md)。Linux coverage 失败、session.lock FileHandle 异常、64 文件覆盖短缺、Windows adapter idle-watchdog 失败仍未处理；当主机负载拖慢同步 CIM 枚举时超出 5 秒预算的边际 abort 测试为既有问题，未改动。
