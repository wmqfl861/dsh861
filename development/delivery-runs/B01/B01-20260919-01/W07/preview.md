# W07 preview — 可分发 Windows 预览产物状态（终版）

- 运行：B01-20260919-01 / W07；构建源码 HEAD 16ae3047 + 本任务修复（diff 见 artifact-index.md）。
- **总结论：未签名可运行目录已构建并在本机完成与 W06 同用例的产物模式旅程验证；
  安装包未构建（NSIS 缺件）；签名/发布未做（按计划）。**

## 交付状态分列（PHASE_B01 §5）

| 项 | 状态 |
|---|---|
| 已构建（可运行目录） | 是：C:\dsh-b01-w07\product\win-unpacked\（980 MB / 11,747 文件；exe sha256 b6d76259…；manifest sha256 04e9f48d…） |
| 可运行目录已验证 | 是（journey-replay.md：A1–A7 七动作 + 单实例 + junction/target 完整性 + 迁移后终位置复验 run 25） |
| 安装包已构建 | 否——NSIS 缺件（系统与 electron-builder 缓存均无；按约束不下载安装） |
| 安装未验证 | 不适用（无安装包；安装未经授权本就不执行） |
| 签名未做 | 是（appId 为测试标识 com.deepseek.dsh.b01-preview-test，总控已确认；无 EV 签名） |
| 发布未做 | 是（publish never、无更新 origin、无 COS 上传、无 release completion record） |

## 本轮修复（总控扩围后）

1. **F5**：smoke 的 checkFsExt（期望已被 flock 迁移移除的 fs-ext）→ checkSystemFlockGate；
   runtime-file-policy / project-manager / 对应 spec 的 fs-ext 死代码清理与事实修正；
   NC 负控（旧断言注入必失败）+ 5 files/39 tests 回归。残留证据化与承接验证见 FINDINGS 续节。
2. **F4**：prepare-runtime pnpm 解析正式修复（pnpm/package.json 子路径）；node_modules
   临时补丁撤销（逐字节还原）。
3. 重跑构建（F1–F3 环境解法复用；electron-builder 终步按 F7 受信链直跑，argv/env 与
   项目命令一致）→ 产物生成 → 全部验收执行。

## 使用与限制

见 **README-product.md**（同目录；副本 C:\dsh-b01-w07\product\README.txt）：启动方法、
数据位置、已知限制（未签名/本机 junction 策略 F7/无更新/测试模型守卫）、清理测试数据。

## B01-A6 判定

**evidenced（本机）**：可运行目录存在（文件名/bytes/hash/构建身份齐备）、直接运行验证
（内置 Node 24.17.0/pnpm 12.4.1/dsh 0.1.5-rc.2 身份核验、七动作旅程、单实例、junction
只删自有不删 target、隔离 home）——A6 的最低可交付形式（已验证的可运行目录）已满足并
超额（含每 run 进程树与 /json/version 补采，兑现 W06 承诺）。安装包一栏按计划保持
"未构建/缺件"，不影响 A6 判定（安装状态单列）。签名/发布明确未做，不冒称。

## NOT_RUN（如实）

- 安装器构建与安装验收（NSIS 缺件 + 无安装授权）。
- 原生目录对话框自动选择（W06 已留人验；本轮未重复尝试）。
- keyless seed 驱动（F8 工具性障碍；A2/A6 以等价产品路径覆盖）。
- COS 上传/自动更新（按计划不在范围）。
