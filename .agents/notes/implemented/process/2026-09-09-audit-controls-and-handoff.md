# Agent Note: Offline audit controls and generated handoff

Status: implemented

English | [中文](2026-09-09-audit-controls-and-handoff.zh.md)

## Problem

The adapterless P0-B foundation could return exit zero and delete its evidence while its record said the directory remained. Its legacy schema admitted a top-level PASS without observed product behavior. Separately maintained handoff prose drifted from node state, and candidate hashes did not identify their byte representation.

## Decision

The user authorized a review-remediation maintenance change. Strict argument parsing, nonzero BLOCKED exits, retained evidence, a successor foundation schema overlay, and independent semantic and exact-byte checks now cover these local contracts. The overlay does not replace the archived schema or implement the planned product evidence v2 runner. AC titles are checked against the complete product specification; test semantics still require review.

The handoff page is generated from a current-node selector and the existing node states. Generation never writes approval state. Historical approval refers to its fixed candidate, not later commits. The P0-B scope correction is a revision request, not a fabricated plan from the designated Codex CLI. P0-C remains closed pending the required real plan, evidence, and independent review.

## Alternatives considered

Rewriting historical plans or normalizing mismatching candidate bytes would erase the distinction between reviewed worktree bytes and archived Git blobs. Those records remain unchanged. Foundation checks remain separate from real product acceptance; a structurally valid file cannot prove a supplier identity, external side effect, or secret-rotation event.

## Consequences

Offline controls are reproducible without model calls. Repository integration checks and real platform validation are still required. Runtime stderr redaction, credential rotation verification, and real adapters remain open work. This note records implemented maintenance controls, not node completion or an external planner/reviewer invocation.
