# W07 README — 未签名 Windows 预览目录（DeepSeek Harness 0.1.5-rc.2 B01 测试构建）

- 产物：`C:\dsh-b01-w07\product\win-unpacked\`（11,747 文件，980 MB；manifest
  `C:\dsh-b01-w07\product\win-unpacked.manifest.tsv`，manifest sha256
  `04e9f48d4096c5903fa51d49bdd62a549bc82973b9a6ee71993b6eab5dbb0d7c`）。
- 这是**未签名测试构建**（`--unsigned --dir`，D09 路径），appId 为测试标识
  `com.deepseek.dsh.b01-preview-test`；无 EV 签名、无自动更新、无 COS 上传；
  未构建安装包（NSIS 缺件，见 FINDINGS F6）。桌面不是完整公司控制台。

## 启动

- 直接运行 `C:\dsh-b01-w07\product\win-unpacked\DeepSeek Harness.exe`。
- 如需测试隔离（推荐）：先设 `DSH_HOME` 与 `APPDATA` 指向测试目录再启动，例如
  ```bat
  set DSH_HOME=C:\dsh-b01-w07\home
  set APPDATA=C:\dsh-b01-w07\appdata
  "C:\dsh-b01-w07\product\win-unpacked\DeepSeek Harness.exe"
  ```
- 本机安全策略注意（FINDINGS F7）：本机安全软件拒绝**未签名进程**创建 junction；
  首次在新 home 启动时应用自举 profile（`<home>\profiles\desktop` 的 241 个 junction）
  会失败并显示恢复页。`C:\dsh-b01-w07\home` 已由受信进程用产品自身函数完成自举，
  可直接使用；换新 home 需以受信进程运行 `C:\dsh-b01-w07\tools\prepare-product-profile.mjs`
  （cwd=仓库根、工具链 node）。常规无此策略的机器不受影响。
- 调试端口：启动参数 `--remote-debugging-port=9222`。

## 数据位置（本测试装配）

| 数据 | 位置 |
|---|---|
| 测试 Harness home（会话/工作区注册表/Desktop profile） | `C:\dsh-b01-w07\home` |
| Electron userData（窗口状态/单实例锁） | `C:\dsh-b01-w07\appdata`（APPDATA 重定向） |
| 测试工作区 | `C:\dsh-b01-w07\workspace\b01-temp-project` |
| keyless 测试模型 journal / 慢任务子进程 pid | `C:\dsh-b01-w07\state` |
| 测试 profile 层（B01 测试模式，DSH_B01_PREVIEW=1 守卫） | `C:\dsh-b01-w07\home\profiles\desktop\cordis.patch.yml`（+ b01-preview-model.mjs） |

## 已知限制

1. 未签名：SmartScreen/杀软可能告警；本机还会触发 F7 的 junction 限制。
2. keyless 测试模型（b01-preview）仅在上述 profile 层 + `DSH_B01_PREVIEW=1` 时生效；
   不带该环境变量时层完全惰性（llm-deepseek/web-search-deepseek 保持启用、默认模型
   保持产品值）。它不访问网络、不读凭据；不声称真实模型端到端可用。
3. 无自动更新（publish: never、无更新 origin）；安装包未构建。
4. 版本：Electron 44.3.0 / Chromium 152.0.7977.78 / 内置 Node 24.17.0 / pnpm 12.4.1 /
   dsh-desktop 0.1.5-rc.2（`resources\dsh\desktop-runtime.json`）。

## 清理测试数据

删除以下目录即清除本预览的全部测试痕迹（不影响真实用户目录与 `~/.dsh`）：
`C:\dsh-b01-w07\`（home/appdata/workspace/state/logs/screenshots/product/tools）。
仓库内构建中间态在 `apps\desktop\.desktop-build\`（gitignored），可整目录删除。
