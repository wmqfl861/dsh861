# r32 — 六个 Web 浏览器消费者失败：证据索引

仓库 `wmqfl861/dsh861`，分支 `chore/latest-stable-upgrade-20260912`，源码基线 `12d8132d9bd2ed3f28cfe46008ee80b81e06d27f`，日期 2026-09-14。本目录 `logs/` 按序留存首失、复现、定因与复测。工具链 Node 26.8.2 + pnpm 12.4.1（`C:\dsh-r24-upgrade-20260912-01` 显式 PATH），DSH_SNAPSHOT=replay，真实 Chromium。

## 文件 → 根因 → 修复 → 证据

| # | 文件 | 首失 | 根因 | 修复（拥有者） | 复测 |
|---|------|------|------|----------------|------|
| 1 | apps/web/tests/built-boot.expected.e2e.ts | logs/01（1 failed/2） | jsdom 30 不再把 camelCase 属性值选择器匹配到 svg；品牌查找落空 | `findSvgByViewBox()`：遍历 svg 以 `getAttribute` 比较精确 viewBox；official/默认两分支对称，品牌与互斥断言保留 | logs/02（2/2） |
| 2 | apps/web/tests/expected/agent-preset-authoring/damaged.expected.md | logs/03（2 failed/7） | js-yaml 4.3.1→5.4.2 诊断措辞变化（"unexpected end of the stream within a flow collection (3:1)"→"deficient indentation (3:1)"）；同输入以已装 5.4.2 复现 | golden 单行更新 | logs/04（6/7；唯一剩余为 Windows 本机 `{{presetRoot}}\my-agent` 分隔符伪差，CI Linux 通过——按交接不动 golden、不加归一化） |
| 3 | apps/web/tests/queue-actions.e2e.ts | CI-only "Minified React error #185"；本机不复现 | 归因（未获 CI 栈）：CI 无 web 矩阵日志——r30 run34799140559 consumers 归档仅 4 条 smoke 门（stdout 10 行、stderr 空），本地无 gh（红线不装/不索取）。机制：第二用例在 claim 的 `/goal` 后接续文本，驱动 claim-decor transform 死循环（见 #4a），每 flush 的 draft 更新即 React setState，慢速 CI 先触发 React 嵌套更新上限（#185）再触 Lexical 100 轮护栏（#14） | 随 #4a 的 claim-decor 修复 | logs/05（3 连跑全过）+ logs/31（CI 并行形态 3/3；共 4 次全过）。最终确认待 CI |
| 4 | apps/web/tests/lifecycle-chrome.e2e.ts | logs/06（4 failed/13，全为 IME） | 两处：(a) claim-decor `splitText` 把 TOKEN_STYLE 复制到溢出半段→Lexical 归一化合并→transform 再分裂→死循环（Lexical #14；与上游 deepseek-harness Discussion #6052 一致，0.49 即存在）；(b) Lexical 0.50 提交路径在 model==DOM−U+200B 时不重写 DOM→填充滞留、吞首个 Backspace（logs/07：事件轨迹+2.5s 滞留采样+codepoint；IME 事件序 input(isComposing)→compositionend） | (a) `packages/client/ui-conversation/src/client/input/editor/claim-decor.ts`：溢出半段清样式；(b) 同包 `keymap.ts`：compositionend 时对"DOM==模型+一个填充字符(U+200B/U+00A0)"的 TextNode markDirty 重写（模型相等护栏，Firefox/Safari 时序安全）；回归：lexical-editor-core.client.spec 2 条（ASCII+CJK） | logs/13（13/13）；合跑 logs/31 同 |
| 5 | apps/web/tests/preview-boot.e2e.ts | logs/14（image 404→503） | 三层：(i) 测试 `respond()` 以 `path.normalize` 处理 URL 路径，win32 把 `/`→`\`，overrides 键全失配→镜像/夹具/manifest 全 404；(ii) zod 4.6.2 经 import 条件提供 ESM dist，worker transform 把具名导入降低为急切 const 读取，core/util 循环 TDZ "Cannot access 'globalConfig' before initialization"（logs/15/16 console 全量透视）；(iii) default 互操作访问器不带括号，`new X()` 构造了 helper 结果 "__dsh$default is not a constructor"→preset standard 挂载失败→session/create 失败→客户端停在工作区选择器（logs/23/25 RPC 线透视） | (i) `apps/web/tests/preview-boot.e2e.ts`：键用原始 URL 路径、磁盘路径 normalize+dist 逃逸防护；(ii)+(iii) `packages/experimental/webworker-runtime/src/compile/transform.ts`：具名/default 导入绑定用点惰性读取（遮蔽跟踪、shorthand 展开、ESM 提升前奏 require、default 访问器带括号），LOWERING_VERSION→`dsh-worker-transform/2`；回归：transform.spec 新增 15 条用例（项目计数 270→300；循环/遮蔽/构造等）+ packer image-loadable 26/26 | logs/27、logs/28（1/1，透视已还原后干净复跑） |
| 6 | apps/web/tests/sidebar-scrollbar.e2e.ts | 本机不复现（logs/29：7/7） | CI 机制（无 CI 日志，按断言语义定因）：静默态 `--dsh-scrollbar-thumb` 解析为透明（golden 的 quietThumb 即证）；两用例继承 beforeAll 停留指针，满载 CI 上用例间 linger 过期→hover==token 失败（即"thumb/hover 透明"） | `apps/web/tests/sidebar-scrollbar.e2e.ts`：新增 `revealThumb()` 每用例真实指针前置（away→poll 静默→list→poll 揭示）；无指针隐藏/离开短暂保留/滚动不揭示/主题差异/稳定 gutter 断言全部保留 | logs/30（7/7）；合跑 logs/31 同 |

## 合跑与门禁

- 六文件 CI 并行形态合跑（--fileParallelism --maxWorkers=4）：logs/31，32/33，五个文件全绿，唯一失败为 #2 的 Windows 分隔符伪差。
- 官方构建：logs/00（前代理）与 logs/08/11/20（本代理三轮，均 244 artifacts、record official）。
- 定向单测：logs/12（claim 回归 52/52）、17/18/26（transform 300/300）、19（packer 26/26）、35（合计 378/378）。
- typecheck：logs/32/33（tsc -b client/host 均 0；注：直接 tsc -b 曾向 src/ 发射 500 个编译残渣，已精确清除，未触碰 lib/ 与 dist/）。lint：logs/34（触面文件 0 warning 0 error）。
- 诊断中临时透视（console/http/ws/RPC 钩子、zz-* 测试）均已还原/删除；`git diff` 仅含真修复。

## 未闭合项

1. agent-preset-authoring 的 Windows 分隔符伪差：本机必然失败、CI Linux 通过；按交接不动 golden、不加归一化。
2. queue-actions #185 与 sidebar-scrollbar 的 CI 行为：本机不可复现；归因与加固已入库，最终确认待提交后的 CI run。
3. transform 的命名空间导入仍为急切快照（无已交付图触达该边界）；模块文档与 README 已注明。
