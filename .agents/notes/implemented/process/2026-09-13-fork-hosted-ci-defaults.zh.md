# Agent Note: 标准 GitHub 托管 runner 作为本 fork 的 CI 默认

Status: implemented

[English](2026-09-13-fork-hosted-ci-defaults.md) | 中文

## 问题

`ci.yml` 的七个作业（`node-24`、`node-24-coverage`、`node-24-consumers`、`windows-build`、`windows-coverage`、`windows-native-tests`、`windows-observational`）在故障切换表达式的兜底分支落到 `dsh-ubuntu-24-04-16core` / `dsh-windows-2025-16core`——上游专用的 16 vCPU 池。本 fork 没有这些池，于是七个作业无限排队，整个 run 被围绕它们取消（run 34754759281：七个排队后取消的作业；只有标准镜像上的作业和可复用打包工作流跑完）。`dsh-*` 标签是上游仓库的供给事实，不是 fork 可以假设的默认。

## 决策

- 七个作业的兜底标签改为池所模拟的同代平台标准 GitHub 托管镜像：Linux 作业用 `ubuntu-24.04`，Windows 作业用 `windows-2025`——正是本仓库引入这些池之前使用的标签。`all-checks-passed` 判定作业的兜底改为 `ubuntu-24.04`，形成统一的托管 Linux 默认。
- 上游专用池只能经显式选择值 `DSH_CI_FAILOVER_LINUX` / `DSH_CI_FAILOVER_WINDOWS` = `'enterprise'` 到达，与同一选择器中的 `'blacksmith'`、`'selfhosted'` 并列。任何未配置的 fork 路径都不再触及池标签；判定作业刻意不带 `'enterprise'` 分支，错误配置也不会把分支保护判定困在缺失的池上。
- 为 16 vCPU 池调定的并发预算（`DSH_GATE_CONCURRENCY` 8/3/10、`DSH_COVERAGE_MAX_WORKERS` 6、`DSH_OXLINT_THREADS` 8、`DSH_PUBLINT_CONCURRENCY` 8、`DSH_WEB_SNAPSHOT_WORKERS` 6、`DSH_SNAPSHOT_MAX_CONCURRENCY` 32）仅在显式选择某个池时注入；托管默认下留空即视为未设置：`run-gates`、oxlint、publint、Vitest 覆盖率与快照配置各自按 runner 的 `availableParallelism` 自适应（标准镜像上为 4）。两个预算因"空串改变行为而非程度"而保留显式托管值：`DSH_WEB_SNAPSHOT_WORKERS`（留空会让 run-gates 切到单一构建套件路径）取 2；consumers 车道的 `DSH_GATE_CONCURRENCY`（ci-consuments 聚合默认全并行）取 4。
- 覆盖率分片（`DSH_COVERAGE_PARTITIONS: '4'`）与 90000 ms 覆盖率测试超时在各路径下保持不变：分片是串行的内存约束，超时是在标准托管镜像上实测所需（run 34449848541）。未放宽任何 `needs` 条目、阻断命令、平台或超时；`windows-observational` 仍按设计 `continue-on-error`。

## 后果

必需作业、检查命令、平台覆盖与最终 `needs` 汇总均未改变；`ci-workflow.spec.ts` 对完整选择器（托管默认、`enterprise`、`blacksmith`、`selfhosted`、dependabot 回退）、并发表达式以及判定作业对每种非成功结果的失败传播做求值断言，回归到池默认或全并行 consumers 车道会在 CI 排队之前被测试拦下。

## 考虑过的替代方案

| 否决 | 一行原因 |
|---|---|
| 在 fork 内自托管 runner | fork 不应承担的部署与凭据姿态 |
| 保留 `dsh-*` 默认并用 `vars` 选择退出 | 未配置的 fork 仍然排队；默认必须不依赖仓库状态即可工作 |
| 对所有路径统一降低池预算 | 对存在且有实测依据的机器做无依据猜测；只有托管路径改变 |
