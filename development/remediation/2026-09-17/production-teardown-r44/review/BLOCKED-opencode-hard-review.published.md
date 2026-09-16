# BLOCKED receipt — r44 OpenCode hard review (designated reviewer unavailable)

Round: r44, 2026-09-17. Status of this receipt: the OpenCode hard-review stage required by NODE_DEVELOPMENT_RULES.md (§1 fixed assignments, §6 hard review) and by PR #13 comment 5701865211 (§A, §F) is BLOCKED on this machine. Per §A of that task comment — "指定CLI/参数/认证不可用……只在当前回合整理源码证据、计划输入和精确BLOCKED报告，不先改受保护源码" — no protected production source was modified this round, and no candidate exists for review.

## 1. Required invocation (fixed by NODE_DEVELOPMENT_RULES §2)

```
opencode --model zhipuai-coding-plan/glm-5.3 --variant max
```

(Review context and candidate-holding invocation would follow the node rules; the model/variant parameters are the fixed part that fails first.)

## 2. Verified blocker (read-only evidence; details in ../planning/cli-availability-probe.md)

1. `opencode --version` → `1.18.26`; single installation at `C:\Users\<local-user>\AppData\Roaming\npm\opencode` (`where.exe`).
2. `opencode auth list` → `0 credentials` (`~\.local\share\opencode\auth.json` absent).
3. `opencode models` → only 7 anonymous `opencode/*` free models; no zhipuai entry.
4. `opencode models zhipuai-coding-plan` → exit 1, `Error: Provider not found: zhipuai-coding-plan`.
5. No provider configuration exists (user `opencode.json` = MCP only; `opencode.jsonc` = skeleton; no project config; no zhipuai string anywhere under `~/.local/share/opencode/`); provider key env vars unset (existence checked only).
6. The previously verified OpenCode binary `C:\Users\Administrator\.opencode\bin\opencode.exe` and wrapper `D:\Temp_projects\dsh861-node-governance\src\ops\real_agents.py` (development/AGENT_TOOL_VERIFICATION.md, 2026-09-08) belong to a different machine/user profile; neither path exists here.

## 3. Why this blocks the round's production work

- The r44 task is a production-lifecycle fix; its stage gate is plan (Codex) → implement → acceptance matrix → gates → OpenCode hard review → evidence → report, with "生产修复交付不得以2F/38P继续宣布完成" and no commit/push before an explicit PASS of the fixed candidate by the designated reviewer.
- Creating a credential, logging in, or adding provider/global configuration to make `zhipuai-coding-plan/glm-5.3` available is explicitly forbidden by the task ("禁止尝试新的Key/登录/全局设置来解除阻断；本任务不新增费用或凭据读取授权"), as is substituting another model or passing an internal subagent off as the designated reviewer.
- Therefore an implemented-but-unreviewable production candidate must not be created this round; the round correctly stops at PLAN_READY with this BLOCKED receipt.

## 4. What this round did deliver

- Fresh first-failure reproduction with real exit codes: `../windows-execution/01-first-failure.normalized.log` (exit 1, 2 failed / 38 passed; the two r43-documented production teardown failures).
- Line-anchored source evidence resolving the attribution ambiguity (composeError registration-stack splicing) and the two ownership chains: `../planning/source-evidence-ownership-map.md`.
- Designated-tool availability probes with hashes: `../planning/cli-availability-probe.md`.
- The formal Codex plan (gpt-6-astra, reasoning max) — see `../planning/` for the plan file and `codex-plan-r44.*` call receipts.

## 5. Unblocking conditions (owner-level decisions, not executable by this agent)

Any one of, decided and performed/provided by the owner:
1. Perform OpenCode auth for the `zhipuai-coding-plan` provider on this machine and confirm `opencode models zhipuai-coding-plan` lists `glm-5.3`.
2. Designate a machine/environment where the verified binary and credentials exist and authorize the r44 implementation+review to run there.
3. Explicitly redesignate the reviewer (model/product) for this round — a new explicit authorization, which current instructions do not grant.

Until one lands, the successor round for r44 implementation stays blocked at this same stage gate.

## Re-dispatch re-verification (2026-09-17, second executor)

Section 2's blocker was independently re-probed by the re-dispatched executor at `2026-09-16T18:52Z`, all read-only, after the first executor was terminated for inactivity:

1. `opencode --version` → `1.18.26` (exit 0).
2. `opencode auth list` → `0 credentials` (exit 0).
3. `opencode models zhipuai-coding-plan` → exit 1, `Error: Provider not found: zhipuai-coding-plan`.
4. The real-user-home opencode auth store is still absent; `ZHIPUAI_API_KEY`, `ZAI_API_KEY`, `GLM_API_KEY`, `OPENCODE_API_KEY` are all unset (existence checked only, nothing read).

Raw captures with SHA-256, kept repo-external under `C:\dsh-r24-upgrade-20260912-01\r44-task-fetch\`: `r44b-opencode-version.txt` (23 bytes, `5c8381dba64eb13775f7a77835b01efbb9f714e43526e550ac1cf951a4976c69`), `r44b-opencode-auth.txt` (128 bytes, `5933819ae4c2b7b17c0f6934d977bb95ee4cd94a95324765a8a44bcbd0bfde1c`), `r44b-opencode-zhipuai.txt` (76 bytes, `39fd74b79da649077e1eccb6e0d8604a247ae033078ecbbc726ad111bb1ffe77`).

Conclusion unchanged: the designated hard review cannot run on this machine, and creating credentials, logging in, or changing provider/global configuration to unblock it remains forbidden by the task. Since the re-dispatch, the formal Codex plan v1 has been delivered (`../planning/plan.v1.md`, invocation record in `../planning/planner-invocation.md`), so the round's terminal state is `PLAN_READY` plus this BLOCKED receipt. The unblocking conditions remain exactly those in section 5.
