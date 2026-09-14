# Agent Note: 由写入稳定测试控制经过的时间

Status: implemented

[English](2026-09-15-chokidar-controlled-time.md) | 中文

## Problem

[Chokidar 组合测试](../../../../packages/experimental/webworker-runtime/tests/node/chokidar.spec.ts)原先通过两次真实的 10ms 等待，将三段写入放在 30ms 稳定窗口内。调度等待不是实际经过时间的上限。Windows CI 记录了 add 后再出现 change，却没有采集每次写入的时间，所以不能证明具体哪个间隔超出窗口，也不能排除其他组合缺陷。

## Decision

仅写入稳定用例通过 Vitest 控制 Date 与 timeout/interval API。它们仍通过生产 Worker 模块加载器和 MemoryVfs 加载实际安装的 Chokidar 4、5。30ms 阈值与 5ms 轮询间隔不变。分段写入用例检查稳定前没有事件、唯一 add 读到完整 abc 字节、之后没有额外迟到事件。另一个用例要求稳定后的新写入产生 change，不能被抑制。先关闭 watcher 再恢复真实时钟；nextTick、queueMicrotask 和 setImmediate 保持原生。

## Alternatives considered

增大稳定阈值只会扩大调度余量。接受 add 加 change、过滤事件或把 watcher 换成事件替身，都不再验证原来的单次分段写入契约。控制测试经过时间可保留这一契约，无需修改产品文件监听或测试运行限制。

## Consequences

候选只修改测试夹具，不修改 Chokidar、VFS 或模块转换。受控时序仍需在两个实际安装版本和仓库两个测试 project 中验证，包括 ready/close 与时钟恢复。[远端回执](../../../../development/remediation/2026-09-15/chokidar-timing-r34/verification.json)将小型轮询模型实验和语法检查与真实组合执行分开，均未宣称完成 Windows 或 Vitest 验收。
