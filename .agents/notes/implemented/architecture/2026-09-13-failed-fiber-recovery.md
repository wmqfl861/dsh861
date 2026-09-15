# Agent Note: Distinguish failed activation from dependency recovery

Status: implemented

English | [中文](2026-09-13-failed-fiber-recovery.zh.md)

## Problem

A failed plugin uses the inactive execution epoch while its effects are cleaned up. That state alone does not establish that an injected service disappeared. Treating every inactive-to-ready notification as recovery restarts failed plugin code even when the services have not changed, including while rollback is still draining.

## Decision

[The fiber](../../../../vendor/cordis/src/fiber.ts) retains the dependency epoch of a failed activation independently of its cleanup epoch. A notification of the same ready dependencies leaves the failure latched. A confirmed availability loss and return, a replacement provider, or an explicit update can authorize another attempt. An availability loss observed during awaited startup remains recoverable. Disposal cannot be reversed by later dependency notifications.

## Alternatives considered

Disabling recovery altogether would strand consumers after a real service outage. Waiting longer in a Loader assertion would hide repeated startup rather than prevent it. Cleaning a directory-picker backend again would not protect other plugin-owned resources from the same retry error.

## Consequences

The retry decision stays in the shared lifecycle implementation rather than in individual consumers. Cleanup still drains through the existing ownership mechanism. [Recovery tests](../../../../packages/host/directory-picker-auto/tests/failure-recovery.spec.ts) cover repeated notifications, awaited rollback, recovery and disposal; [directory-picker composition](../../../../packages/host/directory-picker-auto/tests/loader-composition.spec.ts) remains the integration-level check. A local isolated Fiber test does not substitute for that full Loader execution.
