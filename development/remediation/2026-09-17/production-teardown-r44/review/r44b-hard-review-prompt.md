你是 dsh861 仓库 r44-B 轮次的指定硬审核者：真实 OpenCode CLI，模型 zhipuai-coding-plan/glm-5.3，variant max（既定安排，不更换）。仓库 C:\Albert\project\dsh861，分支 chore/latest-stable-upgrade-20260912。你的唯一任务：对下面的固定候选给出明确裁决 `PASS`、`FAIL` 或 `BLOCKED`，并逐项给出依据。你只读仓库与证据，不修改任何文件，不读取任何密钥/凭据/用户 .env，不调用其他代理。

【固定候选（本轮全部改动，其余工作树未跟踪件为 r44 证据文件）】
生产：
- packages/core/agent/src/index.ts（新增 AgentTeardownHooks：begin/beforeRelease；Create/ResumeAgentOptions.teardown 可选字段）
- packages/core/agent-loop/src/index.ts（FactoryOwnership.dispose 全义务逐项等待+聚合上报、notActiveError；prepare 重构：共享 completion 先发布→begin→cancel→whenIdle→beforeRelease→scope.dispose→handle.close→detach 独立收集错误；owner effect 先注册 join、factory effect 同 fiber 收集 scope rawDispose 撤除 sibling、join 前置融合工厂原因；wrapper 退役标记与 initiatedBy 跳过）
- packages/core/agent-loop/src/agent.ts（cancel 清理失败仍 abort 后重抛原错误）
- packages/subagent/subagent/src/continuation-activation.ts（TeardownRecord 先建、hooks 贯穿 create/resume；prepareRelease 共享一次 P(x)（parent/owner/natural 三入口、自然路径不重复 flush）；finishDisposal=准备→加入 H→终态/bookkeeping；drainThenReleaseScope 防 effect 链短路；disposeRoots 因果保留）
- packages/subagent/subagent/src/index.ts（continuation manager 移入注入子 fiber 终身期；binding 复合 effect 收集子 fiber 精确 disposer，drain+结构释放完成后按 exact identity 清 slot）
- packages/experimental/agent-team/src/index.ts（投影移入专用子 fiber（inject sessionProjections）；runtimeLifecycle 复合 effect 收集其精确 disposer + closeThenReleaseScope 显式事务；closeRuntime 一次性可加入事务；disposeRuntime 真实等待已接纳工作/排水（withTimeout 仅观察期限、heldDrains 保持有）、重采样循环；internal/status 祖先卸载同步启动同一事务）

测试：
- packages/core/agent-loop/tests/teardown-ownership.spec.ts（新：R44-K01–K11）
- packages/subagent/subagent/tests/continuation-teardown.spec.ts（新：R44-S01–S13）
- packages/experimental/agent-team/tests/teardown.spec.ts（新：R44-T01–T08）
- packages/experimental/agent-team/tests/team.spec.ts（修订 §7.3 两个 timeout 用例 + TeamServiceInternals 增加 closeRuntime 白盒签名）
- packages/subagent/subagent/tests/continuation.spec.ts（一处 fixture 调整：handle.dispose 包装在真实路径 reject 时仍注入独立故障——行为随共享关闭接口变化，属接口确受影响的最小修改）

【权威输入（仓库内）】
- development/remediation/2026-09-17/production-teardown-r44/planning/plan.v1.md（冻结计划）
- 同目录 supplement-planning/plan.v1-supplement-s1.md（S1 补充：S1–S4）
- 同目录 windows-execution/04…06（基线复现、R1 首失、R1 裁决）

【已执行验证（raw 在仓库外，摘要在证据目录）】
- 基础 40 用例：38/2→40/0（两原始失败转绿；r43 observer 与 3 个 afterDispose 期待未动）
- K01–K11、S01–S13、T01–T08 全绿（32/32 终态复验）；agent-loop/agent 两包 30 文件全绿；subagent 全部套件绿；agent-team 全套 75/75
- 两个独立负控（对最终冻结字节复验）：Team 旧所有权（negative exit 1；SHA 2efd7a0d… 恢复一致；positive 0）；Subagent 旧异常早退（negative 1；612fa4e8… 恢复一致；positive 0）
- 门禁终态：build exit 0；typecheck exit 0；lint exit 0（0 warn 0 err）；duplication exit 0；test:docs exit 0；doc-sync exit 0
- hygiene：14/16 通过；两项失败如实申报：(a) node-next types（tsc 子进程非零退出且无诊断输出，原因未定位，或为本机环境问题，CI 拥有该信号）；(b) vendored links（pnpm-lock.yaml 含两个 YAML 文档、js-yaml 单文档 load 抛错；该文件 git 状态干净，属既有条件，非本轮改动；vendor/scripts 为排除面未触碰）
- 固定候选清单：windows-execution/candidates/candidate-r44b.md（逐文件 bytes/blob/SHA-256，manifest SHA-256 98ac1d76…）

【如实申报的未完成项（裁决时必须计入）】
- plan v1 §10.1/§10.2 + 补充 S4.3/S4.4 的新增 keyless teardown 快照场景（snapshots/sdk/subagent-teardown、agent-team-teardown、teardown.snapshot.ts）与 Python sdk-teardown 场景 + PY-B01..B07 输入检查 + scripts/smoke-python-runtime.py 支持改动：本轮未实施、未运行。
- plan §10.4 双语 Agent Note 三件、两领域包/core README 与 docs/architecture.md 对应文档：本轮未写。
- built smoke（DSH_EXAMPLE_MODE=lib 重放）：视证据摘要中的实际执行情况为准。

【裁决要求】
1. 逐文件核对候选实现与 plan.v1 §4/§5.3/§6/§7 + 补充 S1–S4 的不变量（共享关闭、异常继续释放、child-first、timeout≠静止、权限不放宽、等待关系无自等）。
2. 对上述未完成项给出其对完成标准（plan §14.3）的影响。
3. 最后单独一行给出 `PASS` 或 `FAIL` 或 `BLOCKED`。只有当候选满足计划全部必需验收（含你认定的未完成项影响）时才可 PASS。
