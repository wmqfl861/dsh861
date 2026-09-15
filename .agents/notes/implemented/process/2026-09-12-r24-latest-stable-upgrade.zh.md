# Agent Note: 将 r24 工具链、源码与依赖批次迁移到最新稳定版

Status: implemented

[English](2026-09-12-r24-latest-stable-upgrade.md) | 中文

## Problem

r23 基线固定在较旧的工具链（Node 26.4.0、pnpm 11.7.0、TypeScript 6.0.3）与合并前的上游源码，而四个子代理 CLI 和全部 workspace 依赖都有更新的稳定发布。起始提交声明了固定批次，但锁重建、安装与迁移都尚未执行。

## Decision

于 2026-09-12 从发布方 registry 一次性解析固定批次并完整执行：项目专用新编号工具目录中安装 Node 26.8.2 与 pnpm 12.4.1（校验和分别对 nodejs.org 与 pnpm release 核验）；先解除 shallow 克隆，再以 merge-base d347e70 真实 merge-forward 上游 deepseek-harness master c291e796；锁文件由 pnpm 本身重建；TypeScript 7 迁移采用发布方拆分方案——构建用 `typescript@7.0.2` 原生编译器，39 处经典编译器 API import 用 `@typescript/typescript6@6.0.2`，lsp-stdio 通过 devDependency 别名让 typescript-language-server 保有 tsserver。Grok 解析为 1.0.30（本轮期间 registry 已越过声明的 1.0.25）；其 postinstall 写 `~/.grok/bin` 被拒绝，claude-code 与 opencode 的 postinstall（包内 bin 复制）经脚本审查后允许。

## Alternatives considered

在安装时追随 `pnpm outdated` 目标会漂移到浮动 latest；批次先冻结。强推全部主版本（react 19、vite 8、vitest 5、jsdom 30、mermaid 12、js-yaml 5）会越过上游项目自身尚未迁移的拥有范围；这些保留为 deferred 主版本。用 `--no-verify` 收尾合并被否决；改为在真实安装后重生成 notices 以满足门禁。

## Consequences

TS7 更严格的 type-only-import 检查暴露了合并代码中的真实缺陷（四个 Branded id 被当值调用；改为 `brandString<T>()`），fast-check 4.10 弃用 assert 的 `timeout` 选项（迁移到 `fc.timeout` 插件）。vendored Cordis 集合维持上游集成基线：四个上游仓库中有三个公开不可解析，可访问的 cordiverse/cordis 有 30 个提交，采纳需要重放 19 项已记录的本地修改——已作为具体后续项记录，而非静默跳过。CI 主验证通道升至 Node 26，制品、原生 ABI 与发布通道保持 24 LTS。
