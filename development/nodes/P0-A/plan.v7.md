以下是供 ZCode 保存的 `development/nodes/P0-A/plan.v7.md` 正文。本轮只读核对了限定源码、直接依赖、既有计划和失败日志，未写文件、运行产品或测试，也未启动其他模型调用。

**P0-A v7：站点检查的成本归属与真实输出测试粒度修订。** 本修订叠加于 v1–v6，仅处理本节点的站点检查失败；`P0A-01` 至 `P0A-09`、需求映射、既有工作保护及最终硬审要求不变。当前状态为待实施、待验证，不能据此标记节点通过。

1. 实施范围明确扩展到以下文件。未列出的既有文件不获得新增修改权限；v6 已完成的 `doc-standard.spec.ts` 修复及其证据保留。

| 永久文件 | 允许修改的内容 |
|---|---|
| `scripts/project-doc-site.spec.ts` | Git 路径发现、真实 manifest 分步落盘与链接验证、下述回归用例及局部 cleanup |
| `scripts/project-doc-site.ts` | 将现有投影循环提取为同步迭代器；保留同步完整投影入口及全部投影规则 |
| `scripts/verify-doc-site-fragments.ts` | 每次检查复用一个 HTML 解析环境，只保留验证所需字段，并关闭环境 |
| `scripts/verify-doc-site-fragments.spec.ts` | 保留原六例，增加下述解析语义回归用例 |
| `website/build.ts` | VitePress 运行时导入移至实际构建函数；类型引用保持显式 |
| `.agents/notes/implemented/testing/2026-09-08-static-document-corpus-test-granularity.md`、对应 `.zh.md`、`.i18n.yaml` | 补充同一测试粒度决定在真实站点投影中的适用条件、输出树共享与验证责任 |
| `development/nodes/P0-A/plan.v7.md` | 保存本修订，不改写前六版 |
| 既有 P0-A 状态、验证、候选及 `evidence/` 产物范围 | 增加本轮记录；旧回执不可覆盖 |

`website/docs.ts`、Markdown 正文、Vitest 配置、门禁注册、依赖声明、锁文件和其他编译配置保持原样。本修订使用已有 `jsdom`，不依赖未声明的传递依赖。软件公司功能、下一节点、提交及推送均不在范围内。

临时写入限于：既有 `D:\Temp_projects\dsh861-p0-a-baseline\r01\` 下的新 `probes/`、`preservation/`、`logs/` 和自有 `tmp/` 子目录；`scripts/p0a-site-v7-negative.spec.ts`；`website/p0a-v7-negative-中文 copy.md`。后两者仅用于负向对照，必须独占创建并删除。正常构建输出继续按 v1 的既有授权产生。

2. 修复依据和未知成本必须分别记录。

| 已核实位置 | 可以成立的结论 |
|---|---|
| `project-doc-site.spec.ts:60` | 原测试把 Git 子进程、全量 website 文件返回、存在性过滤和断言放在同一例中；隔离运行耗时 **10005.8 ms**。这不是 Git 子进程单独耗时的测量。 |
| 同文件 `:748`；`project-doc-site.ts:344` | 整个 manifest 的读取、Markdown 解析、链接重写、图片复制及落盘集中在一个 60 秒 hook。`routes`、`claimed` 属于一次完整投影，不能在逐页调用时重新创建。 |
| `verify-doc-site-fragments.ts:85` | 每个 HTML 文件创建一个 JSDOM，并在 `BuiltPage.document` 中保留文档；后续实际只使用 id、旧式 anchor name 和 href。三页用例隔离运行耗时 **8118.2 ms**。 |
| `website/build.ts:6` | 导入清理函数和构建选项也会运行时加载 VitePress；这些纯辅助函数不需要构建器。 |
| `website/docs.ts` 的构造及 exports | manifest 是内存中的数组组合，可在收集阶段取得完整路由和别名清单，无需渲染或读取正文。 |

聚合为 **32 PASS / 1 FAIL / 0 SKIP**；两文件隔离运行仍为 **64 PASS / 2 FAIL / 3 SKIP**。不能仅归因为 gate 并行竞争。Git 启动与枚举、JSDOM 初始化与选择器、各页解析与文件系统操作的具体占比，以及最大单页能否满足五秒，仍未测得。

ZCode 在新 attempt 中记录发现耗时、Vitest import/collection 阶段、每个落盘与链接用例耗时、最大输入字节数及解析探针结果。探针结果不替代正式用例；不能把移动到收集阶段的成本描述为已经消失。

3. 先修正导入和路径发现，再实施真实投影的测试粒度。

`website/build.ts` 将 `build` 改为仅供 `Parameters<typeof build>` 使用的 type import，在 `buildDocSite()` 内执行 `const { build } = await import('vitepress')`，随后调用原来的 `build(root, docSiteBuildOptions(root, mpa))`。参数解析、SPA/MPA 选项、清理检查和直接执行入口全部保留。

在 `project-doc-site.spec.ts` 的收集阶段执行一次以下真实路径发现；这里只收集路径，不执行违规判断或读取正文：

```ts
const websiteFiles = execFileSync(
  'git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z', '--', 'website'],
  { cwd: repositoryRoot, encoding: 'utf8' },
).split('\0').filter(file => file !== '')
```

保留原 Git 查询范围及 ignore 语义；`-z` 避免空格、中文等路径被 Git quoting 或按行拆分破坏。原 `contains no tracked or unignored documentation copies` 用例继续在测试内执行 `existsSync` 过滤、`unexpectedWebsiteMarkdown()` 和原完整 `toEqual([])` 断言，并断言发现结果包含 `website/AGENTS.md`，防止空发现误通过。Git 失败直接使收集失败，不允许返回空数组兜底。

4. 将真实投影改为可逐文件推进的同一条执行路径，不增加独立投影实现。

将私有 `projectPagesInto()` 的现有循环改成返回 `Generator<string, void, unknown>` 的同步 generator；只在原 `writeFileSync(output, pageContent(...))` 成功后增加 `yield page.route`。原 `routes`、`claimed`、`claim()`、图片复制、路径检查及错误文本继续留在该 generator 的同一次调用内。

新增 `emitRawMarkdownPageSteps(outDir, context)`，按现有规则构造 aliases，再 `yield*` 上述 generator。顺序仍为全部 canonical routes，然后全部 index aliases；链接解析始终使用完整 `context.pages`。

`emitRawMarkdownPages()` 保持原参数、同步行为和 `void` 返回，通过 `Array.from(emitRawMarkdownPageSteps(outDir, context))` 完整耗尽迭代器。`projectDocs()` 同样完整耗尽底层 generator，继续使用原来的 projected-content/frontmatter 回调。给新增导出补全参数、返回值、延迟执行、部分输出和调用者清理责任的 JSDoc。

不更改 `sourceMap()`、`rewriteMarkdown()`、`rawMarkdownRoute()`、`rawMarkdownFiles()` 或链接规则。逐页推进不得使用 `pages: [page]`；不得把 alias 当成第二个 canonical source 登记；不得通过 `rawMarkdownRoute()` 加手写文件复制替代真实 emitter。

5. 真实 manifest 块保留原三个用例名称及全部原断言，按以下顺序执行。

令 `R = rawMarkdownFiles(docsPages)`，`F = R.length`。收集阶段只取得路径数组；不能把 `emitRawMarkdownPages()` 或 Markdown 解析移到 collection。仅此共享投影块使用 `describe.sequential`，不更改文件、worker 或 gate 并发配置。

| 顺序 | 执行内容 |
|---|---|
| `beforeAll` | `mkdtempSync` 创建独有 mirror，登记清理责任，创建一个 steps iterator；不渲染。移除失去适用对象的 60 秒 hook override。 |
| 新增 F 个落盘用例 | 每例调用一次 `next()`，精确断言 `{ done: false, value: route }`，并验证该真实输出文件存在。每例使用默认五秒。 |
| 原“every published route and every index alias” | 保留逐文件存在断言；再断言 iterator 已结束、R 非空且无重复、实际 `globSync('**/*.md')` 规范化排序后与 R 精确相等。 |
| 原“home pages with their bodies” | 从同一个 mirror 读取 `index.md`、`en/index.md`，保留原两个正文断言。 |
| 新增 F 个链接用例 | 每例读取一份真实落盘 Markdown，使用原 `relativeTargets()` 解析，在完整 mirror 中检查相对目标存在；记录完成检查的文件和 broken 条目，并断言该文件的 broken 数组为空。 |
| 原“every relative link inside the emitted tree” | 保留完整 broken 数组的 `toEqual([])`，并验证实际检查过的文件数组与整棵输出树及 R 精确相等。采用默认五秒。 |
| `afterAll` | 在 `try/finally` 中结束未耗尽 iterator，再删除已成功取得的 mirror；初始化失败时不得删除未赋值路径。 |

落盘结束后才能开始跨页链接检查；整个检查阶段共享同一棵完整树。`relativeTargets()` 的 GFM、link/image/definition、编码、query/fragment 和外部链接处理原样保留。Windows glob 路径在入口规范化为 `/`，文件访问仍使用 `join/resolve`。

一次 `next()` 或一次单页链接解析仍超时，就记录该页及具体操作成本并修复实际 owner；本修订不授权扩大预算、任意切割 Markdown、排除大页面或反复运行挑绿。

6. fragment owner 使用已有完整 HTML 解析器，减少环境创建和保留对象。

把 `BuiltPage.document` 改为 `hrefs: string[]`。新增私有 `readBuiltPages(distRoot, files)`：每次调用只创建一个 `new JSDOM()`，用其 `DOMParser.parseFromString(html, 'text/html')` 逐页解析，并在 `finally` 中 `window.close()`。返回值只包含 `file`、`route`、`ids` 和 `hrefs`。

每页遍历 `document.getElementsByTagName('*')` 一次：非 null 的 `getAttribute('id')` 加入 ids；`localName === 'a'` 时，非 null 的 name 加入 ids，非 null 的 href 按文档顺序加入 hrefs。保留空属性值及重复 href；不执行 CSS selector 初始化，不保留 Document、Element 或 NodeList。

后续两遍验证仍先建立完整 `byRoute`，再逐页检查 href。`routeFor()`、`aliasesFor()`、`decodedFragment()`、URL 基准、checked 计数、broken 顺序、异常及 `missingSiteFiles()` 均保持原行为。

选择 DOMParser 是因为本机 jsdom 实现会创建 scripting-disabled 的完整 HTML Document。不能用 `JSDOM.fragment()` 直接替换：fragment 解析会影响 html/head/body 属性等语义。本轮不引入模块级可变 DOM 缓存、预热测试、HTML 正则解析或新依赖。

7. 在原两个 spec 中新增以下 **15 个小型回归用例**。输入均来自自有临时目录；预期路径、文件字节、错误或报告数组必须明确，不能只断言“非空”或“抛了某个错误”。

| 所属 | 新用例与数量 |
|---|---|
| projector：1 | iterator 创建时无落盘；推进一页后 `return()`，后续页与图片均未产生 |
| projector：1 | 两页共享同一来源图片时均成功，图片内容与来源字节一致 |
| projector：5 | 分别拒绝不同来源图片同名、重复 route、page→image 冲突、image→page 冲突、canonical route 与 index alias 冲突；已写内容不被覆盖 |
| projector：1 | 小型完整投影后，从输出文件建立 alias/image 引用，再删除自有输出中的 alias 和图片；使用与 F 个链接用例相同的检查函数得到精确缺失目标 |
| fragments：7 | 分别验证 html/head/body id；实体解码、legacy name 与重复 href 计数；template 内容及 script/comment 文本不当成可达锚点；noscript 的禁脚本解析；SVG id/a[href]；零字节 HTML 仍是已构建页面；不同页面及连续调用之间不泄漏 id |

原 69 例继续覆盖语言别名、Windows 路径与 junction、安全清理、图片与后缀、坏 href、路由冲突、缺 id/路由、无 HTML 的目录等行为。原三页 fragments 正例仍精确得到 `{ checked: 6, broken: [] }`。

8. 保存发现清单，并从实际 JSON 证明覆盖，不依赖控制台通过数。

编辑前归档完整 manifest 对象数组 `P0`、原 `rawMarkdownFiles()` 的有序数组 `R0`、原 Git 路径清单和旧 JSON 中的 69 个 `(相对文件路径, fullName)`。编辑后取得 `P1/R1`，要求 `P1 === P0`、`R1 === R0`，均为完整数组比较，不先去重。

运行前登记新增 15 个用例的完整身份，以及两个各 F 项的参数化身份；不允许从通过结果倒推出预期清单。最终 JSON 必须满足：

- 原 69 个身份各出现一次且为 passed，包括原来被 hook 阻断的三例。
- 两组参数化身份分别精确覆盖 R0，检查 missing、extra 和重复登记。
- 15 个回归用例全部 passed；测试文件也成功，无 hook、collection 或未处理错误。
- 总通过数精确为 **`69 + 2 × F + 15 = 84 + 2F`**，failed、skipped、pending、todo 全部为零。
- F 以本次冻结清单为准，不采用源码注释中的历史“181 文件”。

负向对照使用正式候选 spec 的临时副本 `scripts/p0a-site-v7-negative.spec.ts`，保留全部 imports、用例及断言，只在落盘完成后、检查开始前，向自有 mirror 的 `en/index.md` 追加 `[negative](./p0a-v7-missing.md)`。同时独占创建 `website/p0a-v7-negative-中文 copy.md`，证明真实 Git 发现路径能够拒绝文档副本。

归档原 spec 哈希、临时副本哈希及唯一插入差异。负向运行必须恰有三项指定失败：layout 用例、`en/index.md` 的链接用例、原全树链接汇总用例；后两项必须包含 `en/index.md: ./p0a-v7-missing.md`。其余用例通过，无 skip；timeout、收集错误或无关失败均不算有效负向证据。

两个临时仓库文件使用排他创建；发生名称占用即停止该操作，不能覆盖。`finally` 删除它们，原文件及锁文件哈希必须保持不变；中断恢复依据自有资源清单执行。恢复前不运行生成器、文档聚合或构建。负向记录注明 `negative-control`，不混入通过记录。

9. 以下命令均由 ZCode 后续执行，每条经既有记录器保存实际 argv、cwd、环境名称、起止时间、退出码、signal、timedOut、stdout/stderr、JSON 和候选哈希。示例编号已占用时使用下一个未占用 attempt。

先建立临时 `r01/probes/tsconfig.site-v7.json`：extends 仓库 `tsconfig.base.json`；`files` 精确列出上述五个改动的 TS 文件；`include: []`、`references: []`；设 `noEmit: true`、`composite: false`、`incremental: false`、`rewriteRelativeImportExtensions: false`，并将 `typeRoots` 指向仓库 `node_modules/@types`。其余 strict、解析及 paths 选项继承，直接依赖随 imports 纳入。

```powershell
pnpm exec tsc -p D:/Temp_projects/dsh861-p0-a-baseline/r01/probes/tsconfig.site-v7.json --pretty false
pnpm exec vitest run scripts/p0a-site-v7-negative.spec.ts scripts/verify-doc-site-fragments.spec.ts --reporter=default --reporter=json --outputFile.json=D:/Temp_projects/dsh861-p0-a-baseline/r01/logs/site-v7-negative-01.vitest.json
```

负向命令按上述预期非零验收。清理并核对恢复后，执行正式 focused：

```powershell
pnpm exec vitest run scripts/project-doc-site.spec.ts scripts/verify-doc-site-fragments.spec.ts --reporter=default --reporter=json --outputFile.json=D:/Temp_projects/dsh861-p0-a-baseline/r01/logs/site-v7-focused-01.vitest.json
```

这些 Vitest 命令只增加报告参数，不增加 timeout、retry、过滤、worker 或并发参数。focused 通过并完成覆盖 JSON 核对后，按下表恢复；任一步失败即保留新失败并停止依赖步骤。

| 顺序 | 命令 | 本轮必须执行的原因与验收 |
|---|---|---|
| 1 | `pnpm run docs:check` | `website/AGENTS.md` 要求；运行原站点检查及实际构建，覆盖延迟加载、完整耗尽投影及 fragments CLI。属于预先规定的重复验证。 |
| 2 | `pnpm run test:docs` | Note 双语正文及配对记录改变，重验原完整 **15/15 PASS**；doc-standard 仍须覆盖原 1145 例。 |
| 3 | `pnpm run doc-sync` | 从原失败点恢复，必须取得同一新 attempt 的完整 **33 PASS / 0 FAIL / 0 SKIP**；保留原内部调度及环境，不拼接旧 32 项成功。 |
| 4 | `pnpm run lint` | 验证新执行代码、generator 类型及测试；该公开命令先执行 Host 构建，再执行仓库 type-aware lint。 |
| 5 | `pnpm run build` | 原最终完整 Host/Client/Web 构建，生成后续 built 验收所用产物。 |
| 6 | `pnpm run hygiene` | 验证这次最终产物的 exports、invariants、消费者、依赖与入口约束。 |

原公开 typecheck 的成功证据保留，**不额外重跑完整公开 typecheck**。新增源码确属 `tsconfig.host.json` 的 `scripts/**/*.ts`、`website/**/*.ts` 输入：临时 focused 编译先验证改动及直接依赖，随后既定 lint 的 Host 编译提供正式程序验证。Client 类型接口、依赖和配置未改变，不增加独立 Client 重验。

Note 按正常双语流程更新并重新登记配对；不启动扩展翻译工作流。`docs:check` 与新 `doc-sync` 都包含站点构建，分别承担 subtree 要求和完整聚合证明，不再插入额外独立 `docs:build`。

最终构建后先断言 `apps/cli/lib/bin.js` 和 `.dsh-build/client-build-environment.json` 存在并保存哈希，再执行原冻结入口验收：

```powershell
pnpm.cmd dsh --help
node .\apps\cli\lib\bin.js --version
$env:DSH_EXAMPLE_MODE = 'lib'
$P0ABinCases = 'requires --profile and rejects removed commands|routes help and usage errors without activating startup-dependent rows|runs the headless profile through its app-owned task positional|fails loud on a nonexistent profile with the plugin-command hint|reports a patch-overlay boot failure without hanging'
pnpm.cmd exec vitest run --config vitest.e2e.config.ts apps/cli/tests/built-bin.e2e.ts -t $P0ABinCases
pnpm.cmd exec vitest run --config vitest.e2e.config.ts apps/cli/tests/profiles/headless/tests/keyless-smoke.e2e.ts
```

五个 built 必选用例及一个 keyless smoke 必须实际通过；保留 v1 的版本、Loader、Windows pwsh、`CLI_TOOL_ROUND_TRIP`、Session 与退出断言。`DSH_EXAMPLE_MODE` 在最小 `try/finally` 中恢复原先存在或不存在的状态。全部步骤结束后等待自有进程退出并清理自有资源；后续若重建或修改候选，重新判断受影响证据，不能沿用旧候选的审核结论。

ZCode 可将“projector＋其 spec＋build 导入”和“fragments owner＋其 spec”作为两个文件互斥的实施任务；整合者负责 Note、证据和组合验证。同一工作区的公开聚合、lint 和构建继续按 v1 顺序执行，保留 gate 内部并发。

完整保留 `doc-sync-01.*`、`site-tests-isolated-01.*`、归档 `doc-sync-site-failure-01.json` 及全部更早失败；新增覆盖映射、负向、focused 和恢复链回执。固定候选必须包含未跟踪文件、v1–v7 原文及哈希、全部永久差异和临时资源清理证明。

最后由既定真实 OpenCode 使用 `--model zhipuai-coding-plan/glm-5.3 --variant max` 对固定候选执行硬审，逐项核对 `P0A-01..09`。调用身份以真实回执证明；`FAIL/BLOCKED` 留在 P0-A 返工并重新验证、固定候选、复审，直到当前候选明确 `PASS`。本修订不增加其他模型调用或配置授权。
