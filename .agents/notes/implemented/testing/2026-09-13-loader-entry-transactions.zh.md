# Agent Note: 保持 Loader 成员、配置与发布一致

Status: implemented

[English](2026-09-13-loader-entry-transactions.md) | 中文

## Problem

Loader 条目既有树内的运行成员记录，也有组内的配置行。插件销毁等待期间仍可能发生配置重整；仅删除成员记录会让原配置行再次创建该条目。在激活完成前发布创建记录，也会让失败候选进入持久化及后续重整。

## Decision

[EntryGroup.remove](../../../../vendor/loader/src/config/group.ts)在等待插件清理前，同时删除永久移除条目的配置行与成员记录。组停止则保留配置行供重启。完成通知仍在清理成功后发送，清理失败仍向调用方抛出。

[EntryTree.create](../../../../vendor/loader/src/config/tree.ts)在组激活成功后才发布创建日志。激活失败时只移除该候选对象，不替换整个配置列表，从而保留无关的同级变更。这些操作落实[内嵌源码规则](../../../../vendor/README.md#local-modifications)中规定的事务性配置重整。

## Alternatives considered

延迟检查成员记录既不会删除残留配置行，也不能防止重整再次创建该条目。清空整个组会误删无关条目；放宽目录选择器的卸载断言则掩盖了所有权错误，不能恢复一致性。

## Consequences

[方法级测试](../../../../packages/boot/app-boot/tests/loader-entry-transactions.spec.ts)控制生命周期回调，检查实际树和组操作，区分永久移除与停止重启，并保留失败传播。[既有目录选择器组合测试](../../../../packages/host/directory-picker-auto/tests/loader-composition.spec.ts)验证真实插件激活，仍需单独执行。本次不新增全局操作串行化或另一套插件生命周期机制。
