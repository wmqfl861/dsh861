# W06 — Windows 桌面实际启动与交互（00-start）

- 运行：B01-20260919-01，任务 W06（Desktop 实施者）。
- 仓库：C:\Albert\project\dsh861，分支 chore/latest-stable-upgrade-20260912，任务起始 HEAD
  f5ab2fed621988c559b1c7299a60562bba558e96（与 formal-plan FILE_OWNERSHIP 基准一致）；此后 HEAD
  因总控 CP-A 提交 8d0dc411（fix(ci): honor dpkg-deb field contract…）及其后续 16ae3047 前移，
  均非本任务所为。
- 计划：development/delivery-runs/B01/B01-20260919-01/plan/formal-plan.v1.md §W06（L164-184）、§3 表（L371-384）、D07/D08/D09。
- 工具链（RUN_CONTEXT 登记双目录 PATH 前缀）：
  - Node：C:\dsh-r24-upgrade-20260912-01\node-v26.8.2-win-x64\node.exe（v26.8.2，本机身份，D08）
  - pnpm：C:\dsh-r24-upgrade-20260912-01\pnpm-12.4.1\pnpm.exe（12.4.1）
  - vitest：直连 node_modules/vitest/vitest.mjs（r45 结论 A，不用 pnpm exec）
- raw 目录（仓库外）：C:\dsh-b01-w06\（logs/screenshots/tmp/home 等；不入 Git）。
- 资源占用：Desktop runtime 槽独占（W06→W07）；未触发重型构建（heavy-build 锁归总控）。
- 秘密：不读取任何密钥/凭据/.env；不调用真实业务模型 API；不调用外部代理。

## 现有目标测试（先跑）

`node node_modules/vitest/vitest.mjs run --project thread-safe` + 五个 spec：
backend-controller、host-process、host-protocol、development-project、runtime-file-policy。

- 结果：**5 files / 25 tests 全部通过，EXIT=0**（见 logs/01-target-specs.log；实际数量 9+8+3+2+3=25）。
- TMP/TEMP/TMPDIR 指向 C:\dsh-b01-w06\tmp\01-tests（自有）。
- 未修改 vitest include/exclude；五 spec 归属 root 配置 `thread-safe` 项目（apps/*/tests 匹配 testIncludes，非 processBound）。

## 预登记 fixture（FILE_OWNERSHIP N 路径）

- apps/desktop/tests/fixtures/b01-preview-model.mjs —— keyless 测试模型（标注 "B01 测试模式"）
- apps/desktop/tests/fixtures/b01-preview.cordis.patch.yml —— 测试 profile 配置（开发模式在 project 重建后、Host 启动前装配，D07）
- apps/desktop/tests/fixtures/b01-preview-launch.mjs —— 启动辅助：同一 dev 流程（准备 development project → 装配测试配置 → 启动同一个 Electron main）

## 后续

见 journey.md（逐动作证据）与 FINDINGS.md。

## 终态摘要（2026-09-19 21:35 更新）

- 目标测试：旅程前后各一次 5 files / 25 tests / EXIT=0（logs/01、logs/12）。
- 真实 Electron 44.3.0 完成七动作取证（journey.md §1）：窗口/中文空态、临时项目打开
  （workspace bootstrap 路径；原生对话框子路径留人验 FINDINGS-F2）、keyless 任务流式+最终+
  会话日志对应（11 帧 29 条记录）、取消+自有子进程终止（pid 33848）、关窗→Host 全退（EXIT=0、
  进程/端口复核全清，复核叙述见 journey §A5）、重开读取同一会话、测试自有 backend 失败真实
  显示（中文）。B01-A5 维持 partial：6/7 动作程序验证，动作 2 原生对话框子路径待人验。
- 事故与返工：见 INCIDENT-1.md（用户层 loader entry 误入共享 development project → 总控撤销 →
  进程清理 → 零导入 fixture + env 守卫 + 测试独有 app 目录 + 防呆/备份恢复；含附录 A 第二次
  用户交互影响）。
- 修改：仅三个预登记 N 路径 fixture 新增；无既有源码修改（W? 登记路径起始 blob 不变）。
- raw 证据根：C:\dsh-b01-w06\（截图/日志/工具/测试 home；manifest 哈希已入 screenshots/）。
- 桌面会话日志：session-608e96dc… 18011 bytes sha256
  457004de605e1fb7a10f40b88500710f6b3e72756261e43510a1317e9c2c2f59；
  种子会话 main-session-2d681568… 22480 bytes sha256
  d135b685d01566a89ff7e2ac8ebbbe1944392c33c69470cfc8dc59b031631f68。
- 退出与清理：runs 09/10/11 均由本任务关闭并核验全清（无残留 electron.exe / dsh-desktop-host
  node；9222/9230 释放）；仓库工作树除 W06 证据与三个 fixture 外无改动。
