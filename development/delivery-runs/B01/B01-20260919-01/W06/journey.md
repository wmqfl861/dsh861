# W06 — 实际 Electron 窗口与隔离任务流程（journey）

真实 Electron 交互取证记录。启动方式见 00-start.md 与 INCIDENT-1.md（事故后收紧为
测试独有 app 目录）。所有命令、退出码、进程快照的原始记录在仓库外
`C:\dsh-b01-w06\logs\`（关键件已复制入本目录 logs/）；截图哈希见 screenshots/MANIFEST-sha256.txt。

## 0. 程序与环境身份

| 项 | 值 | 证据 |
|---|---|---|
| Electron | 44.3.0（npm 依赖锁定版；`electron.exe --version` → v44.3.0；UA `Electron/44.3.0`） | logs/electron-install.log、CDP /json/version |
| Chromium / V8 | Chrome/152.0.7977.78 / 15.2.124.19 | CDP /json/version |
| 桌面包版本 | @deepseek-ai/dsh-desktop 0.1.5-rc.2（源码 e8d1858-dirty 构建产物） | 窗口标题/内嵌 UI 文本 |
| 宿主 Node（开发身份，D08） | C:\dsh-r24-upgrade-20260912-01\node-v26.8.2-win-x64\node.exe（v26.8.2） | 03-proctree-after-boot.txt |
| Electron dist 来源 | 仓库 pnpm 副本无 dist；以 electron 包自带 install.js 物化锁定 44.3.0（网络下载，非系统工具安装） | logs/electron-install.log EXIT=0 |
| 测试 app 目录 | C:\dsh-b01-w06\app（package.json main=lib/main.js + 仓库已构建 lib/renderer 的 junction） | helper 输出（09-electron-stdout.log） |
| 测试 Harness home | C:\dsh-b01-w06\home（run 11 错误注入用 C:\dsh-b01-w06\home-error） | 同上 |
| development project | C:\dsh-b01-w06\app\.desktop-build\development\project（每次启动由 prepareDevelopmentProject 重建；D07） | 同上 |
| 真实客户端路径 | apps/desktop/.desktop-build/development/project 全程零写入（防呆断言 + 前后核验：仅原四项） | INCIDENT-1.md §返工-5 |

Electron 进程树（叙述性记录，boot 后取样，run 03）：electron.exe main + gpu/utility/renderer
子进程 + Host `node.exe --inspect=127.0.0.1:9230 …dsh-desktop-host\lib\index.js`。该次快照文件
未留存（当时的枚举脚本过滤器匹配失败产出空文件，已删除）；实存证据为 logs/07、08-dialog-tree.txt
（Host 派生的对话框 worker 进程树）、各 run 的 electron-stderr.log（`Debugger listening on
ws://127.0.0.1:9229`、`DevTools listening on ws://127.0.0.1:9222/devtools/browser/…`——renderer
调试端点与 CDP /json/version 输出同源）、electron dist/version（44.3.0）实测输出，以及 CP1
终态复测记录。**W07 重放本旅程时将补采每次运行的进程树快照与 CDP /json/version 原文产物。**

## 1. 逐动作验收

### A1 显示真实窗口和中文空态 —— 已验证
- OS 级窗口枚举：`hwnd=… title=正在启动 DeepSeek Harness…`、`title=DSH 本地构建`（Win32 EnumWindows 真实句柄）。
- 空会话 home 下 UI 全中文：侧栏"新会话/工作区/设置"、会话区"暂无会话"、空态"选择一个工作区开始"。
- 截图：`2026-09-19T12-51-42-366Z-06-empty-state.png`、`…13-00-37-727Z-07-empty-state.png`（sha256 见 manifest）。

### A2 打开本次创建的临时项目 —— 已验证（经产品自身 bootstrap）
- 临时项目：`C:\dsh-b01-w06\workspace\b01-temp-project`（本次创建，含 README 标记）。
- 种子：仓库自有 keyless headless driver（cli-mock 模型，真实工具回合）从该目录以测试 home
  预置一条真实会话（EXIT=0；logs/09-seed-stdout.log 末行 `"CLI tool round trip complete: CLI_TOOL_ROUND_TRIP"`）。
- 桌面启动后 WorkspaceRegistry 完成一次性 bootstrap，注册表
  `home/storages/workspace.json` 记录 `path=C:\dsh-b01-w06\workspace\b01-temp-project`；
  UI 侧栏出现工作区 b01-temp-project 与种子会话，模型选择器显示"当前 b01-preview/b01-preview-model"。
- 截图：`…13-16-23-568Z-09-workspace-open.png`。
- 说明：UI 原生"添加工作区"路径（Win32 IFileOpenDialog）已实际打开并枚举出完整控件树
  （logs/07-dialog-tree.txt、08-dialog-tree.txt），但自动化输入路径未成功（多次手段记录于
  FINDINGS-F2）；本动作改由产品自身的 workspace bootstrap 完成，原生对话框行为留待人验。

### A3 发起固定 keyless 测试任务，流式及最终结果，与真实 Session 对应 —— 已验证
- 输入 `B01-PREVIEW 测试任务：请流式输出并给出最终标记。`（CDP 驱动真实 composer：focus +
  execCommand insertText + InputEvent + Enter 键盘事件）。
- 模型 journal（logs/model-journal.ndjson）：`request-start(chat)` → `request-finish(final, marker=B01-PREVIEW-FINAL-1789823843078)` → `request-end`；另有 `purpose=session-title` 一次（标题管线经同一 mock）。
- UI（文本转储 `…13-17-26-152Z-09-task-sent2.txt`）：用户消息 → "已思考"（reasoning 块）→ 流式
  中文文本 → 最终标记 → "用时 1秒"、"1 轮 1 步·53 tok/s 78 tok"；会话标题"B01 测试会话"。
- 真实 Session 对应：`home/sessions/--C-dsh-b01-w06-workspace-b01-temp-project--/session-608e96dc-…/session.v3.jsonl.zstd`
  （18011 bytes，sha256 457004de…）逐 zstd 帧解码（11 帧全部成功）共 **29 条**记录：
  session×1、permission/preset×1、sandbox/mode×1、approval/policy×1、agent/inbox/spliced×4、
  turn/start×2、step/start×2、system/message×1、**user/message×4**（seq8 = B01-PREVIEW 任务文本；
  seq9 = 运行时上下文快照；seq10 = system-reminder 技能清单；seq23 = **一条**含两次
  "B01-SLOW"字样的同一消息文本）、request/header×1、request/context×1、session/title×2、
  session/title-llm-request×1、assistant/message×2、step/end×2、turn/end×2、
  session/end-seed×1（seq27，末条）。最终标记在 assistant/message 中。
- 截图：`…13-23-18-728Z-09-task-final.png`。

### A4 可保持运行的测试任务 + 取消 + 自有子进程停止 —— 已验证
- 发送 `B01-SLOW …`：journal `child-spawn pid=33848`（自有 node 子进程，PID 写 state/slow-child.pid）；
  `tasklist /FI "PID eq 33848"` 实测存活；UI 流式递增（001…020…，"深度搜索中…"，19 秒时点）。
- 截图（流式中）：`…13-25-33-719Z-09-slow-streaming.png`。
- 点击真实停止按钮（aria-label"停止生成"）：journal `request-abort(round=37)` + `child-killed(pid=33848)`；
  复测 `tasklist`："没有运行的任务匹配指定标准"——子进程确认终止。
- UI 呈现"已停止 用时 37秒"。
- 截图：`…13-25-56-836Z-09-after-cancel.png`。

### A5 关闭窗口，等待 Host 退出和句柄释放 —— 已验证
- 对真实窗口 WM_CLOSE（等价用户关窗）：window-all-closed → before-quit → backend.close() →
  Host 优雅停止 → Electron 退出码 0（logs/09-electron-stdout.log 末行 `electron exited code=0`、`EXIT=0`）。
- 进程/端口复核为逐次实时执行的叙述性记录（Win32_Process/Get-Process 查询 electron.exe 与
  dsh-desktop-host node、CDP 端口连通），结论为"无残留、9222/9230 释放"；该复核输出未逐次
  保存为产物（run 03 的快照文件因脚本过滤缺陷为空、已删除），实存佐证见 §0 所列与 CP1 终态
  复测记录。W07 重放时补采（见 §0 注）。

### A6 重开同一测试 home，读取此前会话及结果 —— 已验证
- 同一 DSH_HOME 重新启动（run 10）：会话列表显示"B01 测试会话（4分钟）"与种子会话（14分钟）；
  转录完整恢复：B01-PREVIEW 回合（最终标记在列）与 B01-SLOW 回合（001…037 + "已停止 用时 37秒"）；
  统计"2 轮 2 步"。
- 文本转储 `…13-29-51-188Z-10-reopened.txt`；截图 `…13-30-16-343Z-10-reopened-transcript.png`。

### A7 注入测试自有 backend 失败，显示真实失败 —— 已验证
- 注入方式：测试自有 `home-error/.env` 写入 bootstrap-only 名 `DSH_HOME`（产品 fail-loud 契约）。
- 结果：Host 启动即败，startup 页显示真实失败（非 ready/成功态）：
  中文文案"DeepSeek Harness 无法启动…"（含恢复建议与"关闭并重启"操作）+
  真实错误 `dsh desktop: C:\dsh-b01-w06\home-error\.env sets "DSH_HOME", which only the launching
  environment may set …`。
- 截图：`…13-31-15-739Z-11-error-page.png`；转储见 logs/11 相关记录。
- 关闭后进程全清。

## 2. 诚实边界（不冒称亲自完成的事）

1. **原生目录对话框自动选择未成功**（FINDINGS-F2）：对话框真实打开、控件树完整取证，但把路径
   写入"文件夹"字段并确认的自动化（UIA Value/SetFocus/clickable-point/raw-walk、地址栏
   Ctrl+L、SetForegroundWindow+SendKeys 多手段）均未生效；该步待人验。A2 由 workspace
   bootstrap 路径替代验证。
2. UI 交互均为 CDP 驱动的真实 DOM/键盘事件（element.click / execCommand / KeyboardEvent /
   真实 Win32 停止按钮点击），非产品内置测试后门；截图均为 Page.captureScreenshot 实帧。
3. run 06 期间，打开的原生对话框被**真实用户**操作，选了用户自己的 `C:\Users\Joyce Gu\Documents\dsh`
   并因此在我的测试 home 留下工作区记录（INCIDENT-1 附录）；该工作区已随测试 home 重置移除，
   用户目录本身从未被写入。

综上：B01-A5 维持 **partial**（CP1 结论）——七动作中 6 个完整程序验证，动作 2 的原生对话框
子路径留人验（已由产品 workspace bootstrap 路径等效验证打开临时项目）。
