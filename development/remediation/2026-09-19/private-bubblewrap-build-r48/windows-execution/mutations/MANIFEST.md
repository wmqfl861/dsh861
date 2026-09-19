# r48 mutation manifest (negative controls)

Fixed candidate: `scripts/prepare-ci-bubblewrap.sh` — git blob `7d2428e2fa84b7fda9aeec24fa1de661cb90cb46`, SHA-256 `28d31aa9fd7db6f848796feca43725bcd547bca268b56384d6f9ed89068d53a3`, 16220 bytes — identical through the r48 remediation round (independent review found no script defect). The spec companion `scripts/prepare-ci-bubblewrap.spec.ts` after the review-mandated stub fixes is blob `91bcd7fa4833b8687ebf66e8a136a65fe0c78e66`, SHA-256 `8a36f0a700767434356ebe22283c378ce19c03cd51f4d2bcdd0482d527920e79`, 40731 bytes; both negative controls below were re-executed against exactly these spec bytes (see `logs-r48/31-negative-controls-remediated.log`).

Every state below ran only inside the fully stubbed spec environment; the real network, toolchain, and probe were never touched with checks skipped. `bash -n` exit 0 on the fixed candidate and on both mutants.

| State | File | Mutation | Result |
| --- | --- | --- | --- |
| fixed candidate | `fixed-candidate.sh` | none | full suite 36/36, exit 0 |
| NC-bypass-hash mutant | `nc-bypass-hash-mutant.sh` | digest-gate `fail "…pinned SHA-256…"` replaced by a `:` no-op | targeted digest-mismatch subset 3 failed / 33 skipped, exit 1 — caught |
| NC-bypass-hash restored | `nc-bypass-hash-restored.sh` | — | SHA-256 identical to fixed candidate; targeted subset green, exit 0 |
| NC-fail-as-success mutant | `nc-fail-as-success-mutant.sh` | ` || true` appended to the functional probe command | targeted fatal-probe subset 1 failed / 35 skipped, exit 1 — caught (mutant exits 0 and publishes; the test demands exit 17 with zero publication) |
| NC-fail-as-success restored | `nc-fail-as-success-restored.sh` | — | SHA-256 identical to fixed candidate; targeted subset green, exit 0 |

After both restores the full suite ran green on the final bytes (36/36, exit 0). Harness log: [logs-r48/30-negative-controls.log](../logs-r48/30-negative-controls.log); the first harness attempt ([logs-r48/29-negative-controls-first-attempt.log](../logs-r48/29-negative-controls-first-attempt.log)) failed only because its own TMP/TEMP strings were written with mangled backslashes (a literal tab made vitest's temp mkdir fail, collecting no tests); the script was still restored byte-identically in that run's finally, and the harness was fixed (forward-slash temp paths) before the recorded green run.
