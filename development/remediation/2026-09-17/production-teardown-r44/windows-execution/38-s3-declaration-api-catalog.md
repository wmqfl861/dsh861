# S3 申报：packages/extensions/tool-cordis/src/api-catalog.ts（2026-09-17，第四次分派执行者）

## 事实

- `git status` 中存在第 63 个候选文件：`packages/extensions/tool-cordis/src/api-catalog.ts`（对 HEAD `e8d1858c` 差异 +6/−2 行）。第二轮硬审（review/r44b-hard-review-round2.md 第四节）将其识别为唯一阻断发现：内容为候选公共类型改动的机械投影，但未入 candidate-r44b3.md 清单、未在任何申报中出现、且不在批准清单字面范围内。
- 差异全文（逐行核对为生成等价物，无手写逻辑）：
  1. `TYPE_API` 新增条目 `AgentTeardownHooks`（declaration 为 `packages/core/agent/src/index.ts` 中已批准公共接口的逐字投影）；
  2. `CreateAgentOptions.declaration` 字符串内新增 `readonly teardown?: AgentTeardownHooks;`；
  3. `ResumeAgentOptions.declaration` 字符串内新增同一字段。
- 生成者：`scripts/gen-cordis-catalog.ts`（`--check` 归 doc-sync 的 `cordis-catalog` 门，run-gates.ts:772）。该文件为生成输出，非手写源码。

## 产生经过（如实记录，含流程偏差）

第三次分派执行者在补齐 §10.4 文档门禁期间重跑 doc-sync：因候选生产改动使既有生成目录（docs/config-catalog、docs/event-producer-consumer 等）行号漂移，`gate-summary-final.txt` 记录 doc-sync exit=1；执行者运行生成器再生成目录后 final3 复跑 34/34 绿。生成器在同一运行中同步再生了 `packages/extensions/tool-cordis/src/api-catalog.ts`（同一类型 API 的源侧投影），执行者将其留在工作树（doc-sync 因此通过）但既未入清单也未申报——违反 S3"清单外文件先报告"规则。本申报为事后补报，不补造任何事前申报。

## 授权判定

批准范围（scope-approval-registration.md 第一节）的配套面为"已归档 plan.v1 和 r44-B 清单中明确列出的直接相关测试、文档、双语配对和新 Session/SDK 快照"；api-catalog.ts 不在字面清单内。判定其应随候选入清单的依据与边界：

1. **内容零增量**：差异 3 处全部是已批准生产文件（`packages/core/agent/src/index.ts`）公共类型改动的逐字机械投影，无任何手写逻辑、无行为面；S3 表中"文档"行的同类先例——docs/config-catalog 再生成三件已入 r44b3 清单并经第二轮审核接受，api-catalog.ts 为同一生成器同一次运行的源侧输出。
2. **门禁必需，无清单内替代**：第二轮审核实测 `gen-cordis-catalog.ts --check` 在当前工作树通过、仅应用 62 项清单到 HEAD 会 fail doc-sync；而 doc-sync 是 plan §11.4/§14.3 第 9 条要求的适用门禁。清单内可选方案不存在：回退该文件 = 候选无法通过自身必需门禁；修改门禁或生成器 = vendor/scripts 超范围（S3 明列不可写）。
3. **处置沿用第二轮审核的裁定路径**（round2 第五节）："补 S3 申报/授权判定、将该文件入 manifest（无任何既有字节改动）、清 `__pycache__`、重冻结后复审可收窄为该增量"。
4. **边界**：本申报不扩大生产可写面——该文件既有字节不再改动，任何进一步返工（如再生成漂移）按 §13 形成新候选；最终范围追认属所有者侧独立审计（硬审 PASS 后、恢复提交/推送前），本轮不提交不推送。

## 处置（已执行）

- `scripts/__pycache__/smoke-python-runtime.cpython-312.pyc`（Python 运行残留，未跟踪、非保留原件）已删除：`scripts/__pycache__` 目录整体移除，git status 不再含该项。
- 重冻结 `candidates/candidate-r44b4.md`：63 项 = candidate-r44b3.md 的 62 项逐字节不变 + api-catalog.ts 一行（bytes/git blob/SHA-256）。
- 关键门禁在最终字节复跑（39 号文件记录）：`gen-cordis-catalog.ts --check`、`git diff --check`、doc-sync、基础 40、owner-local 三套。
