# Agent Note: Static document corpus test granularity

Status: implemented

English | [中文](2026-09-08-static-document-corpus-test-granularity.zh.md)

## Problem

Two corpus-wide README tests charge file discovery, reads, parsing, and assertions for the entire corpus to one case each. As the corpus grows, otherwise independent document checks compete for the same default five-second test budget.

The recorded P0-A failures affect both cases during concurrent documentation checks and the metadata case even when the spec runs alone. Those observations establish a mismatch between corpus workload and case budget, but do not isolate the cost of discovery, reads, parsing, or assertions.

Site checks expose the same ownership problem: full-manifest emission occupies one setup hook, and importing build helpers also loads the VitePress runtime. Fragment validation creates a DOM environment per page although it only retains attributes. The recorded isolated failures preserve these observations without assigning an unmeasured fraction of time to each operation.

## Decision

The [P0-A v6 plan](../../../../development/nodes/P0-A/plan.v6.md) adopts one README as the validation unit. [`scripts/doc-standard.spec.ts`](../../../../scripts/doc-standard.spec.ts) discovers paths once and shares only the path arrays; collection does not read, parse, or validate README contents.

The six discovery globs, exclusions, path normalization, and sorting remain unchanged. Metadata checks cover every discovered README; body structure checks retain the original four-component path filter. English, Chinese, experimental-package, library, and bundle READMEs remain included within those existing selections.

Each parameterized case reads and validates its document inside the test, using the original helpers and all existing assertions. The non-empty inventory assertion remains. Cases retain the current environment's default 5,000 ms budget, with no new case, suite, or hook timeout overrides; their names identify the checked paths.

Small in-memory cases exercise invalid descriptions and complete or missing headings through the existing error collectors. The required real-file negative control exercises discovery, reading, and parameterized registration; its evidence must show the designated content assertion failures and byte-exact restoration, rather than timeout or collection failures.

The [v7 extension](../../../../development/nodes/P0-A/plan.v7.md) applies per-file execution to the real site manifest. A single projection iterator retains route and image claims across every canonical page and index alias; synchronous publication drains that same iterator. The sequential shared-output test block emits every file before per-file link checks inspect the complete tree. The original inventory, home-page, and all-links assertions remain.

Git discovery returns NUL-delimited paths once without interpreting them as valid during collection. VitePress loads only for an actual build. Fragment validation uses one full-document DOMParser environment per invocation, copies ids and hrefs into plain data, and closes the environment; parsing remains scripting-disabled and preserves document-level elements, legacy anchors, duplicates, and URL rules.

Measured HTMLCollection iteration repeatedly performs a named lookup for `length`, scanning all elements on each step; a probe over 9,216 elements and 100 steps produced 921,600 candidate scans and 1,056 ms of traversal. Static `querySelectorAll('*')` NodeList access with indexed traversal avoids that iterator cost while retaining full-document parsing, document order, and the existing id, `a[name]`, and `a[href]` semantics. No time threshold is an acceptance criterion.

Per-file execution retains the full GFM parsing cost. The four complete configuration and tool catalog routes use an explicit local integration budget of 15 seconds; that budget is not a performance guarantee.

## Alternatives considered

**Increase the timeout.** A larger allowance leaves corpus growth charged to one case and delays the same failure. It does not correct the validation unit for these independent document rules.

**Repeat unchanged runs until one passes.** Selecting a favorable run leaves the workload unchanged and hides the original failure. A later green attempt alone does not establish that the test organization is reliable.

**Serialize all documentation checks.** Removing contention changes the normal execution conditions and does not address the metadata failure observed in isolation. The repository's concurrent verification remains the relevant environment.

**Cache document contents, parsed metadata, or manifests.** These caches introduce additional state and invalidation duties while leaving the corpus-wide case budget unresolved. Moving reads or validation into collection would also remove that work from the individual test; only discovered paths are shared.

## Consequences

More test cases make failures attributable to individual README paths. Discovery and total execution time still depend on filesystem performance, and the complete scan may exceed five seconds; this decision sets no five-second limit for the whole corpus. The [testing policy](../../../../docs/testing.md) continues to govern test execution and evidence.

Coverage requires exact equality of the complete ordered inventories before and after the change, plus exact comparison against sorted paths from both parameterized groups in the actual Vitest JSON report. Every expected case must pass, with no missing, extra, skipped, todo, or duplicate registrations; counts or sets alone cannot establish complete coverage.

Site coverage additionally retains every original test identity, checks each emitted manifest route and alias, and exercises collision, parser, and partial-output cases. Its negative control adds an unignored website document and a broken link in the owned output tree, then verifies their exact failures and cleanup. Iterator construction and per-file tests do not eliminate total projection cost; an early stop leaves partial output that the caller owns and must clean.

This note records adoption of the testing decision. Command records own concrete attempts, timings, restoration evidence, and verification results; review receipts own node acceptance. The note does not claim that the repair, documentation checks, or mandatory independent review has passed.
