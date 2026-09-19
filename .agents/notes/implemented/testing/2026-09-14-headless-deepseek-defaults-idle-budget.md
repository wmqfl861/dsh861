# Agent Note: Give the DeepSeek defaults headless fixture a jitter-proof stream idle budget

Status: implemented

English | [中文](2026-09-14-headless-deepseek-defaults-idle-budget.zh.md)

## Problem

The [DeepSeek defaults scenario](../../../../apps/cli/tests/profiles/headless/tests/headless.expected.e2e.ts) asserts exactly two provider requests from the one-shot app: the main request (`max_tokens` 256000) and the session-title request (`max_tokens` 64). It intermittently received a third request (CI run 34765078459 job 103744493702; local reproduction 2 deviant runs in 4). Captured session events classify the third request as a main-request retry: an `llm/retry` event with `failure: "DeepSeek stream idle timeout after 150ms"`, code `TIMEOUT`, logged after the title request had already been dispatched. The [fixture](../../../../apps/cli/tests/profiles/headless/tests/fixtures/deepseek-defaults.patch.yml) pinned `streamIdleTimeoutMs: 150` while the loopback mock writes an SSE keep-alive comment every 60 ms — a 2.5x margin that scheduler jitter under the concurrent title stream and tsx source-mode transform intermittently exceeds between two keep-alives.

The product behavior is correct and pinned elsewhere: SSE comments count as transport activity through `parseSse`'s `onComment`, the idle watchdog has dedicated unit tests ([adapter.spec.ts](../../../../packages/llm/llm-deepseek/tests/adapter.spec.ts)), and retrying `TIMEOUT` failures is the deployed policy with its own scenario test. The only artificial constraint was the fixture's own idle budget, so the fixture owns the fix.

## Decision

The fixture's `streamIdleTimeoutMs` rises from 150 to 1000, matching the pi-ai defaults sibling fixture and giving 16.7x margin over the keep-alive cadence. The test names the cadence (`KEEP_ALIVE_INTERVAL_MS = 60`, replacing both mock literals) and asserts the fixture's idle budget is at least four keep-alive intervals, read from the fixture text. Reverting the budget fails deterministically at that assertion ("expected 150 to be greater than or equal to 240", 7 ms) instead of resurfacing as a phantom request-count flake.

The request-count contract is unchanged: exactly one main and one title request, no sleeps added, no retry suppression, no golden refresh, no title-feature disable.

## Alternatives considered

| Rejected | One-line reason |
|---|---|
| Relaxing the count to 3, `>=2`, or filter-then-count | Hides the two-request contract the scenario exists to pin |
| Only shortening the keep-alive interval | Any finite cadence can stall; raises timer churn without a real budget |
| Changing the retry policy or idle watchdog | Correct, unit-tested product behavior; the fixture budget was the only artificial constraint |

## Consequences

Six consecutive post-fix runs of the scenario pass. A full-file A/B against the pre-fix files produces identical per-test outcomes, so the six remaining failures on this Windows host are pre-existing `{{cwd}}` golden path-normalization diffs (8.3 short-name temp paths; the macOS/Linux lanes own those fixtures), not effects of this change. Execution evidence: [r29 windows-execution](../../../../development/remediation/2026-09-13/ci-gates-r29/windows-execution/verification.json).
