# Owner S3 ratification for candidate-r44b5 (2026-09-18)

## Source and channel

- Channel: direct owner instruction to the executor session on 2026-09-18, quoted verbatim below. The same dispatch attached the GitHub closing instruction PR #13 issuecomment 5731278517 (main-session published, 2026-09-18T14:15:43Z, fetched credential-less via api.github.com REST); that comment states it is not itself the ratification and leaves the owner decision to the direct instruction recorded here.
- This file is a new independent governance record under review/. Per the closing instruction, adding an external-approval record does not reopen the six production-file authorizations, does not modify any prior S3 declaration or review record, and does not by itself require re-review of unchanged engineering.

## Verbatim owner ratification (transcribed unaltered)

```text
我明确追认以下八项在 dsh861 最终候选 candidate-r44b5 中的差异，
纳入本次 r44-B 范围。

绑定的 manifest SHA-256：
077ea3d43b3900e584741b493e21d015d162a9e07f26801fab42353a4b553472

精确八项：
1. packages/extensions/tool-cordis/src/api-catalog.ts
2. docs/config-catalog.md
3. docs/config-catalog.zh.md
4. docs/config-catalog.i18n.yaml
5. docs/event-producer-consumer.md
6. docs/event-producer-consumer.zh.md
7. docs/event-producer-consumer.i18n.yaml
8. scripts/session-snapshot-corpus.corpus.ts

#6/#7以r44b5的新字节为准，其余六项保持该manifest记录的身份。
这是对本次已发生修改的有限追认，不追溯伪造事前授权，
不包含未来新增文件、生成器规则变化或其他未审字节。

在候选仍与第四轮合规硬审及独立审计一致的前提下，
现在允许按既有安排完成正常hooks提交、
同分支非强制快进推送与最终回执。
```

来源：会话直接指令（2026-09-18），并附 GitHub 收尾说明评论 5731278517。

## Bound set (identities recomputed at ratification time)

Manifest: `candidates/candidate-r44b5.md`, 14227 bytes, SHA-256 `077ea3d43b3900e584741b493e21d015d162a9e07f26801fab42353a4b553472`. Full 63-triple recomputation against the working tree immediately before staging: 63/63 match (bytes / git blob / SHA-256).

The eight items below follow the order of the ratification quote above. The S3 table inside candidate-r44b5.md numbers the same eight files with #1/#8 transposed (its numbering is anchored to receipt comment 5724684848, where #5/#6/#7 are the event-producer-consumer trio); the set and the #6/#7 identities are identical under both numberings.

| # (ratification order) | file | r44b5 git blob | r44b5 SHA-256 |
|---|---|---|---|
| 1 | packages/extensions/tool-cordis/src/api-catalog.ts | `6ec3d307bc56660d761c2ca2ea09b6f0bbd7026d` | `d7b1f38279725fc5cf17787c3b8b1d47a43d0d7019cb58f22654bb025e4e6c3e` |
| 2 | docs/config-catalog.md | `602f9773bd06a16fa37e49d7e9cd3b48efba2b57` | `d2eb5c13c0f426d7b628076f56a64ee1fd0a697ec2655e7ce3918f8aa447611a` |
| 3 | docs/config-catalog.zh.md | `dfab063b8063e14477d435e66ae042fbcb809e0a` | `ae7a9bced7c964e0911e0c0491b4a177473e23ca87231a7008cd858a7ff8d860` |
| 4 | docs/config-catalog.i18n.yaml | `a3b8612ec22b03dd67c80143563e0888a18285e9` | `4356053dee94f7dc808a5b9d65e9440737148793db0cc795e386fdd3640523d3` |
| 5 | docs/event-producer-consumer.md | `4f42fe342086af1bbe7c71dd48a4e30d469b34f5` | `d459cf72de8bb0c89064ab6992ae7f4f98c4b6b30bcd71abcb469f79e16a8125` |
| 6 | docs/event-producer-consumer.zh.md | `714564a8ad9c0e067aa6c29a3c83aa2d61f99872` | `2e8fbd3062d93cd834b15b4037bcd078f32d74d6cbc93fe3691f08cf0d1c6297` |
| 7 | docs/event-producer-consumer.i18n.yaml | `c38a0c3e742c1f665c79f68f0e51c1e892662f1a` | `fc8401758e51251c8bc50f8af3a7f29a100d1b2dbd0f681a0b0f0baa31997ce5` |
| 8 | scripts/session-snapshot-corpus.corpus.ts | `dce4cda1000bea2bc673ae6bce61292277a8eb60` | `dc1e00a9ce877dc09752eafdf4ebb7dd261c3c952b585952b242dec8573276d1` |

#6/#7 carry the r44b5 bytes above; the other six items keep the identities this manifest already records (verified unchanged by the same 63-triple recomputation and by the r44b4-vs-r44b5 delta check: exactly rows #6/#7 moved).

## Boundary (the ratification's own limits)

- Limited ratification of the differences already present in candidate-r44b5 for exactly these eight items; it does not retroactively fabricate prior authorization and does not cover future new files, generator-rule changes, or other unaudited bytes.
- The commit/push permission is conditioned on the candidate still matching the round-4 compliant hard review (round4b: actual argv includes `--variant max`, exit 0, final verdict PASS; r44b-hard-review-round4.md with identity in r44b-hard-review-round4-invocation.md) and the independent audit (r44b5-independent-audit.published.v1.md). Both conditions were re-verified before staging: manifest 63/63 triples, #6/#7 blob/SHA-256 recomputed on-site, remaining six items unchanged.

## Follow-up register (deliberately NOT addressed in this round)

1. Five pre-existing zh declared-in line-number lags. HEAD-existing, verified against the live source (zh = en - 2 on each); not modified this round and the zh table was not regenerated:
   - agent-preset/selected: `types.ts:80` recorded, actual `:82`
   - subagent/end: `index.ts:168` recorded, actual `:170`
   - subagent/provider-added: `:142` recorded, actual `:144`
   - subagent/provider-removed: `:148` recorded, actual `:150`
   - subagent/start: `:159` recorded, actual `:161`

   Evidence: 40-r44b5-bilingual-fix.md (B3) and r44b-hard-review-round4.md (section 2, judged non-blocking). Repair is a later separate task that regenerates the zh table; this round does not modify these rows.
2. Disclosed NOT_RUN restrictions that remain in force unchanged by this ratification:
   - doc-sync full rerun not executed for the r44b5 delta (host pnpm shim broken; incremental substitution via the five affected gates: translation-pairing 846 pairs, md-wrap 1680, md-links 1671, doc-graphs 6/6, cordis-catalog 97) - r44b-hard-review-round4.md section 3, 39-r44b4-gate-rerun.md.
   - hygiene dispositions (node-next host EPERM condition; pre-existing vendored two-document lockfile) - 35-hygiene-dispositions.md.
   - shared sdk.snapshot.ts replay lane cannot run on this Windows host (owned by macOS/Linux CI) - FINDINGS.md item 6.
   - uv offline resolution not satisfiable on this host; python/sdk ran from the existing-cache venv plus PYTHONPATH - FINDINGS.md item 7.
3. The local hard-review PASS does not equal the cross-platform CI result of the commit this ratification enables; that CI is to be read per run/attempt/checkout after the push.
