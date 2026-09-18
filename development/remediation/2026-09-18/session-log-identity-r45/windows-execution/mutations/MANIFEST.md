# r45 negative-control mutation manifest

All hashes are over the exact bytes staged during the final cycles (spec bytes SHA-256 `3461471a06993d4464be7fbb8d31161331339f229d1970b7807fe74918158e38`, git blob `1c213fd770a8ef23431f7662fb1a3519f823ceaa`). Mutants were produced by exact single-occurrence block replacement of the corresponding selector body (`build-mutants.mjs`, run from outside the repository); restores copied the saved original bytes back. No checkout, reset, or stash was used.

| File | Role | SHA-256 | git blob | Bytes |
| --- | --- | --- | --- | ---: |
| original-session-log-identity.ts | fixed candidate helper (restore source) | `7f8d3bd017156700a09f20344b4c3c02bc9216556116c9dcc25d915dbc8805f9` | `efb67536b82b664551614ab9d173ecc4c7cf4f19` | 7417 |
| nc1-session-log-identity.ts | NC-parent-text-match mutant | `68657d944a6ca5530adb0f684e1ad518d3b451179b8ce5106669dc6f1d0e0b6b` | `7737256b166f4d50d6d3e88bcb368e8ab1c57c34` | 7005 |
| nc2-session-log-identity.ts | NC-child-any-parent mutant | `601e4663af17f0b8d118f7f27d233857e42a39012b4359d17931650e632a286e` | `f8ace1d1dcda4f55e5010d5c06a63f303c78200b` | 6764 |

## Cycle results (final bytes)

- NC1 install: helper SHA-256 `68657d94...` verified in place; spec run exit 1, `6 failed | 9 passed (15)` (`../logs/32-nc1-final2-mutant.log`). Required rejections fired: `selects the parent and its child under every enumeration order` failed with `order child.jsonl,parent.jsonl,reference.jsonl,other-child.jsonl: expected 'child.jsonl' to be 'parent.jsonl'`; `rejects a parent id that only event bodies reference` failed with `expected [Function] to throw an error`.
- NC1 restore: helper SHA-256 `7f8d3bd0...` re-verified byte-identical.
- NC2 install: helper SHA-256 `601e4663...` verified in place; spec run exit 1, `8 failed | 7 passed (15)` (`../logs/33-nc2-final2-mutant.log`). Required rejection fired: `does not select another parent's child even when it enumerates first` failed with `expected 'other-child.jsonl' to be 'child.jsonl'`; the permutation order `parent.jsonl,reference.jsonl,other-child.jsonl,child.jsonl` failed the same way.
- NC2 restore: helper SHA-256 `7f8d3bd0...` and blob `efb67536...` re-verified byte-identical.
- Post-restore positive: spec exit 0, `15 passed (15)` (`../logs/34-final-restored-positive.log`).

Earlier cycles against the pre-typecheck-fix helper bytes (SHA-256 `3c1a58cd01ebbf1796b5c7c4ef8051d47f8c65b8fc7c4caff51a68dd8b36fa7e`, blobs recorded in `../logs/17` through `20` and `27` through `30`) showed the same failure patterns; those bytes were superseded by the strict-mode type fixes and the final cycles above are the authoritative record.

## Correction (appended post-review, pre-commit)

The attribution in the paragraph above is imprecise for `../logs/27` through `30`, and the paragraph is left unedited as a historical record: those four cycles did NOT run against the pre-typecheck-fix helper bytes. They ran with the final helper bytes (`7f8d3bd0...`) — `../logs/21b-typecheck-r2.log` passed at 17:15:01Z, before them — and what superseded them was the spec's 140-column lint fix: `../logs/22-lint.log` failed at 17:17:22–17:19:23Z on the spec's line length, and `../logs/22b-lint-r2.log` passed from 17:21:16Z, changing the spec bytes from the pre-lint state to the final `3461471a...` after logs 27–30 had already run. Only `../logs/17` through `20` used the pre-typecheck-fix helper bytes (`3c1a58cd...`). The authoritative final-byte cycles (helper `7f8d3bd0...` + spec `3461471a...`) are `../logs/31` through `34` and the table above.
