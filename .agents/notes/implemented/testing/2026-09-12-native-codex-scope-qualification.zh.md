# Agent Note: 新建隔离机制前先验证原生 Codex 沙箱

Status: implemented

[English](2026-09-12-native-codex-scope-qualification.md) | 中文

## 决定

[无模型范围诊断](../../../../scripts/p0-b/windows-credentials/sandbox-qualification.zh.md)使用合成文件和既有 Windows 作业属主，测量钉版 Codex 沙箱，保持生产投影和准入不变。由原生结果而非 CLI banner 或目录布局，判断该实现能否落实拟定的文件权限。

先完成成功的正控，再检查操作被拒绝。进程失败、文件缺失和子进程未启动不能替代拒绝访问；宿主观察独立检查字节未变及写入未发生。诊断不是对抗性认证服务，永不授予执行权。

## 影响

先评估已有维护中的隔离能力，再决定是否需要新增 token、ACL 或进程启动器。原生策略不受支持时保持阻塞；测试不能替所有者安装更强沙箱或放宽宿主策略。即使命令级观察通过，也不认证主模型进程或所有配置发现路径，这些范围保留各自的接线和授权要求。
