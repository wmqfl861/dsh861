# W04 negative-control mutation record

All mutations ran on files with no concurrent writers, with byte-presave before and SHA-256-verified restoration after; each mutated run's real target failure and the post-restore baseline are archived under [../logs/](../logs/).

## Scaffold (verification-only, not a negative control)

`sdk.snapshot.ts` `hydrateReplayFixtures` was temporarily changed to `JSON.stringify(cwd).slice(1, -1)` hydration so the win32 lane could reach its comparison assertions (the final candidate keeps the raw replacement — W05's scope).
- Presave: `mutations/sdk.snapshot.ts.pre-hydration-scaffold` SHA-256 `2ff4eee95a7707ff2203ae33805ed63343213f26b8627f10dd4456c29357f83d`
- Applied for logs 14–18; reverted; restored file SHA-256 re-verified `2ff4eee9…`.

## NC1 — pwsh description mutation

- File: `snapshots/sdk/subagent-teardown/tool-schemas.win32.expected.json` (W04-owned new file).
- Presave: SHA-256 `bb3b0d0a6d213953e88db2fd39318e1ae166f8ea021b0023fed084f049ca9559`; copy `subagent.te-tool-schemas.win32.expected.json.orig`.
- Mutation: `pwsh.description` prefixed with `MUTATED `.
- Result (log 15): target assertion `subagent-teardown: session 0 header 1` rejected (deep-equal failure) — not the later prompt assertion.
- Restore: copy back; SHA-256 re-verified `bb3b0d0a…`.

## NC2 — pwsh input-schema mutation

- File: `snapshots/sdk/agent-team-teardown/tool-schemas.win32.expected.json` (W04-owned new file).
- Presave: SHA-256 `22edc948119a07d61d7c6eba7d10de8063b26978d2ae4f0e1fe38d1a8965d36e`; copy `agent-team.te-tool-schemas.win32.expected.json.orig`.
- Mutation: `pwsh.parameters.required` `["command","description"]` → `["command"]`.
- Result (log 16): target assertion `agent-team-teardown: session 0 header 1` rejected.
- Restore: copy back; SHA-256 re-verified `22edc948…`.

## NC3 — delivered-evidence deletion

- File: `snapshots/sdk/agent-team-teardown/session.v3.jsonl` (R/F frozen input; byte-presaved first).
- Presave: SHA-256 `196e2c05cbdb466329dde258e751a485570a76e65123f166619c1a8305a533ef`; copy `agent-team.session.v3.jsonl.orig`.
- Mutation: removed both `team/message/delivered` lines (43 → 41 lines).
- Result (log 17): target assertion `agent-team-teardown: sessions` rejected (live parent 42 records vs expected 40) — missing delivery evidence cannot pass.
- Restore: copy back; SHA-256 re-verified `196e2c05…`; file absent from `git status` modified list.

## Post-restore baseline (log 18)

Both scenarios return to the pre-mutation scaffold behavior: whole-Session comparison passes, parent schema comparison passes, failure at the parent system-prompt assertion (the D04-scope gap documented in FINDINGS F4).
