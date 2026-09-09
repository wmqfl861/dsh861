# Credential rotation required

API keys were exposed in the development conversation and must be revoked and replaced before any production use.

The repository must contain only non-secret routing templates such as `development/nodes/P0-B/evidence/authorized-model-routes.example.json`. Runtime commands receive credentials through private per-run environment variables; credential values must never be written to source files, configuration files, command arguments, stdout, stderr, Session data, evidence, snapshots, or Git history.

Recommended environment variable names for controlled P0-B runs are `DSH_P0B_CODEX_API_KEY`, `DSH_P0B_CLAUDE_CODE_API_KEY`, `DSH_P0B_GROK_API_KEY`, and `DSH_P0B_OPENCODE_API_KEY`. The values are intentionally absent from this repository.

Provider, endpoint, model, and reasoning settings are recorded separately from credentials. They are runtime inputs, not permission to change the harness defaults or the project's planner/reviewer model assignments.
