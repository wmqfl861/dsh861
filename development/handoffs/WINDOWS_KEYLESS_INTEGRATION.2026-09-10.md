# Windows 验证、凭据接入与 P0-B 规划交接

适用仓库仅为 `wmqfl861/dsh861`，本地目录为 `C:\Albert\project\dsh861`。本页是当前协作入口，不是指定 Codex 计划或 OpenCode 硬审核。P0-B 继续 blocked，不开放 P0-C，不合并 master。

## 已接收的工作

PR #5 已接收本地 `2a62e488856eee00688740a287abc3cceb90d399` 的 Windows 无密钥修复；[r06 原回执](../remediation/2026-09-10/windows-keyless-r06/verification.json)记录完整文档与 lint 聚合通过。[远端接收审查](../remediation/2026-09-10/windows-keyless-r06/remote-review.json)保留其观察边界。不重做旧17处修复、不重装 Node 或依赖，不重新应用停用的文档补丁。

PR #6 已将本地预检 `04d283fb0d53e334d7a818fdfa95c39bbae1adde` 合入开发分支，合并提交为 `a1f94eab80a109bb19f454620703587c9e630951`。原[planner-precheck.r01.json](../nodes/P0-B/evidence/planner-precheck.r01.json)保留不改写。本地原始 help／probe 输出已按字节原样归档为[可取回包](../remediation/2026-09-10/codex-plan-precheck-raw/archive-manifest.json)，其哈希与 r01 记录全部吻合，未重新执行相同探针。

预检正反对照均回显 effort 字符串，只证明配置层接受；不能证明请求实际携带 max、网关接受 max 或真实服务模型身份。`WRAPPER_READY` 只是预期可满足，不是实际包装器已完成权限、输出、取消及费用保护的证据。单次 CLI 启动可能包含多次模型请求，不等于绝对费用上限。

## 凭据支持候选与责任划分

新增[Windows 专用凭据桥](../../scripts/p0-b/windows-credentials/README.zh.md)提供隐藏录入、固定目标、加密管道读取和现有租约接入。2026-09-10 本机 Windows 原生验证已完成：reader 套件 28 项通过、1 项按设计跳过；native 套件首次失败（bridge.ps1 续行以 `-or` 开头，Windows PowerShell 5.1 拒绝解析）经最小修复后 5 项全部通过，全部合成目标核对无残留。补充验证覆盖隐藏表示的两次确认不一致、重定向输入拒绝和 `-WhatIf` 取消。远端模拟边界见 [r07 回执](../remediation/2026-09-10/credential-store-r07/verification.json)，本机命令、结果与文件哈希见 [r08 回执](../remediation/2026-09-10/credential-store-r08/verification.json)。该组件仍不是已激活的生产服务，交互式真实 Key 录入、跨登录持久性、ACL 隔离与后代进程清理未由本轮证明。

凭据绑定包含开发者的读取器与实际规划包装器接线，不应全部转交所有者。不要执行带真实 Key 的 `cmdkey /pass:...`，也不要创建普通明文 `.key` 文件。不得把用户的 Key 粘贴给本地 agent、命令参数或提交到仓库。密钥输入只由用户在可信本机隐藏表单完成。

所有者仍需确认 Codex 已暴露 Key 在服务商侧撤销，并提供新 Key；另提供并批准 HTTPS 路由或经验证的受保护链路。风险接受文本本身不是传输保护证明，本轮没有批准 HTTP 例外。模型配置、模型锁和依赖锁不自动修改。第一次规划只需要 Codex 凭据，不要求同时录入其他三个产品。

## 本地当前任务：无真实密钥的原生验证（2026-09-10 已执行）

在专用修复分支整合凭据候选，沿用 Node 26.4.0、专用 pnpm 11.7.0 和已安装依赖。保留未提交修改，不强制重置、不自动 stash；不要在主分支开发，不操作其他项目。

本轮已在分支 `fix/p0b-windows-credential-store-20260910`（基于合入提交 a1f94ea 的候选 c70a079）完成：阅读凭据桥说明和源文件；在不设置 `P0B_WINDOWS_CREDENTIAL_MODULE_ROOT` 的情况下运行两个套件；保留 native 首次失败并保存于本地验证目录 `20260910-p0b-credential-native-5e29`；根因为 bridge.ps1 第 23-24 行续行以二元运算符开头（Windows PowerShell 5.1 解析限制，最小复现对照已留证），最小修复为把 `-or` 移至上一行行尾；修复后 native 5 项全部通过，包括 PowerShell/.NET 实际编译 C#、RSA-OAEP-SHA256 跨 Node/.NET 互通、合成条目拒绝隐式覆盖、显式替换、读取和删除，以及 helper 哈希错误在读取前被拒。四个生产凭据目标与全局凭据全程未被读取、枚举或改写；所有记录的 `dsh861/selftest/` 目标经精确目标探针核对均无残留。

补充验证（新增 `SelfTestStore` 合成入口，仅接受 selftest 命名空间，复用真实确认比较路径）：两次确认不一致被拒绝且目标保持 MISSING；一致合成值对经隐藏输入表示（SecureString 逐字符）存入、密封读出并清理；`manage.ps1 -Action Set` 在重定向输入下拒绝而非提示；`-Action Remove -WhatIf` 取消且无完成状态。另注意到 `-EncodedCommand` 在 PS 5.1 下必然向 stderr 输出 CLIXML 模块分析进度（与脚本内容无关），故测试运行器采用与 bridge 相同的 `-File` 形态。

新代码与文档只运行受影响的类型、lint 和文档检查；按仓库程序显式确认新双语对，不机械重复上轮未变化的39/31/56/71项回归。正常提交并推送候选分支及必要脱敏证据，不强推、不自动合并 master。

## 原生验证后，仍然不能自动调用模型

在真实 Key 录入前，确认实际运行账号、所需引用和用途。用户通过 `manage.ps1 -Action Set -Provider codex` 隐藏录入后，状态只能记为已存在、未鉴权；服务商撤销确认另存授权记录，不由脚本假造。若执行策略或账号不支持原生存储，明确阻塞，不退回明文文件或全局登录。

规划包装器必须在读取真实凭据之前校验固定输入提交、批准的路由与完整配置、传输证据、读取范围和费用／时限授权。可信读取器通过原租约向本次进程提供所需环境变量及脱敏匹配值；不得让任意产品 agent 得到通用凭据读取器。所有模型可见输出和落盘路径均需先处理，不能用已有 stderr 屏蔽宣称完整输出安全。预算不能只计 CLI 启动次数；记录原生额外请求及未知用量。

最小接线已落地为 [planner-invocation.ts](../../scripts/p0-b/windows-credentials/planner-invocation.ts)：读取凭据前校验所有者批准记录、与锁验证路由一致的对象、仅 HTTPS 传输门（当前批准路由为明文 HTTP，接线按设计拒绝）、固定提示与可执行文件哈希、时限与通道上限；凭据只经一次性租约进入子进程环境，返回通道全部先脱敏；结果显式注明单进程多请求、不以进程次数为费用上限。其无密钥合成进程测试（假桥＋Node 假 CLI，含泄漏脱敏与超时取消）共 7 项全部通过。真实调用仍未发生，凭据存在不等于执行授权。

只有前置条件齐全，才真实调用指定 Codex 生成有限 P0-B 后继计划；输入[请求 r01](../nodes/P0-B/plan-revision-request.r01.md)、[请求 r02](../nodes/P0-B/plan-revision-request.r02.md)及[控制台补充](../requirements/WEB_CONTROL_CONSOLE_SUPPLEMENT.v1.md)。保持 nativeResume 与 artifactHandoff 的区别，不把整个公网后台追加为 P0-B 前置条件。内置子代理不能代签 plan.v4 或硬审核。

最终返回专用分支与 SHA、原生及源码检查结果、合成清理边界、可取回证据、模型及锁是否保持不变、包装器真实完成程度，以及还需要所有者决定的最小事项。没有凭据时不要重复整轮预检，也不要再把所有实现缺口归类为“用户未配置”。
