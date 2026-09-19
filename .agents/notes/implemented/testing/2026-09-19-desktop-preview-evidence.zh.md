# Agent Note：桌面预览 fixture 与产物打包背后的 fs-ext 迁移清理

Status: implemented

[English](2026-09-19-desktop-preview-evidence.md) | 中文

## 问题

Desktop 应用此前没有 keyless、测试自有的方式以模型 fixture 启动真实 Electron 窗口；且 Windows 产物模式打包在与签名无关的一处无条件失败：flock 迁移（`d927cbff99`）把唯一的 `fs-ext` 依赖（`packages/session/session-persistence-jsonl`）替换为 `@deepseek-ai/node-addon-system`，此后全仓任何包都不再声明 `fs-ext`——但 `apps/desktop/tests/fixtures/runtime-payload-smoke.mjs` 仍无条件调用 `checkFsExt()`，`prepare:dsh` 的冒烟步因此删除已组装的 target，所有签名或未签名 Windows 打包在该步失败。两个较小的阻断叠加其上：锁定 pnpm 12.4.1 无 `main`/`exports`，`prepare-runtime.ts` 的 `require.resolve('pnpm')` 必然解析失败；预览 fixture 首次尝试把 patch 层注入了 `apps/desktop/.desktop-build/development/project/`——用户可见的 development project——真实 owner 客户端随即无法启动（fixture 从 project 上下文导入了不可解析的裸 `@deepseek-ai/*` 名）。

## 决策

`apps/desktop/tests/fixtures/` 下三个预登记 fixture 现在拥有预览路径：`b01-preview-model.mjs`（零裸包导入的 keyless mock 适配器）、`b01-preview.cordis.patch.yml`（由 `DSH_B01_PREVIEW` 守卫、仅在测试启动中激活的 patch 层）、`b01-preview-launch.mjs`（把测试 profile 装配进测试自有 app 目录的启动器，带所有权断言——拒绝测试根与仓库 development 目录之外的路径——装配前备份、退出恢复）。事故返工的条件是结构性的：fixture 不得从 project 上下文导入裸工作区名；装配范围限定在真实客户端永不读取的自有 home。fs-ext 清理把全部四处残留按迁移历史证据化为死代码后移除：`runtime-file-policy.ts` 的排除规则、`project-manager.ts` 生成 workspace 文件的 `fs-ext: true` allowBuilds 项、以及冒烟检查本身。冒烟改为验证承接面：`checkSystemFlockGate` 在打包 runtime 内解析 `node-addon-system/flock` 入口并断言文档化的 win32 平台门（`ERR_FLOCK_UNSUPPORTED_PLATFORM`）——win32 会话锁走 koffi，既有 `checkKoffi` 已覆盖。spec 的 fs-ext 专属 fixture 改为中性 native-sample 对（证明同一通用保留语义）加 node-pty 容器外断言。`prepare-runtime.ts` 改按子路径解析 `pnpm/package.json`，不依赖 pnpm 的 `main` 即恢复"解析到 manifest"契约。其余 Windows 构建阻断仅在调用层解决——绝对 bash 调用并以 workspace 锁定的 pnpm 包装器作 `npm_execpath`、PATH shim 使 `C:` 前缀路径选中 bsdtar 而非 GNU tar、经 `NODE_OPTIONS` 只注入构建进程树的 `fd-slicer` 流 shim——仓库字节零改动。

## 考虑过的替代方案

**恢复 `fs-ext` 依赖声明。** 与 flock 迁移方向相反；闭包已证不含该包，声明只会成为冒烟随后重新索取的死重。

**把 fs-ext 断言藏在平台守卫后。** 迁移后该模块在任何平台都无法 require；带守卫的跳过会让承接面失去验证。

**在重建前把测试 patch 装进 development project。** 该 project 由每次 dev/start 重建且用户可见；注入既不稳定也不在测试所有权内——即已记录的事故。

**安装缺件系统工具（NSIS、GNU tar 替代、新 pnpm）。** 超出本批次授权；每一项要么在调用层绕过，要么作为精确缺件上报。

## 后果

五个目标 Desktop spec 终态 25/25、打包相邻 spec 集 39/39 全过；负控证明被移除的 fs-ext 断言仍被强制（恢复一条旧断言恰好一项失败）。未签名可运行目录经全链构建——`build:official`、三个 release tarball、host pack、runtime/package-set/dsh 准备、electron-builder 终步——产出 980 MB `win-unpacked`（11,747 文件、逐文件 SHA-256 清单）；七动作旅程在产物上（而非开发服务器）重放，逐 run 采集进程树、`/json/version` 与 CDP 身份，单实例行为与 241/241 profile junction 验证且 target 目录保留。对本机拒绝未签名进程链创建 junction 与 DLL 命名文件写入的安全策略，产物 README 以环境事实记录，其自举绕过与产品自身 `applyRelease` 快路径字节等价。NSIS 仍缺件且未授权，安装器未构建；签名与发布保持 unsigned 路径行为（`publish: never`、无自动更新）。证据：[W06 FINDINGS](../../../../development/delivery-runs/B01/B01-20260919-01/W06/FINDINGS.md)、[W07 FINDINGS](../../../../development/delivery-runs/B01/B01-20260919-01/W07/FINDINGS.md)、[产物索引](../../../../development/delivery-runs/B01/B01-20260919-01/W07/artifact-index.md)。
