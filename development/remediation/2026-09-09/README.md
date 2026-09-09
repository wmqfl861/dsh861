# Review remediation and handoff: 2026-09-09

English | [中文](README.zh.md)

Starting point: `feat/multi-agent-company-nodes` @ `673ba77593e3100c1245601a53fb36b7f85ddb10`. Implementation actor: ChatGPT, performing this maintenance round under the owner's instruction to apply the recommendations directly in the repository. This is not an invocation record for the designated Codex, ZCode, or OpenCode.

## Maintenance fixes delivered in this round

| Item | Result in this round | What it does not establish |
|---|---|---|
| AC mapping | Added `../../nodes/P0-B/acceptance-map.r01.json`, corrected AC-04/10/21/23/24 references, and added a command checking titles and version against the main specification. | Product AC acceptance. |
| Plan scope | Added a successor-plan request distinguishing nativeResume from artifactHandoff and P0-B from the later central control plane. Old plans are not rewritten. | A new real Codex plan. |
| Handoff status | `CURRENT_NODE.json` selects P0-B; NODE_STATUS is generated from node state. P0-B explicitly awaits revision and does not admit P0-C. | Certification of the whole current commit by the historical P0-A PASS. |
| B2 runner | Rejects unknown, duplicate, and ambiguous arguments; BLOCKED returns 2; evidence is retained; the entrypoint works without import.meta.main. | Real product startup or native adapter completion. |
| Counterfeit PASS | Preserves the old schema and adds a strict foundation overlay and semantic guard; unobserved legacy records cannot be treated as PASS. | Native product evidence v2 implementation. |
| Candidate hashes | Adds immutable Git-blob/retained-byte verification and rejects escaping, duplicate, and empty inventories. LF/CRLF differences remain failures with diagnostics only. | Independent recertification of historical candidates. |

Commands and evidence are in the [verification receipt](verification.r01.json). All offline tests use synthetic data; passing counts cover maintenance regression only. The new scripts are not integrated into all repository CI/documentation checks. Runnable standalone commands must not be described as mandatory checks covering every commit.

## Historical integrity

This round does not modify P0-A plans, state, candidates, reviews, or evidence; P0-B plan.v1/v2/v3, schema.v1, or old test receipts; models, keys, providers, endpoints, lockfiles, or native Session formats. It does not merge master.

The old `acp-fixture-before-v15.json` Git blob is 664 bytes, whereas candidate.r03 records 681 bytes. Historical review found that reconstructing CRLF reproduces the candidate hash. This is a byte-representation mismatch, not a finding of malicious tampering. The new checker must not convert that diagnostic into PASS or hide the mismatch by changing old numbers. Later candidates must bind immutable Git trees or retrievable archives of original bytes.

## Work still required after this round

**Formal planning and review:** P0-B v3 remains historical and the node remains blocked. The designated real Codex must issue a successor with explicit, finite node-completion conditions; a new candidate also requires designated real OpenCode review. Maintenance code, JSON state, and test exit codes cannot replace those actual invocations.

**Credentials:** Rotation of exposed credentials is unverified. This round neither reads nor changes secret values and cannot verify provider-side revocation on behalf of the credential owner. Do not resume real calls with affected credentials until verified. See root `SECURITY_CREDENTIAL_ROTATION.md`.

**stderr channel:** Raw stderr forwarding in `packages/subagent/subagent-codex/src/run.ts` is not changed in this round. Redaction is required before host forwarding or any persistence, with tests for chunk boundaries, encodings, error objects, and exit paths. No real credential leak was reproduced, but that is not proof of safety. Include this work in a runtime-safety candidate; do not use the unprotected path for currently restricted real tasks.

**Real adapters and v2 evidence:** Four-product allow/deny/cancel checks, external collectors, controlled tool connections, real artifact handoff, and product evidence v2 remain incomplete. This round's guard handles legacy adapterless B2 only and cannot replace that work.

**Independent verification:** Run affected repository tests, lint, documentation checks, and source/artifact smokes on supported Node/pnpm. This round performs only a strict single-file TypeScript compile and offline controls. It cannot certify Windows, actual CLIs, PostgreSQL, GBrain, or delivery on all three platforms.

## Requirements to make concrete in successor design

Distinguish configuration-discovery isolation from operating-system filesystem/network/process restrictions, and record the guaranteed level per execution node. Reject roles whose required level cannot be enforced. Human collaboration needs explicit login, invitation, revocation, recovery, and authority to approve releases or change governance rules.

Durable execution needs state transitions, task/run/attempt relationships, dispatch leases, stable operation identifiers, treatment of results from disconnected old workers, and approval-version invalidation. Logs or model prose alone must not maintain this state.

Memory needs Chinese retrieval, provenance, correction, invalidation, and negative search/direct-read tests after revocation. Design delivery needs accepted editable source formats, asset provenance, and versions. These refine acceptance for the owning nodes; they are not delivered features or authorization for new models or paid services.

## Handoff order

Read generated `development/NODE_STATUS.md` and P0-B state; check credential blockers; have the designated planner process the successor request; include this maintenance work in a new candidate and necessary verification; complete current-node real evidence and hard review before advancing under existing rules. Do not overwrite original failures or relabel local regression PASS as product PASS.
