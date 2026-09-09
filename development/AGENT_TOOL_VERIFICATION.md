# 真实计划与审核工具核验

日期：2026-09-08。用途：核验本项目开发过程中的计划和硬审核工具，不是交付产品的专用 harness 隔离验收。

| 项目 | Codex | OpenCode |
|---|---|---|
| 实际程序版本 | `codex-cli 0.153.4` | `1.18.27` |
| 调用模型 | `gpt-6-astra` | `zhipuai-coding-plan/glm-5.3` |
| 推理参数 | `model_reasoning_effort="max"` | `--variant max` |
| 最小调用结果 | 退出0，`CODEX_PROBE_OK` | 退出0，`OPENCODE_PROBE_OK` |
| 额外核验 | JSON 事件包含 thread、turn 和最终答复；本次命令行显式传入模型和推理参数。 | 会话导出中的 user 和 assistant 记录均为 `glm-5.3`、provider `zhipuai-coding-plan`、variant `max`。模型元数据将 max 映射到 `reasoningEffort: max`。 |

Codex 原生二进制：`D:\npm-global\node_modules\@openai\codex\node_modules\@openai\codex-win32-x64\vendor\x86_64-pc-windows-msvc\bin\codex.exe`。

OpenCode 原生二进制：`C:\Users\Administrator\.opencode\bin\opencode.exe`。

调用通过本轮新建的 `D:\Temp_projects\dsh861-node-governance\src\ops\real_agents.py`，使用 `subprocess.Popen(..., shell=False)`。既有同名模块未找到，因此不声称沿用了原实现。原始输出和命令回执在该目录的 `runs/` 下，探针前缀分别为 `codex-probe-01`、`opencode-probe-01`。

OpenCode 核验会话为 `ses_f81dba69fffeE3FByJaX6941qs`。探针为只读提示，没有生成审核结论。OpenCode 运行时禁用外部插件，并采用只读 plan agent；执行期间 edit/bash/webfetch/websearch 被拒绝。该权限设置仅用于本次审查工具进程，不改变用户全局默认配置。

模型供应商实际路由的内部细节不可由 CLI 输出独立证明；这里记录可核查的真实进程、调用配置和客户端会话元数据，不将模型自己说出的名字当作证明。
