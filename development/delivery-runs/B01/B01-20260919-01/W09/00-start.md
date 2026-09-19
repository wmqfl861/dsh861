# W09 起点：AC-01—AC-32 产品证据盘点方法与边界

任务：B01-20260919-01 / W09（32 项产品证据盘点）。执行者：只读产品分析者。
本目录为本任务独占产物；未写任何产品源码、未更新 NODE_STATUS、未解锁 P0-C、未调用任何模型、未读取密钥或 `.env`。

## 1. 盘点基线（源码 HEAD）

| 项目 | 值 |
|---|---|
| 工作目录 | `C:\Albert\project\dsh861` |
| 分支 | `chore/latest-stable-upgrade-20260912` |
| HEAD | `f5ab2fed621988c559b1c7299a60562bba558e96`（= r48 基线 `7f63d03538` + 采纳提交 `f5ab2fed62`，与 formal-plan.v1 §1.1 一致） |
| P0-B 正式状态 | `development/nodes/P0-B/state.json`：`blocked`、计划 v3、`next_node_allowed: false`、`product_acceptance_completed: []`（blob `4fa1dd1ab8f34e620a14e83fe4c9c7beea12665f`） |
| 本次运行状态 | 读取 `STATUS.run.json` 只读；未修改 |

所有引用 blob 均为 `git rev-parse HEAD:<path>` 在上述 HEAD 的取值，见 [requirements-matrix.b01.md](requirements-matrix.b01.md) 附录 A。

## 2. 盘量方法

1. 必读输入：formal-plan.v1.md（W09 节）、WORK_PACKAGES.md（W09 卡）、REQUIREMENTS_MATRIX.md、PRODUCT_BLUEPRINT.md、MULTI_AGENT_REQUIREMENTS.md（§11 验收表为 AC 定义权威）、MULTI_AGENT_DEVELOPMENT_ROADMAP.md、P0-B state.json。
2. 源码存在性判定用 `git grep`（仅 tracked 文件，避开 node_modules 污染；被污染的两次后台 grep 已中止并改用 tracked-only 检索）。关键负向结论（OpenCode 适配、Grok、PostgreSQL、GBrain、移动端框架）均有 tracked 全仓检索支撑。
3. "真实消费者"不按包名 grep 判定：每个 reusable/partial 项都追到实际调用链（如 provider → `ctx.subagents` 注册 → `dsh-tool-subagent` 工具行 → preset 组合；user-approval → tools pipeline 与沙箱 shell 的 ask 决策点；session-persistence → agent-loop 发布点）。
4. 局部测试按 `git ls-files <pkg>/tests` 逐包核对存在性与关键用例性质（keyless real-product / loader 组合 / 单元）。
5. 证据绑定：路径 + HEAD blob（附录 A）。README 声明仅作线索，结论以 src/tests 与实际组合装配（cordis.patch.yml、presets、bundle）为准。
6. 按实际可交付流程计状态，不给等权百分比；工作包完成与产品 AC 完成分开。

## 3. 状态词义（本次执行版口径）

| 状态 | 判定口径 |
|---|---|
| `product_accepted` | AC 验收条件在产品语境下已有真实运行证据。**本次 0 项**：全部 AC 的验收主体是"多智能体公司平台"，该平台（P1 起）未建设，P0-B 仍 blocked。 |
| `partial_evidence` | 存在与 AC 场景直接对应的真实实现、真实消费者和局部测试；产品级验收（四 harness / 公司平台语境）未完成。 |
| `reusable_code` | 存在可复用的相邻能力（有实现、有消费者、有测试），但不直接构成 AC 验收场景。 |
| `blocked` | 存在明确、已记录的外部前置缺失（环境 / 授权 / 工具链 / 前置节点未放行），且无替代验收路径。 |
| `unassessed` | 本次未完成深度盘点；或已检索但无任何实现且无阻塞事件（属未来阶段未开工）。行内注明是哪一种。 |

约束遵守：当前内部开发者调用 Codex/OpenCode 的记录（P0-B precheck、r44–r48 remediation 等）一律不计为交付系统的受管适配验收。

## 4. 未覆盖模块清单（明确 unassessed 的模块面）

以下模块本次只做存在性/负向检索（确认不含 PostgreSQL、GBrain、OpenCode/Grok 适配、移动端交付代码），未逐文件深读，不从"未深读"推出"无价值"：

- `packages/e2b/*`（远程沙箱 POC）、`packages/lsp/*`、`packages/terminal/*`、`packages/webhook/*`（含 webhook-github）。
- `packages/api/gateway`、`session-controller`、`settings-controller`、`workspace-controller`、`workspace-files` 内部实现（仅核 `api/remotes` 装配面）。
- `packages/client/ui-*` 各 UI 包内部（仅枚举能力面，未逐包审）。
- `packages/experimental/`：inspector、code-runtime-python、webworker-packer/runtime、client-ui-agent-team（agent-team 主链已盘）。
- `packages/spill/*`、`packages/feedback/*`、`packages/goal/*`、`packages/schedule/*`、`packages/attachment/*`、`packages/compaction/*`、`packages/context/*`（agent-instructions 已盘）。
- `python/` SDK、`native/` addon、`website/`（VitePress 文档站构建细节）、`vendor/`。
- `apps/cli` 内部子命令全貌（仅核 profile 启动与 web/dsh 入口）。

## 5. 产物清单

| 文件 | 内容 |
|---|---|
| [requirements-matrix.b01.md](requirements-matrix.b01.md) | 32 行执行版矩阵（六维度 + 证据绑定 + 附录 A blob 表） |
| [reuse-and-gaps.md](reuse-and-gaps.md) | 可复用清单与缺件清单（负责者 / 准确输入 / 授权状态 / 可继续任务 / 验证方法） |
| [user-visible-capabilities.md](user-visible-capabilities.md) | 一页用户可见能力摘要（如实，不营销） |
| [FINDINGS.md](FINDINGS.md) | 分类统计、product_accepted 清单、blocked 归因、unassessed 清单、核查注意点 |

名称映射：formal-plan §2 W09 预告产物名 `requirements-matrix.md`、`capability-summary.md` 对应本目录实际交付的 `requirements-matrix.b01.md`（执行版矩阵）与 `user-visible-capabilities.md`（能力摘要）；按本任务指令命名，内容职责不变。
