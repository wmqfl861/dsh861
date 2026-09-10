# Windows 验证、凭据接入与 P0-B 规划交接

当前仓库仅为 `wmqfl861/dsh861`，本地目录为 `C:\Albert\project\dsh861`。继续在 PR #7 的 `fix/p0b-windows-credential-store-20260910` 分支工作。P0-B 保持 blocked；本页、内置审核 PASS 与局部测试均不是指定 Codex 计划或 OpenCode 硬审核。不合并 master，不进入 P0-C。

## 接收结果与更正

保留本地 r10 提交 `21b654b4877748cbf7ac06ae252f7c7438e11996`。其 [r10 回执](../remediation/2026-09-10/planner-windows-r10/verification.json)和原始失败／通过日志不改写；26/26 是那次 Windows 执行记录，不等于后代清理的充分证明。

[r11 复核](../remediation/2026-09-10/planner-observer-r11/verification.json)在精确 Git blob 的 Linux 转换副本上复现 25/26：后代程序没有创建 `descendant.beat`，`utimesSync` 失败被吞掉；观察器把文件缺失当作停止。因此“心跳证明全部后代退出”和“Windows 不能构造存活后代”不能继续作为验收依据。修正测试在创建心跳后发布就绪，要求真实推进，缺失／冻结都失败；使用 detached 后代，POSIX 继承管道的 `forcedPipeClosure` 断言保留。测试自己的协作停止不等于包装器清理，`descendantState` 仍为 `NOT_VERIFIED`。

Node 26.4.0 的 libuv 使用进程级共享作业对象，并排除 detached 启动；不能从嵌套 Node 合成用例推导任意 Codex/Rust/PowerShell 后代都会自动退出。参考源码及复核边界记录在 r11，不要求按进程名全局清理。

凭据桥的 PS5.1 解析修复、C#、reader、manage 及原生测试没有变化。[r08 原始文件归档](../remediation/2026-09-10/credential-store-r08/raw-evidence-manifest.json)的 19 份文件内容已逐字节校验；仅清理 tar 包装头的账户／时间元数据并更正 source 路径，原归档的提交和 SHA 保留。缺失的 5 份历史日志仍缺失，没有重新生成历史记录。

## r12 本机完成的复验与接线

Windows 复跑修正后的两组测试全部通过（planner 28/28、projection 15/15）。钉版 Codex（repo 内 @openai/codex@0.149.1，sha256 与 r01 一致）在独立自有目录验证新投影：投影 argv／TOML 全部原生接受，错误信息点名生成 TOML 的 `env_key`，banner 显示 provider: my-gpt、sandbox: read-only、reasoning effort: max；负控制证明 `[shell_environment_policy]` 被原生枚举校验、`--sandbox` 被原生枚举校验、空 `CODEX_HOME` 报 provider 未找到；全局 `%USERPROFILE%\.codex` 未被触碰，82 个写入全部隔离。shell 环境策略与只读沙箱的 OS 级实际强制仍为 NOT_VERIFIED（无密钥无法驱动工具调用）。

行为探针（源码 + 五场景实测）证明 Node 26.4.0 上“spawn 自动清理全部后代”不成立：libuv 作业带 SILENT_BREAKAWAY，CLI 后代不入 wrapper 的作业，wrapper 退出杀不到它们。因此本轮新增显式所有权接线：[job-owner.ps1](../../scripts/p0-b/windows-credentials/job-owner.ps1)（无脱离标志的专用作业对象，EOF/dispose/terminate 显式 TerminateJobObject，KILL_ON_JOB_CLOSE 后备）、[windows-job-owner.ts](../../scripts/p0-b/windows-credentials/windows-job-owner.ts)（helper 完整性）、planner-invocation.ts 的可选 `ownership` 接缝（assign 失败即 `OWNERSHIP_FAILED`）和 [planner-entry.ts](../../scripts/p0-b/windows-credentials/planner-entry.ts)（argv／环境／CODEX_HOME 全部取自投影的最小调用入口）。入口套件 10/10：取消与正常完成都终止 detached 后代，显式 breakaway 尝试保持成员并被终止，属主死亡失效安全成立，并行无关调用不受影响。期间发现并修复 PowerShell 嵌套值类型字段直接赋值是静默空操作的缺陷（SetInformationJobObject 返回成功但标志未生效），证据在 [r12 回执](../remediation/2026-09-10/planner-entry-r12/verification.json)。

## 下一步

真实调用前置条件仍不齐：所有者授权记录、轮换确认、HTTPS 路由批准、金额强制点。在它们落地前入口对所有真实声明保持拒绝（当前批准配置为 HTTP，投影即拒），不得读取真实 Key。授权就绪后，用投影入口执行第一次真实 Codex 规划调用，核验证书、请求级预算与网关行为；OS 级 shell 环境策略与只读强制同样需要真实调用验证。随后由真实指定 Codex 产出当前节点后继计划；[r01](../nodes/P0-B/plan-revision-request.r01.md)、[r02](../nodes/P0-B/plan-revision-request.r02.md)和[网页需求](../requirements/WEB_CONTROL_CONSOLE_SUPPLEMENT.v1.md)继续作为输入，不自行代写 plan.v4，不把整个公网后台追加为本节点无限前置。

## 凭据与交付边界

本轮无需真实 Key，不接触四个生产凭据目标，不读取全局认证，不请求中转站。旧 Key 的供应商撤销确认、用户本人隐藏录入替代 Codex Key、HTTPS 路由批准仍为实际规划前置；第一次只需 Codex，不要求四套同时配置。模型声明、模型锁、pnpm-lock 保持原字节。

正常提交并推送同一分支，交付真实 SHA、复验日志、具体运行条件及未完成项。先闭合可信调用方和系统边界，再进入下一节点。
