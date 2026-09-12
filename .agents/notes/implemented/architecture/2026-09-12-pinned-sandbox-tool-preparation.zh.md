# Agent Note: 准备钉版沙箱程序，不初始化共享账号

Status: implemented

[English](2026-09-12-pinned-sandbox-tool-preparation.md) | 中文

## Problem

Codex 主程序可运行，不代表独立的 setup 和 command runner 已齐备。提权初始化还可能影响其他 Codex 安装使用的账号和网络策略对象。把取得程序与系统初始化混为一步，会把缺少文件和共享资源影响推迟到管理员操作开始后才暴露。

## Decision

[本地工具包准备器](../../../../scripts/p0-b/windows-credentials/sandbox-tool-bundle.md)只在核验已审查的大小和 SHA-256 后复制三个显式文件。它使用同一版本的原始主程序、setup 和 runner 摘要，不使用全局 runner 或浮动版本。CLI 选择已有的精确版本清单并默认使用经审查的当前版本，历史清单保持不变。新暂存目录保留来源文件与既有安装。准备不执行程序、不登记信任、不操作账号或请求提权。

## Alternatives considered

仅改变 CODEX_HOME 不会分离源码固定的账号名与过滤标识。复用旧秘密文件会把新部署与其他安装的凭据耦合。通过执行 setup 探查 helper 是否存在，会在确认工具包之前修改系统。准备器把文件完整性和系统授权分别表达。

## Consequences

准备好字节不等于运行时兼容、发布者签名证明、系统变更批准或 OS 隔离。合成文件测试覆盖复制、拒绝与清理，钉版真实文件仍需本地核验。来源和暂存目录须受可信用户控制；准备器不解决恶意并发文件系统替换。不能仅凭名称或 GUID 固定就推导共享资源可以清理。
