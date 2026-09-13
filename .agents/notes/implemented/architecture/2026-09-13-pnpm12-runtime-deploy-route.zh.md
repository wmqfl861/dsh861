# Agent Note: pnpm 12 运行时部署路线与闭包级 peer 供给

Status: implemented

[English](2026-09-13-pnpm12-runtime-deploy-route.md) | 中文

## 问题

r24 工具链迁移把 `pnpm@12.4.1` 固定为本仓库包管理器（上游 `master` 固定 `11.7.0`），此后本分支每一次 `python runtime / release-shaped matrix` 作业都在 `Build single-exe` 步骤失败，自分支首个 CI run 起从未通过。远端一轮曾依据 connector 转码日志把失败归因为 Tailwind 打包错误；该诊断指名的包在本树中完全不存在，本地也无法复现，因此作为证据弃用。本地按 CI 原命令执行，用五个包的最小工作区分别复现了 `deploy --legacy` 在 pnpm 12 下的两处行为变化（证据：`development/remediation/2026-09-13/ci-integration-r28/local-execution/`）：

1. 生产依赖无人供给的 `workspace:^` peer 被改写成非法的裸范围 `^`，解析以 `ERR_PNPM_SPEC_NOT_SUPPORTED_BY_ANY_RESOLVER` 中止。pnpm 11 则静默把该 peer 包从部署目标中省略——这是潜在运行时缺口，因为持有 peer 的插件在加载时就会 import 它。
2. `node-linker=hoisted` 下，注册表依赖树被物化到工作区根 `node_modules`（安装脚本对着根目录运行），部署目标只剩空的虚拟存储。

## 决策

- `python/sdk-runtime/package.json` 补上生产闭包缺失的两个 peer 供给者——`@deepseek-ai/dsh-session-title-llm`（`dsh-session-title-first-prompt-llm` 的 peer，经 `@deepseek-ai/dsh-base` 挂载）与 `@deepseek-ai/dsh-util-workspace-path`（`dsh-api-session-controller` 的 peer，经 `@deepseek-ai/dsh-web-app` 挂载）——沿用清单既有的根级 peer 供给模式。
- 部署去掉 `--legacy`（pnpm 12 的部署实现能正确填充目标）并加 `--ignore-scripts`：pnpm 12 的严格按依赖构建门禁用改写后的绝对 `file:///` 路径作为注入工作区包的键，该键随机器变化，任何已提交的 `allowBuilds` 键都无法授权，部署必然硬失败。跳过脚本对该闭包安全：node-pty 的 `prebuilds/` 随 tarball 发布（Windows 的 `conpty` 目录就在 addon 旁），koffi 的原生二进制经 `@koromix/koffi-*` 平台可选依赖到达；唯一的工作区 postinstall——node-pty macOS spawn-helper 的 chmod——由 `scripts/build-exe-for-python-sdk.ts` 在部署后镜像执行。
- `scripts/verify-runtime-closure.ts` 的遍历同时覆盖 `apps/*/package.json`（闭包经此到达 `@deepseek-ai/dsh`），peer 供给的判定从"仅运行时根"放宽为"生产闭包内任意位置"，与 `deploy --prod` 实际物化的内容一致；`devDependencies` 永不满足 peer。

## 后果

部署直接产出完整暂存树，构建脚本中的 legacy 恢复步骤随之删除。闭包校验器现在能拒绝曾造成十一次红打包 run 的失败类别：删去清单中任意一行，`pnpm run verify-runtime-closure` 都会在任何打包之前以完整引用链失败。Linux CI 的 node-pty manylinux 重建仍作用于工作区包，不受部署路线变化影响。

## 考虑过的替代方案

| 否决 | 一行原因 |
|---|---|
| 把 pnpm 降回 11.7.0 | 撤销已授权的 r24 工具链迁移，并掩盖 pnpm 12 暴露的真实闭包缺口 |
| 保留 `--legacy` 并在脚本侧修补 | 注册表树从未到达目标；从共享工作区 `node_modules` 复制无法干净分离 |
| `--config.strict-dep-builds=false` / 环境变量覆盖 | 部署从写入目标的设置重新推导门禁，该开关到不了内层安装（已实测） |
| 挂载点供给（`dsh-base`/`dsh-web-app` 声明 peer） | pnpm 12 下可行，但偏离清单既有的根级供给模式与校验器规则 |
