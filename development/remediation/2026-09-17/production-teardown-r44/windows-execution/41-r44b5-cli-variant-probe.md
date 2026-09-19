# r44-B CLI capability probe: actual program identity and run --variant (2026-09-18)

Authority: PR #13 issuecomment 5724697192 section C. All commands local, no model inference request, no review prompt, no business question, no auth probe. Raw logs outside repo at C:/dsh-r24-upgrade-20260912-01/r44b5-evidence/ (write-then-readback verified).

## Launch chain from the round-3 wrapper

- Wrapper C:/dsh-r24-upgrade-20260912-01/r44b4-opencode-review-r3b/run-review.sh prepends the npm global dir to PATH and invokes bare opencode. Its recorded program=/c/Users/Joyce Gu/AppData/Roaming/npm/opencode (sh shim). The sh shim and opencode.cmd both exec: node_modules/opencode-ai/bin/opencode.exe.
- Actual program: C:UsersJoyce GuAppDataRoaming
pm
ode_modulesopencode-aiinopencode.exe, 179998248 bytes, SHA-256 0242a0dc705af67c90882b456a36b619883c1c786aad8fe071a1bc64e5d1d440. npm package opencode-ai@1.18.31 (package.json read). File mtime Sep 17 10:16 local, i.e. before the round-3 invocation window 2026-09-17T15:52:23Z; the binary has not been replaced since. (Published copies should redact the username path segment.)
- Shim hashes: opencode (sh) 0f2f05dcd20bcaefd7c050e8d6505d58d4136e896ea38ae9efe561911f04af6c, opencode.cmd b53b698473bfa46e09487e485a7f1ad5b4881f8a8b319d3619aa251f3be8ae10.
- Path resolution checks (no HOME/disk scan): where.exe opencode -> the sh shim and opencode.cmd under the npm dir; PowerShell Get-Command opencode -All -> opencode.ps1 (ExternalScript), opencode.cmd, opencode (Application). All resolve to the same actual exe.

## Captures on the same actual exe

- argv [opencode.exe, --version]: stdout 1.18.31 (7 bytes, sha256 ce93d3a23f487a3c7a9c41bcac7a01907e2d098e11d63d7d77187cb38add2af5), stderr empty, exit=0.
- argv [opencode.exe, run, --help]: stdout empty, stderr 3053 bytes (sha256 d62299ebc267afdf5bab2c07fbfe1a6625cc8769cb7073b3bad975e9531c5732), exit=0. Help lists, among others: -m/--model, --agent, --format, --title, --variant, --thinking. Exact --variant entry: "--variant  model variant (provider-specific reasoning effort, e.g., high, max, minimal)  [string]". Full text archived at r44b5-evidence/cli-run-help.stderr.
- argv [opencode.exe, models, --help]: confirms models [provider] with --verbose (metadata incl. costs) and --refresh (not used). exit=0.

## Conclusion and reconciliation with the historical record

- CLI_OPTION_SUPPORTED: the actual program that the round-3 wrapper chain resolves to exposes --variant on the run subcommand today, and its file predates the round-3 run. The invocation.txt line "CLI 1.18.31 exposes no --variant flag" was an unverified note (no run --help was saved in that round) and is contradicted by the actual binary.
- Per authority, this does not retro-authenticate the round-3 argv: PARAMETERS_NONCONFORMING stands unchanged for the historical run (its argv indeed lacked --variant). The new probe proves current capability only; provider-side acceptance of the mapped option is validated by the authorized Phase-E review call itself.
