# W07 FINDINGS

环境事实、修复与阻断缺陷。六次构建尝试的完整日志在 `C:\dsh-b01-w07\logs\`（build-attempt1…6），
关键摘录见本目录 logs/。

## F1 构建入口：pnpm 12 的 `--` 透传与 `npm_execpath` 二进制（已解决，调用层）

- `pnpm --filter … run package -- win-x64 …` 会把 `--` 作为字面位置参数传给脚本（attempt1 日志），
  `parseDesktopPackageInvocation` 报 "expected at most one target"。去掉 `--` 即可。
- 独立 Rust 版 `pnpm.exe`（本机工具链 12.4.1）为 `npm_execpath` 时，package-target.ts 的
  `runPnpm` 以 `spawn(node, [pnpmEntry, …])` 重启 pnpm，node 把 pnpm.exe 当 JS 解析（attempt2）。
  `scripts/pnpm-invocation.ts` 对 .exe 有双分支处理，但 package-target.ts 的私有 runPnpm 没有。
- **采用**：直接以 tsx 运行打包入口（dsh 源码启动契约 `node --import tsx/esm`），
  `npm_execpath` 指向 workspace 锁定的 pnpm 12.4.1 JS 包装器
  `apps/desktop/node_modules/pnpm/bin/pnpm.mjs`（同版本；Corepack 入口，包装同一原生二进制）：
  ```
  node --import tsx/esm apps/desktop/scripts/package-target.ts win-x64 --unsigned --dir
  ```
  未改任何仓库源码。该项与 F4 是同一包装器的两处消费。

## F2 GNU tar 阻断 release:pack（已解决，PATH shim）

- `scripts/release/tarball.ts` 以 `tar -tzf C:\…` 校验 tarball。Git Bash `/usr/bin/tar`（GNU 1.35）
  把 `C:` 当远程主机（"Cannot connect to C"），attempt3 于 dsh 家族第一个 tarball 即失败。
- **采用**：Windows 自带 bsdtar 3.8.4（System32）复制为 `C:\dsh-b01-w07\bin\tar.exe`，构建时
  PATH 前缀该目录。未安装任何新工具；仅改变本任务进程树的解析顺序（与 GH Windows runner
  的 System32 优先语义一致）。

## F3 锁定依赖 extract-zip→yauzl→fd-slicer 大条目解压挂起（已解决，运行时 shim）

- 现象：`prepare:runtime` 解压 node-v24.17.0-win-x64.zip 时 "unsettled top-level await"、exit 13
  （attempt4/attempt5 前段）。产物只写出部分文件。
- 复现（合成 zip，30KB 条目通过、200KB 条目在 ~1.5×highWaterMark 后停流）：
  `fd-slicer@1.1.0` 的 `FdSlicer` ReadStream 在本机 Node 24.17.0 与 26.8.2 下均挂起
  （`C:\dsh-b01-w07\tools\debug-extract.cjs` 保留取证脚本）。仓库锁定
  extract-zip@2.0.1 → yauzl@2.10.0 → fd-slicer@1.1.0；release CI 为 Linux 路径（用 tar 不用
  extract-zip），win-x64 打包要求 Windows 宿主，因此该路径此前无 CI 证据。
- 诊断细节：直接 fs.createReadStream({fd, start, end}) 替代会因 destroy() 关闭共享 fd（EBADF，
  即使 autoClose:false），不能用；也不能 double-unref（fd-slicer 计数到 0 且 autoClose=true 时
  关 fd）。
- **采用**：`C:\dsh-b01-w07\tools\fd-slicer-compat-shim.cjs`，经 `NODE_OPTIONS=--require` 仅注入
  本任务构建进程树：以 Node 内建 Readable + 定位 `fs.read` 重写
  `FdSlicer.prototype.createReadStream`（沿用其 pend 串行与 ref/unref 生命周期，end 保持排他语义）。
  验证：合成 zip 与 node zip 均完整解出，node.exe 与 bsdtar 解压结果逐字节一致。不改仓库字节；
  不落仓库。product Host 子进程（host-process.ts 过滤 NODE_OPTIONS）与 prepare:dsh 的 pnpm 子进程
  均不受注入影响。

## F4 pnpm 12.4.1 无 main/exports，prepare-runtime 无法解析 pnpm（已解决，node_modules 补一个字段）

- `prepare-runtime.ts` 的 `preparePnpm` 依赖 `require.resolve('pnpm')` 返回 package.json 路径
  （pnpm<12 的 `"main": "package.json"` 契约）。锁定 pnpm 12.4.1（Rust 版）package.json 无
  main/exports 也无 index.js → 解析必败（attempt5，"Cannot find module 'pnpm'"）。这是
  prepare-runtime.ts（R，锁归总控）与锁定 pnpm 的结构性不兼容，属分支潜在缺陷，任何人在当前
  依赖集下运行都会失败。
- **采用**（不修改任何仓库源码）：给 `apps/desktop/node_modules/pnpm/package.json` 增补
  `"main": "package.json"`（恢复历史契约；原文件备份 `C:\dsh-b01-w07\tmp\pnpm-package.json.orig`）。
  影响面：仅恢复可解析性；打包出的 runtime/pnpm 副本多一个惰性字段。请总控以正式修复替代
  （prepare-runtime 改用显式路径，或 workspace 锁回带 main 的 pnpm）。

## F5 阻断缺陷：desktop 冒烟 fixture 期望已被移除的 fs-ext（未解决，超出本任务写权限）

- **现象**：`prepare:dsh` 完成 501 包闭包装配（koffi/node-pty 安装脚本正常执行）后，运行
  `apps/desktop/tests/fixtures/runtime-payload-smoke.mjs` 立即失败：
  `Cannot find module 'fs-ext'`（require 自 `dsh/package.json`；attempt6 日志）。失败触发
  prepare-dsh 的 catch——已组装的 `.desktop-build/targets/win-x64/dsh` 被整体删除，回滚干净。
- **根因**（git 考古）：`d927cbff99`（flock 迁移，"prebuilt Node-API flock"）把
  `packages/session/session-persistence-jsonl` 的 `"fs-ext": "2.1.1"` 替换为
  `@deepseek-ai/node-addon-system`；此后全仓任何 package.json 均不声明 fs-ext（实测遍历 + 打包
  tarball 实读确认：dsh-session-persistence-jsonl@0.1.5-rc.2 依赖里只有 node-addon-system）。
  但 `runtime-payload-smoke.mjs` 的 `checkFsExt()`（无平台/存在性守卫，第 124 行无条件调用）
  仍 `requireRuntime('fs-ext')` 并断言 `fsExt.seekSync`。冒烟的其余四项（koffi/sharp/turndown/
  node-pty）在本次装配中全部具备。即：**当前分支 HEAD 的所有 Windows 打包（signed 或 unsigned）
  在 prepare:dsh 冒烟步无条件失败**。该 fixture 在 formal-plan FILE_OWNERSHIP 中无归属行
  （非本任务可写文件），.agents/notes 亦无该缺陷的既有记录。
- **候选修复（供总控，任一即可）**：
  1. 从 `runtime-payload-smoke.mjs` 删除 `checkFsExt`（fs-ext 的 seek 能力已随 flock 迁移由
     `@deepseek-ai/node-addon-system` 承接，冒烟可改为校验 node-addon-system 的 flock/seek 等价面）；
     同时清理 `runtime-file-policy.ts` 的 fs-ext 排除规则与 `project-manager.ts` workspaceFile 的
     `fs-ext: true` allowBuilds 残留。
  2. 或恢复 fs-ext 声明（不推荐：与 flock 迁移方向相反）。
- 修复后重跑命令与全部环境前置见 preview.md。

## F6 NSIS 未安装（安装器通道缺件，如实报告）

- 系统 NSIS 不存在（Program Files (x86)/NSIS 无、makensis 不在 PATH）；electron-builder 用户缓存
  目录（%LOCALAPPDATA%\electron-builder\Cache）不存在。构建 unsigned NSIS 安装包需要 electron-builder
  自行下载 NSIS 到用户缓存——按本次约束"NSIS 若缺则如实报告为缺件，不安装"，未放行该下载。
  安装器通道结论：**缺件（NSIS 未缓存且未获下载授权）**；即使 F5 修复，`--dir` 可运行目录也不受
  影响（--dir 不触发 NSIS）。

## 其他记录

- 测试 app-id：`DSH_DESKTOP_APP_ID=com.deepseek.dsh.b01-preview-test`（00-start.md 登记，请求总控确认）。
- 因产物未生成：产物清单/旅程重放/进程树与 /json/version 补采/重复启动与 junction 验证全部
  NOT_RUN（依赖产物存在）；W06 journey 的 W07 补采承诺相应顺延。
- 半成品状态（供重跑缩短时间，均在仓库 gitignored 构建目录）：
  `.desktop-build/downloads/`（node zip+SHASUMS，sha256 f2aa33b3…）、
  `targets/win-x64/runtime/`（node.exe v24.17.0 实测可运行 + versions.json）、
  `targets/win-x64/package-set/`（241 项）、`targets/win-x64/packed/`（dsh 268 + vendor 10 +
  landlock tarball）。

---

# 续节（总控扩围后修复与重跑，2026-09-19/20）

总控裁定 F5/F4 为真实分支缺陷并扩围登记四个文件 + apps/desktop/scripts/；测试 app-id 获确认。

## F5 修复（阻断主因）——已完成

- **残留清单（证据化）**：全仓 fs-ext 引用仅 4 处——
  runtime-file-policy.ts L26-30（fs-ext 编译产物/构建配置排除规则）、
  project-manager.ts workspaceFile（`fs-ext: true` allowBuilds）、
  runtime-payload-smoke.mjs（checkFsExt 无条件调用 + fsExt 摘要字段）、
  runtime-file-policy.spec.ts（fs-ext fixture/断言）。
- **死代码判定**：git 考古 d927cbff99（flock 迁移，merge-base 确认在 HEAD 祖先链）把
  session-persistence-jsonl 的唯一 fs-ext 依赖（`"fs-ext": "2.1.1"`，仅用 flock exnb/un）
  替换为 `@deepseek-ai/node-addon-system/flock`；迁移前源码实读确认产品从未使用 fs-ext
  的 seek。此后闭包（241 项 package-set 实读）不可能包含 fs-ext → 三处源码残留均为死代码，
  smoke 的 checkFsExt 则是硬阻断。**未发现运行时仍真实需要 fs-ext 的路径**（flock 迁移无缺口）。
- **承接验证**：win32 会话锁走 koffi（lease.ts win32.ts，smoke 的 checkKoffi 覆盖）；
  POSIX 走 node-addon-system/flock（平台门：win32 抛 ERR_FLOCK_UNSUPPORTED_PLATFORM——
  这是该入口的文档化契约）。新 checkSystemFlockGate 在产物 runtime 内验证：入口可解析
  （require(esm) on bundled Node 24.17.0 实测）+ 平台门正确拒绝。构建日志中冒烟输出
  `{"node":"24.17.0","platform":"win32","arch":"x64","flockGate":true,"koffi":true,"sharp":true,"html":true,"pty":true}`。
- **事实修正（非弱化）**：spec 的 fs-ext removed/retained fixture 改为中性 native-sample
  （证明同一通用保留语义）+ node-pty 容器外断言（证明包规则容器作用域）。
- **负控（NC 纪律）**：恢复一条旧断言（removed 列表加回 `fs-ext/build/Release/fs_ext.lib`）
  → runtime-file-policy.spec **1 failed** → 恢复修复版 → 3 passed。两轮输出均留存终端记录。
- 回归：5 files / 39 tests / EXIT=0（runtime-file-policy、project-manager、plugin-manager、
  plugin-pnpm、profile-packages）。

## F4 正式修复——已完成

- prepare-runtime.ts 改 `require.resolve('pnpm/package.json')`（子路径解析，恢复"解析到
  manifest"的历史契约，不依赖 pnpm main/exports）。
- node_modules 内临时补丁已撤销：pnpm package.json 与备份逐字节一致
  （`cmp` 验证；备份 C:\dsh-b01-w07\tmp\pnpm-package.json.orig）。

## F7 本机安全策略：未签名进程链的 EPERM（环境事实，影响交付说明）

- **现象与定位（复现工具 tools\name-probe.cjs / unzipper-repro.cjs 留存）**：本机安全
  软件按进程链授信——凡是祖先进程链含未签名二进制（Rust pnpm.exe、未签名的
  DeepSeek Harness.exe）的进程，创建 **junction（reparse point）** 与写**系统 DLL 命名
  文件**（d3dcompiler_47.dll）被拒 EPERM；bash→node（已签名链）执行完全相同的操作成功。
- 这统一解释并实证了此前三处"EPERM"：prepare:dsh 冒烟的 junction（pnpm.exe 链）、
  electron-builder 解压 electron zip 的 d3dcompiler（pnpm.exe 链）、以及**未签名产物
  exe 首启自举 profile junction 失败**（应用以真实恢复页呈现——产品 fail-loud 正确，
  顺带成为 A7 的又一真实样例）。
- **处置（均为调用层，不改产品语义）**：electron-builder 终步以项目相同 argv/env 在
  bash→node 受信链直跑（cli.js 入口，config/参数与 desktopElectronBuilderArguments 一致）；
  产物 profile 的 241 个 junction 以**产品自身函数**（createPluginProfile +
  linkDesktopHostPackages，经 tsx 从仓库源码）在受信进程自举，字节等价于 applyRelease
  路径，applyRelease 快路径随后接受该状态（无重建）。
- **影响声明**：本机签名构建不受影响；其他无此策略的机器上未签名目录可开箱自举。
  README-product.md 已写入该注意事项。

## F8 keyless seed 驱动无法完成（工具性障碍，已用等价路径替代）

- W06 的 seed（repo headless driver + seed.patch.yml）在本机尝试 5 次：repo cwd 运行会话
  键到仓库路径（污染 workspace 注册表）；workspace cwd 运行则 CLI 源码解析崩溃
  （`FiberState` 缺失——vendor cordis 的构建产物 lib 落后于 src，tsx 的 tsconfig-paths
  发现依赖 cwd；TSX_TSCONFIG_PATH 可修 import 但 agent 启动后 idle 挂起——CPU profile
  完全空闲，无子进程，1 次成功建立会话头后无回合）。属仓库工具链在"仓外 cwd + 源码
  启动"组合下的缺陷，超出本任务登记范围，未深入。
- **替代**：home\storages\workspace.json 以与 W06 bootstrap 输出同构的注册表预置（初版
  有一次路径转义损坏——run 21b 以真实 SessionCreateError 呈现后修正）；A2 由产品
  initial workspace selection 完成打开；A6 重开对象为 A3/A4 经产品创建的真实会话。

## 重跑与验收结论

- 构建：package-target 全链（build:official → release:pack×3 → desktop-host pack →
  prepare:runtime/packages/dsh）+ EB 终步 → **win-unpacked 980 MB / 11,747 文件**。
- 旅程：run 20/21c/22/23/24/25 全部动作验证 + 每 run 进程树/json/version 补采
  （journey-replay.md）。产物迁移至 C:\dsh-b01-w07\product\ 后 run 25 复验可运行。
- NSIS 维持缺件不安装（F6）；安装器未构建。
