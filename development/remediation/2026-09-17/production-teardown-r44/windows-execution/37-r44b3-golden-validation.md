# r44b3 golden regeneration and determinism evidence

All runs below are real runtime replays through make-goldens.mjs (the lane's own
refresh normalization: refreshFixtureReplacements / stabilizeRefreshLog / scrub /
tokenize / stabilizeFixtureMessageIds / redactSessionSnapshotIds).

## Generation and validation sequence

- subagent-teardown generation (--write): MATCH yes, 36/26 lines.
- subagent-teardown independent validations: MATCH yes x4 (golden-validate-subagent2/3.log and inline runs).
- agent-team-teardown first generation (--write from the prior draft fixtures): MATCH yes but left raw volatile ids;
  independent validation exposed nondeterminism (a natural teammate-completion notice racing the spawn
  tool result inside the Lead turn: agent/inbox/spliced vs tool/result order, see the captured line diff in
  r44b3-exec-raw logs). Root cause: the scenario's teammate first model call could complete before the Lead's
  turn ended.
- Fix: the agent-team-teardown trigger now fences the teammate FIRST model call until the Lead is idle,
  making the natural completion notice impossible inside the Lead turn (the pending Lead message keeps the
  teammate turn open; the only close path is the held second call). Deterministic by construction.
- agent-team-teardown regeneration after the fix (--write): MATCH yes, 42/26 lines.
- Determinism sample after the fix: 12 consecutive independent validations MATCH yes
  (golden-write-team3.log; 12-run loop, 12 pass / 0 fail).

## Final runs on the frozen bytes

- teardown.snapshot.ts built mode: 2/2 pass (teardown-spec-final-builtin.log).
- teardown.snapshot.ts DSH_EXAMPLE_MODE=lib subprocess env: 2/2 pass (teardown-spec-final-lib.log).
- corpus gate: 3/3 pass (corpus-gate-final.log).
