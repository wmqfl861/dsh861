# W07 — 可分发 Windows 预览产物（00-start）

- 运行：B01-20260919-01，任务 W07（Desktop 实施者，W06 交接后继续持有 Desktop runtime 槽；
  heavy-build 锁独占——本机当前无其他重型任务在跑）。
- 仓库：C:\Albert\project\dsh861，分支 chore/latest-stable-upgrade-20260912，任务起始 HEAD
  16ae3047ddc3caf9302c188a200faee818986f61。
- 计划：formal-plan.v1.md §W07（L186-203）、D09（未签名目录须组合 `--unsigned --dir`）、
  §3 FILE_OWNERSHIP（W07 行：package-target.ts 等 W?；证据目录 E/W07）；
  WORK_PACKAGES.md W07 卡；PHASE_B01.md §5（不签名/不上传/不自动更新；安装未经授权不执行，
  状态分列）。
- W06 输入（只读复用）：apps/desktop/tests/fixtures/b01-preview-{model,launch}.mjs、
  b01-preview.cordis.patch.yml；W06 journey.md 的 W07 补采承诺（每次运行的进程树快照与
  CDP /json/version 原文）；C:\dsh-b01-w06\ 的 cdp-driver.mjs/proc-tree.ps1/check-procs.ps1 工具。

## 工具链（RUN_CONTEXT 登记双目录 PATH 前缀，实测）

| 项 | 值 | 实测 |
|---|---|---|
| Node（构建宿主） | C:\dsh-r24-upgrade-20260912-01\node-v26.8.2-win-x64（v26.8.2） | `--version` |
| pnpm | C:\dsh-r24-upgrade-20260912-01\pnpm-12.4.1（12.4.1） | `--version` |
| electron-builder | 26.15.3（仓库锁定 devDependency） | package.json 实读 |
| Electron dist | 44.3.0（W06 已物化，dist/version=44.3.0） | 实读 |
| Python | 3.12.10（本机既有） | `--version` |
| Visual C++ | VS 2022 BuildTools（VC.Tools.x86.x64，vswhere 实测） | vswhere |
| NSIS | 未核对到系统安装；electron-builder 缓存目录不存在（%LOCALAPPDATA%\electron-builder\Cache 缺） | ls |
| 磁盘 | C: 余 720 GB | df |

## 测试 app-id 登记（计划回退路径）

计划要求测试 app-id"由总控登记"；截至本任务开始，STATUS.run.json 与 W06 证据中无任何已登记
测试 app-id。按计划回退语义在本任务证据内登记一个测试用途标识，仅作为本次打包参数
（`DSH_DESKTOP_APP_ID`），请求总控在整合时确认：

- `DSH_DESKTOP_APP_ID=com.deepseek.dsh.b01-preview-test`（reverse-DNS 校验通过；
  明确标注 b01-preview-test，非官方生产标识；官方生产 appId 从不落仓库，由发布环境注入）。

## 命令（D09：--unsigned --dir 组合）

不新增脚本（apps/desktop/package.json 为冻结输入 R/F）：

```
pnpm --filter @deepseek-ai/dsh-desktop run package -- win-x64 --unsigned --dir
```

等价于 `tsx scripts/package-target.ts win-x64 --unsigned --dir`（pnpm `--` 透传）。
普通 `package:win:x64:dir` 不用——不带 --unsigned 会进入签名要求（D09）。
产物输出目录（electron-builder.config.mjs）：`apps/desktop/.desktop-build/targets/win-x64/unsigned-artifacts/`。

## raw 目录（仓库外，不入 Git）

C:\dsh-b01-w07\（logs/screenshots/tmp/state/home 等）。大件产物完成后迁移/复制至该根并记录
路径+SHA-256。

## 秘密与红线

不读取任何密钥/凭据/.env；不调用真实业务模型 API；不调用外部代理；不执行安装器；
不提交不推送；不跑全量 typecheck/lint。

## 后续

构建日志 → logs/；逐文件清单与 hash → artifact-index.md；旅程重放（含 W06 补采承诺的
进程树快照与 /json/version 原文）→ journey-replay.md；发现与缺件 → FINDINGS.md。

## 终态摘要（2026-09-20 01:50 终版；第一版 blocked 结论已被总控扩围修复推翻）

- **总控扩围登记后完成 F5/F4 修复并重跑成功**：可运行目录
  `C:\dsh-b01-w07\product\win-unpacked\`（980 MB / 11,747 文件，exe sha256 b6d76259…，
  manifest sha256 04e9f48d…）已构建，并从产物直接启动完成 W06 同用例七动作旅程、
  单实例、junction/target 完整性、迁移后终位置复验——**B01-A6：evidenced（本机）**。
  安装包未构建（NSIS 缺件 F6，按约束不下载）；签名/发布未做。
- 第一版"blocked_on_branch_defect"的取证（F5 smoke 期望已移除的 fs-ext）成为总控
  扩围依据；修复 diff（起始/终态 blob）、负控与回归见 FINDINGS 续节 + artifact-index.md。
- 新增环境事实 F7（本机安全软件按进程链授信：未签名链拒绝 junction/系统 DLL 名写入，
  统一解释全部历史 EPERM；处置均为调用层）与 F8（seed 驱动工具性障碍，A2/A6 以等价
  产品路径覆盖）。
- 秘密与红线：全程未读密钥/.env、未调真实模型 API、未调外部代理、未执行安装器、
  未提交未推送、未跑全量 typecheck/lint。仓库源码改动仅扩围登记的 5 个文件；
  node_modules 补丁已逐字节还原；产物与大件在仓库外。
