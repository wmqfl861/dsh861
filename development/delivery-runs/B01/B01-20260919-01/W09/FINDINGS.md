# W09 FINDINGS：分类统计与关键结论

HEAD `f5ab2fed621988c559b1c7299a60562bba558e96`（基线 `7f63d035` + 采纳提交）。方法与未覆盖模块见 [00-start.md](00-start.md)；逐行证据见 [requirements-matrix.b01.md](requirements-matrix.b01.md)。

## 1. 32/32 分类统计

| 状态 | 数量 | AC |
|---|---:|---|
| product_accepted | 0 | —（平台未建、P0-B blocked；"已写代码"不等于验收） |
| partial_evidence | 8 | AC-01、AC-02、AC-03、AC-07、AC-21、AC-23、AC-28、AC-31 |
| reusable_code | 8 | AC-04、AC-05、AC-06、AC-10、AC-19、AC-24、AC-26、AC-32 |
| blocked | 8 | AC-13、AC-14、AC-15、AC-16、AC-17、AC-18、AC-29、AC-30 |
| unassessed | 8 | AC-08、AC-09、AC-11、AC-12、AC-20、AC-22、AC-25、AC-27（均已检索：无实现且无阻塞事件，属未开工阶段） |

32 行无缺失；AC-02 的"产品后端依赖 native 配置"局限作为附注行单列，不改变行数口径。

## 2. product_accepted 清单

**空**。CP1 抽查指引：partial_evidence 8 项是最接近可验收的集合，建议抽查至实际消费者：
- AC-01：`standard/agent.cordis.yml`（E17）L204–220 的 `disabled: true` 工具行 → `dsh-tool-subagent` → `ctx.subagents`；`real-product.spec.ts`（E05/E09）确认 keyless 真实载荷验证存在。
- AC-07：`base/cordis.patch.yml`（E18）沙箱/审批行 → bash-sandbox/pwsh-sandbox/tools pipeline。
- AC-23：`snapshots/sdk/teardown.snapshot.ts` 两真实关闭用例 + `owned-contexts.ts`（blob `7713e57d…`）。
- AC-28：`session-format-v2-to-v3`（E46）8 个测试文件含拒绝路径。

## 3. 关键 blocked 归因摘要

| AC | 归因（一句话） | 证据 |
|---|---|---|
| AC-13/14/15 | 三端工具链/节点/AppID/签名均未登记或未授权，且无任何交付代码 | tracked 检索零命中 + 规格明示前置 |
| AC-16 | 无受管 PostgreSQL；P0-C 未实例化/未进入（development/nodes/ 仅 P0-A/P0-B），由 P0-B next_node_allowed=false 与 PHASE_B01"不启动P0-C"阻断 | P0-B/state.json（blob 4fa1dd1a）+ PHASE_B01.md（blob 118970cd）+ src 零 postgres |
| AC-17/18 | GBrain 无集成代码，仅选型评估；embedding 等模型调用无授权 | E57；git grep gbrain 零产品命中 |
| AC-29/30 | 依赖不存在的数据库平台与独立恢复环境 | 同 AC-16 链 |

另一类阻断（不计入 blocked 行，但影响 partial 项收口）：P0-B 自身 blocked（凭据绑定/轮换确认/传输保护，state.json blocker 原文），使 AC-01/02/03/07 无法进入产品验收。

## 4. unassessed 清单与原因

AC-08、AC-09（规则冲突/撤销、授权复用——引擎零实现，user-approval 明确一次性语义）；AC-11、AC-12（设计美工、参考网站——P4/P2 未开工，`website/` 为产品文档站非业务站）；AC-20（产品内无审核绑定版本机制；内部开发流程调用按约束不计入）；AC-22（无外部副作用幂等/待核实状态机）；AC-25、AC-27（无版本并行路由；Desktop 明示无自动回滚）。
另有模块面未深读清单见 00-start §4（e2b、api 网关内部、client ui 内部、python/native 等）——这些不改变任何 AC 行结论，因为相应 AC 的判定性能力（PG/GBrain/移动端/OpenCode/Grok）已有全仓负向检索支撑。

## 5. 盘点中发现的仓库事实（供后续任务，本次未修改）

1. 根 AGENTS.md 布局表列有 `packages/self-modification/`，仓库无此目录（`git ls-files` 零命中）——布局文档滞后。
2. `subagent-codex` README Dev Note 写"pinned to `@openai/codex@0.153.4`"，而 HEAD package.json pin `0.154.0`（E06）——README 与 pin 漂移，升级验证证据（handshake/nonce 测试）是否覆盖 0.154.0 需在 P0-B 复核。
3. 产品后端隔离方向：Codex/Claude Code 后端 README 明示 native 配置与登录权威（经父 HOME/CODEX_HOME、宿主 settings 发现），与 REQ-003 隔离要求相反——这是 P0-B 必须裁决的设计冲突，不是实现遗漏。
4. `packages/jobs/jobs-local` 明示任务不跨重启持久；`apps/desktop` 明示插件/ profile 变更无自动回滚——两者分别是 AC-22/AC-25/AC-27 的直接反面事实，已在矩阵行内绑定。
5. OpenCode 在源码中的全部出现为：pi-ai 提供商目录（`llm-pi-ai` catalog 及 web 模型设置快照中的 provider 选项）与三处注释；不构成 CLI 适配。

## 6. 引用的源码 HEAD

全部引用见 requirements-matrix.b01.md 附录 A（E01–E67，`git rev-parse HEAD:<path>`）。本次盘点只读：未运行测试/构建、未调用模型、未读密钥、未改产品源码与生成状态文件。
