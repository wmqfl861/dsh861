# Windows 验证、凭据接入与 P0-B 规划交接

适用仓库仅为 `wmqfl861/dsh861`，本地目录为 `C:\Albert\project\dsh861`。本页是当前协作入口，不是指定 Codex 计划或 OpenCode 硬审核。P0-B 保持 blocked；不开放 P0-C、不合并 master、不改四套模型配置或锁。

## 当前分支与已完成工作

当前候选继续使用 PR #7 的 `fix/p0b-windows-credential-store-20260910`，不另起平行实现。r09 接收基点为本地推送的 `0589b0340682edbe1a3abb256a5c1c890ca5f495`；fetch 后以该分支实际尖端为准。保留已完成的 PowerShell 5.1 行布局修复、C# 合成存取入口、原生测试及旧证据，不重做 r06 的17处修复，不重装 Node、pnpm 或依赖。

[r08 回执](../remediation/2026-09-10/credential-store-r08/verification.json)记录本地 reader 28通过／1项设计跳过、native 5通过，以及旧规划测试7通过；其大部分原始日志仍引用本机目录，远端本轮只读取结构化回执，没有独立执行 Windows 存取或认证聚合门禁。上一轮 help／probe 的[原始归档清单](../remediation/2026-09-10/codex-plan-precheck-raw/archive-manifest.json)已保留，无需重复探针。

PR #5/#6 和文档整合保持不变，当前修复不重复应用旧 PR 或停用评论中的候选。[r06 原回执](../remediation/2026-09-10/windows-keyless-r06/verification.json)与[远端接收审查](../remediation/2026-09-10/windows-keyless-r06/remote-review.json)仍描述各自固定输入。

## r09 修复与证明范围

远端检查 [planner-invocation.ts](../../scripts/p0-b/windows-credentials/planner-invocation.ts) 后新增负控与正常完成对照，并先对原版本运行：首批15项中13项失败、2项通过。修复包括 UTF-8 字节限额、EOF 尾部限额、超限片段先丢弃、提示投递失败取消、异步调用输入快照、URL解析及凭据变量大小写冲突拒绝、复用既有参数秘密扫描器，以及有界取消等待。

新增显式 `terminationGraceMs`；不再无限等待继承的管道关闭。包装器只管理直接子进程及自己的管道，`cleanup` 明确报告是否观察到直接子进程退出、stdio关闭、强制关闭管道，后代状态始终为 `NOT_VERIFIED`。测试刻意保留后代，确认包装器返回后再由测试清理，不将测试清理算作产品能力。

[r09 回执](../remediation/2026-09-10/planner-bounds-r09/verification.json)区分 Linux 局部验证、模拟凭据对端及真实 Node 子进程。原7项与新增17项合计24项通过；没有把它们描述为 Windows、真实 Codex、完整 Loader 或模型请求验收。本轮原生凭据源文件不变，原生存取不用因纯包装器修改而无条件重跑。

## 本地下一项：仅复验受影响边界并补回可取回日志

在同一个候选分支安全同步远端，沿用 Node26.4.0、专用pnpm11.7.0和现有依赖。检查未提交修改后正常整合，不强推、不 reset、不自动 stash。不要单独覆盖 planner 文件或取另一套旧补丁。

```sh
node --import tsx/esm --test scripts/p0-b/windows-credentials/planner-invocation.test.mjs scripts/p0-b/windows-credentials/planner-invocation-bounds.test.mjs
```

不得设置模块覆盖变量。重点验证 Windows 上的提示写入失败、字节限额、超时后的继承管道持有者和合成清理；如实区分正常返回与后代完全退出。不要用跳过关键用例、改断言、无限重试或全局进程清理来取绿灯。源码修复只复测受影响范围。

按仓库要求完成本次受影响类型、lint与文档检查；对凭据 README 和对应 Agent Note 两组配对逐项确认后，用原 `verify-translation-pairing --write` 显式点名重录，不用 `--all`。r09 的独立结构和blob核对不代替原仓库检查，也不声称已生成本机快照引用。

将 r08 已存在的首次失败、native/reader/planner结果、类型、lint、test:docs/doc-sync和精确合成目标清理记录，检查脱敏后打包为可从远端取得的证据，补命令索引与文件摘要；不要为了归档重复执行已完成命令。如果某条原命令没有可取回日志，明确写缺失而非重造原回执。本轮新日志另存 r09 后继验证，旧 JSON 和原始失败不覆盖。

## 真实调用仍须明确的开发与用户前置条件

[凭据桥说明](../../scripts/p0-b/windows-credentials/README.zh.md)中的管理入口及固定引用不变。只有用户本人在可信交互式窗口隐藏输入新的 Codex Key；agent不读、不代填，不能把Key放进聊天、argv、普通文件或Git。首次规划只需要Codex这一套。

服务商侧旧Key撤销确认、新Key的本机录入，以及获批HTTPS路由仍需用户完成。现有HTTP路由继续被拒绝；没有授权改成其他地址或接受明文风险。新路由要走显式配置变更授权，不能重算旧锁掩盖变化。

`invokePlannerOnce`是可信调用方使用的受控进程组件，不是认证／审批服务。实际调用方仍须把已核验的所有者授权、模型锁、CLI参数及原生配置、读取范围、隔离CODEX_HOME、只读沙箱与预算绑定到同一次调用。非空记录名称和HTTPS前缀不是授权或证书证据；参数echo不是网关执行max的证据。原始进程文件日志、未登记秘密值和Windows资源所有权也不由文本脱敏自动保护。

当前完整Windows后代清理仍未证明；本轮有界等待不是该能力的替代实现。真实调用前必须有可信执行所有者承担进程树限制和核验，不能因返回 `PLANNER_INVOCATION_CANCELLED` 就放行下一次调用或宣布资源干净。必要的最小生命周期接线可在当前P0-B范围用合成进程完成，不启动真实模型探测，不另造通用平台。

当前无密钥步骤不等用户Key；完成后正常提交和推送同一个候选分支，返回SHA、实际命令结果、证据路径及仍缺的具体授权／实现项。只有全部实际条件成立才可调用指定真实Codex产出有限后继计划，输入[请求r01](../nodes/P0-B/plan-revision-request.r01.md)、[请求r02](../nodes/P0-B/plan-revision-request.r02.md)及[控制台补充](../requirements/WEB_CONTROL_CONSOLE_SUPPLEMENT.v1.md)。不伪造plan.v4，不把公网后台无限追加为当前节点前置条件，不提前执行指定硬审核。
