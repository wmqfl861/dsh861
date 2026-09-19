# r42 start-state verification (2026-09-16)

Branch: chore/latest-stable-upgrade-20260912
Local HEAD:  0bb1eff579a9e823d68fc8870896e9f143996a12
Remote HEAD: 0bb1eff579a9e823d68fc8870896e9f143996a12 (git ls-remote origin refs/heads/chore/latest-stable-upgrade-20260912)
Working tree: clean at start (git status --porcelain empty); no fetch repeated (local and remote already agreed on 0bb1eff5).
PR #13 remains draft; base feat/multi-agent-company-nodes unchanged; P0-B blocked; not merged; no P0-C.
r41 was accepted by the remote; this round does not redo the panel-source handoff or push bookkeeping.

## Git blobs at start (task A section expected vs observed)

Both match (git ls-tree HEAD):

c1cb00e114fcbcc2ad5a1039968ad174635734fa packages/subagent/tool-subagent-control/tests/tool-subagent-control.spec.ts
6ae2fddca392d10164f11d55fc8d91c19795598c packages/experimental/tool-agent-team/tests/tool-team.spec.ts

Protected surfaces re-verified unchanged before work: AgentLoop destruction path, JSONL lease, persistence implementation, Windows lock mechanism, public MockAdapter, shared read-handle helper (persistence-helpers.ts), r41 panel spec.

## Task sources read before any change

- PR #13 task comment 5696351145 (LOCAL_AGENT_TASK r42, sections A-G) - fetched via credential-less api.github.com REST (curl), HTTP 200.
- PR #13 diagnostic comment 5696337750 (r41 acceptance, CI status, FileHandle ownership analysis) - fetched the same way, HTTP 200.
- Workspace AGENTS.md, packages/AGENTS.md, docs/architecture.md, docs/defensive-patterns.md, docs/testing.md, .agents/skills/dsh-pre-push-checks/SKILL.md, .agents/skills/dsh-ci-test-reliability/SKILL.md.
- Sources studied for the ownership gap: packages/core/agent-loop/src/index.ts (FactoryOwnership dispose, prepare teardown, handle close), src/agent.ts (cancel/whenIdle semantics), packages/session/session-persistence-jsonl/src/index.ts (open/create claim paths), src/lease.ts (POSIX FileHandle flock vs Win32 named semaphore), src/win32.ts, src/storage.ts (HandleTracker.install teardown effect closing every open handle), vendor/cordis/lib/types/fiber.d.ts (fiber.dispose settles only after cleanup finished), packages/subagent/subagent/tests/persistence-helpers.ts, park-parent.ts, both target spec files, and afterEach precedents in packages/api/gateway + packages/api/session-controller tests.

Toolchain: Node v26.8.2 + pnpm 12.4.1 from C:\dsh-r24-upgrade-20260912-01 (PATH prefix on every command, including any hook-triggered pnpm work). No gh install, no auth/system changes, no keys or user .env read, no external agent invoked.

## Stage point of this handoff record

This file records the start state and the intended stage: baseline of the two unchanged files, minimal test-only ownership fix plus deterministic resource verification, two independent negative controls (NC-no-dispose, NC-no-await) with byte-verified restoration, gates, bilingual Agent Note, evidence - with NO commit and NO push in this round. A fresh-context independent review comes before any delivery; repair and re-review happen here until PASS.

## End state of this round (no commit, no push - stage gate reached)

Local and remote HEAD both remain 0bb1eff579a9e823d68fc8870896e9f143996a12 (re-verified via ls-remote after all runs). The candidate is the uncommitted working tree: two modified specs, two new test files (helper + direct regression), the bilingual Agent Note triplet, and this evidence directory. Final candidate hashes:

```
git blob                          sha256                                                            file
da23db7d7ba9351c0b6006b2e3a4b1c120f5cc6c  4bf4bd8d6e9e310b848f9dbffb0528515d299c29681710f05aab032f3c99db85  packages/subagent/tool-subagent-control/tests/owned-contexts.ts (NEW)
3db9a7732afa2f97c8da51ffcc42e02694154762  3934c18adcbb8ddfa6bf18491af62b1461c9456f81c1f96ad8bc96444152e518  packages/subagent/tool-subagent-control/tests/owned-contexts.spec.ts (NEW)
9d1d92fef1a58cc7e72e4f05ab14e37560768252  6df86407356f419c38168bd616daa3a5994c87812190fe0cb12e3d2696a53200  packages/subagent/tool-subagent-control/tests/tool-subagent-control.spec.ts (MODIFIED)
6f688a15daa7cb237de80c2cae8b1e00e5e2ccde  380c3d98456f548617c0d6a0cc929650e182d09758b3f87a382707fb95053e32  packages/experimental/tool-agent-team/tests/tool-team.spec.ts (MODIFIED)
```

Protected surfaces re-verified unchanged at end: AgentLoop destruction 6c30f041..., JSONL lease 59dfe27f..., MockAdapter 6a5d31e7..., read-handle helper d6c980e2..., r41 panel spec 4de2fd6e.... git status --porcelain at end: exactly the two modified specs, the two new test files, the Note triplet, and this evidence directory; nothing else. No production runtime source, vendor, lockfile, workflow, or frozen r29-r41 evidence byte changed. See FINDINGS.md for the executed matrix (baseline 28/28; first failure 7F/28P; candidate 35/35; NC-no-dispose 7F/28P; NC-no-await 2F/33P; post-restore and final confirmation 35/35) and gates (typecheck 0, lint 0, duplication 0 clones, i18n pairing, doc-sync 34/34).
