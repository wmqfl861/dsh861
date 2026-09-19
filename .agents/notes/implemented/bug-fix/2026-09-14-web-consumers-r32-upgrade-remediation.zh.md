# Agent Note: 依赖大版本升级后的 Web 消费者失败

Status: implemented

[English](2026-09-14-web-consumers-r32-upgrade-remediation.md) | 中文

## 问题

依赖大版本升级（Lexical 0.50、zod 4.6.2、jsdom 30、js-yaml 5、React 19）后，六个 Web 浏览器消费者测试文件失败。四个相互独立的根因，均对照留存的首失日志定因：

1. `built-boot.expected.e2e.ts`——jsdom 30 不再把 camelCase 属性值选择器（`svg[viewBox="…"]`）匹配到 foreign-namespace 元素上，品牌图查找落空。
2. `agent-preset-authoring` golden——js-yaml 5.4.2 把损坏 YAML 的诊断措辞改为 "deficient indentation (3:1)"（4.3.1 为 "unexpected end of the stream within a flow collection (3:1)"）。golden 单行更新；Windows 本机的 `{{presetRoot}}\my-agent` 分隔符差异保持不归一化（CI 在 Linux 上比对）。
3. `lifecycle-chrome.e2e.ts` IME 用例——composer 内两处缺陷相互作用。(a) `claim-decor.ts` 用 `splitText` 切分已着色 token，而 `splitText` 会把样式复制到每一部分；溢出半段带着 `TOKEN_STYLE`，Lexical 文本归一化把等样式的两半合并回去，transform 再切分，循环以 Lexical 错误 #14 收场——即上游 Discussion #6052 报告的"claim 后接续输入（尤其 IME）"问题。(b) Lexical 0.50 只在提交后的模型文本不同于"DOM 文本减组合填充字符"时才重写组合 TextNode 的 DOM；Chromium insertText 提交路径上剥离填充后的文本已与模型相等，U+200B 填充滞留 DOM，静默吞掉下一个 Backspace。
4. `preview-boot.e2e.ts`——三层。静态主机 `respond()` 把 URL 路径过 `path.normalize`，win32 上把 `/` 变成 `\`，所有生成覆盖物（镜像、夹具、manifest）404。越过该层后，zod 4.6.2 经 `import` 条件提供 ESM dist；worker transform 把具名导入降低为急切的顶层 `const local = held[name]` 读取，zod 的 core/util 循环使全部 loader entry 抛出 "Cannot access 'globalConfig' before initialization"。再越过后，default 导入互操作访问器是不带括号的调用表达式，`new X()` 被降低成构造 helper 结果的形式（"__dsh$default is not a constructor"，preset "standard" 挂载失败）。

`queue-actions.e2e.ts`（仅 CI 的 "Minified React error #185"）与 `sidebar-scrollbar.e2e.ts`（仅 CI 的 thumb/hover 透明）本机从未复现：queue-actions 连续四次全过（含 CI 并行形态合跑），sidebar-scrollbar 7/7。queue-actions 第二用例在 claim 的 `/goal` 后接续输入，正是驱动 claim transform 循环的输入；循环每次 flush 的 draft 更新即 React `setState`——慢速 CI 机器在 Lexical 的 100 轮 transform 护栏之前先触发 React 嵌套更新上限。sidebar-scrollbar 的 thumb token 在列静默时解析为透明，两个用例继承了 `beforeAll` 停留的指针，满载 runner 上用例间的 linger 过期使读数落在静默态。

## 决策

每个缺陷在其拥有者处修复并钉住行为：品牌查找改为对所有 `svg` 元素经 `getAttribute` 读取精确 `viewBox`；golden 承载新诊断措辞；`claim-decor.ts` 在 `splitText` 后清除溢出半段的 `TOKEN_STYLE`（两半样式不同后归一化无法合并）；composer 的 compositionend 处理器在"DOM 文本恰为模型文本加一个填充字符（U+200B 或 U+00A0）"时重写 DOM，以模型相等为护栏，compositionend 先于提交输入的引擎不受影响；`respond()` 以原始正斜杠 URL 路径查覆盖物并把磁盘路径限制在 `dist/` 之内；worker transform 通过改写用点、经被 require 模块的 exports 读取来保持具名与 default 导入绑定的活性——带遮蔽跟踪（函数 var 提升、块/循环/catch/switch 作用域）、shorthand 属性展开、ESM 提升的前奏 require、带括号的 default 访问器——并记录为 `dsh-worker-transform/2`；两个 sidebar 用例在用例内部以真实指针移动建立自己的已揭示 thumb。未删除断言、未过滤错误、未只延长超时。

## 考虑过的替代方案

**在测试驱动层容忍填充以修 IME 用例。** 滞留填充是产品可见状态（每次 IME 提交后第一个 Backspace 无效），不是测试误读；容忍后缀的比较器无法区分 DOM 填充与模型泄漏。

**直接改写 DOM 以剥除组合填充。** 该文本节点归 Lexical 所有；在模型相等护栏下经 `markDirty` 强制 reconcile 是 Lexical 提供的缝。

**命名空间导入同样保持活性。** 已交付图中没有经命名空间导入触达的循环；恒等稳定的惰性命名空间在 CommonJS 体内不可表达。保持急切快照，写入模块文档与 README。

**为 preset golden 增加路径分隔符归一化。** CI 在 Linux 比对并通过；归一化将认证 Windows 分隔符而非 golden 内容。

## 后果

六文件合跑本机 32/33（五个文件全绿；剩余差异为已记录的 Windows 分隔符伪差）。回归：两条 headless claim 用例（ASCII 与 CJK 增量输入断言 token 着色、溢出无样式、无 #14）、15 条新 transform 用例（项目计数 270→300；循环求值、遮蔽、shorthand、提升引用、re-export 访问器、构造优先级），此前 transform 用例与 packer image-loadable 套件保持全绿，每条 IME 用例保留中文输入、退格、placeholder 与 claim 断言。composer 变更在每次 compositionend 增加一次对编辑器文本节点的 TreeWalker 遍历。queue-actions 的 #185 归因与 sidebar-scrollbar 的 CI 行为仍待 CI 确认；两文件现已通过本机 CI 形态并行合跑。证据与首失日志：`development/remediation/2026-09-14/web-consumers-r32/`。
