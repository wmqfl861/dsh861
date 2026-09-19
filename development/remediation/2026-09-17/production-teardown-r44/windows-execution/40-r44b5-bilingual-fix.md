# r44-B bilingual minimal correction and candidate-r44b5 re-freeze (2026-09-18)

Authority: PR #13 issuecomment 5724697192 (r44-B successor task) and issuecomment 5724684848 (published local verification receipt). Both fetched credential-less via api.github.com REST (curl), bodies archived at C:/dsh-r24-upgrade-20260912-01/r44b-authoritative-{task,receipt}-comment.{json,md}. Where this relay and the dispatch differed, the stricter reading was followed.

## B1 single-row replacement

- Target: docs/event-producer-consumer.zh.md L88, unique anchor row | internal/status | - | [agent](../packages/core/agent), inspector | -> identical row plus agent-team between agent and inspector. One line replaced via exact string match; no other byte of the file touched (+14 bytes = the inserted backtick agent-team backtick comma space).
- Before (== candidate-r44b4 manifest rows, recomputed before edit): zh.md 24579 bytes / blob a729da9c0ce8978b6da9ee031074e3ce2d97a784 / SHA-256 60497305d5776f873e18cd0677624a165b04450f232cf141c038aa8787765ea8; en.md 24358 / 4f42fe342086af1bbe7c71dd48a4e30d469b34f5 / d459cf72de8bb0c89064ab6992ae7f4f98c4b6b30bcd71abcb469f79e16a8125; i18n.yaml 465 / ee6b836f1b16bb2300fa265cfd7a3aeefa913564 / 06bad0399b048e42b776c1c15ef4b02abb6d8d53b8dcdf3e4678ec14684ffcbe.
- After: zh.md 24593 / 714564a8ad9c0e067aa6c29a3c83aa2d61f99872 / 2e8fbd3062d93cd834b15b4037bcd078f32d74d6cbc93fe3691f08cf0d1c6297; en.md byte-identical to r44b4 (blob 4f42fe342086af1bbe7c71dd48a4e30d469b34f5 unchanged); i18n.yaml 465 / c38a0c3e742c1f665c79f68f0e51c1e892662f1a / fc8401758e51251c8bc50f8af3a7f29a100d1b2dbd0f681a0b0f0baa31997ce5. Both edited files: 0 CR bytes, single trailing LF.

## B2 pairing re-record (single pair, not --all)

- Command (dual-prefix PATH node-v26.8.2-win-x64 + pnpm-12.4.1): pnpm run verify-translation-pairing --write docs/event-producer-consumer.md -> stdout: recorded docs/event-producer-consumer.i18n.yaml; 1 record(s) written. exit=0. Sidecar delta: en 31bcff64->4f42fe34 (line vs HEAD was stale at HEAD blob; now records actual candidate blob, which equals r44b4-era value), zh 239149009d->714564a8.
- No other file touched by the tool (git status reconciliation below).

## B3 content-level table comparison

- Row-by-row machine-fact comparison of both tables (76 table rows each; label row differs by language as expected; raw log C:/dsh-r24-upgrade-20260912-01/r44b5-evidence/table-content-comparison.txt, readback-verified): internal/status rows now identical on both sides including agent-team. 69/74 machine-fact rows byte-identical; all event names, modes, dispatchers, listeners identical across languages.
- Pre-existing finding (NOT introduced or repaired by this correction, reported per instructions not to expand scope): 5 zh declared-in line references are stale relative to the current source program that the English table records: agent-preset/selected types.ts:80 (actual :82); subagent/end index.ts:168 (:170); subagent/provider-added :142 (:144); subagent/provider-removed :148 (:150); subagent/start :159 (:161). All 5 verified against the live source files by grep. The English table matches source (gen-doc-graphs checks English; the zh variant was not regenerated in this round and repairing it would rewrite the whole table, outside the authorized single-row correction).

## B4 checks actually run

- pnpm run verify-translation-pairing docs/event-producer-consumer.md -> 1 named pair(s) consistent. exit=0.
- git diff --check -> no output. exit=0.
- No build/typecheck/full test re-run for this two-file change (per instructions); English generation freshness (gen-doc-graphs) unchanged inputs cited from 39-r44b4-gate-rerun.md.

## B5 candidate-r44b5 re-freeze

- Full 63-triple recomputation vs candidate-r44b4.md (raw log r44b5-evidence/manifest-triple-verification.txt, readback-verified): exactly 2 mismatches (zh.md, i18n.yaml, values above); the other 61 rows byte-identical.
- New manifest: candidates/candidate-r44b5.md, 14227 bytes, LF, single trailing newline, readback-identical after write. Manifest SHA-256 077ea3d43b3900e584741b493e21d015d162a9e07f26801fab42353a4b553472. Old candidate-r44b4.md (74cc534912d901a3db249934f4936adec21c5093413b25d5aaa98a56f93bc613), r44b3/r44b, and the 38-numbered S3 declaration are preserved unmodified.
- S3 eight-item ratification set (see the table inside candidate-r44b5.md): #6 docs/event-producer-consumer.zh.md and #7 docs/event-producer-consumer.i18n.yaml hashes updated as above; #1 corpus.ts, #2-#4 config-catalog trio, #5 event-producer-consumer.md, #8 api-catalog.ts unchanged (proven by the same 63-triple recomputation). The eight-item set is reconstructed here because no standalone eight-item S3 table file existed locally; numbering anchored to the receipt comment (its #5/#6/#7 are the event-producer-consumer trio).

## Site reconciliation after B

- HEAD e8d1858ca6a65710c346007e48809580f6064beb and branch chore/latest-stable-upgrade-20260912 unchanged; no reset/rebase/amend/stash/clean; no commit/push; 3 preserved originals untouched.
- git status entries: 74 before B, 75 after (one new visible entry windows-execution/40-r44b5-bilingual-fix.md; candidates/candidate-r44b5.md lives under the already-collapsed untracked candidates/ directory and adds no new status line). Both are new versioned evidence files; no product file outside the authorized zh row and its sidecar changed.
