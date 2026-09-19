# r44 designated planner/reviewer CLI availability probe (2026-09-17)

Read-only probes only. No configuration, credential, auth, or global setting was created or modified; no keys were read. Raw probe outputs live outside the repository at `C:\dsh-r24-upgrade-20260912-01\r44-task-fetch\` and are hashed below.

## Codex CLI (designated planner) — AVAILABLE

- Resolved program: `C:\Users\<local-user>\AppData\Roaming\npm\codex` (npm global shim; `where.exe codex`).
- Version: `codex-cli 0.153.4` (`codex --version`).
- Login status: `codex login status` reports "Logged in using an API key - sk-1f67a***4e41f" (masked by the CLI itself; the key was not read).
- Minimal availability probe (exact invocation, run in `C:\dsh-r24-upgrade-20260912-01\r44-task-fetch`, non-repo dir):
  - Command: `codex exec --skip-git-repo-check --sandbox read-only --model gpt-6-astra -c model_reasoning_effort="max" -C C:\dsh-r24-upgrade-20260912-01\r44-task-fetch "Availability probe. Reply with exactly: CODEX_PROBE_OK"`
  - Exit code: 0.
  - stdout tail: `CODEX_PROBE_OK`; stderr tail: `CODEX_PROBE_OK` / `tokens used 13,721`.
  - Raw logs: `codex-probe.stdout.log` (15 bytes, SHA-256 `7e9daad9d8e1027fe5f6d1771f4caec39daf103afd9c50e463204a739c417312`), `codex-probe.stderr.log` (402 bytes, SHA-256 `508cd41062c53ff5688e76a220cdb5973161148f6389631737ce202669c98885`).
- Conclusion: the exact NODE_DEVELOPMENT_RULES parameters (`--model gpt-6-astra`, `-c model_reasoning_effort="max"`) execute successfully on this machine.

## OpenCode CLI (designated hard reviewer) — MODEL/AUTH UNAVAILABLE on this machine

- Resolved program: `C:\Users\<local-user>\AppData\Roaming\npm\opencode` (only installation found; `where.exe opencode` returned no other; `~/.bun/bin` has none).
- Version: `1.18.26` (`opencode --version`).
- `opencode auth list`: "0 credentials" (credential store `~\.local\share\opencode\auth.json` does not exist).
- `opencode models`: only 7 anonymous `opencode/*` free models listed (full capture: `opencode-models.txt`, 234 bytes, SHA-256 `b965630ecad1244921b1b74246f2b708223bd82ed2f8c753d47906a55414f3a8`).
- `opencode models zhipuai-coding-plan`: exit 1, `Error: Provider not found: zhipuai-coding-plan` (capture: `opencode-zhipuai-models.txt`, 61 bytes, SHA-256 `a0f26407f89c40f945a702f20634f3c9141331458af4c837d1b83814ea2f6808`).
- User-level config `C:\Users\<local-user>\.config\opencode\opencode.json` contains only MCP servers; `opencode.jsonc` is an empty skeleton; no project-level opencode config exists in the repository; no `zhipuai` string exists in `~/.local/share/opencode/` (log dir empty; sqlite db has no match).
- Provider key env vars (`ZHIPUAI_API_KEY`, `ZAI_API_KEY`, `GLM_API_KEY`, `OPENCODE_API_KEY`) are all unset (existence checked only; nothing read).
- Cross-check with `development/AGENT_TOOL_VERIFICATION.md` (2026-09-08): the verified OpenCode binary `C:\Users\Administrator\.opencode\bin\opencode.exe` and the wrapper `D:\Temp_projects\dsh861-node-governance\src\ops\real_agents.py` belong to a different machine/user profile; neither path exists here (`C:\Users\Administrator\.opencode\bin\`, `D:\npm-global\...`, `D:\Temp_projects\` all absent).
- Conclusion: the designated review invocation `opencode --model zhipuai-coding-plan/glm-5.3 --variant max` cannot run on this machine. Creating credentials, logging in, or adding provider configuration to unblock it is explicitly forbidden by the r44 task (PR #13 comment 5701865211 section A: "禁止尝试新的Key/登录/全局设置来解除阻断"). The OpenCode hard-review stage is therefore BLOCKED this round; per the same section, no protected production source was modified.

## Decision recorded

Codex formal planning: PROCEED (available, authorized). Implementation of production source: WITHHELD pending the round's mandatory OpenCode hard review, which cannot be satisfied here — a production candidate that can never receive its designated hard review must not be created this round (comment 5701865211 section A/F). This round's deliverable: source evidence, plan inputs, the formal Codex plan, and this precise BLOCKED receipt.
