# Agent Note: 新建隔离机制前先验证原生 Codex 沙箱

Status: implemented

[English](2026-09-12-native-codex-scope-qualification.md) | 中文

## Problem

Windows 规划器路径需要执行时成立的文件范围权限：获准输入可读，私有目录与未获准写入对命令及其子进程被拒。此前 P0-B 各轮测的是提交输入快照、TLS 和凭据读取，没有一轮执行过钉版 Codex 沙箱，因此没有任何记录能说明其原生 Windows 沙箱能否落实这些权限。在测量之前另写 token、ACL 或进程启动器，会与既有隔离重复或冲突。

## Decision

[无模型范围诊断](../../../../scripts/p0-b/windows-credentials/sandbox-qualification.md)使用合成文件和既有 Windows 作业属主，测量钉版 Codex 沙箱，保持生产投影和准入不变。由原生结果而非 CLI banner 或目录布局，判断该实现能否落实拟定的文件权限。

先完成成功的正控，再检查操作被拒绝。进程失败、文件缺失和子进程未启动不能替代拒绝访问；宿主观察独立检查字节未变及写入未发生。诊断不是对抗性认证服务，永不授予执行权。

## Alternatives considered

**重跑 r20 输入快照或 TLS 套件。** 它们验证提交字节、传输和凭据读取，不验证运行时文件拒绝，回答不了文件范围问题。

**新增第二套沙箱运行器或复用旧打包运行器。** 并行实现会新增自己的 token 和 ACL 维护面，而钉版 Codex 沙箱仍未被测量。

**相信 CLI 帮助文本或发行说明。** 以钉版二进制的实际执行为准；文档不能替代观察到的拒绝。

**把策略放宽为全盘读。** unelevated 后端能跑这类策略，但获准根之外的读拒绝才是被测能力，放宽后的运行证明不了所需权限。

## Consequences

先评估已有维护中的隔离能力，再决定是否需要新增 token、ACL 或进程启动器。原生策略不受支持时保持阻塞；测试不能替所有者安装更强沙箱或放宽宿主策略。即使命令级观察通过，也不认证主模型进程或所有配置发现路径，这些范围保留各自的接线和授权要求。

## Testing

Windows 实测对钉版 Codex 0.149.1 二进制执行了两组套件：18 项观察器检查通过；原生用例被沙箱本体拒绝，错误为 `windows sandbox failed: Restricted read-only access requires the elevated Windows sandbox backend`。钉版源码在 profile 缺少全盘读时直接退出 unelevated 后端；elevated 后端需要专用沙箱登录账号、capability SID 和管理员上下文下的本机 ACL 变更。本轮 unelevated 约束下验证保持阻塞；[r21-win 回执](../../../../development/remediation/2026-09-12/native-sandbox-r21-win/verification.json)记录确切证据与最小追加授权。
