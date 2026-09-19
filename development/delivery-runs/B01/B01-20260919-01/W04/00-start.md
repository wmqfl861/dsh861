# W04 start record — 2026-09-19

## Identity

- Task: W04 cross-platform shared SDK snapshot contract (formal plan v1, §2 W04; D04/D05/D06).
- Repo: `C:\Albert\project\dsh861`, branch `chore/latest-stable-upgrade-20260912`.
- HEAD at start: `6528141bc9f435f8a2361f4a0c56eb9393092c02` (plan input HEAD `f5ab2fed…` is an ancestor; concurrent streams W01/W06/W08/W09 own their own files, none in `snapshots/`).
- Platform: win32 10.0.26200 x64. Node `v26.8.2` (`C:\dsh-r24-upgrade-20260912-01\node-v26.8.2-win-x64\node.exe`), pnpm `12.4.1` (`C:\dsh-r24-upgrade-20260912-01\pnpm-12.4.1\pnpm.exe`), both dirs PATH-prefixed for task subprocesses.
- Raw run workspace (repo-external): `C:\dsh-b01-w04\` (`tmp\`, `capture\`, `logs\`, `mutations\`).

## Owned / frozen inputs (FILE_OWNERSHIP §3.3, this task)

- W: `snapshots/sdk/sdk.snapshot.ts` (start blob `cd62c0e4b78140f8279cc2fdc743e77a92f90324`).
- W?: `snapshots/sdk/teardown.snapshot.ts` (start blob `a7584b0d0bab54533ba037ae895f69133fee791d`) — read-only use this round; no modification planned.
- N (pre-registered new): `snapshots/sdk/subagent-teardown/tool-schemas.win32.expected.json`, `snapshots/sdk/subagent-teardown/tool-schemas.1.win32.expected.json`, `snapshots/sdk/agent-team-teardown/tool-schemas.win32.expected.json`, `snapshots/sdk/agent-team-teardown/tool-schemas.1.win32.expected.json`.
- R/F frozen: both scenarios' `session.v3.jsonl`, `session.1.v3.jsonl`, `tool-schemas.1.expected.json`, `system-prompt.1.expected.md`, entry/trigger/override files; shared `session/text-turn` sources.

## Start-state facts established before any run

1. `packages/bundle/base/cordis.patch.yml` gates `tool-bash`/`bash-sandbox` off on win32 and `tool-pwsh`/`pwsh-sandbox` off elsewhere (lines 214–252). Both teardown compositions assemble the platform shell tool only (`tool-pwsh` on win32, `tool-bash` elsewhere); the scenario trigger plugins contribute no tools.
2. Committed expectation bytes are mixed-platform today: parent (class-pin) schema+prompt sources are `session/text-turn` (bash flavor, `tool-schemas.expected.json` blob `1531215c…`, `system-prompt.expected.md` blob `b3c8e3db…`), while both scenarios' committed child sidecars (`tool-schemas.1.expected.json` blobs `3b51e300…`/`e55ca1d0…`, `system-prompt.1.expected.md`) carry win32 captures from r46 (`9f27326b07`, make-goldens on Windows; shared lane itself never ran on win32 — hydration defect).
3. The system prompt is platform-flavored through the shell tool's `ctx.systemPrompt.section` registration (`packages/shell/tool-pwsh/src/index.ts:243-247` vs tool-bash's): committed parent prompt line 8 is the bash exit-code section; both child prompt sidecars carry the pwsh Windows-kill section. Consequence recorded up front: a win32 parent-prompt comparison cannot pass against the text-turn prompt; see FINDINGS.
4. Fixtures tokenize both prompt text (`{{system}}`) and tool bulk (`{{tools}}`), so the whole-Session comparison is platform-neutral; only the full-header comparison (schema restore + real prompt text) is platform-specific. Parent fixtures: 1 `request/header` (reason `initial`), 2 turns; child fixtures: 1 `request/header`, 1 turn.
5. Known blockers carried in (not re-derived): shared automatic lane on win32 hits the raw `{{cwd}}` hydration (`sdk.snapshot.ts:345`, W05's fix); Linux lane depends on W03.

## Planned execution order

capture via dedicated adapter dump → independent review → write 4 registered sidecars → platform selection in `sdk.snapshot.ts` → shared-lane run (own TMP) → dedicated adapter read-only verify → negative controls with byte-preserving restore → FINDINGS/report.
