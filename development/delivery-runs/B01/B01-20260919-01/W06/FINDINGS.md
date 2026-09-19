# W06 FINDINGS

## 环境缺件与补齐

- **F1 Electron dist 缺失（已物化）**：仓库 pnpm 副本 `electron@44.3.0` 无 `dist/`（postinstall
  从未运行），全盘（兄弟项目、用户缓存）无 44.3.0 二进制；用户缓存仅 v42.1.0（弃用，避免版本
  混装）。以 electron 包自带 install.js 从官方源物化锁定 44.3.0（npm 依赖工件，非系统工具、
  非重型构建）。物化细节（install.js 本身成功时静默，故 logs/electron-install.log 仅 9 字节
  "EXIT=0"——这是真实输出而非缺件）：命令
  `node install.js`，cwd=仓库 `.pnpm/electron@44.3.0_supports-color@9.4.0/node_modules/electron`，
  下载约 2 分钟后 EXIT=0；产物核验（均为事后实测读取）：`dist/electron.exe` 存在、
  `dist/version` 内容 `44.3.0`、`path.txt` 内容 `electron.exe`、
  `electron.exe --version` 输出 `v44.3.0`；用户缓存新增目录
  `~/AppData/Local/electron/Cache/f9c7436ab4a2c1ed6ac6cea2902187de75bd5b7a60c0973ad8967c318a6313c3`；
  解锁后 CDP /json/version 的 User-Agent 亦含 `Electron/44.3.0`。完整性由包自带
  checksums.json 在 install.js 内校验。W07 打包所需 NSIS/7-Zip 等未核对，属 W07。
- **F2 原生目录对话框无法自动输入路径（未解决，留人验）**：桌面"添加工作区"唯一路径是
  Win32 IFileOpenDialog（标题 "Select Workspace Directory"）。对话框可真实打开且 UIA 可见
  （完整控件树见 logs/07-dialog-tree.txt、08-dialog-tree.txt：文件夹字段为虚拟化 Pane id=1152，
  确认为 Pane id=1 "选择文件夹"/id=2 "取消"，均不暴露 Value/Invoke 模式）。尝试并失败的手段：
  UIA ValuePattern（首 Edit 实为搜索框，一次写入搜索视图造成视图污染）、SetFocus（"目标元素
  无法接收焦点"）、GetClickablePoint+mouse_event、RawViewWalker（1152 下无 Edit）、地址栏
  Ctrl+L、SetForegroundWindow+SendKeys 直打。改由 workspace bootstrap 路径完成 A2。
- **F3 spawn 的 electron.exe 可能早退（launcher handoff）**：run 03 中被 spawn 的 electron.exe
  在应用树仍存活时以 0 退出（其后 4 个 electron.exe + Host node 仍在）——Windows 下 npm electron
  包的启动器让渡行为。因此 launch helper 的退出码不总反映应用生命周期；退出验证一律用进程树
  轮询（本任务已如此执行）。helper 已加 ref'd keepalive 修正"未等待即退"缺陷。
- **F4 窗口会被真实用户关闭**：run 04/06 的可见窗口在 1–5 分钟内被干净关闭（退出码 0、无诊断
  输出；run 06 且有用户操作原生对话框的直接证据）。缓解：取证间隙最小化窗口（最小化期间实例
  存活 12+ 分钟）；截图时短时 foreground（Chromium 对遮挡/最小化窗口会挂起
  Page.captureScreenshot，必须前台后截图）。

## 产品观察（本场景内，非缺陷登记）

- **O1** 用户层 patch 的 `!!js` 三元表达式中 `? ` 会被 YAML 解析为显式键（"object-based map
  does not support complex keys"）——产品 fail-loud 正确显示于 startup 页（中文文案 + 真实
  错误），无空指针/静默；fixture 改为无空格三元后正常。（已用于 A7 的等价证据之一）
- **O2** 会话日志为逐记录 zstd 帧（session.v3.jsonl.zstd）；单次 `zstdDecompressSync` 只解首帧，
  完整读取需按 magic 0xFD2FB528 分帧（本任务日志实测 11 帧 → 29 条记录；首版文本误计 28 系
  扫描漏末帧末条 session/end-seed，已在 CP1 复核后修正）。
- **O3** 桌面会话事件为写后缓冲，回合进行中与退出后均完整落盘（11 帧 29 条记录含两回合、标题
  生成、权限/沙箱/审批策略事件与末条 session/end-seed）；"model-visible ⟺ logged" 契约在本场
  景成立。
- **O4** 同一 eval 内 insertText+Enter 存在 React 状态竞态（消息入列但回合未启动、composer 未
  清空）；两步序列（输入事件提交后再发 Enter）稳定。属测试驱动手段问题，非产品缺陷。

## 修改清单（全部在 FILE_OWNERSHIP 登记 N 路径内）

仅新增三个预登记 fixture，**未修改任何既有源码**（所有 W? 登记路径保持起始 blob）：

1. `apps/desktop/tests/fixtures/b01-preview-model.mjs` —— 零裸包导入 keyless mock 适配器。
2. `apps/desktop/tests/fixtures/b01-preview.cordis.patch.yml` —— DSH_B01_PREVIEW 守卫的测试层。
3. `apps/desktop/tests/fixtures/b01-preview-launch.mjs` —— 测试独有 app 目录启动辅助
   （assertOwned 防呆：拒绝测试根外路径与仓库 development 目录；装配前备份、退出清理/恢复）。

仓库外测试工具（不入 Git）：C:\dsh-b01-w06\{cdp-driver.mjs,main-realm.mjs,*.ps1,run-*.sh,
seed.patch.yml}。

## 回归

- 五个目标 spec 旅程前后各一次：**5 files / 25 tests / EXIT=0**（logs/01-target-specs.log、
  logs/12-target-specs-regression.log）。未改 vitest include/exclude；thread-safe 项目直连
  node_modules/vitest/vitest.mjs；自有 TMP。
- 未做任何关键生命周期改动，故无新增生命周期回归需求。

## A5（B01-A5）状态

| # | 动作 | 状态 | 关键证据 |
|---|---|---|---|
| 1 | 真实窗口 + 中文空态 | 验证 | 窗口句柄/标题枚举；06/07 空态截图 |
| 2 | 打开本次创建的临时项目 | 验证（bootstrap 路径）；原生对话框选择待人验 | workspace.json 路径记录；09-workspace-open.png；dialog-tree |
| 3 | keyless 任务流式+最终+Session 对应 | 验证 | journal final 标记；09-task-final.png；11 帧 29 条会话记录含标记 |
| 4 | 保持运行任务 + 取消 + 子进程停止 | 验证 | 停止生成按钮；journal child-killed pid 33848；tasklist 复核 |
| 5 | 关闭窗口 → Host 退出 | 验证 | WM_CLOSE → EXIT=0；进程/端口全清 |
| 6 | 重开读取同一会话 | 验证 | 10-reopened-transcript.png；转录含最终标记与"已停止" |
| 7 | 测试自有 backend 失败真实显示 | 验证 | 11-error-page.png；真实错误文案 |

结论：B01-A5 维持 **partial**（CP1 结论）：七动作中 6 个完整程序验证，动作 2 的原生对话框
子路径留人验（已由产品 bootstrap 路径等效验证打开临时项目）。STATUS.run.json 的 B01-A5 状态值
由总控维护更新。
