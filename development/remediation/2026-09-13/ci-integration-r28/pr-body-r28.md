# PR #13 body update — r28（CI runner 托管默认 + 单文件打包修复）

> 本文件是 PR 正文更新文本（本机无 gh/Token，无法直接写 PR 正文；入库供拥有者粘贴）。PR 保持草稿，不合并 master，不开放 P0-C。

## 升级收尾：r27 Gateway 212/212 已接收；r28 修复 CI runner 默认路径与真实单文件打包失败

### r28 改动

**CI runner 适配（工作流源码，不部署任何 runner）**
- `ci.yml` 七个原默认 `dsh-ubuntu-24-04-16core` / `dsh-windows-2025-16core` 的作业改为标准 GitHub 托管镜像默认：Linux `ubuntu-24.04`、Windows `windows-2025`（即本仓库引入专用池之前的 hosted 标签）；run 34754759281 中七个无限排队的作业由此恢复可运行。
- 上游 16 核专用池保留为显式选择路径：`DSH_CI_FAILOVER_LINUX` / `DSH_CI_FAILOVER_WINDOWS` = `'enterprise'`；`blacksmith` / `selfhosted` 分支不变；`all-checks-passed` 判定只走托管镜像。
- 与 runner 耦合的并发预算改为按池注入：显式选池时维持 16 核调定值，托管默认留空使 run-gates/oxlint/publint/Vitest/快照按 `availableParallelism` 自适应；`DSH_WEB_SNAPSHOT_WORKERS`（空值会切换测试套件）与 consumers 车道 `DSH_GATE_CONCURRENCY`（默认全并行）保留显式小值 2/4。覆盖率分片、90000ms 覆盖超时、全部 needs/阻断命令/平台范围不变。

**单文件打包失败修复（run 34754759281 两个平台 Build single-exe 真实失败）**
- 根因一：pnpm 12.4.1 `deploy --legacy` 把生产闭包内无供给者的 `workspace:^` peer 改写为非法裸 `^`（pnpm 11 则静默丢弃该包——潜在运行时缺口）。修复：`python/sdk-runtime/package.json` 按既有根级供给模式补上 `@deepseek-ai/dsh-session-title-llm` 与 `@deepseek-ai/dsh-util-workspace-path`，锁同步再生成（+6 行）。
- 根因二：pnpm 12.4.1 `deploy --legacy --config.node-linker=hoisted` 把注册表树物化到工作区根而非部署目标。修复：改走 pnpm 12 部署实现（去 `--legacy`）并 `--ignore-scripts`（node-pty/koffi 均随包发布预构建；严格构建门禁对工作区包的 file://URL 键随机器变化无法提交）；node-pty macOS spawn-helper 的 chmod 由 `build-exe-for-python-sdk.ts` 镜像执行；删除已死的 legacy 恢复步骤。
- 回归：`verify-runtime-closure` 遍历扩到 `apps/`、peer 供给语义改为“生产闭包内存在”（与 deploy --prod 一致）；删除任一新增清单行都会在打包前失败。5 包最小工作区在 pnpm 11/12 的行为差异证据入库。

### r28 验证（Windows 本机 + 受影响测试）

- Windows 完整单文件管线双 Node 版本通过：Node 26.8.2 与隔离安装的官方 Node 24.21.0（sha256 校验）均 exit 0，产出 `deepseek-harness-sdk-runtime-win-x64.exe`（230.3MB）+ `-rg.exe`。
- wheel 构建 + 干净 Python 3.10 venv 安装 + `smoke-python-runtime.py --scenario all --installed-wheel`：全部通过（本机用户路径含空格的首次失败为本地环境条件，已记录）。
- 受影响 specs 全绿；host typecheck、oxlint、note 格式/分类、831 对翻译配对、闭包校验器（242 包）全绿。
- Linux 打包交由本候选推送后的标准 hosted CI run 验证；macOS 不在本 PR 工作流。真实 API 冒烟未运行（无密钥且本轮禁止）。

### 不变项

模型配置两文件、provider/endpoint/思考等级/credentialRef、P0-B state、pkg 补丁、分支保护、PR 草稿状态均未改动。证据目录：`development/remediation/2026-09-13/ci-integration-r28/`。
