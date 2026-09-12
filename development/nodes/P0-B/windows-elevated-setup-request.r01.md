# Windows elevated 沙箱：未批准的初始化影响清单

日期：2026-09-12。状态：`approved=false`、`systemChangesAuthorized=false`、`executionAuthorized=false`。本文件不是安装命令、真实模型启动申请、指定 Codex 计划或 OpenCode 审核。现有 [r21 Windows 回执](../../remediation/2026-09-12/native-sandbox-r21-win/verification.json)的原生结果继续为 BLOCKED；后继[源码复核](../../remediation/2026-09-12/native-sandbox-r21-win/setup-impact-review.r22.json)不改写其原始失败。

## 已确定的障碍与范围更正

钉版 Codex 0.149.1 的 unelevated 后端已实际拒绝限定读取；重复原测试不能补齐该能力。elevated 初始化是系统部署变更，不是把测试配置中的单词改掉就能完成。原回执关于本轮未修改账号、ACL、网络设置的事实保留；其关于未来初始化“仅账号/ACL、不涉及防火墙”的预测范围不完整，不能作为授权依据。

同版 `setup_main/win.rs` 的 `configure_offline_sandbox_network` 调用账号专用的代理许可、出站阻断以及 WFP 过滤安装；`run_provision_only` 也调用它。`setup.rs` 存在通过 `ShellExecuteExW` 和 `runas` 启动 setup helper 的路径；另有要求调用方已经提升的 provisioning 入口。不能只看 `elevated_impl.rs` 就把整个本地 agent 长期管理员运行列为必要条件。`wfp_setup.rs` 的部分失败会记录后继续，因此单凭初始化退出零也不能认证网络过滤生效。

## 必须纳入用户决定的系统影响

| 类别 | 上游路径的影响 | 本次状态 |
|---|---|---|
| 本机身份 | `CodexSandboxOffline`、`CodexSandboxOnline`，相关组/权利及登录界面隐藏状态；已有同名对象可能被其他 Codex 实例使用。 | 未授权创建、接管、重置密码或删除。 |
| 本机秘密与持久目录 | 沙箱账号凭据及其保护目录、辅助程序及状态记录；这不是模型 API Key。 | 不读取凭据内容，不把临时测试 CODEX_HOME 当成经批准的长期位置。 |
| 文件与设备权限 | 精确 read/write/deny roots、沙箱目录、运行时所需位置以及相关设备权限；最终目录由实际请求和初始化路径决定。 | 不授权递归修改用户目录、整个磁盘或任意父目录。 |
| 网络过滤 | 面向 offline 沙箱账号的 Windows Firewall 规则及 WFP 过滤器；不是关闭全机防火墙，也不是授权模型联网。 | 未授权新增、移除或更新。需先识别已存在且共享的规则。 |
| 管理员权限 | 只提升确有需要的 setup 操作；初始化与后续受限执行的身份分开。 | 不触发 UAC、不提升整段 agent 会话、不承诺永远只需一次提升。 |
| 遥测与后台步骤 | helper 存在可选指标配置，部分读取权限维护可能另有阶段。 | 不把“无模型调用”推导为完全无出站；执行前需核对具体入口和开关。 |

这些是待精确化的影响类别，不是用户对所有类别的空白授权。未取得明确批准前，不调用可能初始化或刷新系统状态的 setup、sandbox、doctor/repair 等入口。`--help` 的既有证据优先复用；不能把未经证明的命令当作纯只读检查。

## 现在允许本地完成的只读清点

只核对仓库钉版程序及本地配套 helper 的存在、版本/文件摘要与来源；检查两个精确沙箱账号和上游精确组名的存在状态，不枚举不相关用户，不读取或验证密码。只读取已确定候选目录的访问控制元数据，以及与这些账号和同版源码规则标识匹配的网络策略元数据；权限不足记 UNKNOWN/ACCESS_DENIED，不提权重试、不运行 setup 来探测。

将拟采用的稳定 CODEX_HOME、初始化 helper、实际操作用户与最小提权路径列出。区分新增对象、已有对象和未知对象；对已有共享身份/规则不提出自动覆盖。记录哪些变化需要执行前保存元数据、哪些可精确恢复、哪些恢复尚未证明。不得把删除目录或删除两个账号宣称为完整回滚；未经确认也不得删除已有沙箱资源。

将只读结果写为本文件旁的一个独立未批准清点结果，引用本申请和被读程序摘要，不重新生成一份重复申请。报告只含必要状态与脱敏标识，完整 SDDL、机器标识和用户名等本机元数据不自动上传。没有新增信息就不造空提交。此时不重跑 r21 原生测试或旧 62/1、TLS、凭据和门控套件。

## 批准之后才可能开始的步骤

完成本机清点后，由所有者确认精确的账号、目录/权限、Firewall/WFP 与提权范围。若官方入口实际还会变更清单外的对象，则重新说明，而不是凭“继续开发”扩大授权。实现端随后才准备并验证最小接线；不手工调用未知 payload 的内部 helper，不改造另一套沙箱运行器。

后继合成复验继续要求获准输入可读、目录外父子读取被拒、写入被拒及宿主字节/作业清理证据；初始化成功不替代这些行为。限制不成立时保留真实失败，不转为全盘读取来取得通过。即使命令级验证通过，也不自动认证主 CLI 或配置发现路径。

本申请不批准生产凭据、TLS 中转、模型调用、金额消费、生产签署或 P0-C。真实规划仍依照[节点规则](../../../NODE_DEVELOPMENT_RULES.md)进行；[网页控制台需求](../../requirements/WEB_CONTROL_CONSOLE_SUPPLEMENT.v1.md)保持原样，不新增与本次系统清点无关的前置框架。

## 固定上游证据

均为 `openai/codex@rust-v0.149.1` 的已读源码，不把当前网页文档直接当作钉版行为。

| 源码 | Git blob | 核验区间与内容 |
|---|---|---|
| [setup_main/win.rs](https://github.com/openai/codex/blob/rust-v0.149.1/codex-rs/windows-sandbox-rs/src/bin/setup_main/win.rs#L622-L770) | `dc43abd9226e13cdf6aadc9abadce5bf46a854c4` | 622–770：网络规则、WFP 与 provisioning 调用链。 |
| [setup.rs](https://github.com/openai/codex/blob/rust-v0.149.1/codex-rs/windows-sandbox-rs/src/setup.rs#L964-L1137) | `4a5f403e5bd1fb4a13d7690e16894bddd3049bdc` | 964–1137：runas、是否需要提升及另一 provisioning 前置要求。 |
| [wfp_setup.rs](https://github.com/openai/codex/blob/rust-v0.149.1/codex-rs/windows-sandbox-rs/src/wfp_setup.rs#L129-L186) | `688878583b017ef029a9b54b8fdf5e806a7d94ad` | 129–186：安装失败可继续，指标依赖可选设置；未做本机效果验证。 |

没有执行上游初始化程序，没有改动本机系统，不能将这份源码审查写成部署完成。
