# Windows 验证、升级收尾与 P0-B 交接

仅处理 `wmqfl861/dsh861` 与本地 `C:\Albert\project\dsh861`，继续 `chore/latest-stable-upgrade-20260912` 和草稿 PR #13。r28 接收基线为 `ccc5aa51d50fb4e51c3a89658db8d769811221d4`。r29 源码提交为 `321172e13c0962fdb3c745f2e3317015fc5802fb`：新 CI static 已实绿，built-lib 已在本机以真实产物完整执行并通过，consumers 第三请求已在本地定因并修复；独立复审仍待完成。P0-B 仍 blocked，不合并 master、不开放 P0-C，不代写指定计划或硬审核。

## 当前唯一执行入口

本地按 [r29 本地执行任务](../remediation/2026-09-13/ci-gates-r29/LOCAL_AGENT_TASK.md) 接续；新 [CI 回执补充](../remediation/2026-09-13/ci-gates-r29/ci-followup.json) 优先于初始候选回执中的待运行状态。`verification.json` 中的基线 run 14 失败仍是历史事实，不覆盖成通过。

远端先完成可直接执行的工作，只有依赖本地实际环境的步骤才交给本地 agent。交付文件先放此 GitHub 仓库，提示词提供完整固定提交 SHA、路径、完整性核对与使用方法，不依赖聊天附件或滚动分支链接。存在新工作时审阅整合，不覆盖、不回退、不自动 stash、不强推。

## 已接收结果

[r27 Windows 回执](../remediation/2026-09-13/gateway-scope-r27/windows-execution/verification.json)记录 Gateway 212/212；[r26 Windows 回执](../remediation/2026-09-13/loader-entry-r26/windows-execution/verification.json)及 Loader/Fiber 122/122 保留。用户转达独立复审 PASS；远端没有冒充 Windows 执行或独立重扫其归档。不重复应用旧补丁，不重做已完成的整体升级。

[r28 执行回执](../remediation/2026-09-13/ci-integration-r28/verification.json)记录托管 runner 默认适配、两个 pnpm deploy 根因修复、双 Node Windows 单文件构建和无密钥黑盒。此前 [artifact-build-r28 诊断](../remediation/2026-09-13/artifact-build-r28/verification.json)中的 Tailwind 归因已撤回，不再据此改源码。历史文件不覆盖。

远端读取 run `34765078459`（run 14）实际作业列表，确认 Linux/Windows 单文件构建、wheel 干净安装和 keyless 黑盒成功，Linux GLIBC/manylinux 成功；Windows build/native、benchmarks、兼容矩阵、Python SDK 成功。PR 正文已经由远端 API 直接更新，不再让用户粘贴旧正文。

## r29 修复与真实新结果

[r29 初始记录](../remediation/2026-09-13/ci-gates-r29/verification.json)固定基线、作业身份、明确日志摘录、三个源码文件变更与未执行项目；不是完整原始日志归档，也不是独立硬审核。

ACP `cordis.yml` 原 Git mode=120000，但内容为 YAML `- path: ...` 而非链接目标。已改为 100644 并补 LF，include 目标文件不变。config-files spec 新增索引模式回归，防止 core.symlinks=false 掩盖错误，不修改用户 symlink 设置。

built-lib E2E 的私有 builtAgentId 改为脚本内 Symbol，同一键用于 identity 和 Context.extend，+3/-2。真实 HTTP、生成包、业务输入、断言、超时与清理不变；Gateway/Cordis 运行时零修改。没有产物导致 skipped 不算通过。

[隔离 Git 实验](../remediation/2026-09-13/ci-gates-r29/git-mode-proof.json)与[复现程序](../remediation/2026-09-13/ci-gates-r29/probe-git-mode.py)记录远端 Linux 容器实际四组 checkout：旧 mode 在 symlinks=true 时 ENOENT、false 时被掩盖；新 mode 两组可读；索引回归旧两组拒绝、新两组接受。远端 Node22.16.0 仅检查了嵌入脚本语法，不冒充全仓运行。

源码提交 321 对应新 run `34768688465`（run 15），static job `103754182530` 已由 job 状态与原日志双核对：Node26.8.2/pnpm12.4.1，47 passed / 0 failed / 0 skipped，116.62秒。checkout `7187c6f70dcea5df7917105a5857a944b38c6f79` 合并 321 到既有 PR base。该结果已闭合 Linux static 原首失；不等于本地 hooks、独立复审或整条 PR 全绿。

## 剩余范围与被排除的诊断

基线 run 14 static 是5过1失41跳的 fail-fast，Windows observational 是52过2失（ACP缺失与builtAgentId注入）；node-next types 当时实际通过，不去修已绿类型检查。新 run 15 observational 截止本回执读取仍执行中，不提前宣布 built-lib 通过。

consumers 基线 headless expected 用例收到3次请求而非2。[r29 Windows 执行回执](../remediation/2026-09-13/ci-gates-r29/windows-execution/verification.json)已在本地定因：第三次请求是主请求重发——fixture `streamIdleTimeoutMs: 150` 对 mock 60ms keep-alive 仅2.5倍余量，Windows 调度抖动触发 `STREAM_IDLE_TIMEOUT` 后按部署策略重试（事件序列 seq15 `llm/retry`，标题请求 seq13 已先行发出）。产品重试/watchdog/标题调度不变且另有专项测试；修复归属 fixture：150→1000（与 pi-ai 同族一致）并加"空闲预算≥4×keep-alive 间隔"负向回归（旧值确定性失败），两次请求契约原样保留，复测 6/6 绿，整文件 A/B 证明本机另 6 个 `{{cwd}}` golden 失败为预存路径归一化差异（macOS/Linux 通道负责）。run 15 consumers job `103754182474` 首失因本机无 gh 未核对，不把旧首失自动写成新首失。不放宽计数、不刷新 golden 造绿。

基线两个 coverage 日志响应出现文件路径与固定 Git 树不匹配，已在 ci-followup.json 排除出修改依据。实际 gateway.client.spec.ts 仍保留 r27 fixtureContextTag 与调用次数断言；不得按不存在的 gateway.spec.ts 宣称 r27 退化。tool-present 的被报告文件也不在该包树中；不据此猜测补目录。需要原始日志与 checkout/source-map 或真实复现。新 run 15 coverage 两腿截至读取仍执行中；partial coverage 不当完整阈值结果。

新 run 15 Linux exe/wheel/keyless/GLIBC/manylinux 已成功，Windows runtime 截止读取仍构建中，不替它宣布结束。Issue policy、Issue lifecycle、Build PR preview 仍有独立失败未归因；真实 API skipped，macOS 不在此 PR 打包矩阵。首次运行暴露不等于已证明非 r28 回归。后续提交使用各自 CI 结果，不拿321的结果冒充最新提交全绿。

## 本地接续与 F1–F4

按当前任务取件，运行 config-files spec、verify-cordis-config、实际产物 built-lib 与必要类型/lint/docs，正常 hooks 和独立子代理复审。采集 consumers 第三请求、来源匹配后处理 coverage。远端没有完整依赖环境，Git Data API 提交没有运行本机 hooks，不声称独立硬审通过。

r28 两处历史日志名核对与真实本机47/47归档仍需本机原始材料；有则追加、没有则明确缺失，不把新 CI 摘录或四组 Git 机制实验冒充 r28 本机日志。追加 `ci-gates-r29/windows-execution/`，不覆盖 r25–r28 回执；沿既有脱敏/归档规范。当前 static 清单已分开记录 run14红与run15绿。

r29 本地执行已完成并记录于 [r29 Windows 执行回执](../remediation/2026-09-13/ci-gates-r29/windows-execution/verification.json)：取件完整性四项全过；config-files spec 4/4、verify-cordis-config 153、真实产物 built-lib E2E 1/1（非 skipped）；typecheck/lint/test:docs 全绿（16/0/0）；consumers 第三请求定因修复如上；F1/F2 勘误——封存 r28 回执引用的三处日志名（18-build-exe-newdeploy2 / 19-build-exe-node24 / 25-blackbox-keyless-spacefree）实为 18/19-*-full-pass 与 25-blackbox-keyless-pass，实际文件均在、EXIT 0、内容与描述相符，封存记录原字节未动；F3 复核确认 run14红/run15绿已分列；F4 本机无原始 47/47 日志——r28 本机 static 实为 46/1（cordis catalog 红），明确缺失，不以 run15 CI 摘录冒充。gh 本机不可用，run15 consumers/coverage 各 job 读取未执行并已记录原因；coverage 修复仍以来源匹配为前置。本轮新增提交使用各自 CI 结果，独立子代理复审仍待主会话派发后才能宣称完成。

不机械重跑 Gateway212、Loader122、全部升级或已绿打包矩阵。正常提交、非强推同一分支，返回真实 SHA、固定证据路径、通过/失败/未执行各自结果。

## 不变的边界

模型配置两文件、provider/endpoint/思考等级/credentialRef、P0-B state、pkg 补丁、依赖锁与历史计划/证据保持原字节；本轮源码修复不改工作流。不读生产 Key或全局认证，不登录/请求真实模型，不复制旧沙箱秘密，不改全局工具、账号/ACL/注册表/Firewall/WFP/UAC，不使用 Remote Desktop Commander、不操作其他项目。Windows CSPRNG 同类子进程与 present-open.host 文件 symlink 仍未证明，目录 junction 不替代文件 symlink，不补造旧 stderr。三个来源不可达的 vendor 和指定规划/审核仍独立记录。
