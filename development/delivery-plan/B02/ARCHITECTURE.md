# B02 实现责任、持久状态与并发约定

类型：正式规划的架构输入。以下类型/方法名是建议命名，不冒充现有API；C00/C01以实际源码核实后冻结。先交互切片，后扩完整图与循环，不重写原agent-loop。

## 1. 组合路径

Windows Electron → 现有Web client/runtime/Remote → 桌面控制Host consumer → TeamService、Subagent服务、WorkflowEngine或新的结构化流程控制owner → 已配置provider。沿用既有鉴权、Session选择、IPC/transport和插件effect所有权；不另开未鉴权HTTP监听器，不把Node进程控制交给renderer。

建议把工作分成三个新增责任单元：`packages/experimental/desktop-control/`（人类操作API、执行能力解析、团队/Agent控制）、`packages/workflow/workflow-control/`（定义、校验、持久run和结构化调度）、`packages/client/ui-control-center/`（团队、Agent、流程编辑及运行中心UI）。这是候选位置，若现有模块能完整承担职责则复用；不得为凑包数拆空接口。

现有Team Remote只有view/createTask/updateTask，spawn/send/interrupt需安全的Host consumer。优先新增控制facade而不是改其销毁实现；确需在原service新增Remote仅限类型化管理入口，保持原Lead与exact live Agent校验。浏览器输入teamId/childId不等于权限，必须由会话/主体权限解析出真实Agent，再调用相应方法。

## 2. 数据责任，不能悄悄替换原PostgreSQL要求

| 实体 | 责任 | 持久和版本规则 |
|---|---|---|
| TeamDefinition | 本地项目的团队模板，不等于一次活跃Team | 显式版本、成员定义、已有profile引用、无秘密；保存成功必须经过Host持久确认 |
| TeamInstance | 实际根Session及其Team成员/任务 | TeamId仍等于真实root Session；现有TeamJournal是成员/任务/消息事实源，不另造镜像主库 |
| AgentBinding | 模板成员到受管执行配置和实际Session的关联 | 显示别名不当身份；能力与实际程序/配置版本固定在执行快照 |
| WorkflowDefinition | 可编辑的版本化结构化流程 | 同一JSON定义驱动图与表；运行后改模板只生成新版本 |
| WorkflowRun/NodeAttempt | 本次执行的不可变输入快照与事件 | 在新owner中使用现有持久化接口/Session日志保存intent、结果、取消和checkpoint，持久失败不能确认动作 |
| ScheduleDefinition/Occurrence | 哪个定义何时可启动、唯一一次触发 | 固定definitionVersion、时刻/序号、重叠/错过策略和有限次数；启动去重不能靠renderer内存 |
| Artifact/ReviewResult | 实际输出及所审版本 | 引用、hash、来源run/attempt；审核结果绑定产物/候选，输出换版不复用旧PASS |

本阶段的本地项目模板可以采用已有profile-owned文件/配置存储，并用明确原子写入、预期版本比较及冲突处理。它不是正式公司状态库；禁止在localStorage保存唯一执行状态，禁止新增临时SQLite公司主库冒充原REQ-016。正式PostgreSQL/GBrain部署与跨机平台保持原需求和前置，本阶段不自行安装。C00必须写明每个字段的唯一权威及未来接入映射，不能同时维护两份自认主库的Team/Task。

新的运行事件须由所属包按既有Session扩展规则声明和验证，保留原已发布代次/fixture；不为容忍新数据而全局忽略未知事件。若现有持久服务缺少必需原语，先在当前节点计划中明确最小扩展及验证，不跳过持久化，亦不从“能写JSON”推导具备事务安全。

## 3. 稳定命令和结果

每个写命令含 `requestId`、目标稳定ID、`expectedRevision`及经过schema校验的数据；不接收任意JS函数、shell字符串或伪造live Agent。Host返回区分transport错误、业务拒绝、已持久接收、进行中和需核实状态的typed result。

读API至少涵盖capabilities、teams/instances、members、task board、definitions、run snapshot、events cursor和artifacts。写API至少涵盖保存定义、创建/启动team、创建/指派任务、发送成员消息、interrupt当前轮、启动/暂停/继续/取消run、提交人工决定、管理schedule。每项命令需对应权限和失败码；不要机械转发全部Host方法。

同requestId重试复用已知结果，冲突payload拒绝；跨崩溃的外部动作若缺唯一收据则进入 `reconciliation_required`，不能宣称通用exactly-once或自动重发。先持久化调度intent再启动动作，绑定实际child/session/attempt，保存结果后才允许依赖节点放行。

## 4. 结构化图和运行器

定义为有向无环外层图；循环使用显式Loop节点和独立body图，不允许在任意边上形成无界环。节点kind、端口、引用类型、条件DSL、版本、最大节点数/深度及输出大小在边界验证；前端校验只是提示，Host必须再验。

优先把已有WorkflowEngine用于一个有界活动片段的执行，并让新workflow-control负责定义版本、checkpoint、人工等待和跨片段调度。现有engine只暴露live caller-owned handle，没有journal/resume，不能直接把它当持久调度服务。若决定不用其脚本模式，仍复用统一subagent/权限入口；正式计划给出原因，不拼字符串eval用户输入。

run状态至少区分 `queued`、`running`、`pause_requested`、`paused`、`waiting_approval`、`cancelling`、`completed`、`failed`、`cancelled`、`reconciliation_required`。节点状态至少区分pending/running/awaiting_review/completed/failed/skipped/cancelled/unknown。idle是Agent运行观察，不是节点完成。

并行汇合只有所有必需前置成功才能正常放行；非必需失败规则须显式。一个子任务失败，仍要等待或取消并收敛其他已启动任务，不能Promise.all先reject后把剩余工作遗忘。审核者应与实现者具有独立Session且按已有权限预设限制写入，角色文案不能代替隔离。

## 5. 循环、限额和重入

固定循环有显式iterationId，返工循环有reviewId和artifactRevision；重试attempt不是新iteration，调度周期occurrence也不是模型重试。所有新外部请求先在同一owner的原子准入区预留调用额度/并发槽，不能在并行分支各看旧计数后一起超限。失败/取消请求也计入已实际发出的调用数，启动前拒绝不计为已发送。

费用、token回传可能缺失或延迟；UI分别显示已确认、估算和未知。能硬执行的是实际可观测的调用/并发/时间上限；不能向用户承诺provider不给数据时的精确金额封顶。预算耗尽关闭新派发，已启动任务按取消策略收敛。

所有ready判断、状态写入、人工批准、定时触发和取消必须能抵抗双击、重复事件和同一microtask中的重入。先建立共享事务/Promise身份再启动可重入动作；事件监听器不能持有会等待自身完成的依赖环。保留r44的exact-owner取消/销毁语义，关闭当前run不影响无关团队。

## 6. 暂停、取消和重启

暂停默认是调度屏障：停止新增动作，已运行工作到达可确认边界后才标paused。若用户选择立即停止当前模型调用，则使用明确interrupt/cancel操作，而非假装进程可被任意挂起恢复。

取消顺序是持久cancel intent → 停止新准入/移除自有timer → abort本run拥有的实际handles → 等待各自终态/释放 → 持久化结果。超时只报告尚未停止，不能改成cancelled成功或删除诊断数据。

重启先恢复定义与journal，核实未终结attempt的实际结果、child Session及收据；已有完成动作不重做，不明确的操作需人工确认或支持的安全查询。不能恢复原JS堆栈时明确“从已提交节点检查点继续”，不要写透明续跑。

间隔计划只在本应用Host实际存活并拥有项目时执行；关闭应用不提供后台daemon承诺。默认重开时合并/跳过错过周期，不集中补跑无限积压；时区只影响展示或已明确定义的时间计算，持久层保存明确UTC与策略。分叉项目/复制模板不自动复制正在激活的调度。

## 7. 安全与边界测试

跨项目Team/Agent/Run ID拒绝、stale revision拒绝、未授权provider/工具拒绝、非法图和无界loop拒绝、异常输出拒绝、错误来源artifact拒绝、取消竞态、持久失败、崩溃后未知外部动作、重复schedule触发、事件流断线重连均须有直接与组合验证。

复用现有Electron隔离和Remote框架，不为方便给renderer Node访问权、开放通用exec或让图表达式访问文件/网络。新消息或工具输入若模型可见，按现有规则留真实Session记录。测试使用自有项目和已批准的keyless/真实产品条件，不扩大系统或凭据权限。
