# Agent Note: 区分启动失败与依赖恢复

Status: implemented

[English](2026-09-13-failed-fiber-recovery.md) | 中文

## Problem

插件启动失败后，执行状态会在清理副作用期间变为 inactive。这个状态本身不能证明注入的服务曾经消失。把每次 inactive 到 ready 的通知都当作恢复，会在服务未改变时重复执行失败的插件，甚至发生在回滚尚未结束时。

## Decision

[Fiber](../../../../vendor/cordis/src/fiber.ts)独立保存失败启动所对应的依赖状态，不与清理使用的执行状态混淆。相同就绪依赖的通知不会解除失败状态；确认依赖不可用后恢复、更换提供者或显式更新，才允许再次尝试。等待启动期间已经观察到的依赖丢失仍可恢复。销毁不会被后来的依赖通知逆转。

## Alternatives considered

完全禁用恢复会使消费者在真实服务中断后无法恢复。延长 Loader 断言的等待只会掩盖重复启动，而不能阻止它。再次清理目录选择器后端，也不能保护其他插件因相同重试错误而产生的资源。

## Consequences

重试判断由共享生命周期实现负责，而不是分散到每个消费者。清理仍通过既有资源管理机制等待完成。[恢复测试](../../../../packages/host/directory-picker-auto/tests/failure-recovery.spec.ts)覆盖重复通知、等待回滚、依赖恢复与销毁；[目录选择器组合](../../../../packages/host/directory-picker-auto/tests/loader-composition.spec.ts)保留为集成检查。局部隔离的 Fiber 测试不能替代完整 Loader 执行。
