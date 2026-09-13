# Windows 验证、升级收尾与 P0-B 交接

仅操作 `wmqfl861/dsh861`、`C:\Albert\project\dsh861`、`chore/latest-stable-upgrade-20260912` 和草稿 PR #13。PR base 保持 `feat/multi-agent-company-nodes`，不合并，P0-B blocked，不进入 P0-C。

## 当前接收状态

r29 接收 SHA 为 `1baf323167e9d4bde171249f322ab4ebec7f3567`。[本地回执](../remediation/2026-09-13/ci-gates-r29/windows-execution/verification.json)记录 ACP/config 验证、实际构建产物下 built-lib 1/1、headless 第三请求 fixture 根因修复与 6/6、类型/lint/docs。用户随后转达独立复审八项 PASS，另附两项非阻断勘误；这不是远端 Windows 重跑，也不替代指定 P0-B 硬审核。

r29 不再处于“等待整轮独立复审、等待 built-lib 实测”的状态。保留 config 与 built-lib blob、1000ms/60ms 预算和原 expect(2)。r27 Gateway212、r26 Loader122、r28 构建交付仍接收；不重复应用旧补丁、升级调查或无关构建矩阵。

## 当前执行入口

[r30 本地任务](../remediation/2026-09-14/ci-evidence-r30/LOCAL_AGENT_TASK.md)是唯一接续入口；[r30 取证与勘误](../remediation/2026-09-14/ci-evidence-r30/READOUT.md)记录来源及限制。只在完整项目环境中验证新增 CI 诊断导出，给三个红项提供带 run/attempt/checkout/hash 的失败证据，不猜测修补产品。

远端已经请求 run34789573313 只重跑失败作业，接口成功，随后读取 attempt2=in_progress；未宣称完成。首次读取仍有 coverage 两腿和 consumers 失败；static 日志报告47/47，observational 作业显示成功，但不同 job 身份/日志读取存在不一致，整体首失尚不能可靠归因。后续用匹配源码与 hash 的 artifact 核对，不混用 run 或提交结果。新的交接文档提交不是原源码 CI 的证明。

## 已结案的勘误与非本轮任务

r28 本机 static 实际46/1，无本机47/47原始日志，不能拿CI摘录冒充。两处陈旧日志名的核对结果保持在r29回执，不改封存r28材料。`push-attempt1.log` 是复推成功记录，首次失败输出缺失；负向回归的7ms是用例耗时，实际失败为150<240。不要再要求补造这些缺失历史。

六个既有 Windows golden 失败不能全归因于8.3路径；已读日志还包含bash/pwsh、命令文本和换行差异。保留用户A/B基线同样失败的结论，并按当前任务先核对已有本机日志。此轮不把macOS/Linux夹具范围扩大成Windows新阻断，不改normalizer或刷新golden抹平语义差异。

Issue policy、Issue lifecycle、Build PR preview 的独立失败仍未归因；不改权限/分支保护绕过。真实API不运行，macOS不在本PR打包矩阵。Windows CSPRNG同类子进程和文件symlink旧未证明项不因其他CI成功自动标绿。

## 执行约束

远端先做可执行的读取、取证和仓库交接；本地只处理需要完整依赖、Windows行为和独立复审的新增任务。取件使用固定提交SHA，先检查工作树，安全快进；保留后续工作，不reset、强推、自动stash、重复clone。当前r30只交付文档/取证任务，没有源码补丁等待重复应用。新源码按正常hooks和独立复审后提交，回传真实SHA、固定证据路径及通过/失败/未运行。

模型配置两文件、provider/endpoint/思考等级/credentialRef、P0-B state、pkg补丁、锁和旧证据不变。不读生产Key或全局认证，不请求真实模型，不改全局工具、账号/ACL/注册表/防火墙/UAC/Developer Mode，不部署runner、不使用Remote Desktop Commander、不操作其他项目。不把普通独立复审冒充指定规划/硬审核，不改PR base、不合并、不进入P0-C。
