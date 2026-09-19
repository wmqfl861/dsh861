# r44-B supplement invocation record (real Codex CLI, attempts 1 and 2)

Records the real invocations that produced `plan.v1-supplement-s1.md`. The frozen v1 planner invocation remains MISSING argv/exit as recorded in `../planning/planner-invocation.md`; nothing here replaces or backfills it.

## Attempt 1 (abnormal termination, no supplement produced)

- Launched by the prior executor at `2026-09-17T05:18:33Z`; raw artifacts in repo-external `C:\dsh-r24-upgrade-20260912-01\r44b-codex-supplement\`.
- argv: `codex exec --model gpt-6-astra -c model_reasoning_effort=max --sandbox read-only -` with the same prompt file (SHA-256 `540642b77bca69532d8eb1132a7a25d15d9f12fd2ce7946e0e98bd7ec791a859`); Codex CLI 0.153.4; workdir `C:\Albert\project\dsh861`.
- From `05:41Z` its Windows sandbox helper failed repeatedly (`orchestrator_helper_exit_nonzero`, status `-1073741502` = STATUS_DLL_INIT_FAILED); the CLI logged `Retrying helper resolution`, then `ERROR: Reconnecting... 1/5` (05:46:36Z). The reconnect later succeeded and reasoning resumed (05:57Z), but helper failures continued.
- The prior executor's session was terminated; its wrapper script died with it, so when the codex process finally exited nobody captured its exit code. NOT FABRICATED: exit code remains uncaptured for attempt 1.
- stdout 0 bytes (no document). stderr final size 252,668+ bytes (still growing at last observation 14:01 local; final state not re-read after process exit). Attempt-1 stderr at 05:46:36Z: 251,963 bytes, SHA-256 `e029bcf9e8d1b722a36ee89fd996972c2e431d104e4d268cd94a776d04814ba2`.

## Attempt 2 (successful, canonical)

- Launched by the re-dispatched executor at `2026-09-17T05:50:30Z` after verifying the prompt file hash unchanged; raw artifacts in repo-external `C:\dsh-r24-upgrade-20260912-01\r44b-codex-supplement-2\` (wrapper `run-codex-supplement-2.sh` with 30s heartbeat).
- Program: npm-global `codex` shim; Codex CLI 0.153.4.
- argv (full): `codex exec --model gpt-6-astra -c model_reasoning_effort=max --sandbox read-only -` (prompt fed via stdin from `codex-supplement-prompt-r44b.txt`).
- workdir `C:\Albert\project\dsh861`; prompt SHA-256 `540642b77bca69532d8eb1132a7a25d15d9f12fd2ce7946e0e98bd7ec791a859`.
- exit_code=0; start `2026-09-17T05:50:30Z`, end `2026-09-17T06:13:45Z` (~23 min).
- stdout 25,529 bytes, SHA-256 `86e45e920f1889ad099b481e1be3b59f3008ed5246f4ea1319185936c5ce51fa`; stderr 672,029 bytes, SHA-256 `30488e32b6b43cf5a65b9290ae0a492738245ef6b0b31ed8cd8d862217b65a7d`; stderr ends with the CLI's standard accounting `tokens used 188,670`.
- The run stayed in its read-only sandbox; `git status` shows no repository modification by it (only evidence files written by the executor).
- Archived document: `plan.v1-supplement-s1.md` in this directory, byte-identical copy of attempt-2 stdout (cmp equality verified after copy; LF-only; single trailing newline; SHA-256 identical to stdout hash above).

## Acceptance by the implementing executor

- Covers the four mandated points: S1 (R1 old-interface forensics only, R44-K11, valid-first-failure definition, reduction-path rule), S2 (factory multi-handle wait acceptance R44-K09/K10 on the real repository path), S3 (approved-scope confirmation matching `C:\dsh-r24-upgrade-20260912-01\r44b-scope-approval\scope-approval-registration.md`), S4 (waiting relationships P/H/C/W/M with anti-self-wait algebra, R44-S13, real-shutdown snapshot suffix requirements, PY-B01..B07 input checks, ordering R1→R2(K01–K11)→R3(S13)→R4→R5).
- New case count: 4 new IDs (K09, K10, K11, S13); planned totals Subagent 13 + Team 8 + core 11 = 32 new owner-local cases; 40 original + 32 = 72 target.
- No write target outside the approved list; frozen v1 untouched.
