# r43 evidence manifest

Manifest point-in-time: after all finalized files below were written and read-back verified, including the post-review corrections (probe attribution, sequencing-note raw-overwrite disclosure) and the post-correction pairing/doc-sync re-runs. Each hash is over the in-repo file bytes and this manifest is the authoritative per-file record — the review independently recomputed all 19 pre-correction entries and they matched at that point. Raw pre-normalization logs and mutated-byte copies stay repo-external under C:/dsh-r43-work/raw; the repo-external normalization record retains only its last invocation (each normalize call overwrote it) and is not a complete dual-hash ledger.

9e3e48b5144e497f70b40e12b5a796232a93767995c77cedde601c103e52e573  00-start-state.md  (2323 bytes)
c6cf2c82eff954daaeee14da7fd2192c2a7ab667ed20f36010e45725b30ccc21  02-first-failure.normalized.log  (6138 bytes)
a784ad82bf4ae53861e963d593b709146756438326038fc99a87cfdf4b71dec7  03-positive-candidate.normalized.log  (11357 bytes)
338c3704491557d5fbcf62b07b23d5f62a23a0d579a6cf8f7c8861ba88abd488  04-nc-ignore-logged-failure.normalized.log  (6282 bytes)
8337bfc9fa73671d10c76833eb1c85ca42f15c40a65bfcc66dd7b6b14f5af166  05-nc-ignore-restore-positive.normalized.log  (11357 bytes)
386714766de9ad9aa3401b60020c49d0183b438f88fcb2d4c02d92ae481f47b6  06-nc-observer-too-short.normalized.log  (6138 bytes)
fe35ff4576b161cdf1be216ddc59d4563cfbed0dfddf99104fb7f3a1d197d902  07-nc-observer-restore-positive.normalized.log  (11357 bytes)
51274c6281d42d235cf76ce68576daee902de2ec96231a181f44449e39272b3d  08-gate-typecheck.normalized.log  (196263 bytes)
fdb6b3f9b664e6028ca5bd3a6608d248cc22240ef77597fd7bdd79093368a21a  09-gate-lint.normalized.log  (191866 bytes)
6d177b509dbfc5e3f0405fa61faf4516fab582793d9e4b673be1fc9064d7e2b5  10-exposed-defects-diagnosis.md  (5647 bytes)
081cc46433e0ec9c04c63d178ff5277422eb2f8e6b786fdcc81c670de5879fd3  11-gate-duplication.normalized.log  (2318 bytes)
67089108ffc8603e3333f2c444bbd58f071a82eae0e1984a5b0a09a436f96952  12-gate-pairing.normalized.log  (342 bytes)
f778275c06d68c7a81f897c1961aaca079acecc95e09bfa2eee21b0ab2678a1c  13-gate-docsync.normalized.log  (2881 bytes)
b613b3597e6f170868021f5686eab2e2ea1af11b61c742eba4b263c8c72e12ce  14-final-positive.normalized.log  (11356 bytes)
9cd029764f50eec71a1d06c00d3e02d6cefb87f8db7c04b817d9b6b47bbe798e  15-mutation-restore-verification.md  (4734 bytes)
67089108ffc8603e3333f2c444bbd58f071a82eae0e1984a5b0a09a436f96952  16-gate-pairing-post-review.normalized.log  (342 bytes)
58a5b1b2e0ba72a39cdbc0e28d62dc26446d064388a106880b0913da886798a2  17-gate-docsync-post-review.normalized.log  (2882 bytes)
e12ee6701cf77076fe73e10d00ab466c6160910366dc479192699dccefd32a30  FINDINGS.md  (8661 bytes)
cea61adb8a5b4d530eb2648679e227400af3e5b2c6ec534ecf2f47e7a2ba5d29  diagnostic-control-isolated.normalized.log  (6076 bytes)
f70fbfae1960c471ae9547bfe797f48ca2f51d044c2f275d9bcc3bf6a0c4ad10  diagnostic-team-isolated.normalized.log  (6734 bytes)
