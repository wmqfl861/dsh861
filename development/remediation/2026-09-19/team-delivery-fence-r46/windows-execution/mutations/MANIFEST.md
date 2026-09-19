# r46 mutation manifest: byte, git-blob, and SHA-256 record of every candidate state

All states are of `snapshots/sdk/agent-team-teardown/teardown-trigger.mjs`. Mutations were applied by exact single-occurrence string replacement (anchor count asserted `1` before writing) through Node `fs` on explicit ASCII paths; restores copied the saved candidate bytes back and re-verified SHA-256 before any further run. No `checkout`/`reset`/`stash` was used at any point. Saved byte copies live outside the repository (`C:\dsh-r46-tmp\candidates\`) and are committed here for provenance.

| State | Bytes | Git blob | SHA-256 | File |
| --- | ---: | --- | --- | --- |
| Pre-fix original (git `3c9f40f8…` blob `c2e3c486…`) | 7807 | `c2e3c48601463a897871da2e0c80a3408f289dd7` | `511a9daf0a509d4233b7ff6729af6e16a637f2f3e025328f28590d48ac57eda9` | `original-teardown-trigger.mjs` |
| Fixed candidate (final) | 10136 | `2e404c687214931f2906df67e3a32cc6ef1bba92` | `97ba412852d3912843f5822751edbc614da7c8a08b967eb8058803c4cab9a71e` | `teardown-trigger.mjs.fixed` (byte copy; working tree verified identical) |
| NC-early-close mutant | 10101 | `5a9610ed6d744749817a094210aafda49771fd78` | `e27563040ceaee09603d8a7d6430d5f6bd93eb7dd3cc9f3cef40254c9c027118` | `nc1-early-close-mutant.mjs` |
| NC-failed-send-as-success mutant | 10166 | `0b1fce4ecaad33b791d95b90d2f29c204b827b24` | `09566badfd7f65b5a9da5aa986f99041b1662e123eebdf06340bcb60ae919515` | `nc2-failed-send-as-success-mutant.mjs` |

## NC-early-close (remove the acceptance precondition, restore original readiness)

Anchor replaced (1 occurrence): `state.held && state.pendingInbox >= 1 && state.leadIdle && state.sendStatus === 'accepted' && !state.ready` -> `state.held && state.pendingInbox >= 1 && state.leadIdle && !state.ready`.

- Mutant run `logs/03-nc1-mutant.log`: exit 1, 6 failed / 4 passed. First failing assertion: `s1-inbox-before-ack/no-close-while-send-pending: drain calls while pending: 1: expected false to be true` — the send-unfinished-must-not-close rejection, as required. This is a real target rejection, not a syntax, import, timeout, or zero-test failure.
- Restore: candidate bytes copied back; re-read SHA-256 `97ba412852d3912843f5822751edbc614da7c8a08b967eb8058803c4cab9a71e` verified.
- Post-restore positive `logs/04-nc1-restored-positive.log`: exit 0, 10/10 passed.

## NC-failed-send-as-success (keep the barrier, treat queued or reject as confirmation)

Anchors replaced (1 occurrence each):
1. `if (result.status === 'accepted') {` -> `if (result.status === 'accepted' || result.status === 'queued') {`
2. the rejection callback's `state.sendStatus = 'rejected'` -> `state.sendStatus = 'accepted'`

- Mutant run `logs/05-nc2-mutant.log`: exit 1, 3 failed / 7 passed. Failing assertions include both required error-branch rejections: `s3-queued/no-close-on-queued: drain calls: 1, ready: true: expected false to be true` and `s4-reject/no-close-on-reject: drain calls: 1, ready: true: expected false to be true`.
- Restore: candidate bytes copied back; re-read SHA-256 `97ba412852d3912843f5822751edbc614da7c8a08b967eb8058803c4cab9a71e` verified.
- Post-restore positive `logs/06-nc2-restored-positive.log`: exit 0, 10/10 passed.
