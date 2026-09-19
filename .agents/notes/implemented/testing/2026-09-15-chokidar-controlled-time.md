# Agent Note: Let write-finish tests own elapsed time

Status: implemented

English | [中文](2026-09-15-chokidar-controlled-time.zh.md)

## Problem

The [Chokidar integration test](../../../../packages/experimental/webworker-runtime/tests/node/chokidar.spec.ts) used two real 10ms waits to place a three-part write inside a 30ms stability window. A scheduled wait is not an upper bound on elapsed time. The Windows CI failure reported an add followed by change, but did not capture individual write times, so it does not prove which interval exceeded the window or exclude other integration defects.

## Decision

Only the write-finish cases control Date and timeout/interval APIs through Vitest. They still load the installed Chokidar 4 and 5 packages through the production Worker module loader and MemoryVfs. The 30ms threshold and 5ms poll interval stay unchanged. The burst case checks that no event is emitted before stability, the single add observes complete abc bytes, and no delayed extra event follows. A second case requires a later stable write to produce change rather than being suppressed. Watchers close before restoring the real clock; nextTick, queueMicrotask and setImmediate stay native.

## Alternatives considered

Increasing the stability threshold only increases the scheduling margin. Accepting add plus change, filtering events, or replacing the watcher with an event fixture would stop verifying the original single-burst contract. Controlling elapsed test time preserves that contract without changing production file watching or test-runner limits.

## Consequences

The candidate changes a test fixture, not Chokidar, the VFS or the module transform. Its deterministic schedule still requires validation against both installed package versions and both repository test projects, including ready/close behavior and timer restoration. The [remote record](../../../../development/remediation/2026-09-15/chokidar-timing-r34/verification.json) distinguishes a small modeled polling experiment and syntax checks from the real integration run; neither is reported as a completed Windows or Vitest acceptance.
