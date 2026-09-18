# Agent Note: headless subagent expected 套件按 header 身份选择日志

Status: implemented

[English](2026-09-18-session-log-identity-r45.md) | 中文

## 问题

两个 assembled-app 的 subagent 套件按枚举的偶然顺序选择持久化 Session 日志。`subagent-diagnostic.expected.e2e.ts` 用对 `'"subagent-diagnostic-parent"'` 的全文包含 find 挑出"父日志"；`subagent-inheritance.expected.e2e.ts` 对父日志做同样的全文查找，而 child 只要求首记录的 `parentSession` 是任意字符串。被委派 child 的 header 在自己的 `parentSession` 字段里携带父 id，无关 Session 也可能在事件正文里引用父 id，于是 `readdir` 先列出哪份日志，哪份就成了"父日志"。r44-B 提交的 consumers CI 运行（run 35359781644）正是在这里让两个套件失败：diagnostic 的"父日志"其实是 child 日志，inheritance 把同一份 child 日志同时对照两份 golden。目录枚举顺序在任何地方都不是契约，这两个套件一直在对任意文件做断言。

## 决策

测试专用模块 `apps/cli/tests/profiles/headless/tests/session-log-identity.ts` 按首条 JSONL 记录的持久身份选择日志。`sessionLogIdentity` 校验一份日志的首记录——合法 JSON 对象、`type: 'session'`、字符串 `id`——并按来源名拒绝畸形记录而不是跳过，因为被跳过的日志可能悄悄藏起父日志或重复父日志。`selectSessionLogById` 要求恰好一份日志断言目标 id：零匹配（只在 child header 或事件正文里被引用的 Session）与重复匹配（两份日志声称同一 Session id）都带着来源清单失败。`selectDirectSubagentChild` 要求恰好一个候选断言确切的 `parentSession`、与父不同的自身 `id`、以及 `origin: 'subagent'`；固定的 `childId`（diagnostic fixture 播种的 child）也必须被断言。选择返回原始日志字节与它的 header，不重写、不改变任何日志的身份。两个套件的 `inspect` 都调用这些选择器并消费返回的内容；inheritance 额外断言 child 的文件与 id 都不同于父，diagnostic 通过固定 id 核对播种 child 的对应关系。确定性回归 `session-log-identity.spec.ts` 覆盖父、其 child、仅引用会话、另一父的 child 四份日志的全部 24 种枚举顺序，外加仅引用拒绝、重复与缺失父、畸形首记录（非法 JSON、非 session type、缺 id）、兄弟/孙会话/无 origin 干扰项、重复直接 child、header 字段顺序与 CRLF 容忍及原始字节返回、输入不变性。两个负控只突变 helper——恢复旧的全文 first-find 父选择使 6 项回归失败（含 child 在前顺序与仅引用两项），恢复任意 `parentSession` 字符串 child 选择使 8 项失败（含另一父 child 排在前的情况）——每个突变体都按字节恢复（SHA-256 复核），spec 回到 15/15。

## 考虑过的替代方案

**复用 JSONL 持久化的 header 编解码器。** 生产的 `parseHeaderRecord`/`isHeaderLine` 未导出，而 `scanLog` 会重新校验每一行事件，header 选择将开始因与它无关的事件正文失败；首记录身份读取就是全部所需。

**按目录或文件名选择。** 文件名是 `encodeSegment` 路径转义后的 Session id，属于某个持久化后端的编码细节；选择应依赖格式定义为身份的记录，而不是后端可能改动的名字拼写。

**在原地把 `find` 加固（例如跳过 header 带 `parentSession` 的日志）。** 这仍然让选择依赖顺序——重复父、仅引用日志或第二个 child 还是解析到"排在最前的那个"——失败只是搬家而不是消失。

**选择前先给文件列表排序。** 排序让某个幸运顺序变得确定，但仍按包含选择；任何排在前面的干扰项（或排序无法区分的重复项）依旧误导。

## 后果

两个套件的全部业务断言逐字保留：descriptor-less 冷 child、`[diagnostic: corrupt]` 包含、父 golden、最终父结果与空 stderr；`inherited.txt` 物理不存在、child 首记录的 read-only `source: 'delegation'`、两份 policy context 及全部正反文本检查、两份 golden、真实 write 拒绝、最终父结果。未刷新任何 golden（从未设置 `DSH_SNAPSHOT=refresh`），未改任何生产包。同样的全文选择形态仍留在 `headless.expected.e2e.ts` 中，本轮刻意不动：本轮范围就是两个失败套件，整仓替换需要独立轮次。两项本地 Windows 环境发现作为首失保留、不在本轮修复：在规范的 `pnpm exec vitest` 包装下，assembled app 的 profile node_modules 安装等待包装自身 pnpm 进程持有的锁，两个套件都以 30 秒零输出超时，而直接调用 Vitest 能完整运行；`normalizeSessionSnapshots` 不对嵌入 workspace-write 政策文本的 Windows 反斜杠 cwd 做令牌化，diagnostic 套件的父 golden 比较在选择成功之后于 `{{cwd}}` 上本地失败——无空格 ASCII TMP 也不能改变它。两项在 CI（POSIX 临时路径、无 pnpm-exec 父进程）才是权威。证据：[windows-execution/FINDINGS.md](../../../../development/remediation/2026-09-18/session-log-identity-r45/windows-execution/FINDINGS.md)。
