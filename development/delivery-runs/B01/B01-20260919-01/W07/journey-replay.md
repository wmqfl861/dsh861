# W07 journey-replay — 产物模式旅程（已执行，2026-09-19/20）

从**实际生成的未签名可运行目录**直接启动 `DeepSeek Harness.exe`（非开发服务器）重放
W06 旅程。每次运行均按 W06 journey.md 的 W07 承诺补采**进程树快照**与 **CDP
/json/version 原文**（logs/run-NN-proctree.txt、logs/run-NN-json-version.json）。
启动辅助 `C:\dsh-b01-w07\tools\launch-product.mjs`（测试独有 DSH_HOME + APPDATA 重定向）。

## 身份与环境（run 20/21c/22/23/24/25 的 /json/version 与实测）

| 项 | 值 |
|---|---|
| Electron | 44.3.0（UA `@deepseek-ai/dsh-desktop/0.1.5-rc.2 … Electron/44.3.0`） |
| Chromium / V8 | Chrome/152.0.7977.78 / 15.2.124.19（每 run /json/version 原文） |
| 内置 Node | `resources\runtime\node\node.exe --version` → v24.17.0（产物内实测） |
| pnpm / dsh | 12.4.1 / 0.1.5-rc.2（versions.json + desktop-runtime.json 实读） |
| 测试 home | C:\dsh-b01-w07\home（DSH_HOME 环境注入；APPDATA 重定向至 C:\dsh-b01-w07\appdata） |
| profile | home\profiles\desktop（241 junction → resources\dsh\node_modules；由受信进程以产品函数自举，见 FINDINGS F7） |

## 逐动作（对应 W06 七动作）

### A1 真实窗口 + 中文空态 —— 已验证（run 21c 起始态）
- 侧栏"新会话/工作区/b01-temp-project/设置"、空态"选择一个工作区开始"、预览版内测声明全中文。
- 文本转储 `21-app-state`（screenshots/，含 sha256 清单）。

### A2 打开临时项目 —— 已验证（经产品自身的 initial workspace selection）
- 临时项目 C:\dsh-b01-w07\workspace\b01-temp-project（本次创建，README 标记）。
- home\storages\workspace.json 登记（对 W06 bootstrap 同构注册表的等价预置；因 keyless
  seed 驱动在本机无法完成，见 FINDINGS F8）；run 21c 启动时产品自动完成 initial
  workspace selection 并创建首个会话（此前的路径损坏实例见 run-21b：真实失败显示，
  修复后成功）。顶栏显示 b01-temp-project，composer 激活，模型选择器显示
  **b01-preview/b01-preview-model**（测试层在产物内生效）。
- 原生目录对话框子路径维持 W06 结论（待人验），未重复尝试。
- 转储 `21c-workspace-open`。

### A3 keyless 任务流式+最终+Session 对应 —— 已验证（run 21c）
- 经真实 composer（CDP Input.insertText + Enter）发送 `B01-PREVIEW 测试任务：…`。
- UI：已思考 → 流式中文 → **B01-PREVIEW-FINAL-1789839131350** →"用时 1秒"、
  "1 轮 1 步·52 tok/s"；窗口标题变"B01 测试会话"（标题管线经同一 mock）。
- journal（state\model-journal.ndjson）：request-start(chat)+session-title → request-end。
- 真实 Session：`home\sessions\--C-dsh-b01-w07-workspace-b01-temp-project--\session-87bd3e7b…\session.v3.jsonl.zstd`
  （18,101 bytes，sha256 c970b2ef…）；逐 zstd 帧解码 **10 帧 28 条**记录
  （session/permission/sandbox/approval/spliced×4/turn×2/step×2/user×4/request×2/title×3/
  assistant×2/end×4）——任务文本、最终标记、慢任务 045/046 块均在记录中。
- 转储 `21c-task-result`；截图 `21c-final-transcript.png`。

### A4 保持运行任务 + 取消 + 自有子进程停止 —— 已验证（run 21c）
- 发送 B01-SLOW：journal 显示自有 node 子进程 **pid 76676**（state\slow-child.pid），
  `Get-Process` 实测存活；UI 流式递增（031…046，"深度求索中…"，46 秒时点）。
- 点击真实停止按钮（aria-label"停止生成"）：journal `request-abort(round=78)` +
  `child-killed(pid=76676)`；复测 `Get-Process`：**pid 76676 gone**。UI 呈现"已停止"。
- 截图（流式中）`21c-slow-streaming.png`。

### A5 关闭窗口 → Host 退出与句柄释放 —— 已验证（run 21c/22/23/24/25 各一次）
- CDP Browser.close（等价关窗）→ exe 退出码 0；每次复测 app 进程 0、dsh-desktop-host
  node 进程 0（无残留）。run-NN-proctree.txt 补采每次运行的完整进程树（8×
  DeepSeek Harness.exe 主+GPU/utility/renderer + resources\runtime\node 的 Host）。

### A6 重开同一测试 home 读取此前会话 —— 已验证（run 22）
- 同一 DSH_HOME 重启：侧栏"B01 测试会话"；转录完整恢复——B01-PREVIEW 回合
  （最终标记在列）与 B01-SLOW 回合（031…046）。转储 `22-reopened`；截图
  `22-reopened-transcript.png`（与 21c 终态逐像素一致，sha256 相同——状态一致的佐证）。

### A7 测试自有 backend 失败真实显示 —— 已验证（run 23 + run 20/21b 两次真实失败）
- 注入：测试自有 `home-error\.env` 写 bootstrap-only 名 `DSH_HOME`（产品 fail-loud 契约）。
- 结果：startup 页真实失败（中文恢复文案 + 真实错误
  `dsh desktop: C:\dsh-b01-w07\home-error\.env sets "DSH_HOME", which only the launching
  environment may set…`）。转储 `23-error-page`；截图 `23-error-page.png`。
- 附加真实失败样例：run 20（unsigned exe 的 junction EPERM，F7）与 run 21b（注册表
  路径损坏的 SessionCreateError）均以同一恢复页呈现真实错误，未冒充成功态。

## 重复启动 / 退出 / 自有 junction 清理（run 24 + 终态核验）

- **单实例**：第一实例存活（4 进程）时启动第二实例 → **1 秒内退出码 0**（拒绝
  requestSingleInstanceLock），第一实例不受影响（run-24b-second.log）。
- **junction 与 target 完整性**：全旅程后 profile 241 个 junction 全部
  `kind=junction matchesRecorded=true`（junction-after-journey.json）；resources\dsh
  抽样目标（cordis/dsh package.json）hash 前后一致。
- **只删自有 junction 不删 target**：以产品自身 `unlinkDesktopHostPackages` 执行移除 →
  **241 个 junction 全部消失（remaining=0）、抽样目标 hash 逐字节不变
  （targetsIntact=true）**，随后以 `linkDesktopHostPackages` 重建（241）保持测试 home
  可用（verify-junction-removal 运行记录在终端输出；工具留存 tools\）。
- 产物迁移至 C:\dsh-b01-w07\product\ 后重放一次（run 25）：同一 home 会话恢复、
  /json/version 与进程树补采、退出码 0、无残留——**最终位置的可运行性已验证**。

## 诚实边界

1. 原生目录对话框自动选择未尝试（W06 已留人验）；A2 经产品 initial workspace
   selection + 等价注册表预置验证。
2. 所有 UI 交互为 CDP 驱动的真实事件（trusted Input.insertText/dispatchMouseEvent/
   element.click）；截图为实帧；无产品内置测试后门。
3. profile bootstrap 的 junction 自举由受信进程以产品函数完成（F7 的本机安全策略
   所迫，字节等价于产品 applyRelease 路径）；该策略本身是本机环境事实，非产品缺陷。
4. keyless seed 驱动（W06 的 A2 前置）在本机无法完成（F8），故未预置种子会话；
   A2/A6 由产品自建会话覆盖（A6 的重开对象即 A3/A4 创建的真实会话）。
