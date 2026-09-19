# r44 归档接收索引 v1（r44-A 纯文档归档轮，2026-09-17）

本索引只登记 r44 已产出的计划与脱敏证据及其缺口，不重写计划、不构成任何批准。归档后生产状态仍为 `BLOCKED`（P0-B blocked，不进入 P0-C）；本目录不是 `implemented` 记录，不改 `development/nodes/P0-B/state.json`。本轮任务来源：PR #13 评论 [issuecomment-5705673790](https://github.com/wmqfl861/dsh861/pull/13#issuecomment-5705673790)（凭据无关的 api.github.com 匿名读取，HTTP 200；副本存仓库外 `C:\dsh-r24-upgrade-20260912-01\r44a-task-fetch\`，13066 字节）。

## 1. 源码基线与四项状态

- 基线：分支 `chore/latest-stable-upgrade-20260912`，HEAD `9d0db65683b7925e37dc84578e23cba2a83e589c`（父 `c791b40e35580efd63ebc85607a8c898c64177fb`）；`ls-remote` 实测同 SHA；PR #13 保持 draft、base `feat/multi-agent-company-nodes`（远端 `5434305c…`）未变、未合并。除本目录外工作树干净，r29–r43 已跟踪历史与全部已跟踪源码/测试/配置相对基线零变化。主 CI run 35120957257 仍为历史 failure（以 r43 回执评论为据，本轮未重取证）。
- 计划：[planning/plan.v1.md](planning/plan.v1.md)，51955 字节，SHA-256 `4b666af39f993ac1253c079786d1bc87391caf8d91abcff35b4f25f3fa41141c`，git blob `e28695c08b43cec50c196f3fa252543a014ce847`；与仓库外 raw stdout（同哈希）字节等同。
- 四项状态分离：计划 = 本地 `PLAN_READY`（[planning/planner-invocation.md](planning/planner-invocation.md)、[00-start-state.md](00-start-state.md)），远端审阅待完成；生产 `IMPLEMENTED` / `VALIDATED` 未执行（复现仍 2 failed / 38 passed，exit 1）；指定 OpenCode 硬审未执行、无 `REVIEW_PASS`；计划 §5.3 core 扩围未获批准。

## 2. 原 Codex 调用证据、缺口与口径

- 确有证据：[planning/planner-invocation.md](planning/planner-invocation.md)（run header 逐字事实：Codex CLI 0.153.4、workdir、`gpt-6-astra`、read-only sandbox、reasoning max、session `01a0ab6d-c5be-74f0-ab73-80e72f76d2f1`；18:14:37Z 启动、18:54Z 完成；stdout 为完整计划；stderr 尾部结算行）。raw stdout/stderr 与探测捕获均在仓库外 `C:\dsh-r24-upgrade-20260912-01\r44-task-fetch\`，不入库；完整 raw 哈希以 planner-invocation.md 记录为准。
- 缺口：原调用的完整 argv 与进程退出码未被任何人捕获（首执行者等待期间被终止所致），记 MISSING，不以任何探针或结算行补证为 exit 0。
- 另一次运行须分列：[planning/cli-availability-probe.published.md](planning/cli-availability-probe.published.md) 记录的 `CODEX_PROBE_OK`（exit 0，独立 session `01a0ab60…`）是参数可用性探针，属另一次调用，不能充当原调用回执。
- 行数口径：plan.v1.md = 51955 字节、724 个 LF 换行（`wc -l` 口径，即换行符个数）、文件以单个换行结尾、无 BOM。"725 行"主张未出现在任何仓内证据文件（仅见于前代理会话回执）；未为消除该口径差修改任何原文。
- token 结算仅引用原输出行 `tokens used 826,220`（stderr 结尾）；不推算金额、不宣称额度或费用已获新增批准。

## 3. plan.v1.md §5.3 三个 core 文件（待所有者决定的精确范围清单，不是批准单）

出处：plan.v1.md §5.3，原文第 163–178 行（表体 166–171），计划 SHA-256 见 §1。前提（第 164 行）："如真实轨迹确认上述路径"（§5.2 第 141–160 行的源码时序反例）才需要该扩展；§5.1（第 129–139 行）说明三个首要文件修不了共同 owner 语义。授权须同时覆盖这些文件的 owner-local 测试、README/JSDoc、`docs/architecture.md` 生命周期说明与双 SDK 预期（第 172 行）。第 174 行："本计划列明必要范围，不授予该范围写权限。"

| 文件（固定 9d0d blob） | 拟改职责（§5.3 原文） | 最小必要性（计划依据） | 公开行为 / 持久化 / 取消与释放语义 | 对应回归编号 | 不扩围替代方案 |
| --- | --- | --- | --- | --- | --- |
| `packages/core/agent/src/index.ts`（blob `21c95b5c600d393d3cfd2bf37f76f40fea22cb58`） | "为 create/resume 声明类型化的关闭参与接口，使 owner 在发布前安装关闭开始通知和释放前准备；明确 exact Agent、共享 completion Promise 与禁止自等"；不扩大到"不新增 wire 方法、Session event 或模型输入" | §5.2：领域包内新增 effect 无法阻止同 scope 的 inbox 注册 sibling 提前撤销，不能保证 child settlement 所需 inbox；§5.1：三首要文件修不了共同 owner 语义 | 行为：现有未提供 hooks 的调用者维持原有行为（§6.1 第 199 行）；持久化：未说明（仅计划级验收"应持久化的事件没有丢失"，§14.3 第 7 条）；释放：发布前安装 begin/beforeRelease 参与点（§6.1 第 184–197 行） | §9.4 K01–K08（`packages/core/agent-loop/tests/teardown-ownership.spec.ts`，第 381–394 行）与 §9.6 既有 agent factory/scope/cancel 测试（第 435 行）；逐文件映射未说明 | 第 176 行：若真实证据证明三个首要文件内可满足 §4 全部不变量，由指定 Codex 出具缩减范围的计划修订后实施；未获扩展授权则后继为精确 `BLOCKED`（第 174 行） |
| `packages/core/agent-loop/src/index.ts`（blob `6c30f0413593ae171aed09e35e68eb1f5946a4d9`） | "在 `prepare()` 的同一 memoized teardown 内调用上述参与点；将实际 scope 的精确 structural disposer 在其 parent fiber 上纳入该顺序；逐项执行清理义务"；不扩大到"不改全局 Cordis 算法，不重构 driver" | §5.2 时序反例：factory provider 卸载与 Agent scope 结构 disposer 并行；§3.3 第 107 行：跨 fiber 收集不能移除另一 fiber 的注册 | 行为：未说明；持久化：未说明；释放：scope 精确 disposer 在实际 parent fiber 上纳入同一 memoized teardown、撤除原 sibling 注册（§6.1 第 193 行），每项清理义务逐项执行（第 194 行） | §9.4 K01–K08；§11.1 扩展 owner-local 检查命令（第 517–519 行）；逐文件映射未说明 | 同上 |
| `packages/core/agent-loop/src/agent.ts`（blob `06e1f51b57277ba296698b6c8b810f0e455e3695`，与任务评论 B 节固定值一致） | "`cancel()` 的 inbox 清理失败后仍执行对应 abort 与禁止后继 wake 的义务，保留原始异常"；不扩大到"不改 inbox projection、`whenIdle()`、工具调度或模型调用协议" | §5.2 反例链末端"再次 cancel → inbox.clear → 读已撤销的投影"（第 154–155 行）；§3.2 与 §6.3：cancel 一步失败不得跳过其余释放义务 | 行为：cancel 补异常安全语义并保留原始异常；持久化：未说明；释放：inbox 清理失败后 abort 与禁止后继 wake 义务仍执行 | §9.4 K05（inbox 清理 sentinel 后仍 abort、`whenIdle()` 等待真实退出、原错误保留，第 391 行）；逐文件映射未说明 | 同上 |

"未说明"= plan.v1.md 未就该文件在该维度作出说明，本索引不替 Codex 补写。除上述三文件外，`session-projection` 注册框架、core inbox、`scope`、持久化/lease 与 vendor 继续只读（第 178 行）。

## 4. 两个独立阻断（解锁其一不自动解锁另一）

1. 认证阻断：指定硬审核者（真实 OpenCode CLI，`--model zhipuai-coding-plan/glm-5.3 --variant max`，依 NODE_DEVELOPMENT_RULES 固定、维持不变）在本机 0 凭据、无 `zhipuai-coding-plan` provider。本索引仅引用已完成的无秘密诊断（[review/BLOCKED-opencode-hard-review.published.md](review/BLOCKED-opencode-hard-review.published.md) §2 及其指向的 probe 发布副本；仓库外 raw 捕获哈希已在案）。r44-A 未再次 `auth list` / `models` / `run`，未重查全局认证路径或环境变量。
2. core 扩围未批准：§5.3 三文件（上表）未获所有者授权，任何人不得凭"认证已修复"迳行实施。

未降级、未替换审核者/模型/等级；两项解锁条件互相独立。

## 5. 复用的独立审计与最小独立归档复核

- 审计对象：r44 BLOCKED 回执证据集（本目录 11 个仓内文件 + 仓库外 raw stdout/stderr/probe 捕获）。
- 审计记录：[review/r44-independent-audit.published.v1.md](review/r44-independent-audit.published.v1.md)（4879 字节，SHA-256 `1a4ba22e7047af744731e12d0f10b7ea0ba72fc59cafc56effb701b0538c26ee`）。性质：主会话委派、全新上下文、只读；结论 `PASS`；由 r44-A 执行者自所有者任务转达逐字转录落盘（此前仅存于会话）。未脱敏逐字原件 3891 字节、SHA-256 `62142317aa2c973ebb409cbaebba765c74857d8697fcda9705a944abf6cafdbe`，保存在仓库外 `C:\dsh-r24-upgrade-20260912-01\r44a-task-fetch\`。
- 边界：该 `PASS` 只针对 BLOCKED 回执证据本身，不构成、不替代指定 OpenCode 生产硬审，也不把计划升格为可执行授权。本索引与脱敏发布副本相对已审计的 11 文件集改变了归档候选；按 r44-A 任务阶段门，本次纯证据交付交由全新上下文独立归档复核确认——该复核仍不是生产硬审。

## 6. 归档清单与 raw/published 双哈希

唯一归档目录：`development/remediation/2026-09-17/production-teardown-r44/`。原样提交（8 件，冻结原件，未做任何改动）：

| 文件 | bytes | SHA-256 | git blob |
| --- | ---: | --- | --- |
| `00-start-state.md` | 6732 | `1104ed9efaeb9f1e3a8ed57f3ccfa0424a68bf6d4f6c91f177605cf5abb4edd9` | `4bdbc4f78cd1aaf3ef27092d292998f32e870b34` |
| `planning/plan.v1.md` | 51955 | `4b666af39f993ac1253c079786d1bc87391caf8d91abcff35b4f25f3fa41141c` | `e28695c08b43cec50c196f3fa252543a014ce847` |
| `planning/planner-invocation.md` | 3737 | `7bc5529de1f1857daa4e2389078fd9d8fc315500097d62aedebaee74778d0efd` | `131b61c1f1cecbf1dd9ed9a07f7628d8a77de5f8` |
| `planning/ownership-correction.md` | 2407 | `5679abd1feb95bd4340bf4d26d23f1e43ade399a247d714a16904471c14122a2` | `7b961bbed3536c260638807e85ebed17748dc7ad` |
| `planning/codex-planner-prompt-r44.txt` | 9553 | `65ffd7230a4ab0ddaf0f1615dfc12e2d138cd656b862cf21b848b1d607605d87` | `6349daa6272f284b61f7d712db745a7d9ace4d69` |
| `planning/source-evidence-ownership-map.md` | 13279 | `43df69337819472355b16ef944fb7e4e9ca905896a42e6804b35b90662b68384` | `ef80eda04d4b4dcc75d2d085550f518729353383` |
| `planning/task-comment-5701865211.md` | 15624 | `6c6de7a08013f6038e31d9db33c777d5ec64ed0f6942b0beb10319ef7b7d623d` | `4067ab32d201ef40ee0edd4225ae623e7de0a85b` |
| `planning/receipt-comment-5701849308.md` | 9404 | `194022d38cbce729f4d2f23ccf10e8bfcb497109b1f635d5ad75ffd4d4fbb923` | `d49db92b7c8925beaf32190596c4eefd75449cad` |

脱敏发布副本（3 件，提交）与其本地保留原件（3 件，不提交、留在工作树，禁止当垃圾清理）：

| 发布副本（提交） | bytes / SHA-256 / git blob | 本地原件（未提交） | bytes / SHA-256 | 处理范围 |
| --- | --- | --- | --- | --- |
| `planning/cli-availability-probe.published.md` | 4139 / `6494bdceb72643d2c6a6564bb87fe244678b1ab9ee864d04235a100b0887a568` / `57e7e859de5faa38cba9805806d0fb3d89d65ede` | `planning/cli-availability-probe.md` | 4127 / `32d2801dedef2bd2edef5d7bfc37884bd8861c5f51e151639c1021f71139efd5` | 本机用户名全名 → `<local-user>`，3 处 |
| `review/BLOCKED-opencode-hard-review.published.md` | 5663 / `225dd4dc8ae3616a1b425d2eaf697fa84acb64826a035123d200c1abeeb7d07a` / `098509c96dd05effe5c80b475a1af4c9c48e02ec` | `review/BLOCKED-opencode-hard-review.md` | 5659 / `f631f6947dcee4a4668abc79b15cc41451088648b3411caeb43b632efe81d1ed` | 本机用户名全名 → `<local-user>`，1 处 |
| `windows-execution/01-first-failure.published.log` | 11367 / `7a11a875a88c6bb19c7903200b088e630ebe79653e1c097dfa059703705f6943` / `95ff7dab4834ba0762965d49bcc8d0733e49ede6` | `windows-execution/01-first-failure.normalized.log`（raw 另存仓库外，13656 字节，`30648084…f93d`，见 00-start-state.md） | 11355 / `aacfedb6dc1ce422cf2b53fd0f755146b71b81f49b7be8e9b358e36abb36bb33` | 本机用户名 8.3 短名形式 → `<local-user>~1`，2 处 |

新增（2 件）：`review/r44-independent-audit.published.v1.md`（哈希见 §5）与本索引（本索引不自列哈希）。合计提交 13 件，全部位于唯一归档目录。

发布副本唯一改动是上述本机用户名替换（往返校验一致）；除此之外与原件逐字节相同，但不得称为逐字原始输出。CLI 自身掩码的登录状态显示（`sk-1f67a***4e41f`，非凭据值）与指向另一机器历史文档的既有路径引用（`C:\Users\Administrator\...`）保持原样。归档集内无任何凭据值（仅环境变量名的存在性检查记录）。

## 7. 清单差异说明与仓库外保留件

- 扩展名差异：所有者转达清单把提示词文件记为 `codex-planner-prompt-r44.md`；磁盘实为 `codex-planner-prompt-r44.txt`（9553 字节、SHA-256 与独立审计记录的提示词文件一致，planner-invocation.md 亦记 `.txt`）。按"以磁盘与审计清单实际结果为准"以 `.txt` 归档，未另造 `.md`。
- 仓库外保留（不入库）：`C:\dsh-r24-upgrade-20260912-01\r44-task-fetch\`（codex stdout/stderr、探测与 `r44b-opencode-*.txt` 捕获）、`C:\dsh-r24-upgrade-20260912-01\r44-raw-logs\`（首失 raw）、`C:\dsh-r24-upgrade-20260912-01\r44a-task-fetch\`（r44-A 执行说明取件、独立审计未脱敏原件与生成脚本）。plan.v1.md 内含指向本机绝对路径的 markdown 链接（Codex 原文冻结，未改动）。
- 冻结件内相对路径的断链披露：冻结原件（`00-start-state.md`、`planning/planner-invocation.md`）与脱敏发布副本（`review/BLOCKED-opencode-hard-review.published.md`）的内文按相对路径引用未提交的本地原件（`planning/cli-availability-probe.md`、`review/BLOCKED-opencode-hard-review.md`、`windows-execution/01-first-failure.normalized.log`）；推送后这些相对路径在 GitHub 上不解析（对应提交件为 `.published` 命名）。冻结件不可改动、发布副本唯一允许的改动是用户名替换，故保留原文并在此披露；本地工作树上原件仍在，这些引用在本地仍有效。
- 本轮归档不含生产源码、测试、模型配置、锁、vendor、workflow 改动；未重跑 Codex/OpenCode、未调用业务 API/E2B；PR 保持 draft，不合并。
