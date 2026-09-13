# Windows 验证、升级收尾与 P0-B 交接

仅处理 `wmqfl861/dsh861` 与本地 `C:\Albert\project\dsh861`，继续 `chore/latest-stable-upgrade-20260912` 和草稿 PR #13。r27 已接收（Gateway 212/212，补丁已应用，独立复审 PASS）；r28 的 CI runner 适配与单文件打包修复已完成并通过本机验证（见下）。P0-B 仍 blocked，不合并 master、不开放 P0-C，不代写指定计划或硬审核。

## 固定交付规则

远端先完成可直接执行的工作，只有依赖本地实际环境的步骤才交给本地 agent。交付文件先放此 GitHub 仓库，提示词提供完整固定提交 SHA、路径、完整性核对与使用方法，不依赖聊天附件或滚动分支链接。存在新工作时审阅整合，不覆盖、不回退、不自动 stash、不强推。

## 已接收的 r27 与 r26

[r27 Windows 回执](../remediation/2026-09-13/gateway-scope-r27/windows-execution/verification.json)记录 Gateway 补丁只改一个 spec 的身份夹具和两条 RPC 计数断言，两个原失败在两 project 中全部通过，整文件 212/212，类型、lint 和快速文档检查通过。用户转达独立复审 PASS；本次远端读取回执与提交，没有重新运行 Windows 或独立扫描其归档。实际补丁已应用，不重复 r27 的 apply 或验证任务。

[r26 Windows 回执](../remediation/2026-09-13/loader-entry-r26/windows-execution/verification.json)及其 Loader/Fiber 六套件 122/122 保留。已完成的上游、主版本与工具链升级不重做。Windows CSPRNG 同类子进程及 present-open.host 文件 symlink 仍是未证明范围，目录 junction 不替代文件 symlink；缺失的旧 stderr 不重造。

## r28：CI runner 托管默认与真实打包失败修复（本轮已完成）

[r28 执行回执](../remediation/2026-09-13/ci-integration-r28/verification.json)是唯一现行执行记录；上轮的[诊断记录](../remediation/2026-09-13/artifact-build-r28/verification.json)与其"tailwind/tsdown"转述已被本地复现证伪并弃用（固定树无任何 tailwind 依赖，build:lib 双 Node 版本通过），未据此改码。原始 job 日志无凭据不可取（403），按预案本地完整复现同一路径。

两个真实根因与修复（证据见回执）：其一，pnpm 12.4.1 `deploy --legacy` 把生产闭包内无供给者的 `workspace:^` peer 改写为裸 `^` 致两平台同步骤失败——闭包根清单已补上 `dsh-session-title-llm` 与 `dsh-util-workspace-path` 两个 peer 供给者（锁再生成 +6 行）；其二，同版本 `--legacy` + hoisted 把注册表树物化到工作区根——`build-exe-for-python-sdk.ts` 改走 pnpm 12 部署实现并 `--ignore-scripts`，spawn-helper chmod 已镜像，死代码 legacy 恢复步骤删除。`ci.yml` 七个作业默认改标准托管 `ubuntu-24.04`/`windows-2025`，上游专用池转为显式 `'enterprise'` 值，池调并发常量改按池注入、托管默认回落 CPU 自适应；needs、阻断命令、平台范围、超时未放宽。

Windows 完整管线在 Node 26.8.2 与隔离官方 Node 24.21.0（sha256 校验）下均通过并产出 230.3MB 单文件与 `-rg` 伴随件；wheel + 干净 venv + keyless 黑盒 `--scenario all` 全部通过（本机含空格用户路径的首次失败为本地条件，已记录）。受影响 specs/typecheck/lint/note 检查/831 对翻译配对全绿。

候选 `a9aac5d15b` 推送后的 CI run 12（34762530672）证实：七个原排队作业全部在标准托管 runner 上实际运行；r28 核心（双平台单文件打包、windows-build、native-tests、benchmarks、compat、python-sdk）全绿，Linux 打包腿含 wheel/干净安装/keyless 黑盒/GLIBC/manylinux 冒烟全部通过。同 run 暴露：static 车道因 r26 遗留 stale cordis catalog 失败（已再生成并推送修复）；coverage×2、consumers、observational 四条本分支从未运行过的车道首次执行即失败（本机复核：node-next-types 在本机因 symlink 特权早死与 CI 模式不同、built-bin smoke 本机真实失败、coverage/consumers 未本机重跑；原始 CI 日志无凭据不可取）——单列为后续轮次的既有暴露，非 r28 回归。PR 正文更新文本入库于同目录 `pr-body-r28.md`（无 gh/Token，不入正文）。

## 本地连续完成的工作（历史轮次说明）

复用现有 Node26.8.2、pnpm12.4.1、TS7 与安装，按 r28 说明取得固定交付，检查 PR merge 与 head 的相关差异，定位真实调用与正确包拥有者，保存首失，最小修复并验证完整构建产物。必要的定向依赖／锁更新仍在既有授权内，不整体重新升级或重装。不能用只通过 typecheck、忽略解析错误、给根目录随意补包或改成全量 external 代替产物闭合。

通过实际构建、产物级回归及必要检查后，独立复审固定候选，正常钩子提交推送同一分支。明确 Windows 与 Linux 结果，等待中的 CI 不认证成功。本轮的实际日志与摘要写入 r28 新执行目录，不覆盖 r25/r26/r27 记录。未受影响通过检查复用旧证据，不机械重跑 Gateway212、Loader122或整个 Web 测试矩阵。

## 不变的边界

模型配置两文件、provider/endpoint/思考等级/credentialRef、P0-B state 与历史计划/证据保持原字节。本轮诊断未改变依赖锁或 pkg 补丁；后继必要锁变更由包管理器真实生成并验证。升级修复不等于模型调用或系统初始化授权。不读生产 Key、全局认证、不登录、不请求模型，不复制旧沙箱秘密，不改全局工具、账号/ACL/注册表/Firewall/WFP/UAC，不使用 Remote Desktop Commander、不操作其他项目。三个来源不可达的 vendor 和指定规划/审核仍独立记录。
