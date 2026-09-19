# r47 second-executor start state and audit of the concurrent session's artifacts

Recorded 2026-09-19 ~12:05 UTC, before any command of mine mutated anything.

## Start state

- Repo `C:\Albert\project\dsh861`, branch `chore/latest-stable-upgrade-20260912`,
  HEAD `f20ca4b97f9c3babb05b95e96a04e09031f92806` (same base the concurrent
  session recorded; no fetch, no remote operations).
- Working tree at hand-off: `M scripts/prepare-ci-bubblewrap.sh`; untracked —
  `scripts/prepare-ci-bubblewrap.spec.ts`, the three Agent Note files
  (`.md`/`.zh.md`/`.i18n.yaml`), the r47 evidence tree
  `development/remediation/2026-09-19/ci-bubblewrap-acquisition-r47/`, and the
  three preserved r44 artifacts (untouched, kept).

## Audit verdicts (concurrent session artifacts → adopted / corrected)

1. **Script diff** — `git diff scripts/prepare-ci-bubblewrap.sh` is exactly
   `4 insertions(+), 1 deletion(-)`: the URL line replaced by
   `https://snapshot.ubuntu.com/ubuntu/20260901T000000Z/pool/main/b/bubblewrap/bubblewrap_${BUBBLEWRAP_VERSION}_amd64.deb`
   plus a 3-line source comment. The URL is **character-exact** equal to the
   verified snapshot URL required by PR13 comment 5738542974. `BUBBLEWRAP_VERSION='0.9.0-1ubuntu0.1'`
   and `BUBBLEWRAP_SHA256='1b506492bd9c7fd0cdb4f02ac822f1d3e336b0aead5113c1239baf8db5db562a'`
   are context-unchanged; curl flags, hash-before-extract order, platform/env
   gates, tolerated sysctl, probe, and all exits unchanged. → **ADOPTED, no edit needed.**
2. **Spec** `scripts/prepare-ci-bubblewrap.spec.ts` (15594 B, SHA-256
   `2ea9ae86e4f055011f5fd2ed4b640165deec8a5ff7c652691f786c44c66d7c86`) —
   executes the real Bash script; stubs on a per-run PATH for `uname`, `curl`,
   `sha256sum`, `dpkg-deb`, `sudo`, and the extracted `bwrap` (via
   `bwrap-payload` copied by the dpkg-deb stub); 13 tests = 2 source-level +
   11 end-to-end covering all 8 required behavior classes plus connection
   failure and both env-var gates. Success path asserts the request URL equals
   the verified snapshot URL, the hash-check stdin contains the **original
   pinned SHA**, and exactly one success line; every failure scenario asserts no
   later phase ran (stub-observed). Failure exits pinned: 404→22, conn→7,
   digest→1, extract→2, probe→17, platform/env→1. → **ADOPTED; re-executed by me, 13/13 exit 0 twice (logs 02/03).**
3. **Mutants** under `../mutations/` — `diff` vs `fixed-candidate.sh` shows each
   is a single surgical line: NC1 swaps only the URL base back to the dead
   `archive.ubuntu.com` rolling pool; NC2 appends only ` || true` to the
   sha256sum check line. SHAs match `MANIFEST.md` byte-for-byte
   (`a8cbf098…`, `fc8571e6…`, fixed `37a96d50…`). → **ADOPTED as the mutant bytes for my re-execution.**
4. **Agent Notes** — en + zh both state: UBUNTU-CVE-2026-87766 **not closed**
   (still a CVE-listed pin; acquisition restoration, not a security upgrade;
   upgrade stage + P0-B stay blocked); real Linux unpack/sysctl/probe
   **NOT_RUN locally** (owned by CI's ephemeral runners; stubs prove control
   flow only); version + SHA-256 + official-source pinning unchanged. Language
   switcher lines in correct order both sides; `.i18n.yaml` blob hashes match
   the current files exactly (`097a2a22…` / `0c78edf7…`); full pairing re-check
   849 pairs consistent, exit 0 (log 11). → **ADOPTED, no edit needed.**
5. **Evidence claims vs my re-execution** — their FINDINGS numbers all
   reproduced independently by me: 13/13 on fixed bytes (exit 0); NC1
   6 failed / 7 passed with `bash -n` valid mutant; NC2 exactly the
   digest-mismatch test failing (`expected +0 to be 1` — the `|| true` mutant
   crossed the checksum into extraction, detected via the observed exit, not a
   string search); restores byte-verified; `bash -n` 0; oxlint staged clean;
   typecheck exit 0. One nuance corrected in my logs: their runs used the
   prefix's Node v26.8.2, mine used PATH Node v26.4.0 for direct-entry runs —
   irrelevant to results, recorded per-log for accuracy.

Nothing in the concurrent session's artifacts required correction; the only
"fix" this session made was to its **own** driver's summary parser: the first
NC1 invocation mis-parsed vitest's `Tests 6 failed | 7 passed (13)` summary
because of ANSI color codes (driver exit 1 with `EXPECTATION_PARSE_FAIL`), while
its vitest run and byte-verified restore were already identical to the clean
re-run recorded in log 04. That attempt-1 file was overwritten by the clean
re-run under the same name (same mutant bytes, same results); only the clean run
is preserved on disk.
