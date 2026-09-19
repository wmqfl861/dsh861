# r46 windows-execution findings: Team teardown trigger fences the close behind confirmed delivery

Round: r46 (team delivery fence). Base HEAD `3c9f40f8211894631a65764a18801f0ac77e2ba6` on `chore/latest-stable-upgrade-20260912`; PR #13 stays draft. Local toolchain: Node v26.8.2 + pnpm 12.4.1 from `C:\dsh-r24-upgrade-20260912-01` (dual-directory prefix; CI runs Node 26.9.0/pnpm 12.4.1, difference recorded, not upgraded). Local OS: Windows 10.0.26200 x64. All times UTC. Start state verified in [00-start-state.md](00-start-state.md) before any edit.

## Scope actually changed

| File | Start blob | End blob | Change |
| --- | --- | --- | --- |
| `snapshots/sdk/agent-team-teardown/teardown-trigger.mjs` | `c2e3c48601463a897871da2e0c80a3408f289dd7` (7807 B) | `2e404c687214931f2906df67e3a32cc6ef1bba92` (10136 B, SHA-256 `97ba412852d3912843f5822751edbc614da7c8a08b967eb8058803c4cab9a71e`) | send-confirmation barrier |
| `snapshots/sdk/teardown.snapshot.ts` | `6b78bda5931bbb72f36e20258501da6446838679` (25387 B) | `a7584b0d0bab54533ba037ae895f69133fee791d` (30269 B, SHA-256 `215b5a889bea060259593591a9beeb7d8ffbbfc2b5a8012dcc3158f5ccbf56f2`) | Team adapter: send settlement fields, queued/delivered persistence + ordering, fast-fail send diagnostics |
| `scripts/tests/agent-team-teardown-trigger.spec.ts` | new | `1c752d74f264afcfea5778a31e9423aa1f5aea0e` (final bytes after two lint fixes) | deterministic regression spec |
| `scripts/tests/fixtures/agent-team-teardown-trigger-driver.mjs` | new | `da83e0e9138a4815b32de835f1e7854bbe573a43` | test-owned subprocess driver fixture (explicitly listed) |

Unchanged (verified by `git status` at the end of the round): every `packages/` production source (including read-only `packages/experimental/agent-team/src/mailbox.ts` blob `6afc7f44…`), the r43 observer, r44 close logic, shared `snapshots/sdk/sdk.snapshot.ts`, every normalizer, every golden/JSONL/replay input (including `snapshots/sdk/agent-team-teardown/session.v3.jsonl`, `session.1.v3.jsonl`, `tool-schemas.1.expected.json`), lockfiles, workflows, and all r29-r45 evidence. No `DSH_SNAPSHOT=record`/`refresh` was ever set.

## First failure (deterministic, on the unmodified module)

`logs/01-first-failure-spec.log` (direct Vitest entry, `--project thread-safe`, exit 1, 7 failed / 3 passed of 10) plus the driver-level result `logs/01a-first-failure-driver-result.json`: with the Lead idle, the held second teammate call open, and the scenario send's dispatch inserting into the teammate inbox while the send promise is still pending, the original module fires `drainContinuableChildren` synchronously inside the inbox-insert handler — `no-close-while-send-pending` observes `drain calls while pending: 1`. The same run shows no send settlement recorded anywhere (`accepted-identity-recorded` fails on empty state), a queued send still closing (`no-close-on-queued`), a rejected send still closing (`no-close-on-reject`), an identity-less result still closing, an unrelated child's insert counting as the teammate's pending inbox, and a pre-existing manual trigger file closing before any acknowledgement. This is the CI consumers-run shape (root 41/42 records, missing `team/message/delivered` for `{{id:2}}`): the trigger raced its own send.

## The fix

`teardown-trigger.mjs` now settles the scenario send through one `settleSendResult` step: only `status: 'accepted'` with a non-empty string `messageId` arms anything; `queued`, unusable identities, unusable statuses, and rejections each record `sendStatus` (`queued` / `invalid` / `rejected`), `sendMessageId`, and an exact `sendError` in `state.json`. Readiness is the original held + pending-inbox + idle-Lead conjunction plus `sendStatus === 'accepted'`; every settle/insert/idle path re-evaluates, so both causal orders arm exactly once. Auto and manual modes share the same `state.ready` (the manual timer cannot cross the barrier with an early trigger file). Only the exact teammate's inserts count toward the pending fact. The real close entry (`subagents.drainContinuableChildren(lead, [teammateId])`), the held call's abort handshake, the manual timer's `unref`/effect cleanup, and the fail-loud fence deadline are unchanged; no sleep, timeout, log patching, or process exit was added. Production semantics are untouched: `TeamMailbox.send` resolves `accepted` only after the Lead log's delivery checkpoint, so the fence waits on durable delivery.

## Regression and negative controls

All Vitest runs used the direct entry `node node_modules/vitest/vitest.mjs run --project thread-safe scripts/tests/agent-team-teardown-trigger.spec.ts` with `TMP`/`TEMP` = `C:\dsh-r46-tmp` (r45 finding A: the canonical `pnpm exec vitest` wrapper starves assembled-app profile installs on this host; the canonical command is NOT claimed as passed).

- Positive on fixed bytes: `logs/02-positive-spec.log` exit 0 (10/10); re-confirmed on final spec bytes in `logs/16-spec-final.log` exit 0 (10/10).
- NC-early-close (acceptance precondition removed): `logs/03-nc1-mutant.log` exit 1, first failing assertion `s1-inbox-before-ack/no-close-while-send-pending` (the send-unfinished-must-not-close rejection). Restored byte-identically (SHA-256 `97ba4128…` re-verified); `logs/04-nc1-restored-positive.log` exit 0 (10/10).
- NC-failed-send-as-success (queued or reject treated as confirmation): `logs/05-nc2-mutant.log` exit 1, failing assertions include `s3-queued/no-close-on-queued` and `s4-reject/no-close-on-reject`. Restored byte-identically; `logs/06-nc2-restored-positive.log` exit 0 (10/10).
- Full byte/blob/SHA-256 record for every candidate and mutant state: [mutations/MANIFEST.md](mutations/MANIFEST.md); mutant and original byte copies committed under `mutations/`.

## Real SDK acceptance (not fake)

`logs/07-teardown-snapshot.log` and final-bytes rerun `logs/20-teardown-final.log` (direct entry `node node_modules/vitest/vitest.mjs run --config vitest.snapshot.config.ts snapshots/sdk/teardown.snapshot.ts`, exit 0, 2/2 both runs): for `agent-team-teardown` the armed gate now requires `sendStatus: 'accepted'` with the message identity, and the adapter verified in the real Lead log, for the exact same `messageId` (`team-message-85c57edb…` in run 07, `team-message-f515ccec…` in run 20): `team/message/queued` persisted with the teammate as target, `team/message/delivered` persisted with the teammate as target after the queue edge, delivery at seq 32 strictly before every close-produced root event (close suffix starts at seq 33; root pre-seq 32, suffix 8 events, child 20 -> 24), and the child's pending inbox splice behind the held step carrying the same message identity. The child's second model request was still held (pre-close tail not `turn/end`, no `assistant/attempt` before close), the pending message was not consumed for the acknowledgement, and every original assertion held: cancelled-attempt suffix with zero chunks, exactly one child terminal with the parent-abort reason, contiguous final seq, root settlement turn, SDK `subagent.finished` notification, write-lock `SessionAlreadyOwnedError` during the close, protocol shutdown, and the post-shutdown takeover appending nothing. The `subagent-teardown` case passed unchanged in the same runs. A send settling without acceptance now fails the armed poll immediately with the recorded `sendError` instead of a silent 60 s timeout.

## Shared automatic lane (known host limitation, honestly recorded)

`logs/08-shared-auto-lane.log` (direct entry `node node_modules/vitest/vitest.mjs run --config vitest.snapshot.config.ts snapshots/sdk/sdk.snapshot.ts -t "replays agent-team-teardown through dsh --profile sdk"`, exit 1, 1 failed / 19 skipped): the scenario fails before any golden comparison with `JsonRpcResponseError: cannot create effect on inactive context` — the pre-existing Windows host defect recorded as r44 Gap #6 (fixture hydration embeds a raw backslash `{{cwd}}` into JSONL text; `llm-replay` fails to load), reproduced here with the identical signature before and independent of this round's change. Per the round's instructions the normalizer and fixtures were not touched; the full automatic golden comparison remains owned by the new Linux CI run. This host's verification of the delivery fence is the direct regression plus the real manual SDK adapter above.

## Gates (final bytes)

- `pnpm run typecheck`: exit 0 (`logs/22-typecheck-final3.log`; first attempt `logs/09-typecheck-first-attempt.log` exit 1 caught one unused import in the spec's first byte state, fixed; `logs/10-typecheck-r2.log` and `logs/14-typecheck-final.log` exit 0 on intermediate byte states; `logs/21-typecheck-broken-shim-path-mistake.log` exit 1 was a shell-precedence mistake that ran pnpm without the dual-directory PATH prefix and hit the user's broken shim — not a repository result).
- `pnpm run lint`: exit 0, 0 warnings, 0 errors (`logs/23-lint-final.log`; first attempt `logs/11-lint.log` exit 1 caught six `any`-typed stream-chunk operand errors, second `logs/12-lint-r2.log` exit 1 caught two arrow-paren styles, all fixed and confirmed by `logs/13-lint-r3.log` exit 0 on that byte state before the final rerun).
- Duplication: `node node_modules/jscpd/run-jscpd.js --config .jscpd.json packages scripts` exit 0, 0 clones (`logs/15-duplication.log`).
- Docs: `pnpm run test:docs` — `logs/18-doc-quick-r2.log` records 15 passed / 1 failed where the only failure was this FINDINGS.md not yet existing (broken relative link from the new note); the gate was rerun after this file landed (`logs/24-doc-quick-final.log`). `logs/17-doc-quick-broken-shim-path-mistake.log` exit 1 was the same broken-shim PATH mistake as `21`, not a repository result.
- Snapshot corpus hygiene: `node node_modules/vitest/vitest.mjs run --config vitest.snapshot.config.ts scripts/session-snapshot-corpus.corpus.ts` exit 0, 3/3 (`logs/19-corpus-gate.log`).
- Commit-time hooks: not exercised (the round stops before commit by instruction).
- Evidence byte discipline: `logs/01b-first-failure-driver-stderr.log` is a zero-byte capture (the first-failure driver run wrote nothing to stderr) and therefore has no trailing newline by capture; every other evidence file is ASCII-named, LF-only, exactly one trailing newline (audited by codepoint walk over the whole round tree).

## NOT_RUN / preserved out of scope

- Full Linux automatic golden comparison, full coverage, Web, Gateway 212, Loader 122, exe-wheel, the six old Windows goldens, both SDK surfaces: not rerun; the new CI owns them.
- subagent-teardown pwsh/bash tool-schema platform difference, r45 local findings A/B root causes, Linux pwsh/Python CI failures, both platforms' 67-file coverage shortfalls, the five pre-existing Chinese line-number issues: listed, untouched.
- The consumers artifact ZIP (`10560313189`) was not re-downloaded: remote forensics already completed it, and this round's first failure was reproduced locally and deterministically.
- No commit, no push, no CI interaction, no external agents, no credentials or user `.env` read, no real model API or E2B invoked. PR #13 remains draft; P0-B stays blocked.
