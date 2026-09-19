# Agent Note：生产关闭等待其拥有的每一项义务

Status: implemented

[English](2026-09-17-production-teardown-ownership.md) | 中文

## 问题

两条生产关闭路径在仍拥有进行中工作时结束了会话。控制路径在驱动结束前清除了 inbox 投影；Team 路径在投影消失后采样 roster。在 Cordis 反序卸载下，effect 组合还可能在该槽位真实 drain 结束前清空注册槽位，使并发关闭观察到"无 manager 的 no-op"而不是加入进行中的清理。超时被当成了完成。

## 决策

每一层等待自己拥有的对象，且每次等待观察真实 settlement 而非期限。`AgentTeardownHooks` 向 factory 交付每个 agent 的同步 completion 句柄；factory 先关闭 admission，启动全部已跟踪义务，待它们 settle 后才报告全部原始失败。激活的关闭记录先于 create 或 resume 建立；共享准备 `P(x)` 绝不等待自己的句柄或等待它的 wrapper。槽位所有权只在所属子 fiber 的完整生命周期——drain、结构释放与错误观察——settle 之后按精确 identity 清除。Team runtime 对已接纳工作保留真实持有，每个入口汇入同一关闭事务，并把超时当作错误观察而非静止。

## 备选方案

不发布 completion 的顺序取消会重新引入共享句柄消除的自等环。首次进入即清槽使并发 drain 什么也加入不了——本轮首次硬审把这测成了真实的次序反转。承诺超出 vendored fiber 实际交付的次序，会掩盖所有权收集真正弥合的缺口。

## 后果

inbox 清除失败时取消仍会传播，原始错误沿聚合 cause 存活。投影最后一次合法读取是拥有它的关闭；之后的读取者看到拒绝而不是缺失。Keyless 证据现在包含触发关闭的路径本身：[teardown 快照场景](../../../../snapshots/sdk/) 在门控处保持真实关闭、验证写所有权锁、并在协议 shutdown 后接管原目录；Python smoke 对 built CLI 重放同一链路。r43 的 observer 仍是清理失败的交叉校验；本 Note 记录已交付的次序，不改写那段历史。
