你是 dsh861 仓库 r44-B 轮次（第二次重派后）的指定硬审核者：真实 OpenCode CLI，模型 zhipuai-coding-plan/glm-5.3，variant max（既定安排，不更换；CLI 无 --variant 旗标，variant max 要求以本提示词传达，请在证据中注明）。仓库 C:\Albert\project\dsh861，分支 chore/latest-stable-upgrade-20260912，HEAD e8d1858ca6a65710c346007e48809580f6064beb。你的唯一任务：对下面的固定候选给出明确裁决 `PASS`、`FAIL` 或 `BLOCKED`，并逐项给出依据。你只读仓库与证据，不修改任何文件，不读取任何密钥/凭据/用户 .env，不调用其他代理。

【背景】第一轮硬审（review/r44b-hard-review-round1.md）FAIL，理由：(F1) subagent/src/index.ts 绑定 effect 的 yield 顺序在 Cordis 反序卸载下先清 slot 后 drain（违反 §6.4/S4.1）；以及申报的五类未完成验收（§14.3 第 9、10 条）。此后：F1 已修复（settleManagerLifetime 显式事务 + 新增 R44-S14 钉住用例），五类验收已补齐，形成本候选。

【固定候选（本轮全部改动；清单逐文件 bytes/blob/SHA-256 见 windows-execution/candidates/candidate-r44b3.md，共 62 项，manifest SHA-256 b734dfc989c3a3bb25b269a45f04d6786e33f98d2f2daf9bad89d304ff575bc9）】
A. 生产 6 文件——与第一轮修复后重冻结（candidate-r44b.md，manifest f88eaa47…）逐字节一致，未再改动：
- packages/core/agent/src/index.ts、packages/core/agent-loop/src/index.ts、packages/core/agent-loop/src/agent.ts、packages/subagent/subagent/src/continuation-activation.ts、packages/subagent/subagent/src/index.ts（含 settleManagerLifetime 修复）、packages/experimental/agent-team/src/index.ts
B. 测试 5 文件——同上未再改动（K01–K11/S01–S14/T01–T08、team.spec §7.3 修订、continuation.spec 一处 fixture 调整）。
C. S4.3 新增：snapshots/sdk/teardown.snapshot.ts（关闭证据链 adapter：manual 门控、前缀/seq/epoch 记录、gate 期间 SessionAlreadyOwnedError 写所有权持有断言、真实 disposer 触发、活订阅观察 subagent.finished、真实后缀/终态唯一/取消握手、协议 shutdown 后原目录写接管+takeover close 零追加）；snapshots/sdk/subagent-teardown/ 与 snapshots/sdk/agent-team-teardown/ 全套（snapshot.yml/cordis.yml/cordis.snapshot.yml/teardown-trigger.mjs/入口垫片/goldens/子 sidecar；agent-team 另有 replay.override.json 4 条）；scripts/session-snapshot-corpus.corpus.ts 的 snapshotAdapters 注册（新 adapter 的机械必要登记，范围邻接项）。
D. S4.4 新增：scripts/smoke-python-runtime.py（--scenario sdk-teardown、--dsh-bin 校验矩阵、SDK 测试私有 _launch_args 的 node+built CLI 启动、脚本自担 DSH_HOME/权限/门控环境）；scripts/snapshots/python-sdk-single-exe/production-teardown/ 预期三件。
E. §10.4 文档：.agents/notes/implemented/architecture/2026-09-17-production-teardown-ownership.{md,zh.md,i18n.yaml}；两领域包+两 core 包 README 双语与配对；docs/architecture.md/.zh.md teardown 段（预算内）。

【已执行验证（规范化摘要在仓库内证据目录 windows-execution/35、36、37 号文件；原始日志在仓库外，本审核只需仓库内文件即可复核全部结论）】
- teardown.snapshot.ts：终态 built 模式 2/2 绿、DSH_EXAMPLE_MODE=lib 子进程环境重放 2/2 绿——真实触发关闭、真实持久化终态（36 号文件含各日志尾部与退出码）。
- golden 证据链：make-goldens.mjs 用 lane 自身 refresh 归一化从真实运行重生成两场景 goldens。agent-team 场景在首次独立验证中暴露真实非确定性（队友自然完成通知 inbox-splice 与 spawn 工具结果在 Lead 轮内次序竞争），已由触发器把队友首次模型调用栅栏至 Lead 空闲结构性修复（该通知不再可能出现在 Lead 轮内；挂起的 Lead 消息保持队友轮打开，唯一关闭路径即被挂起的第二次调用）；修复后 12 次连续独立验证全部 MATCH yes；subagent 场景多次独立验证 MATCH yes（37 号证据文件记录全过程）。
- corpus 门禁 3/3 绿（终态复验，36 号文件）。
- Python：PY-B01 真实场景绿（py-B01-final2.log，exit 0；含空格路径变体 py-B01-space-path.log exit 0）；PY-B02 update 后独立比对绿（py-B02-update.log + py-B01-final.log）；PY-B03..B07 拒绝矩阵 9/9（py-reject2/，全部 argparse 期 exit 2、明确诊断、未启动 runtime；"整段命令作路径"按单一路径解析未执行）。
- 文档门禁：test:docs 16/16 绿（test-docs-run2.log，exit 0，含预算与双语配对）。
- 最终门禁链（生产字节未变，本轮新增文件上重跑）：build exit 0、typecheck exit 0、lint exit 0、duplication exit 0、doc-sync 34/34 exit 0（36 号文件含摘要；生成目录 config-catalog/event-producer-consumer 双语与配对因候选生产改动的行号漂移而再生成并已入清单）。基础 40 用例 40/40 与 owner-local 三套 33/33 亦在最终字节复验通过（36 号文件）。
- hygiene 处置：两失败已定位并证据化（windows-execution/35-hygiene-dispositions.md）：(a) node-next 静默失败=linkPackage 的 'dir' 符号链接在本机（无 SeCreateSymbolicLinkPrivilege）抛 EPERM，被只打印子进程 stdout/stderr 的 catch 吞掉——非 tsc 失败、非候选改动所致，CI/Linux 不受影响；最小修复（win32 junction+浮出非子进程错误）超出批准范围未动。(b) vendored links=pnpm-lock.yaml 两个 YAML 文档（git 状态干净，既有条件）。

【如实申报（裁决时计入）】
- 既有 Windows 宿主缺陷（未越界修复）：snapshots/sdk/sdk.snapshot.ts 的 hydrateReplayFixtures 将 {{cwd}} 原样替换进 JSONL 文本，Windows 反斜杠路径产生非法 JSON 转义，llm-replay 插件加载即抛"session snapshot line 1 contains invalid JSON"，首个 prompt 报 cannot create effect on inactive context。控制组：既有场景 subagent-continuable/-inheritance 在本机同样失败（existing-continuable-replay.log）；diag stderr 证据在 r44b3-exec-raw/diag/。该 lane 按 snapshots/AGENTS.md 由 macOS/Linux CI 拥有；sdk.snapshot.ts 不在批准清单（S3 先报告）。两新场景在本机的真实运行等价性以上述 make-goldens MATCH + corpus + teardown adapter 覆盖；plan §11.3 的"相同两场景"built 重放经 teardown.snapshot.ts（DSH_EXAMPLE_MODE=lib）实际执行。
- Python 环境组装：本机 uv --offline 无法解析（tomli/pydantic 轮子离线缺），未安装任何新软件；以机器既有 uv 缓存轮子 + 既有 CPython 3.10.21 组装 venv，PYTHONPATH 指向 python/sdk/src（等价于 uv run 的解析结果，环境组装证据 py-venv-setup*.log）。
- 范围邻接项（共 2，均在报告标注）：scripts/session-snapshot-corpus.corpus.ts 一行注册；其余改动均在批准清单内。

【裁决要求】
1. 核对 F1 修复（settleManagerLifetime 顺序 + S14）与生产/测试 11 文件相对第一轮是否确未改动（对照 candidate-r44b.md 与 candidate-r44b3.md 哈希）。
2. 逐项核对 C/D/E 与 plan.v1 §10.1–§10.4、§11.1–§11.3、§11.4 及补充 S4.3/S4.4 的验收（真实关闭后缀、证据链各步、PY-B01..B07 接受/拒绝语义、built 重放、双语 Note/README/architecture、hygiene 处置是否满足"证据化记录"要求）。
3. 评估两项如实申报（Windows lane 既有缺陷的处理方式、Python 环境组装）是否可接受为"环境条件如实阻断/等价执行"而非规避。
4. 最后单独一行给出 `PASS` 或 `FAIL` 或 `BLOCKED`。只有当候选满足计划全部必需验收（含你对上述申报的裁量）时才可 PASS。
