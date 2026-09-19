# 审核与验证矩阵

类型：执行参考。与 [任务卡](WORK_PACKAGES.md) 配合，不能只按此文件中的命令清单运行后宣称产品通过。

## 1. 证据与执行环境

| 证据类别 | 能证明 | 不能证明 |
|---|---|---|
| 静态源码/官方手册 | 预期协议、可能的问题与精确路径 | 本机命令实际执行、编译成功或产品可用 |
| Bash/进程替身 | 控制流、错误传播、调用顺序 | 真实dpkg输出、真实ELF/ABI/内核隔离 |
| 真实本地直接回归 | 当前平台、当前工具和候选行为 | 未运行平台或完整业务产品验收 |
| 真实SDK/Session replay | 指定fixture的事件、请求和header行为 | 四种真实模型服务已接入、任意任务都正确 |
| Electron实际运行 | 本地桌面交互、隔离数据、退出重开 | 正式签名、升级安装或生产发布 |
| 原CI的固定run/attempt | 该checkout和runner执行的阶段 | 其他SHA、被skip步骤、截断区域未见的事实 |
| 指定硬审核 | 实际参数下对固定候选的审核结论 | 没有执行的测试、未授权范围或后来的新字节 |

所有命令明确source/built入口，项目依赖版本不私自升级。调用某个脚本失败后改用直接Node入口必须记录实际argv，不能把替代执行写成原pnpm-exec命令成功。测试不得读取生产Key/用户.env来解除缺件。

## 2. 最小验证矩阵

| 任务 | 本地必需 | 集成/平台必需 | 有效负向证明 |
|---|---|---|---|
| W01 | 真实脚本契约回归、Bash语法、字段与命令exit | 原包真实dpkg控制输出；W03继续真实Linux构建 | 恢复裸值假设；忽略命令失败 |
| W02 | 原36项及新增来源/环境测试全部非零执行 | Windows原CI文件级结果，Linux不回归 | 错误PATH/Path或宿主命令不能假绿 |
| W03 | 候选/输入身份与原日志核对 | 实际Linux下载、配置、编译、链接、ELF、版本、安全/功能probe及最后PATH发布 | 错误来源/依赖/产物不能被当可运行安全沙箱 |
| W04 | 平台契约和完整schema拒绝路径 | 两个shared场景完整Session/header；原专用adapter仍通过 | 修改真实工具字段/缺delivered必须失败 |
| W05 | 隔离profile、identity15项、目标expected | Windows实际cwd/profile行为；适用shared场景 | 错日志身份、未释放锁、错误转义不能被容忍 |
| W06 | Desktop/Host目标生命周期与协议测试 | 实际窗口、任务、取消、退出重开、数据隔离 | 真实自有backend失败必须显示失败而非假ready |
| W07 | 打包输入/文件清单/hash及私有运行时核对 | 实际未打包目录启动；安装仅在原授权具备时 | 错版本/缺资源不得退回全局运行时 |
| W08 | 单对语义与来源对照、pairing、链接 | 同一候选中英与源码机器事实一致 | 旧source/漏listener不能只靠配对重新写hash通过 |
| W09/W10 | 32项逐条来源、正式状态和缺件 | 独立审查product_accepted及关键归因 | 开发CLI测试不能冒充交付产品验收 |
| W11 | run/attempt/checkout、包hash/manifest | 新CI所有必需阶段实际结论 | 不拿历史失败数减法、skip或mock代替 |
| W12/W13 | 组合candidate、全部新增文件、适用门禁 | A1—A9状态与真实硬审绑定 | 整合后改变字节不得复用过期PASS |

## 3. 命令入口

以下是当前仓库已有入口，过滤范围须以实际测试注册核对。计划中新增文件未创建时，不能因为零测试或不存在路径返回成功就通过。

```text
pnpm exec vitest run --project thread-safe scripts/prepare-ci-bubblewrap.spec.ts
pnpm exec vitest run --config vitest.expected.config.ts apps/cli/tests/profiles/headless/tests/subagent-diagnostic.expected.e2e.ts apps/cli/tests/profiles/headless/tests/subagent-inheritance.expected.e2e.ts
pnpm exec vitest run --project thread-safe apps/cli/tests/profiles/headless/tests/session-log-identity.spec.ts
pnpm exec vitest run --config vitest.snapshot.config.ts snapshots/sdk/teardown.snapshot.ts
pnpm exec vitest run --config vitest.snapshot.config.ts snapshots/sdk/sdk.snapshot.ts -t teardown
pnpm exec vitest run --project thread-safe apps/desktop/tests/backend-controller.spec.ts apps/desktop/tests/host-process.spec.ts apps/desktop/tests/host-protocol.spec.ts apps/desktop/tests/development-project.spec.ts apps/desktop/tests/runtime-file-policy.spec.ts
pnpm run typecheck
pnpm run lint
pnpm run duplication
pnpm run test:docs
pnpm run verify-translation-pairing --write docs/event-producer-consumer.md
pnpm run verify-doc-graphs
```

只对实际需要的工作包执行；`--write`是W08已声明配对变更，不是所有门禁阶段的默认动作。Desktop测试归属若不在thread-safe项目，则读取原配置采用其实际项目，不能改include让测试消失。SDK共享场景过滤实际命中数量必须保存。基线完整doc-sync或built证据可在输入不变时引用，新增未覆盖内容必须补适用检查。

## 4. 定期独立审核具体要求

CP1必须由没有实施被审修改的新上下文实例完成。输入应有任务ID、明确文件白名单、前后hash、真实首失/正向/拒绝证据和未运行项；审核者只读文件或运行获准验证，不能边审边修。原实现者负责按问题编号返工，复审重新绑定新candidate。

CP2在每波整合后运行，重点检查跨任务调用、资源所有权和产物一致性：W01/W02真实外部契约是否一致；W04/W05预期与原日志是否仍相符；W06/W07实际启动的是否是同一组产物；W08两语言是否表达同一事实。中间问题本地闭环，不每个问题向用户请示。

CP3冻结所有写入后，用真实OpenCode按现有参数和授权审核完整候选。输入包含已失败的旧审核及修复证据，但不能用旧候选PASS代替新candidate。审核stdout、退出码、实际参数、版本、开始结束、提示哈希与完整manifest共同归档；缺任一必需准入证据则BLOCKED。

## 5. 负控与资源清理

变异只发生在明确属于本阶段且无并发写入的文件或隔离副本中。先存原始字节/hash，独立执行变异、保存真实目标失败，再在可靠finally恢复；恢复失败停止整合，不用reset/stash清场。不得在真实未隔离机器上绕过hash或sandbox运行测试包。正常失败应是目标断言或业务拒绝，不是编译、导入、网络、超时或零发现。

finally要释放测试自有deferred、等待已启动任务、移除timer/观察者，确认实际handle/进程结束再删除自己的临时树。清理失败也保留原始测试错误；不通过强退进程、GC或只删除目录当作已释放。

## 6. 防止验证工作失控

中间检查每个包一次最小集、整改后只补受影响集；波末一次组合，阶段末一次覆盖必需路径的验证。只有输入改变、结论不可信或实际不稳定性需诊断时才重复，不为“5次绿”机械执行全仓。

完整coverage留给原CI，历史红项不免除本阶段新增行为测试，也不自动把整个仓库所有缺口塞入本批次。截图、实际运行日志、安装包与库测试分别有证明边界。最终报告明确哪些是实际运行、哪些是替身、哪些是历史引用和哪些没有执行。
