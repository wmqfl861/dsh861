# r47 supply-chain / security policy check (before any code edit)

Question put to the repository's own governing text: does any current policy allow, forbid, or fail to cover "keep acquiring the CVE-listed pinned `bubblewrap_0.9.0-1ubuntu0.1` payload (same bytes, pinned SHA-256) for the restricted purpose of restoring CI preparation"?

## Search scope (what was actually examined, 2026-09-19, HEAD f20ca4b9)

- Root `AGENTS.md` (workspace instructions in force), including the Vendoring policy, Secrets/.env, Conventions, and Defensive patterns sections.
- Root policy-shaped documents: `SAFETY.md` (+ `.zh.md`), `SECURITY_CREDENTIAL_ROTATION.md`, `CONTRIBUTING.md`, `NODE_DEVELOPMENT_RULES.md` headers.
- `docs/` tree (all top-level `*.md` filenames enumerated; targeted reads of `docs/testing.md`, `docs/architecture.md` supply-chain-adjacent mentions): no dedicated supply-chain/security policy document exists there.
- `.agents/notes/` full-tree grep for `CVE`, `supply`, `advisory`, `security polic`: the only supply-chain governance artifact is `.agents/notes/proposed/process/2026-06-11-supply-chain-and-vendor-drift.md`, whose `Status: proposed` section proposes (does not mandate) vendor-drift checks and npm advisory scanning; it covers npm dependencies and `vendor/` drift, not CI-downloaded OS packages, and proposed notes are not binding policy. All `CVE` grep hits elsewhere are `execve` false positives.
- `scripts/run-gates.ts` gate inventory: no supply-chain, CVE, or advisory gate exists; the closest are `verify-vendored-links`, `verify-package-dependencies`, `verify-dsh-package-licenses`.
- The CI surface that owns the payload (`.github/workflows/ci.yml`, `ci-master.yml`, `e2e.yml`, `sandbox.yml`) and `scripts/ci-workflow.spec.ts`: the repository's tested, committed practice is exactly "prepare bubblewrap from the pinned payload without a package transaction" (`scripts/ci-workflow.spec.ts:690-699` asserts the pinned-payload step and the absence of `apt-get`) — an existing accepted pattern that predates CVE-2026-87766 and nowhere addresses CVE-listed versions.

## Conclusion: (c) policy does not cover this situation

No repository policy text speaks to acquiring a CVE-listed pinned CI payload. Nothing forbids continuing the same-byte pin; nothing explicitly authorizes it either — the committed pinned-payload pattern (`scripts/ci-workflow.spec.ts` "prepares bubblewrap from the pinned payload without a package transaction") and the *proposed* (non-binding) supply-chain note are the nearest texts and neither addresses the CVE dimension.

Conservative handling, per the round's red lines: the restricted fix, regressions, negative controls, and evidence below are prepared as reviewable working-tree output only; nothing is committed or pushed this round. Commit authorization is left to the owner after independent review, with the explicit facts that (1) the pin remains CVE-affected (`UBUNTU-CVE-2026-87766`, upstream fix toward 0.12.0, supported fixed builds still require USN-8779-x verification), (2) same-byte restoration is not a security fix, and (3) a minimal version migration proposal is included in the round report for a future round: pin a specific Noble fixed build from the official archive/snapshot with its own SHA-256, verify `libc6`/`libcap2`/`libselinux1` dependency compatibility on the runner image, and re-run the existing functional probe under CI before removing the CVE caveat.
