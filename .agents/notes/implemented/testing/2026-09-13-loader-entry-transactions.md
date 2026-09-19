# Agent Note: Keep Loader membership, configuration and publication consistent

Status: implemented

English | [中文](2026-09-13-loader-entry-transactions.zh.md)

## Problem

A Loader entry has both runtime membership in its tree store and a configured row in its group. Reconciliation can run while a plugin disposer is awaiting. Removing only the store entry leaves its row eligible for re-creation. Publishing a creation before activation settles also leaves a failed candidate visible to persistence and subsequent reconciliation.

## Decision

[EntryGroup.remove](../../../../vendor/loader/src/config/group.ts) unlinks a permanently removed row and unregisters its entry before awaiting plugin cleanup. A group stop retains the row for restart. Completion notifications still follow successful cleanup, and cleanup failure still rejects.

[EntryTree.create](../../../../vendor/loader/src/config/tree.ts) publishes its creation journal only after group activation succeeds. Failed activation unlinks the exact candidate object rather than replacing the entire group list, preserving unrelated sibling mutations. These operations implement the transactional reconciliation described in the [vendoring policy](../../../../vendor/README.md#local-modifications).

## Alternatives considered

A delay before checking the store does not remove a stale row or prevent reconciliation from re-creating it. Clearing the entire group can remove unrelated entries. Weakening the directory-picker's teardown assertion hides the persisted ownership error rather than restoring consistency.

## Consequences

The [method-level tests](../../../../packages/boot/app-boot/tests/loader-entry-transactions.spec.ts) control lifecycle callbacks and check the actual tree/group operations. They distinguish permanent removal from stop/restart and preserve failure propagation. The existing [directory-picker composition tests](../../../../packages/host/directory-picker-auto/tests/loader-composition.spec.ts) exercise real plugin activation and remain required separately. This change adds neither global operation serialization nor a replacement plugin lifecycle mechanism.
