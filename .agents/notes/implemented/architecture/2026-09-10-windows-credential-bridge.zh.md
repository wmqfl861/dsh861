# Agent Note: 专用 Windows 凭据与加密读取管道

Status: implemented

[English](2026-09-10-windows-credential-bridge.md) | 中文

## 问题

固定凭据引用需要真正的操作系统读取器。把 Key 放进命令参数会增加命令和进程观察中的暴露路径。打印明文的原生读取器也会使凭据进入意外的诊断采集。

## 决策

[专用 Windows 组件](../../../../scripts/p0-b/windows-credentials/README.zh.md)使用四个固定的通用凭据管理器目标。交互式录入接受 SecureString，不接受值为 Key 的命令参数。可信读取器要求显式引用授权，并接入现有一次性租约，不发现全局账号或配置。

原生 stdout 只承载用父进程每次新建的 RSA-4096 公钥生成的 RSA-OAEP-SHA256 封装。加密由内置密码实现处理，Windows 负责落盘保护。凭据限制为 384 个可打印 ASCII 字节，超过限制拒绝而不是截断。通道具有显式程序／源码哈希、环境、时限和输出限制；失败丢弃原生诊断内容。

规划进程包装器在等待外部工作前复制可信调用输入，按 UTF-8 字节限制已脱敏的保留输出并覆盖 EOF，输入投递失败则取消。独立的终止宽限期限制继承管道的等待；宽限期后返回明确的未验证清理状态，不声称所有后代已经退出。心跳缺失或冻结不能证明退出。生命周期 fixture 在就绪前创建心跳，观察实际推进并使用 detached 存活后代；测试清理与包装器拥有的终止能力保持区分。

无密钥 Codex 启动配置生成器校验实际配置锁并生成固定原生 argv／配置。它不签发授权或读取凭据；原生强制行为与可信生产调用方仍是独立责任。

## 考虑过的替代方案

明文文件和命令行密码参数增加暴露路径。读取器 stdout 输出明文会使意外进程日志变得不安全。完整平台凭据服务及公网管理界面需要超出本支持组件的授权和部署约定，本组件不宣称已经交付它们。

字符串长度不能覆盖多字节输出；只检查数据回调会遗漏延迟的 EOF 输出。先保留超限片段再终止进程不能落实内存边界。只等待 stdio 关闭可能在直接子进程退出后卡住。有界方案明确放弃取消后的诊断内容和完整后代清理声明。

## 影响

安全边界是操作系统账号，不是凭据名称前缀或加密管道。共享该账号的产品 agent 仍需要有效的操作系统隔离。不自动激活模型，不确认 Key 轮换，不授权 HTTPS 或规划调用。[远端 r07 回执](../../../../development/remediation/2026-09-10/credential-store-r07/verification.json)区分合成协议测试与原生 Windows 验证；[本机 r08 回执](../../../../development/remediation/2026-09-10/credential-store-r08/verification.json)记录已执行的 Windows 原生结果、解析兼容修复和尚未完成的接入限制；[r10 回执](../../../../development/remediation/2026-09-10/planner-windows-r10/verification.json)保留原始 Windows 观察。[r11 更正](../../../../development/remediation/2026-09-10/planner-observer-r11/verification.json)记录缺失心跳缺陷，并限定相关生命周期结论。
