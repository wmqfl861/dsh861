# r30 取证与接收记录

本记录是 PR #13 的执行交接参考，不是新产品功能、CI 全绿证明或指定 P0-B 硬审核。接收源码为 `1baf323167e9d4bde171249f322ab4ebec7f3567`；本轮只增加交接记录，未修改产品、测试、配置或工作流源码。

## r29 接收与证据等级

[r29 本地回执](../../2026-09-13/ci-gates-r29/windows-execution/verification.json)记录 ACP 索引模式回归、153 个配置验证、244 个真实构建产物下的 built-lib 1/1、headless 6/6，以及类型、lint、文档检查。用户随后转达八项独立复审 PASS；这是用户转达的独立复审，不是远端助手在 Windows 重跑的结论。回执内早于该复审的待审字段不再用来要求重复审核 r29。

主请求重试的 r29 修复保留：fixture idle 预算为 1000ms，mock 间隔为 60ms，预算回归要求不少于四个间隔，原两次请求断言保留。不得重新放宽计数、修改产品重试或重复应用 r27 补丁。

用户复审的两项勘误按原意接收：`push-attempt1.log` 是复推成功记录，首次失败输出未存档；7ms 是负向用例耗时，失败条件是 150 < 240，不是 7ms 的时序保证。r28 本机 static 的真实记录为 46/1，未找到本机 47/47 原始日志；此缺失已明确，不再反复索要或拿 CI 摘录顶替。旧封存回执和日志不改写。

## Windows 六个 golden 失败的分类更正

远端读取的 [r29 全文件日志](../../2026-09-13/ci-gates-r29/windows-execution/logs/10-headless-full-file.log)同时包含路径差异和平台行为差异。首个失败涉及 `bash` / `pwsh`、`printf` / `Write-Output`、LF / CRLF；另有原生路径、嵌套 JSON 字符串中的转义路径，以及启动错误消息中的路径。不能把全部差异概括成 8.3 短路径替换失败。

这些读取结果不推翻用户提供的基线 A/B 同样失败结论，也不证明产品回归；它们只纠正原因分类。短路径、真实路径别名、JSON 二次转义分别需要实际父/子进程值才能定因。共享 normalizer 出现 `cwdAliases` 也不能证明只加别名就能修复所有用例。

[根规则](../../../../AGENTS.md)说明记录夹具的 macOS/Linux 执行范围，[profile 规则](../../../../apps/cli/tests/profiles/AGENTS.md)要求修正夹具/组合而非放宽断言。当前任务不把六个既有 Windows 失败升级成新增阻断工作，不刷新 golden，不把 PowerShell 输出伪装为 Bash，不泛化 normalizer 来消除语义差异。先用本机已归档日志核对这些摘录，存在差异就记录内容和 Git blob 校验结果，不盲从远端摘要。

## CI 的已读结果与限制

run `34789573313`、run number 17 关联接收 SHA。首次读取显示整体失败，static 和 Windows observational 显示成功，Linux/Windows coverage 与 consumers 显示失败。远端取得的一份 static 日志报告 47 passed / 0 failed / 0 skipped；该观察不替代完整可信日志归档，更不是新文档提交的 CI 结果。

不同读取途径返回的 job 身份存在不一致；部分列出的 job 再读为 404。consumers 的返回日志提及 `packages/test-support/loader-smoke/tests/bundled-profile-runtime.e2e.ts` 与 `bundle-closed-world.e2e.ts`，但固定 HEAD 的已返回子树不包含它们。尚未完成 checkout/source-map/字节级来源核对，因此这些日志不作为修改源码的依据。不能把未知首失写成“r29 第三个请求仍失败”，也不能照不存在的文件补代码。

远端尝试了完整 run 日志端点，连接器只返回空文本，未取得可验证 ZIP。运行产物列表仅列出发布形态运行时与 SDK wheel，没有解决失败日志取件。没有把摘录、空响应或旧 run 重命名成完整原始日志。

远端已实际调用“仅重跑失败作业”，接口返回成功；随后 run 元数据确认 attempt 2、status=in_progress、head 仍为接收 SHA。未宣称 attempt 2 完成或成功。文档提交可能触发后续 CI，必须按具体 SHA/run/attempt 分开记录，不能混用。

## 下一步执行入口

执行 [本地任务](LOCAL_AGENT_TASK.md)。重点是为三个红项提供可校验的失败证据 artifact，而不是重复升级或猜测修复。远端已读取 [CI 工作流](../../../../.github/workflows/ci.yml)与 [run-gates](../../../../scripts/run-gates.ts)：Linux/Windows coverage 使用 `check:ci:coverage`，consumers 使用对应 aggregate；`GateResult` 已含状态、退出码、信号、aborted 和分 stdout/stderr 的输出。取证可基于这些现有结果，不需要另造测试启动器。

当前远端只有 Node 22.16.0 / Git 2.47.3，没有完整项目、pnpm 和 Windows 执行环境，直连 GitHub 也失败。新取证代码的现有调度器集成、项目类型检查、Windows 行为验证和独立复审需要本地执行。本轮未用 Git API 提交未经这些验证的产品/测试/工作流源码；交接文本不是已实现的 artifact 功能。
