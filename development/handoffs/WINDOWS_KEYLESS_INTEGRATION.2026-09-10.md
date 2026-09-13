# Windows 验证、升级收尾与 P0-B 交接

仅处理 `wmqfl861/dsh861` 与本地 `C:\Albert\project\dsh861`，继续 `chore/latest-stable-upgrade-20260912` 和草稿 PR #13。r28 接收基线为 `ccc5aa51d50fb4e51c3a89658db8d769811221d4`。r29 已直接提交小范围夹具修复候选，完整工作区执行与独立复审仍待完成，不把远端静态证据称为整体验收。P0-B 仍 blocked，不合并 master、不开放 P0-C，不代写指定计划或硬审核。

## 固定交付规则

远端先完成可直接执行的工作，只有依赖本地实际环境的步骤才交给本地 agent。交付文件先放此 GitHub 仓库，提示词提供完整固定提交 SHA、路径、完整性核对与使用方法，不依赖聊天附件或滚动分支链接。存在新工作时审阅整合，不覆盖、不回退、不自动 stash、不强推。

## 已接收结果

[r27 Windows 回执](../remediation/2026-09-13/gateway-scope-r27/windows-execution/verification.json)记录 Gateway 212/212；[r26 Windows 回执](../remediation/2026-09-13/loader-entry-r26/windows-execution/verification.json)及 Loader/Fiber 122/122 保留。用户转达独立复审 PASS；远端没有冒充 Windows 执行或独立重扫其归档。不重复应用旧补丁，不重做已完成的整体升级。

[r28 执行回执](../remediation/2026-09-13/ci-integration-r28/verification.json)记录托管 runner 默认适配、两个 pnpm deploy 根因修复、双 Node Windows 单文件构建和无密钥黑盒。此前 [artifact-build-r28 诊断](../remediation/2026-09-13/artifact-build-r28/verification.json)中的 Tailwind 归因已撤回，不再据此改源码。历史文件不覆盖。

远端在 r29 读取 run `34765078459`（run 14）的实际作业列表，确认 Linux/Windows 单文件构建、wheel 干净安装和 keyless 黑盒成功，Linux GLIBC/manylinux 成功。Windows build/native、benchmarks、兼容矩阵、Python SDK 成功。PR 正文已经由远端 API 直接更新，不再让用户手工粘贴旧正文。

## r29 当前候选与证据

[r29 远端记录](../remediation/2026-09-13/ci-gates-r29/verification.json)固定基线、作业身份、原始日志的明确摘录、修复范围和未执行项目。此记录不是完整原始日志归档，也不是独立硬审核。

ACP `cordis.yml` 的 Git 模式原为 `120000`，blob 内容却是 YAML `- path: ...`，并非链接目标。候选只将其改为 `100644` 并补结尾换行，include 目标与目标文件保持不变。`scripts/cordis-config-files.spec.ts` 增加索引模式回归，避免 `core.symlinks=false` 将错误掩盖为可读普通文件。索引回归检查当前已暂存版本；接收本提交后直接运行，不在用户工作区修改 symlink 设置。

`packages/api/remotes/tests/built-lib.e2e.ts` 仅把私有 `builtAgentId` 字符串元数据改为同一脚本中的 Symbol 键。真实 HTTP、生成包加载、参数、原始错误、输出与所有断言保持不变；Gateway/Cordis 运行时零修改。它是已提交的候选，不是已取得成功日志的 built-lib 终验。

[隔离 Git 实验结果](../remediation/2026-09-13/ci-gates-r29/git-mode-proof.json)及[复现程序](../remediation/2026-09-13/ci-gates-r29/probe-git-mode.py)来自远端 Linux 容器，不是 Windows 全仓测试；四组真实 checkout 证明旧模式的 ENOENT 与禁用 symlink 时的掩盖，并证明新模式在两种 Git 设置下均可读。新回归的模式条件在旧两组拒绝、新两组接受。built-lib 嵌入脚本只做了 Node 22.16.0 语法检查，不能替代项目 Node26/生成产物执行。

## 尚未闭合的 CI

run 14 的 static 仍红：首失为 `verify-cordis-config` 读取 ACP 文件 ENOENT，5 passed / 1 failed / 41 skipped（fail-fast），不能把未执行的 41 项记绿。Windows observational 为 52 passed / 2 failed：同一 Cordis config 错误，以及 built-lib 的 `cannot get property "builtAgentId" without inject`；该作业的 node-next types 实际通过，不要按本机权限现象去改已绿的 CI 类型检查。

consumers 首失为 `headless.expected.e2e.ts` 第 471 行，`keeps provider comments alive and sends DeepSeek defaults through the one-shot app` 收到 3 次请求而预期 2；该预期套件为 30 passed / 1 failed，后继 snapshot/browser/built-bin 等被 fail-fast 中断或未执行。不要直接把 2 改成 3，须记录 mock 请求和重试原因后修复。

Linux/Windows coverage 仍失败，不能据其他作业成功认证其通过；两条 coverage 的完整首失仍需单独分析。Issue policy、Issue lifecycle、Build PR preview 也失败，暂未归因；真实 API E2E skipped，macOS 不在本 PR 打包矩阵。首次执行暴露不等于已证明非 r28 回归。以新提交实际 CI 的完整结果更新本清单，不用旧 run 代替新提交结果。

## 本地接续

先 fast-forward 接收远端候选并核对 Git 模式与 blob。复用 Node26.8.2、pnpm12.4.1 及现有依赖；定向运行 config-files spec、verify-cordis-config、真实构建后的 Remotes built-lib E2E。若 requiredArtifacts 不齐导致 skip，先沿现有 build 命令生成，不能把 skip 算 PASS。保留无密钥、无模型请求边界。真实 typecheck/lint/test:docs、必要配对和独立复审由可执行环境完成；远端 Git Data API 提交不声称执行了本地钩子。

r28 审核 F1–F4 中，本交接已经补记 static 仍红并纠正日志可达性和 PR 正文状态；两处历史日志名称核对、47/47 本机原始日志归档仍需从真实本机证据补齐，不能把远端四组实验改名冒充该日志。追加 r29/windows-execution 证据，不覆盖 r25–r28 原始回执。检查通过后正常钩子提交、非强推同分支；不机械重跑 Gateway212、Loader122或已绿的打包矩阵。

## 不变的边界

模型配置两文件、provider/endpoint/思考等级/credentialRef、P0-B state、pkg 补丁与历史计划/证据保持原字节；本候选不改依赖锁或工作流。不读生产 Key、全局认证，不登录、不请求模型，不复制旧沙箱秘密，不改全局工具、账号/ACL/注册表/Firewall/WFP/UAC，不使用 Remote Desktop Commander、不操作其他项目。Windows CSPRNG 同类子进程与 present-open.host 文件 symlink 仍未证明，目录 junction 不替代文件 symlink，不补造旧 stderr。三个来源不可达的 vendor 和指定规划/审核仍独立记录。
