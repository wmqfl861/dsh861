# Windows 验证、凭据接入与 P0-B 规划交接

当前仓库仅为 `wmqfl861/dsh861`，本地目录为 `C:\Albert\project\dsh861`。继续在 PR #7 的 `fix/p0b-windows-credential-store-20260910` 分支工作。P0-B 保持 blocked；本页、内置审核 PASS 与局部测试均不是指定 Codex 计划或 OpenCode 硬审核。不合并 master，不进入 P0-C。

## 接收结果与更正

保留本地 r10 提交 `21b654b4877748cbf7ac06ae252f7c7438e11996`。其 [r10 回执](../remediation/2026-09-10/planner-windows-r10/verification.json)和原始失败／通过日志不改写；26/26 是那次 Windows 执行记录，不等于后代清理的充分证明。

[r11 复核](../remediation/2026-09-10/planner-observer-r11/verification.json)在精确 Git blob 的 Linux 转换副本上复现 25/26：后代程序没有创建 `descendant.beat`，`utimesSync` 失败被吞掉；观察器把文件缺失当作停止。因此“心跳证明全部后代退出”和“Windows 不能构造存活后代”不能继续作为验收依据。修正测试在创建心跳后发布就绪，要求真实推进，缺失／冻结都失败；使用 detached 后代，POSIX 继承管道的 `forcedPipeClosure` 断言保留。测试自己的协作停止不等于包装器清理，`descendantState` 仍为 `NOT_VERIFIED`。

Node 26.4.0 的 libuv 使用进程级共享作业对象，并排除 detached 启动；不能从嵌套 Node 合成用例推导任意 Codex/Rust/PowerShell 后代都会自动退出。参考源码及复核边界记录在 r11，不要求按进程名全局清理。

凭据桥的 PS5.1 解析修复、C#、reader、manage 及原生测试没有变化。[r08 原始文件归档](../remediation/2026-09-10/credential-store-r08/raw-evidence-manifest.json)的 19 份文件内容已逐字节校验；仅清理 tar 包装头的账户／时间元数据并更正 source 路径，原归档的提交和 SHA 保留。缺失的 5 份历史日志仍缺失，没有重新生成历史记录。

## 已新增的无密钥接线基础

[codex-launch-projection.mjs](../../scripts/p0-b/windows-credentials/codex-launch-projection.mjs)实际调用模型锁校验器，生成固定 Codex argv、TOML 和隔离路径环境。它不读取 Key、不创建目录、不写配置、不启动进程、不签发授权；当前 HTTP 路由仍拒绝。结果明确为 `CODEX_LAUNCH_PROJECTED_NOT_AUTHORIZED`。这补齐了确定性配置生成，不等于可信生产调用方、金额预算或系统隔离已经落地。接口边界见[组件说明](../../scripts/p0-b/windows-credentials/README.zh.md)。

远端 Linux 检查：原两组测试修复后 28/28；启动配置生成器 15/15。Node22.16.0、局部 TypeScript 转换副本、真实 Node 子进程/RSA，凭据对端明确模拟；不声称本轮 Windows 或完整仓库门禁已执行。

## 本地下一步：只做受影响复验与明确接线

安全同步同一候选分支，沿用现有 Node26.4.0、pnpm11.7.0 和依赖；不重装、不重克隆、不强制重置、不自动 stash。运行：

```sh
node --import tsx/esm --test scripts/p0-b/windows-credentials/planner-invocation.test.mjs scripts/p0-b/windows-credentials/planner-invocation-bounds.test.mjs
node --test scripts/p0-b/windows-credentials/codex-launch-projection.test.mjs
```

正常运行不设模块覆盖变量。Windows 必须先证明心跳创建且推进，再观察 detached 用例；没有心跳、停止心跳或测试自己清理，均不能签发系统静止证明。检查 Node/libuv 的具体创建标志和作业归属，不再次概括成“所有 spawn 自动清整树”。出现失败保留证据，最小修复，不删断言或重复到偶然通过。

配置生成器的 native argv/TOML 仍须以钉版 Codex 做无密钥解析和隔离配置发现检查。只检查新投影，不重复已核验且未变的 version/help。新增 shell 环境策略必须验证实际原生语义；不以 banner 自述替代请求或权限证据。

随后在当前 P0-B 支持范围连接可信调用方：使用上述投影而非再手写一套参数；从已验证的人类授权取得具体目标、输入版本和预算，使用已证明的进程所有权与只读边界。授权引用非空不是核验，生成目录名不是 ACL，金额限额必须有实际强制点；没有这些条件继续 fail closed。先用合成批准／凭据和进程验证，不替用户签发真实授权。

按源码／文档影响执行必要类型、lint 和文档检查。两组配对点名重录，不用 `--write --all`；不机械重跑未变化的 reader/native 或旧行为套件。原 raw-evidence 内容不修改，只核对新包装元数据及 19 个内容摘要。

## 凭据与交付边界

本轮无需真实 Key，不接触四个生产凭据目标，不读取全局认证，不请求中转站。旧 Key 的供应商撤销确认、用户本人隐藏录入替代 Codex Key、HTTPS 路由批准仍为实际规划前置；第一次只需 Codex，不要求四套同时配置。模型声明、模型锁、pnpm-lock 保持原字节。

正常提交并推送同一分支，交付真实 SHA、复验日志、具体运行条件及未完成项。先闭合可信调用方和系统边界，再由真实指定 Codex 产出当前节点后继计划；[r01](../nodes/P0-B/plan-revision-request.r01.md)、[r02](../nodes/P0-B/plan-revision-request.r02.md)和[网页需求](../requirements/WEB_CONTROL_CONSOLE_SUPPLEMENT.v1.md)继续作为输入，不自行代写 plan.v4，不把整个公网后台追加为本节点无限前置。
