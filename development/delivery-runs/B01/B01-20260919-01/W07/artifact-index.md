# W07 artifact-index — 产物与构建状态索引（终版）

**结论：未签名可运行目录已构建并在本机完成旅程验证；安装包未构建（NSIS 缺件 F6）；
签名/发布未做（按计划）。** 产物在仓库外本地路径，不入 Git，无远端下载渠道（不编造 URL）。

## 可运行目录（已构建 + 已验证）

| 项 | 值 |
|---|---|
| 位置 | `C:\dsh-b01-w07\product\win-unpacked\`（980 MB） |
| 入口 | `DeepSeek Harness.exe`（246,070,272 bytes） |
| exe sha256 | `b6d7625969315d3d94183e1b5a0248fedf3c4ad7db886fd228ae90c23e539062` |
| app.asar sha256 | `d75e200154ba1f8d95695335938abf0fd456d8b987349abd9a6f26b8f0eb110c`（2,367,812 bytes） |
| 逐文件清单 | `C:\dsh-b01-w07\product\win-unpacked.manifest.tsv`（11,747 文件：相对路径/bytes/sha256；副本在 W07/logs/） |
| manifest sha256 | `04e9f48d4096c5903fa51d49bdd62a549bc82973b9a6ee71993b6eab5dbb0d7c` |
| exe 元数据 | FileDescription/ProductName "DeepSeek Harness"，FileVersion 0.1.5-rc.2，ProductVersion 0.1.5.0 |
| 运行时 | resources\runtime（Node 24.17.0 + pnpm 12.4.1，versions.json sha256 66926c90…） |
| dsh 资源 | resources\dsh（release 0.1.5-rc.2，hostProtocolVersion 3，241 sharedPackages；desktop-runtime.json） |
| 追加件 | builder-debug.yml（electron-builder 配置转储）；README.txt |

## 构建身份

| 项 | 值 |
|---|---|
| 源码 | 仓库 @ HEAD 16ae3047ddc3caf9302c188a200faee818986f61 + 本任务 W07 修复（见下 diff 表；未提交） |
| 命令 | D09 组合 `--unsigned --dir`：package-target 全链至 prepare:dsh；electron-builder 终步以项目相同 argv/env 直跑（F7 受信链，见 FINDINGS） |
| Node/pnpm | 宿主 v26.8.2 / pnpm 12.4.1（工具链；npm_execpath 指向 workspace pnpm.mjs，F1） |
| electron-builder | 26.15.3（锁定 devDependency）；Electron 44.3.0 |
| 测试 app-id | `DSH_DESKTOP_APP_ID=com.deepseek.dsh.b01-preview-test`（总控已确认） |
| publish | never；无自动更新配置；无 release completion record（--unsigned 路径源码确认 + builder-debug.yml） |

## 源码修复 diff（W07 扩围登记文件；起始/终态 blob）

| 文件 | 起始 blob（=formal-plan 基准） | 终态 blob | 内容 |
|---|---|---|---|
| apps/desktop/tests/fixtures/runtime-payload-smoke.mjs | da2d5c478dc0dbbf428b7177c4da9ff629d432e5 | c63d674fd9dab3318a581914890e1952e73c4ac0 | checkFsExt → checkSystemFlockGate（flock 入口在 runtime 内可解析 + win32 平台门 ERR_FLOCK_UNSUPPORTED_PLATFORM）；摘要字段 fsExt→flockGate |
| apps/desktop/scripts/runtime-file-policy.ts | 9e6722009dfe03f4744b33f983b2cbbdcdc4bc12 | abc13e931167ff348f833bfe12fc6d119737303d | 删除 fs-ext 编译产物/构建配置排除规则（死代码） |
| apps/desktop/tests/runtime-file-policy.spec.ts | 837fd54bf1cff1bf3b834a7ebf3fa522183824c4 | 265700f61f424e38822209ad04b7eaf9beb2f25a | 事实修正：fs-ext fixture 改中性 native-sample（保持通用保留语义）+ node-pty 容器外规则作用域断言 |
| apps/desktop/src/project-manager.ts | a91c6af6b2fb5a1172b9850f33e65dae0e6a6983 | acf4591fa09819ae67f2aa64ba7c9c33bbbfb516 | 生成 workspace 的 allowBuilds 删除 `fs-ext: true`（死授权） |
| apps/desktop/scripts/prepare-runtime.ts | 1b22293c23d04ed30b5c9a791335e801c2d403d3 | 90803d5f1904914e773000e836600a5bcb2caced | F4：`require.resolve('pnpm')` → `require.resolve('pnpm/package.json')`（pnpm 12 无 main/exports；node_modules 补丁已撤销恢复原字节） |

- 证据化与负控：残留清单与承接验证见 FINDINGS F5 节；NC-A 注入旧 fs-ext 断言 →
  runtime-file-policy.spec 1 failed → 恢复后 3 passed（终端记录）。
- 目标回归：runtime-file-policy / project-manager / plugin-manager / plugin-pnpm /
  profile-packages = **5 files / 39 tests / EXIT=0**。

## 状态分列（PHASE_B01 §5）

| 项 | 状态 |
|---|---|
| 已构建（可运行目录） | **是**（上表） |
| 可运行目录已验证 | **是**（journey-replay.md：七动作 + 单实例 + junction/target + 最终位置 run 25） |
| 安装包已构建 | **否**（NSIS 缺件 F6；按约束不下载） |
| 安装未验证 | 不适用（无安装包；安装未经授权本就不执行） |
| 签名未做 / 发布未做 | 是（无 EV 签名、无自动更新托管、无 COS 上传） |

## 仓库外证据与工具（C:\dsh-b01-w07\，不入 Git）

logs\（build-attempt1-6、run-20/21b/21c/22/23/24a/24b/25 全部启动日志、每 run
json/version 原文与进程树、manifest-summary）；screenshots\（实帧 + 文本转储，
哈希见 W07/screenshots/MANIFEST-sha256.txt）；state\（model-journal.ndjson、
slow-child.pid、junction-after-journey.json）；product\（产物 + manifest + README）；
tools\（launch-product/cdp-driver/proc-tree/window-op/prepare-product-profile/
verify-junction-removal/junction-snapshot/send-composer/mouse-click/select-workspace/
decode-session/build-manifest/seed-driver/debug 工具与 fd-slicer shim）；node24\、
bin\tar.exe、tmp\（备份与复现物）。关键件已复制入 W07/logs、W07/screenshots。
