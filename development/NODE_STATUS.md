# 节点执行状态

规则：[节点开发与硬审核](../NODE_DEVELOPMENT_RULES.md)。需求：[主规格](../MULTI_AGENT_REQUIREMENTS.md)。路线：[阶段工作包](../MULTI_AGENT_DEVELOPMENT_ROADMAP.md)。

## 当前状态

- 分支：`feat/multi-agent-company-nodes`。
- 代码基线：`d347e703908d0406b7a7ef80e3a0e594d86b2215`。
- 当前节点：P0-A，Windows 构建与可复现启动基线。
- 阶段：P0-A 已通过；真实 Codex 计划 v1–v15 已归档，真实 OpenCode r03 已明确 PASS。
- 已通过硬审核节点：无。
- 实施进度：工具链、冻结安装、fs-ext加载、16个基线测试、完整类型检查、v6全部1145用例通过；v8投影201文件字节对照及准确3失败/476通过的负向控制完成；v9限定类型检查、480用例和实际站点构建通过，2590内部片段引用有效，197个Markdown与llms.txt齐全。
- 当前验收：v9跨独立构建的185个HTML路径和长度相同、SHA均不同，旧HTML未保存字节，[失败记录](nodes/P0-A/evidence/site-v9-rebuilt-html-mismatch.json)保持原样。v10在同一份保留的847文件站点上分别运行旧、新检查器各一次，[完整报告对照通过](nodes/P0-A/evidence/site-v10-equivalence.json)，均为2590条有效引用、空broken数组，运行前后输入未变化。v15 fixture配置修复后，直接Cordis校验和hygiene16/16、CLI启动验收全部通过；r03真实OpenCode对当前候选明确PASS。
- 当前证据：[v9用例覆盖](nodes/P0-A/evidence/site-v9-coverage.json)、[v10同输入报告](nodes/P0-A/evidence/site-v10-equivalence.json)、[v15恢复链](nodes/P0-A/evidence/recovery-v15-validated.json)、[hygiene16/16](nodes/P0-A/evidence/hygiene-v15-completed.json)、[OpenCode r03 PASS](nodes/P0-A/reviews/r03.json)。历史失败、r01/r02无结论审核和所有复用边界均保留；软件公司产品功能和AC-01..AC-32未完成。
- 失败证据：[首轮验证记录](nodes/P0-A/verification.r01.json)、[原生安装阻塞](nodes/P0-A/evidence/install-failure.r01.json)。
- 工具链证据：[安装器准备](nodes/P0-A/evidence/build-tools-preparation.json)、[安装回执](nodes/P0-A/evidence/build-tools-install-01.json)、[实际工具链验证](nodes/P0-A/evidence/build-tools-verification-02.json)。安装退出0，不要求重启。
- 安装授权：[用户授权记录](nodes/P0-A/evidence/dependency-install-authorization.json)允许补齐所需依赖，包括限定 C++ Build Tools、MSVC v143 x64/x86 和 Windows SDK 26100；禁止自动重启。
- 下一节点准入：未满足，禁止提前详细规划或实施。

## 已完成的调用核验

| 调用 | 结果 | 证据位置 |
|---|---|---|
| 真实 Codex 探针 | 退出0，返回 `CODEX_PROBE_OK`，命令指定 `gpt-6-astra` / `max`。 | `D:\Temp_projects\dsh861-node-governance\runs\codex-probe-01.receipt.json` 及同名前缀输出。 |
| 真实 OpenCode 探针 | 退出0，返回 `OPENCODE_PROBE_OK`；会话导出确认 `zhipuai-coding-plan/glm-5.3` 和 variant `max`。 | `D:\Temp_projects\dsh861-node-governance\runs\opencode-probe-01.receipt.json`；会话 `ses_f81dba69fffeE3FByJaX6941qs`。 |

上述是开发工具调用核验，不是交付产品的专用隔离或业务验收。

## 已完成的计划调用

- 执行者：真实 Codex CLI `0.153.4`。
- 参数：模型 `gpt-6-astra`、`model_reasoning_effort="max"`、只读 sandbox、ephemeral、JSON 事件。
- 临时入口：`D:\Temp_projects\dsh861-node-governance\src\ops\real_agents.py`。
- 提示词：`D:\Temp_projects\dsh861-node-governance\prompts\p0-first-plan-v1.md`。
- 回执：`D:\Temp_projects\dsh861-node-governance\runs\p0-first-plan-v1.receipt.json`。
- 事件：`D:\Temp_projects\dsh861-node-governance\runs\p0-first-plan-v1.stdout.jsonl`。
- 正式计划：[P0-A 计划 v1](nodes/P0-A/plan.v1.md)、[有限修订 v2](nodes/P0-A/plan.v2.md)、[工具链修订 v3](nodes/P0-A/plan.v3.md)、[文档预算修订 v4](nodes/P0-A/plan.v4.md)、[显示版本核验修订 v5](nodes/P0-A/plan.v5.md)、[文档测试粒度修订 v6](nodes/P0-A/plan.v6.md)、[站点校验修订 v7](nodes/P0-A/plan.v7.md)、[大页面成本修订 v8](nodes/P0-A/plan.v8.md)、[HTML遍历修订 v9](nodes/P0-A/plan.v9.md) 与 [同一HTML输入验收修订 v10](nodes/P0-A/plan.v10.md)。
- 原始终稿：`D:\Temp_projects\dsh861-node-governance\runs\p0-first-plan-v1.last.md`。
- 调用结果：退出0；补充程序版本、二进制哈希和输出哈希的回执见 [计划证据](nodes/P0-A/evidence/planning-invocation.json)。

恢复工作时先检查 [节点状态](nodes/P0-A/state.json) 与执行日志，不重复发起已完成的计划调用。没有硬审核通过回执，不推进下一节点。
