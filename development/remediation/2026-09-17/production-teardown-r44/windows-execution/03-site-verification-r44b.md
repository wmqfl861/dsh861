# r44-B 现场核对（2026-09-17）

## 仓库状态（git 只读命令）
- 分支：chore/latest-stable-upgrade-20260912（git rev-parse --abbrev-ref HEAD）
- HEAD：e8d1858ca6a65710c346007e48809580f6064beb（r44-A 归档提交，与 r44-B 任务声明一致）
- 远端：git ls-remote origin refs/heads/chore/latest-stable-upgrade-20260912 → e8d1858ca6a65710c346007e48809580f6064beb（exit 0，与 HEAD 一致，无远端移动）
- git status --porcelain --untracked-files=all：仅 3 个既有未跟踪保留原件，与归档索引声明一致，保留、不上传、不清理：
  - development/remediation/2026-09-17/production-teardown-r44/planning/cli-availability-probe.md
  - development/remediation/2026-09-17/production-teardown-r44/review/BLOCKED-opencode-hard-review.md
  - development/remediation/2026-09-17/production-teardown-r44/windows-execution/01-first-failure.normalized.log

## 批准范围内 6 个生产/core 文件基线核对（git hash-object 工作树 vs 9d0db656 vs e8d1858c）

| 文件 | 工作树 blob | 9d0db656 blob | e8d1858c blob | 一致 |
| --- | --- | --- | --- | --- |
| packages/experimental/agent-team/src/index.ts | 6fa0500eebff1f4eb865d5e290fa251c3beff0ea | 同左 | 同左 | 是 |
| packages/subagent/subagent/src/continuation-activation.ts | df2b6da439776918aaf5d6f4cbad07e9c7ef6dab | 同左 | 同左 | 是 |
| packages/subagent/subagent/src/index.ts | 8a91e06e56c63006d473d421113936ed2d0331ad | 同左 | 同左 | 是 |
| packages/core/agent/src/index.ts | 21c95b5c600d393d3cfd2bf37f76f40fea22cb58 | 同左 | 同左 | 是 |
| packages/core/agent-loop/src/index.ts | 6c30f0413593ae171aed09e35e68eb1f5946a4d9 | 同左 | 同左 | 是 |
| packages/core/agent-loop/src/agent.ts | 06e1f51b57277ba296698b6c8b810f0e455e3695 | 同左 | 同左 | 是 |

生产/测试源码基线仍为 9d0db656，与任务声明一致；未因计划引用旧 SHA 回退 HEAD。未执行 reset/rebase/amend/stash/clean/强推。scripts/smoke-python-runtime.py 存在于仓库（范围登记第六节已核）。
