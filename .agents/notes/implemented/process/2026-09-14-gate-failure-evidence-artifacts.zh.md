# Agent Note：红项 CI 车道的 gate 失败证据 artifact

Status: implemented

[English](2026-09-14-gate-failure-evidence-artifacts.md) | 中文

## Problem

PR CI 存在三条红项车道——Linux coverage（`node-24-coverage`）、Windows coverage（`windows-coverage`）与 consumers（`node-24-consumers`）——其失败无法定因：远端连接器下载完整 run 日志返回空文本，不同读取途径给出的 job 身份不一致，consumers 日志摘录引用的测试路径不在固定 HEAD 子树内（r30 整改记录 `development/remediation/2026-09-14/ci-evidence-r30/`）。没有可下载、可哈希校验的各车道自身输出记录，任何修复都无法引用其失败。

## Decision

- `run-gates.ts` 增加显式启用的证据导出：`DSH_GATE_EVIDENCE_DIR` 指定输出目录。未设置或为空即无文件、无行为变化；调度、gate 命令、`GateResult` 与 stdout/stderr 所有权不变。
- 导出写入 `identity.json`、`gate-results.json`（每个 gate 的 id、label、公开命令、状态、aborted 标志、耗时、退出码、信号、脱敏 error、匹配到的路径 blob、显式列为未匹配的路径参数）、每个保有输出的非通过 gate 一份日志、镜像的 aggregate stdout 与 stderr，以及针对实际写入字节计算 SHA-256 的 `manifest.json`。
- `mirrorProcessOutput` 在运行期内包装 `process.stdout.write`/`process.stderr.write`，使 `streamOutput: true` 的 gate（分区 coverage、web snapshot）同样留下证据；它只观察写入，不阻塞、不重排、不夺取所有权。
- 任何字节被写入或哈希之前先脱敏：凭据头、token 形态、cookie、secret 命名赋值与非 runner 的用户目录段替换为固定占位符。截断在每份日志 1 MiB 上限内保留头部（首失区域）与尾部，文件内 notice 写明省略、原始与保留字节数；manifest 条目携带同样事实。
- 导出目录必须不存在或为空，且最终递归清单必须恰等于写入集合，预置文件与 symlink 无法混入上传；gate 日志文件名限定 `[A-Za-z0-9._-]`。导出错误只打印一行 stderr，绝不改变 aggregate 退出码。
- `identity.json` 记录 repository、PR 编号、run id、run attempt、job、aggregate、PR head/base、checkout 的 `github.sha`/`github.ref`、实际 Git HEAD 及其父提交、Node/pnpm/平台；PR head、checkout merge SHA 与真实 HEAD 保持分立字段。只读取白名单内的非敏感 CI 变量——不 dump 环境、事件载荷或凭据存储。
- `ci.yml` 向三条红项车道既有的 gate 步骤传入证据目录与 PR 编号/head/base，并新增 `actions/upload-artifact@v7` 步骤，条件为 `failure() && steps.<id>.outcome == 'failure'`，命名为 `gate-evidence-<job>-run<run>-attempt<attempt>`；needs、runner、timeout、并发预算、分区与测试选择不变。

## Consequences

失败的红项车道产出可逐字节复核的 artifact：身份、状态与日志均可校验——状态逐字复制自 `GateResult`（fail-fast 跳过保持 skipped、aborted 保持 failed），上传仅在 gate 步骤自身失败后运行，因此失败车道缺少 artifact 本身即是一项发现。`scripts/gate-evidence.spec.ts` 拥有导出行为（开关关闭、状态忠实、退出码保持、脱敏反向断言、截断可见、拒绝非空目录、防遍历文件名、manifest 复算、run/attempt/job 分立）；`ci-workflow.spec.ts` 固定三条车道的接线。

## Alternatives considered

| 拒绝 | 一句话理由 |
|---|---|
| 下载完整 run 日志归档 | 连接器的 run 日志端点返回空文本；artifact 上传才是受支持的通道 |
| 用 pnpm/PowerShell tee 包装 gate 命令 | 替换项目入口并改变退出码语义；run-gates 内镜像只观察不拥有 |
| 在 `GateResult` 中保留流式 gate 输出 | 改变调度器的 stdout 所有权与内存姿态，本变更不得触碰 |
| 把 runner 环境 dump 进 identity | 超出非敏感白名单的读取；identity 需要命名字段而非环境档案 |
