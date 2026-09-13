# Agent Note: 执行 r25 修复与延期的依赖及 vendor 迁移

Status: implemented

[English](2026-09-13-upgrade-consumers-r25-execution.md) | 中文

## Problem

r25 接收的两处修复只带有创作环境的结果：五个插件行为测试从未在已安装的 TypeScript 6 与 Vitest 下运行，Codex 解析器也从未读取真实的 Windows 安装。r24 轮还留下了延期的依赖主版本与已解析但未应用的 cordiverse/cordis vendor 同步，其经典编译器 API 迁移也遗漏了 39 处统计之外的使用方。

## Decision

[共享配置行为测试](../../../../scripts/vitest-shared.spec.ts)与 [Codex 解析器](../../../../scripts/p0-b/windows-credentials/codex-installed-tools.mjs)现在针对已安装环境运行。解析器读取平台包自带的 `codex-package.json` 布局（`entrypoint`、`resourcesDir`），不再假设扁平的 `bin/` 目录，其[控制项](../../../../scripts/p0-b/windows-credentials/codex-installed-tools.test.mjs)覆盖 realpath 路径形态、放错位置的辅助文件与布局元数据不匹配。两处遗漏的经典 API 使用方（[headless 快照](../../../../snapshots/session/headless.snapshot.ts)、[provider 夹具](../../../../packages/subagent/subagent-codex/tests/private-stderr-provider.fixture.mjs)）迁移到 `@typescript/typescript6`。延期的主版本连同其归属使用方一并落地：React 19（ref、计时器、重渲染不变量、十四处类型修复）、js-yaml 5（经 `defineScalarTag` 的方言标签、命名空间导入、自带类型）、Lexical 0.50 统一为单实例、Zustand 5、Immer 11、jsdom 30、Mermaid 12、`typescript-language-server` 6、Vite 8、plugin-react 6、Vitest 5（根配置继承、`expect.poll` 回调、`Assertion` 泛型、面向分面包的共享 automatic-JSX 预设），以及经 `pnpm patch` 重放的 `@yao-pkg/pkg` 6.22.0 补丁。[vendor 同步](../../../../vendor/README.md)以三方合并重放 cordis 56b3d4f→f8ea3cd：采纳上游的变更日志与符号事件，保留本地懒配置解析、事务回滚与等待式卸载，`Fiber.restart` 保持在实例自身（本仓库调用方直接调用 fiber），失败 fiber 守卫仅在服务恢复时重试，上游的加载器形状分类逐字退役本地第 19 条。

## Alternatives considered

只在创作环境中运行接收的修复会重复本轮要关闭的 r24 缺口。让延期主版本停留在语义化范围更新内，则仓库停留在所有者已明确授权迁移的过期主版本上。整体替换 vendored 分叉会丢弃十九条已记录的本地修改；整体退役则会丢掉 harness 依赖的已测试加载器行为。

## Consequences

真实工具链结果取代环境假设：共享配置测试 5/5、解析器控制项 11/11、三组 provider 套件 71/71，完整 Loader 组合经直连 harness 验证（Node 26 在 Windows 上对 Vitest 池孙进程挂起或中止，已记录而非绕过）。client 套件 5269/5270 通过，唯一失败源于本机缺失的符号链接权限；web 套件以真实构建产物在真实浏览器中运行 102 个文件；构建、类型检查、lint 与冻结锁校验均以 0 退出。app-boot 225/225 通过；一个目录选择器包含性测试在新的卸载顺序下确定性失败，已连同诊断链记录为未决 vendor 项。js-yaml 5 的行为差异（空文档、空 `!!js` 体）归类为校验失败以保持 v4 契约。三个 deepseek-harness 分叉仍不可达，其 vendored 包保持在分叉基线，仅 include 的 js-yaml 范围除外。
