# W08 findings — B01-20260919-01

## 1. Bilingual fact verification (before / after)

Machine-fact comparison of both tables (event keys, modes, declared-in
`path:line` + link target, dispatcher sets incl. dispatch-method annotations,
listener sets; paired-document locale links folded before compare) found
exactly **5 differences before the fix, 0 after** — no other machine-field drift
existed. Row counts: 72 data rows per side (68 declared events + 4
undeclared-string rows), identical section structure.

| Event | zh before | zh after | en (unchanged) | actual source declaration |
|---|---:|---:|---:|---|
| `agent-preset/selected` | types.ts:80 | **types.ts:82** | types.ts:82 | `packages/preset/agent-presets/src/types.ts:82` |
| `subagent/provider-added` | index.ts:142 | **index.ts:144** | index.ts:144 | `packages/subagent/subagent/src/index.ts:144` |
| `subagent/provider-removed` | index.ts:148 | **index.ts:150** | index.ts:150 | `packages/subagent/subagent/src/index.ts:150` |
| `subagent/start` | index.ts:159 | **index.ts:161** | index.ts:161 | `packages/subagent/subagent/src/index.ts:161` |
| `subagent/end` | index.ts:168 | **index.ts:170** | index.ts:170 | `packages/subagent/subagent/src/index.ts:170` |

Exactly five, all zh two lines behind — matches the CP0-verified baseline
count. Source lines verified by direct grep of the working tree (outputs in
logs). Additionally, all 68 declared-event anchors were probed against source
BEFORE baking the check into the spec: 68/68 sit on the event's declaration
line (probe: `C:\dsh-b01-w08\anchor-probe.mjs`, "anchor violations: 0").

## 2. Generator run record (D10 isolation)

- Command: `pnpm run verify-doc-graphs` (= `tsx scripts/gen-doc-graphs.ts --check`),
  logged in `logs/verify-doc-graphs-01.log`, **exit 0**:
  `gen-doc-graphs: 6 graph doc(s) are up to date.`
- `--check` regenerates all six documents in memory from the current source and
  compares against committed bytes without writing, so this single run proves
  both required facts with zero worktree effect:
  1. The English `docs/event-producer-consumer.md` (wholly generator-owned)
     matches current source on every machine field — no English regeneration
     was needed and no English modification was manufactured (D11).
  2. The other five generator outputs (`docs/graph-atlas.md`,
     `docs/capability-seams.md`, `apps/cli/composition.md`,
     `docs/agent-lifecycle.md`, `docs/tool-execution-pipeline.md`) regenerate
     byte-identical — **no drift**, nothing to register with master control.
- Log sha256: `4ea3fd1d962d93480e78913d0fec7216266143e689c0fd3238124ac65fabd9fa`.
- `scripts/gen-doc-graphs.ts` untouched (start blob = end blob `242ce910…`, R/F).

## 3. Content-level spec and negative controls

New file `scripts/event-producer-consumer-pair.spec.ts` (pre-registered path).
It checks, at the existing top-level unit entry:

- cross-language machine-fact equality (keys, modes, declared anchors + links,
  dispatcher/listener sets with method annotations), locale link targets folded;
- source-anchor validity: every `Declared in` `path:line` must sit on the
  event's actual declaration line — catches both-sides-stale rows that a
  two-language comparison accepts;
- fail-loud parsing (unrecognized cell/shape becomes a reported difference);
- rejection boundaries as in-file mutation cases (one-side stale line, dropped
  listener, both-sides-stale, locale-fold vs real URL drift).

Physical runs (all logged with real exit codes):

| Run | Command | Result |
|---|---|---|
| spec-01 | `node node_modules/vitest/vitest.mjs run --project thread-safe scripts/event-producer-consumer-pair.spec.ts` | exit 1 — 4 failed: parser missed method notes on bare (unlinked) package entries like `` `session-controller` (`emit`) ``. First failure preserved in `logs/spec-01-positive.log`. |
| spec-02 | same, after parser fix | exit 0 — 6/6 passed. Discovery by the thread-safe project proven by the run itself. |
| control A | real zh doc restored to stale `types.ts:80`; pairing re-recorded over the drift; named-pair pairing check → **exit 0** ("1 named pair(s) consistent"); content spec → **exit 1** | proves a passing pairing hash cannot substitute for content consistency; spec rejects with `agent-preset/selected: declared source …:82 vs …:80` and `zh agent-preset/selected: …:80 is not its declaration line` |
| control A restore | copy-back from byte-preserved original | sha256 identical to pre-mutation; spec exit 0 (6/6) |
| control B | `tool-subagent` listener dropped from real zh `subagent/provider-added` row; spec → **exit 1** | rejects with `subagent/provider-added: listeners … tool-subagent … vs without` |
| control B restore | copy-back | sha256 identical; spec exit 0 (6/6) |

Restore checkpoints (sha256 of `docs/event-producer-consumer.zh.md`):
`0edcc51e…` at preserve, restore A, and restore B — identical. The `.i18n.yaml`
re-record performed during control A was also reverted (sha256 `fc840175…`
before and after). Raw log: `logs/negative-controls.log` (copy also under
`mutations/`).

## 4. Pairing re-record

After the zh fix: `pnpm run verify-translation-pairing --write
docs/event-producer-consumer.md` — named pair only, no `--all`. See
`logs/final-gates.log` for the record write, the named-pair check, and the
md-links / md-wrap / doc-graphs gate results.

## 5. Other-document drift disposition

None. `verify-doc-graphs --check` exit 0 proves all six generator-owned
documents regenerate byte-identical from current source; the only changed file
on the English/generator plane is nothing at all — the English table needed no
change. No mechanical line-number drift in the other five docs, so nothing was
deferred to master-control registration.

## 6. File identities (start → final)

| Path | Start blob | Final blob |
|---|---|---|
| docs/event-producer-consumer.md | `4f42fe342086af1bbe7c71dd48a4e30d469b34f5` | `4f42fe342086af1bbe7c71dd48a4e30d469b34f5` (unchanged) |
| docs/event-producer-consumer.zh.md | `714564a8ad9c0e067aa6c29a3c83aa2d61f99872` | `a612f9939a1c10eb8dad2196f0b18296e9fc12d1` (5-line sync) |
| docs/event-producer-consumer.i18n.yaml | `c38a0c3e742c1f665c79f68f0e51c1e892662f1a` | `f720b5be0d9a5b61b09ace807ccf8a5c27c3935e` (zh hash re-recorded) |
| scripts/event-producer-consumer-pair.spec.ts | NEW | `56e364436bf0f49d5847d9c346a29c0df4b1a583` |

Frozen/read-only inputs re-verified untouched at end (blobs identical to
`00-start.md`): `scripts/gen-doc-graphs.ts` `242ce910…`,
`docs/capability-seams.md` `9cc7a6fc…`, `apps/cli/composition.md` `406edb45…`,
`docs/agent-lifecycle.md` `6ffe3c2b…`, `docs/tool-execution-pipeline.md`
`f9d3d145…`, `docs/graph-atlas.md` `e37719c4…`. `git diff --check` exit 0.
Final post-gate spec run: exit 0, 6/6 (`logs/spec-03-final.log`).

## 7. Rework (CP-A integration typecheck TS18048, same session)

CP-A first failure: 22 × TS18048 (`'a'/'b' is possibly 'undefined'`) in
`scripts/event-producer-consumer-pair.spec.ts` lines 193–204 (full list:
`C:\dsh-b01-cp-a\typecheck.log`). Root cause: `tsconfig.base.json` sets
`noUncheckedIndexedAccess: true` and `tsconfig.host.json` includes
`scripts/**/*.ts`, so the integration program types `enRows[i]`/`zhRows[i]` as
`MatrixRow | undefined` — a strictness the vitest transform path does not apply.

Fix: one fail-loud guard in the `factDifferences` row loop (the only change):

```diff
     for (let i = 0; i < Math.min(enRows.length, zhRows.length); i++) {
       const a = enRows[i]
       const b = zhRows[i]
+      // Unreachable under the Math.min bound; the explicit guard keeps the
+      // impossible row pair fail-loud instead of asserting it away.
+      if (a === undefined || b === undefined) {
+        differences.push(`${name} row ${i + 1}: row present in one list only`)
+        continue
+      }
       const where = a.event || b.event || `${name} row ${i + 1}`
```

No non-null assertions, no loosened semantics; the unreachable branch reports a
difference (in-band with the function contract) rather than throwing.

Verification (`logs/rework-ts18048-verify.log`):

- File-level strict check reproducing the integration program's flags:
  temp `C:\dsh-b01-w08\tsconfig.w08-file.json` extends
  `tsconfig.host.json` (single-file include), then
  `pnpm exec tsc --noEmit -p C:/dsh-b01-w08/tsconfig.w08-file.json` → **exit 0**,
  zero TS18048. tsbuildinfo residue stayed in the TMP dir, none in the repo.
- `node node_modules/vitest/vitest.mjs run --project thread-safe
  scripts/event-producer-consumer-pair.spec.ts` → **exit 0, 6/6 passed**.

Spec file identities: pre-rework blob `56e364436bf0f49d5847d9c346a29c0df4b1a583`
→ final blob `a168c30a15197e80402ee9ec184b3d01463c17c4`
(sha256 `aab5710358775db3152a69b8c63c6a9d56f4229bcac5d8b8b4a0a4ecc3f4699a`).
Doc files untouched by the rework; no paired-doc gate re-run needed (the spec
is their only consumer change). Integration typecheck rerun belongs to CP-A.

## 8. Not done / out of scope

- No full-repo refresh, typecheck, or lint (per constraints); no commit/push.
- Corpus-wide pairing and the full doc-sync aggregate remain with doc-sync/CI.
- r44 historical evidence untouched.
