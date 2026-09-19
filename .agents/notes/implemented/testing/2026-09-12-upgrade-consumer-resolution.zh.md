# Agent Note: 按实际使用方解析编译器 API 和原生工具

Status: implemented

[English](2026-09-12-upgrade-consumer-resolution.md) | 中文

## Problem

原生 TypeScript 编译器构建不会执行 Vitest 配置加载时导入的编译器 API。Codex 已安装的版本也不能证明诊断实际执行哪个二进制，尤其当诊断写死了包管理器存储路径时。

## Decision

共享的[装饰器转换](../../../../vitest.shared.ts)导入已声明的 TypeScript 6 兼容 API。[行为测试](../../../../scripts/vitest-shared.spec.ts)通过测试配置实际使用的同一插件执行转换后的装饰器，并检查 TSX、模块后缀和源映射。

[原生诊断](../../../../scripts/p0-b/windows-credentials/codex-sandbox-qualification-native.test.mjs)从 provider 实际安装的依赖及其平台包解析 Codex。[解析器](../../../../scripts/p0-b/windows-credentials/codex-installed-tools.mjs)在返回路径前核验声明、安装元数据、仓库内位置和三个发布文件的摘要，不依赖 pnpm 存储目录的拼写，也不回退到全局程序。

## Alternatives considered

仅修改依赖声明会让使用方仍停留在旧 API 或旧程序。把一个写死的存储目录换成另一个，会在下次升级时重复问题。把旧编译器恢复为默认则掩盖了原生编译器迁移，而非保留用途不同的 API 使用方。

## Consequences

编译器构建、测试配置加载和原生文件核验分别需要证据。合成解析器材料不执行 Codex，也不证明沙箱权限。哈希检查只覆盖检查时刻，使用前的安装完整性仍由调用方负责。模型配置、生产授权和历史结果与依赖选择保持分离。
