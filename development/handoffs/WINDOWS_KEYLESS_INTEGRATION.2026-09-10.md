# Windows 验证、凭据接入与 P0-B 规划交接

仅处理 `wmqfl861/dsh861`，本地目录为 `C:\Albert\project\dsh861`。继续原 PR #7 的 `fix/p0b-windows-credential-store-20260910`，不另建实现。P0-B blocked，不合并 master，不进入 P0-C。本页、局部复核和内置子代理 PASS 均不代替指定 Codex 规划或 OpenCode 硬审核。

## 已接收与本次修正

基线 `ca7f0da03ba1233d1bcae7eec96eed365240aebb` 的 [Windows 回执](../remediation/2026-09-10/gate-abort-r14-win/verification.json)记录 34/34、2/2、25/25、12/12 和局部／全量类型、lint、test:docs 结果。原 breakaway 内核观察、首失、日志和所有已验证的 helper 实现保留；不重做凭据、进程属主或归档。

[r15 复核](../remediation/2026-09-11/entry-gate-r15/verification.json)发现正式入口传入原属主，但该属主的方法名为 launchGated/releaseGated/abortGated，包装器实际读取 launch/release/abort，因而走到直接 spawn。原延迟指派用例自行完成映射并直接调用 invokePlannerOnce，不覆盖此入口。这个发现不抹除 helper 与内核测试的结果，但这些结果不能认证错误的入口接线。

本次只修改 planner-entry.ts 的实际适配，使用 Required<PlannerProcessOwnership> 要求全部方法；同一个属主负责启动、指派、放行、中止和终止。新增[入口组合测试](../../scripts/p0-b/windows-credentials/planner-entry-gate.test.mjs)加载真实 entry、invocation、租约与脱敏源码，六项模拟操作系统控制验证无直接 spawn、失败／迟到不放行以及异常传播。两项 Windows 原生消费路径测试已写好：保留真实 PowerShell、作业及启动器，只观察宿主 spawn，要求直接子进程是 helper 与 launch-gate，目标的真实父 PID 必须是该启动器，覆盖正常完成和取消。测试不手工创建另一个 ownership 适配器。

## 本地只处理新入口与必要集成

安全同步本次提交，沿用现有 Node 26.4.0、pnpm 11.7.0 与依赖。运行新入口测试，在 Windows 应是 8 项实际执行；远端的 6 通过／2 平台跳过不是 8 项原生成功。随后运行受影响的 ownership-failures 与 planner-entry 原有回归；helper、launch-gate、凭据、版本与配置解析源码未变，不机械重复这些独立套件。

若实际入口开始使用门控后揭示 Windows 的 stdio、退出码、清理等差异，先保留新失败，再修真实调用路径；不得退回直接 spawn、只改测试手工适配或删除断言。原生观察必须经过 invokeProjectedPlannerOnce，不能直接调用 invokePlannerOnce 来替代。只清理本轮拥有的资源，不按进程名扫杀。

按实际影响执行类型、lint、test:docs；核对两个双语对后用原程序点名重录 README 与已有 Agent Note 的 i18n sidecar，不用 --write --all。远端本次未运行原配对程序，sidecar 有意未改。

已查询基线的 GitHub Actions runs：total_count=0，不能把“由 CI 承接”当作已执行。现有 CI 还引用专用 runner 标签，其可用性未核验。要有可读取的完整 doc-sync 执行结果（现有匹配候选的结果可复用），或显式保留 NOT_RUN；不要为了填补记录重跑无关全平台矩阵，不修改云资源、付费 runner 或 Actions 权限。

正常提交推送同一分支，回传 SHA、新 8 项结果、原有受影响回归、必要门禁与可取回日志。保留四套模型声明、模型锁、pnpm-lock、state.json 原字节。无真实 Key、生产凭据或中转请求，不重造历史日志。

## 此后真正的前置条件

本轮无需用户发 Key。真实规划仍需要可核验的所有者授权、本人私下录入已轮换的 Codex Key、获批的受保护路由，以及实际隔离和费用约束；非空记录名、HTTPS 字符串和一次 CLI 启动都不能替代这些条件。用户选择具体授权与金额，开发者负责技术执行点，不互相替代。

后继指定规划保留[请求 r01](../nodes/P0-B/plan-revision-request.r01.md)、[请求 r02](../nodes/P0-B/plan-revision-request.r02.md)和[网页后台需求](../requirements/WEB_CONTROL_CONSOLE_SUPPLEMENT.v1.md)作为输入。当前只是入口修复，不把全部公网后台追加为 P0-B 前置，也不代写 plan.v4。
