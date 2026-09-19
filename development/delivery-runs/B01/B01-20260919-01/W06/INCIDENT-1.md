# W06 事故记录 1 —— 测试 loader entry 进入共享 development project，挂真实客户端

状态：已撤销（总控）、已清理（进程）、已按批准方案返工。CP2 立即复核项。
记录时间：2026-09-19。

## 时间线（均为本任务实际动作）

1. 目标测试 5 spec / 25 tests 通过（logs/01-target-specs.log，EXIT=0）。
2. 仓库内无任何 Electron dist（pnpm 副本、兄弟项目均无 electron.exe）；以 electron 包自带 install.js 物化锁定 electron@44.3.0（C:\dsh-b01-w06\logs\electron-install.log，EXIT=0；dist\version=44.3.0）。
3. 启动尝试 1：launch helper APP_ROOT 层级错误，在产物校验处 EXIT=1 失败——**未重建 project、未复制 patch、未启动 Electron**。
4. 启动尝试 2（修复后）：`prepareDevelopmentProject` 重建 development project，随后把 `apps/desktop/tests/fixtures/b01-preview.cordis.patch.yml` 复制为 `C:\Albert\project\dsh861\apps\desktop\.desktop-build\development\project\cordis.patch.yml`（用户层），再启动 Electron（main pid 8644；Host node pid 29960，inspect 9230）。
5. 窗口停留在 startup.html（"正在启动 DeepSeek Harness…"）超过 3 分钟，Host 一直未 ready。
6. 总控通报：**用户真实客户端启动失败**，报 `dsh desktop: plugin tree failed to load: failed to apply loader entry include (cordis:include): failed to import loader entry b01-preview-model ... Cannot find package '@deepseek-ai/cosmokit' imported from C:\Albert\project\dsh861\node_modules\@deepseek-ai\cordis\lib\index.js`。
7. 立即停止：TaskStop 后台轮询；不再复制 patch、不再启动 Electron；冻结进程未杀。
8. **总控撤销**（2026-09-19 ~20:13-20:15）：删除该 cordis.patch.yml，development project 回到原始四文件状态；全盘确认无其他副本。
9. **进程清理**（2026-09-19T20:21-20:22+0800）：端口 9222/9230 复测均 False；`taskkill //PID 8644 //F` 与 `//PID 29960 //F` 均报"没有找到进程"——两个进程已在冻结期间自行退出（具体时刻不可考：Electron 日志在 DevTools 行后无更多输出）；Get-Process/Win32_Process 实时复核结论为**无任何 electron.exe、无任何 dsh-desktop-host node 残留**（复核输出为叙述性记录，产物未逐次留存；实存佐证为此后各 run 的 electron-stderr.log DevTools 行与 CP1 终态复测记录，W07 重放时补采进程树产物）。未对任何存活进程施加强杀；未触碰其他进程。
10. **返工**（总控批准 + 三条硬条件，见下），随后按收紧隔离继续 W06。
11. **返工后运行（06–11）**：06/08 两轮尝试经 UI"添加工作区"自动化原生对话框未成功（FINDINGS-F2）；期间 06 的对话框被真实用户操作（附录 A）。09–11 以收紧隔离完成七动作取证（journey.md）。全程真实客户端 development project 零写入（终态核验：仅原四项）。

## 附录 A —— run 06 期间的用户交互（第二次用户可见影响）

run 06 打开的原生"Select Workspace Directory"对话框停留于用户桌面约 1 分钟，被**真实用户**
操作并选择了其自己的 `C:\Users\Joyce Gu\Documents\dsh` 目录，随后用户关闭了应用窗口（干净退
出码 0）。后果：我的测试 home 的 workspace 注册表曾记录该路径（storages/workspace.json，
创建于 2026-09-19T12:52:39Z）。处置：该记录仅存在于测试自有 home；后续以重置测试 home（连同
种子方案）移除；**用户 Documents\dsh 目录本身从未被写入**（无任何工具调用落地该目录）。教训
已并入旅程方法：取证间隙最小化窗口、对话框操作限时完成。

## 根因

1. **隔离边界判错**：我把用户层 patch 装配进 development project（dev/start:desktop 的标准目录），误以为只有自己的启动会读取。该目录位于仓库内，任何从本 checkout 以开发模式启动的真实客户端都会重建/加载它——用户可见环境契约被破坏。
2. **fixture 裸包导入在 pnpm 严格布局下不可解析**：b01-preview-model.mjs `import { LlmAdapter } from '@deepseek-ai/dsh-llm'`，其传递运行时导入 `@deepseek-ai/cordis → cosmokit` 从该解析上下文不可达（root node_modules 的 cordis 副本缺相邻依赖）。预检只验证了 package.json 可解析，未验证传递运行时导入。
3. 我方桌面启动停滞与用户报错同源（同一 loader entry 导入失败），两边互为印证。

## 影响

- 用户真实客户端（从本仓库开发模式启动）无法启动，直至该 `cordis.patch.yml` 被总控移除（已移除）。
- 受影响文件仅一处用户层：`apps/desktop/.desktop-build/development/project/cordis.patch.yml`；同目录 package.json/pnpm-workspace.yaml/node_modules junction/desktop.cordis.yml 属 dev 流程标准重建产物（保留）。
- 测试自有面（C:\dsh-b01-w06\home 等）未被真实客户端读取；无全局/用户 profile 写入。

## 返工（已执行；总控三条硬条件逐条落实）

1. **fixture 零裸包导入**：b01-preview-model.mjs 不 import 任何 npm 包（仅 node: 内建），经宿主注入接口 `ctx.llm.registerAdapter` 注册纯对象适配器，自实现 `providerInfo/providerRetryPolicy/imageRequestPricing/listModels/resolveModel/prepareCall/stream`（复刻 LlmAdapter 基类默认 prepareCall 行为；prepareRoutes 实测无 instanceof 校验）；StreamChunk 仅结构化字面量。任何加载上下文都不再发生包解析。
2. **装配目标收紧为测试独有**：launch helper 建立测试 app 目录（C:\dsh-b01-w06\app：package.json main=lib/main.js + 仓库已构建 lib/renderer 的 junction），Electron app path 锚定该目录，development project 与 electron-user-data 全部落于 C:\dsh-b01-w06\；DSH_HOME/DSH_B01_PREVIEW_STATE 同前。**永不写 apps/desktop/.desktop-build/development/**——源码内 `assertOwned` 防呆断言：目标不在测试根下或命中仓库 development 目录即抛错。
3. **备份/恢复/清理**：装配前若目标存在非自有 cordis.patch.yml 先 rename 备份；Electron 退出（含启动失败路径）后删除自有 patch 与 fixture 副本并恢复备份。
4. **层默认惰性（纵深防御）**：patch 全部条目以 `DSH_B01_PREVIEW=1` 守卫（entry `disabled` 的 `!!js` 为仓库明文许可语义）；不带该环境变量的任何加载看到的层完全惰性（产品模型路由保持启用、默认模型保持产品值、测试插件条目禁用）。fixture 以 `./` 相对引用由 helper 复制的同目录副本，无跨树相对路径。
5. **真实客户端路径零改动核验**：返工后实测 `apps/desktop/.desktop-build/development/project` 仅含原四项（desktop.cordis.yml、node_modules、package.json、pnpm-workspace.yaml），无 cordis.patch.yml；journey 全部运行结束后再次核验并记录。

## CP2 复核项

- 用户可见环境契约破坏的发生、遏制、撤销与回归验证（本记录 + 总控撤销回执）。
- 防呆断言与惰性守卫的实际字节（fixture 三件套）。
