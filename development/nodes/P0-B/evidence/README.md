# P0-B controlled validation infrastructure

English | [中文](README.zh.md)

`validate-harness.ts` remains an adapterless B2 foundation, not a real adapter runner. Valid invocations produce only `BLOCKED`; they do not start a product, read credential values, or prove allow/deny operations, cancellation, handoff, or isolation. Existing evidence, `schema.v1.json`, and historical verification receipts remain unchanged.

## Current command contract

```sh
node --import tsx/esm scripts/p0-b/validate-harness.ts --harness codex --case allow --source --root <absolute-owned-root> --require-real-product
```

The four harness names are `codex`, `claude-code`, `opencode`, and `grok`. The case is `allow` or `deny`; exactly one of `--source` and `--artifact` is required. `--expect-denied` is valid only for deny. Value options accept `--name value` and `--name=value`; boolean flags reject `=true`. Unknown and duplicate arguments are rejected.

On Windows, omitting root retains the default `D:/Temp_projects/dsh861-p0-b-harness-validation`; other systems require an explicit absolute path. Each invocation creates its own subdirectory. The bait directory inside root is only a placeholder in the legacy structure, not a verified external global bait target.

CLI exit codes are 0 for PASS, 1 for FAIL/input errors, 2 for BLOCKED, and 3 for NOT_RUN. The current foundation never produces PASS. Tests must assert BLOCKED and exit code 2 rather than treating successful shell execution as product acceptance.

`result.json` and `manifest.json` remain in the generated run root. The CLI does not automatically delete them, so `cleanup.rootRemoved=false` matches the outcome. Operators may clean up only the directories owned by this run, after archiving and checking references; cleanup requires a separate receipt and must not rewrite the old result. Recorded environment variable names do not prove that a secret-value scan passed.

## Strict legacy-format validation

`schema.foundation.v2.json` composes `schema.v1.json` through `$ref`, adding constraints such as BLOCKED-only status and no real process or artifact observations. It is not the proposed native `p0-b-evidence.v2` and does not relabel legacy records as output from a new runner. JSON Schema validators must resolve references locally; business-semantic checks are still required afterwards.

```sh
node scripts/p0-b/audit-controls.mjs foundation --evidence <result.json>
```

This command checks only legacy foundation semantics; it is not a general JSON Schema engine. A valid BLOCKED record returns 2; invalid or fabricated records return 1. Neither result grants product approval. The real adapter successor is not implemented.

## Candidate bytes and requirements mapping

```sh
node scripts/p0-b/audit-controls.mjs candidate --manifest <candidate.json> --root <repo-root> --commit <exact-40-character-commit>
node scripts/p0-b/audit-controls.mjs mapping --map development/nodes/P0-B/acceptance-map.r01.json --spec MULTI_AGENT_REQUIREMENTS.md
```

Candidate verification has two byte sources: an explicit commit selects immutable Git blobs; without a commit, the checker reads the original bytes in the retained directory. A nonempty inventory is required. Unknown types, duplicate or escaping paths, and unreadable files cannot be skipped. Only regular-file inventory entries are supported; other types require explicit implementation rather than an unsupported completeness claim. Line-ending differences remain failures with a diagnostic hint. Content-hash verification does not authenticate the original execution or log author.

The mapping command reads the titles and version of all 32 AC entries from the main specification. It rejects incorrect identifiers, renamed titles, empty mappings, and partial specification input. It detects structural and title drift, not the semantic adequacy of tests; that remains a review responsibility.

## Regression

```sh
node --test scripts/p0-b/audit-controls.test.mjs
node scripts/p0-b/sync-node-status.mjs --check
```

Normal repository tests require installed `tsx` and Git. Tests create only owned temporary directories and synthetic data, with no product calls or network requests. Offline review may explicitly supply separately compiled runner JS through `P0B_AUDIT_RUNNER_MODULE`; that checks this file's logic, not repository source/artifact composition, a full build, or supported Windows-machine behavior.

Product integration, actual filesystem/network isolation, native execution, central capability bridges, credential safety, and full acceptance still require real evidence and the designated hard review. See `../plan-revision-request.r01.md` for the successor-plan request.
