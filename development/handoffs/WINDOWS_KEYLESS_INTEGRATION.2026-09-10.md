# Windows 验证、凭据接入与 P0-B 规划交接

当前仓库仅为 `wmqfl861/dsh861`，本地目录为 `C:\Albert\project\dsh861`。继续使用 PR #7 的 `fix/p0b-windows-credential-store-20260910`。P0-B 保持 blocked，不合并 master，不进入 P0-C；本页和内置子代理审核不是指定 Codex 规划或 OpenCode 硬审核。

## 当前输入与已完成部分

接收基线为 `ed8d91461fcdbf68066fa5804d57d06c23c31749`。[r13 Windows 回执](../remediation/2026-09-10/planner-gate-r13/verification.json)记录补丁接收、钉版门控启动器、ABI 探针、31 项规划测试和 12 项原生入口测试。原回执、首失及历史缺失记录保留，不重复执行没有变化的版本、配置发现、凭据存取或归档任务。

本次 r14 在同一实现上处理 helper 失败时未指派启动器的中止、失效属主放行、销毁等待和过期 go 标记。[r14 回执](../remediation/2026-09-10/gate-abort-r14/verification.json)记录 34 项新控制、10 项既有属主控制和局部类型检查；Linux 执行不代替 Windows 作业或 ACL 证明。源码和使用限制集中在[凭据组件说明](../../scripts/p0-b/windows-credentials/README.zh.md)。

## 本地下一步：仅验证新变化

安全同步当前候选，不强制覆盖、不自动 stash，不另建平行实现。沿用 Node 26.4.0、专用 pnpm 11.7.0 和已安装依赖。先运行新的门控控制与两项 Windows 原生 fixture，再复验受影响的既有属主控制和原生入口。优先覆盖 helper 在尚未指派与已指派但尚未放行时异常退出，使用测试保留的精确子进程句柄，不按名称杀进程；目标必须没有执行，启动器必须被观察到关闭，异常销毁不能改报成功。

[gate-owner-native.test.mjs](../../scripts/p0-b/windows-credentials/gate-owner-native.test.mjs)已写好这两项 fixture；在 Windows 上应实际执行。VM 只观察原始 spawn 返回值，不模拟 Windows 或替换 PowerShell。非 Windows 跳过不能计作通过。必要时最小修复并保留首次失败，不能删除断言、追加任意重试或降低宿主策略。

补齐原 breakaway fixture 的真实进程身份：从已完成布局核验的 `PROCESS_INFORMATION.dwProcessId` 保存实际 PID，并保留进程句柄以等待内核退出；未创建、PID 占位符、无法查询或仅心跳冻结不能证明退出。不要重新编写整套属主。生产代码本轮未修改 C#、PowerShell 凭据或模型配置。

按实际影响完成类型、lint 和文档验证。两组 README/Agent Note 已同步双语正文，但没有冒充执行原仓库配对程序；点名重录受影响的 `.i18n.yaml`，不用 `--write --all`，不关闭钩子。不重复未变化的 reader/native、版本和配置解析探针。实际执行的完整命令与退出码应有可取回日志，旧缺失文件不得重造。

正常提交推送同一分支并更新 PR #7；本轮重点是本次修改的 Windows 结果和两个原生失败场景，不再返回“与旧提示词相同、无新工作”。

## 真实调用边界

本轮不用真实 Key，不读写或枚举生产凭据，不读取全局认证，不访问中转、不调用收费模型。模型声明、模型锁、pnpm-lock 和节点状态保持不变。门控哈希由本次受控开发更新，生产批准另行记录；不能将测试时计算的哈希冒充用户生产批准。

首次真实规划仍需可核验的所有者授权、用户确认供应商侧撤销旧 Key、本人隐藏录入新的 Codex Key、获批受保护路由，以及实际隔离和费用约束。金额预算的技术强制机制属于实现工作，具体金额和服务商支持条件需要用户决定；不能以一个非空记录名、HTTPS 字符串或单次 CLI 启动替代这些条件。不要求用户现在提供四个 Key，也不要求把任何新 Key 发给聊天或 agent。

指定 Codex 后继计划继续以[请求 r01](../nodes/P0-B/plan-revision-request.r01.md)、[请求 r02](../nodes/P0-B/plan-revision-request.r02.md)和[网页控制台需求](../requirements/WEB_CONTROL_CONSOLE_SUPPLEMENT.v1.md)为输入。保留多团队和全站助手需求，但不把整个公网后台追加为 P0-B 的无限前置条件。
