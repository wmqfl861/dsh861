# Agent Note: Fixed candidates and real CLI review for project nodes

Status: implemented

English | [中文](2026-09-08-fixed-node-candidate-review.zh.md)

## Problem

Parallel contributions can change files while a reviewer examines them. A tracked diff omits new untracked documents, and a role label or successful tool exit alone cannot establish who reviewed which contents.

Build and keyless startup evidence has narrower meaning than product acceptance. Treating planned commands, skipped checks, or mock responses as completed product capabilities removes that distinction.

## Decision

The adopted [node development rules](../../../../NODE_DEVELOPMENT_RULES.md) assign detailed planning and plan revisions to real Codex CLI with `gpt-6-astra` and effort `max`, implementation and repair to ZCode, and mandatory independent review to real OpenCode CLI with `zhipuai-coding-plan/glm-5.3` and variant `max`. ZCode may delegate implementation to built-in subagents; those helpers never count as the named planner or reviewer. These assignments govern project development, not permanent product role bindings.

Each claimed external invocation requires executable path, version and hash, model and effort arguments, timing, exit outcome, prompt hash, and original output references. Submitted arguments and observable execution facts remain separate; model self-identification proves neither. An unavailable prescribed model, unsupported effort, unverifiable identity, or missing output blocks the node without substitution. Plan originals and revisions retain their invocation evidence; implementation does not silently rewrite acceptance criteria.

The integrator fixes the baseline HEAD and a candidate file inventory covering added, modified, and deleted files across staged, unstaged, and untracked work. Each entry records its normalized repository-relative path, type, byte size, and SHA-256; toolchain, verification, and build evidence carry hashed references. The inventory's own hash is stored separately. Later state and review receipts identify the candidate without entering its own hash inputs or altering its contents.

Review starts after implementation tasks finish and candidate contents are frozen. The reviewer reads actual files without editing them. Any candidate-content change requires a new round, preserving prior receipts. Only explicit OpenCode `PASS` for the current candidate together with actual success of every required check permits next-node planning. `FAIL` requires repair and review again; `BLOCKED` retains the missing conditions.

Verification separates source or configuration inspection, commands actually run, reusable components requiring adaptation and verification, requirements needing implementation, and missing prerequisites. Records preserve `NOT_RUN`, `OUT_OF_SCOPE`, skips, retries, timeouts, and original failures. A zero CLI exit without a candidate-bound verdict, an unexecuted required check, or a skipped mandatory test cannot certify node completion.

The [P0-A plan](../../../../development/nodes/P0-A/plan.v1.md) owns operational steps and limits acceptance to the Windows build and startup baseline. Keyless or mock-backed checks establish only the properties actually exercised. Development CLI calls do not prove product harness isolation, and baseline success does not complete P0 or the product acceptance criteria for permissions, memory, workflows, or real model integration.

## Alternatives considered

**Use built-in role labels as independent planning or review.** The node rules reject this because a label provides no evidence that the designated external product ran with the authorized settings. Real subprocess calls require invocation records and depend on tool and authentication availability.

**Review only a tracked Git diff.** The rules reject this because new untracked requirements, plans, notes, and evidence can affect acceptance while remaining absent from that diff. Explicit file coverage and content hashes add bookkeeping but identify the complete candidate.

**Keep editing during review or reuse a prior verdict after changes.** The rules reject this because the verdict then describes different contents. Freezing each candidate and preserving separate rounds delays review until integration finishes and adds another review after repair.

**Treat zero exit, skipped checks, or baseline success as sufficient acceptance.** The rules and plan reject this because each proves less than the node or product claim. Required execution evidence and an explicit candidate-bound verdict preserve those limits at the cost of blocking progress when evidence is missing.

## Consequences

Reviewers can identify the implementation and evidence behind a verdict, including untracked contributions. The workflow adds hashing, attributable logs, and repeated review after candidate changes; external CLI or authentication failures can block development. It relies on the integrator and reviewer to enforce these duties and does not itself deliver product authorization, isolation, or audit capabilities.

The Agent Note's `implemented` status records adoption of the process decision. Node completion belongs to candidate-bound review receipts and verification evidence; this note makes no claim that a node or check has passed.

[Explicit change-scope reporting](../../archived/process/2026-07-27-explicit-change-scope-report.md) continues to own Git-layer discovery, and [browser evidence chains](2026-08-08-browser-gif-evidence-chain.md) govern recorded GUI runs. Both retain independent rationale and mechanisms.

[Product subagent backends](../feature/2026-08-04-claude-code-and-codex-subagent-backends.md) own runtime integration and its testing tiers. [Periodic human-review maintenance](../../proposed/process/2026-07-13-human-review-skill-maintenance.md) remains a proposal for maintaining the review skill. This node workflow supersedes neither record.
