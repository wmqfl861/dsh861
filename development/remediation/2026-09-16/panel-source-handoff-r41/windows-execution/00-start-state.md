# r41 start-state verification (2026-09-16)

Branch: chore/latest-stable-upgrade-20260912
Local HEAD:  0f4b487c2b48f6502507c3173acedfc491a74674
Remote HEAD: 0f4b487c2b48f6502507c3173acedfc491a74674 (git ls-remote origin refs/heads/chore/latest-stable-upgrade-20260912)
Base branch feat/multi-agent-company-nodes at 5434305c5dcf7ddc3ebf939226647b7b608335e6 (unchanged).
Working tree: clean at start (git status --porcelain empty); no fetch repeated (local and remote already agreed on 0f4b).
PR #13 remains draft; P0-B blocked; not merged; no P0-C.

## Git blobs at start (task B section expected vs observed)

All match (git ls-tree HEAD):

389c1a0d90f23f0b41c530b387d489067d40c246 packages/test-support/client-runtime/tests/helpers.client.spec.tsx (only allowed main modification)
8472514901da323fe3812fa9ef50be6de037b461 packages/test-support/client-runtime/src/index.ts (fixed)
728cbdcb21d128ca3fa05d8067bdd4f6a4f3fe60 packages/client/ui-renderer/src/client/registry.ts (fixed)
fde55a366cd5e7826214e16f132cd1d2d95ba1ff packages/client/ui-renderer/src/client/bindings.tsx (fixed)
3a5ecb8373ac4f856102e9c1cd37bb430cdaf295 packages/client/ui-renderer/src/client/scoped-slots.tsx (fixed)

## Task sources read before any change

- PR #13 task comment 5694575878 (A-H sections) — fetched via credential-less api.github.com REST, HTTP 200.
- PR #13 CI-forensics comment 5694557659 — fetched the same way, HTTP 200.
- Workspace AGENTS.md, packages/AGENTS.md, docs/defensive-patterns.md, docs/testing.md, .agents/skills/dsh-pre-push-checks/SKILL.md.
- Sources studied for the timing diagnosis: packages/test-support/client-runtime/src/index.ts, packages/client/ui-renderer/src/client/registry.ts, bindings.tsx, scoped-slots.tsx, packages/client/ui-slots/src/index.ts (reportEntryError/onEntryError), vendor/cordis/src/fiber.ts (await() rethrows startup errors).

Toolchain: Node v26.8.2 + pnpm 12.4.1 from C:\dsh-r24-upgrade-20260912-01 (PATH prefix on every command). No gh install, no auth/system changes, no keys or .env read.

## Stage point of this handoff record

This file records the start state and the intended stage: baseline first failure, candidate implementation plus behavior verification, two independent negative controls with byte-verified restoration, gates, and evidence — with NO commit and NO push in this round (independent fresh-context review comes before delivery; see FINDINGS.md for the executed end state).

## End state of this round (no commit, no push — stage gate)

Local and remote HEAD both remain 0f4b487c2b48f6502507c3173acedfc491a74674. The candidate is the uncommitted working tree: the modified test spec, the new bilingual Agent Note triplet, and this evidence directory. End blob of the modified spec:

4de2fd6eb2440ae9c6a310fecacff0caee1db322 packages/test-support/client-runtime/tests/helpers.client.spec.tsx (9678 bytes, SHA-256 1665c6368ee6f8b22d6a62753e9386e81d33c26e089ec89df7690800eb50502a)

No runtime implementation, vendor, lockfile, workflow, or frozen-evidence byte changed. git status --porcelain at end: only the spec file plus new (untracked) note and evidence paths.

## Re-dispatch arrival state (same day, second executor)

The re-dispatch claimed the first dispatch "did no work"; on arrival the tree already held the frozen candidate (spec modified to blob 4de2fd6e...) and the full 00-13 evidence above as untracked files, with HEAD and the remote still at 0f4b487c (remote unmoved, base unchanged). The scene was preserved and the entire pipeline was independently re-executed (baseline first failure, candidate positives, both negative controls with byte-verified restoration, typecheck/lint/duplication/doc-sync, final confirmation 10/10); the frozen candidate's bytes never changed. The end state above therefore still holds, now accompanied by the rv-00..rv-13 re-verification set in this directory (see FINDINGS.md's re-verification section). Still no commit and no push at this stage point.
