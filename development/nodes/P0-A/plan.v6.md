本次 v6 的最小修复是：**只枚举一次 README 路径，将两个全库循环改为逐 README 的参数化测试，保留原校验函数和全部断言。** 不调整 timeout，也不引入内容缓存、manifest 缓存或新的测试框架。

本轮已只读核对 [doc-standard.spec.ts](/D:/Projects/dsh861/scripts/doc-standard.spec.ts) 全文、`vitest.config.ts` 的 timeout 检索结果、可靠性技能、测试政策和 Agent Note 规则。失败次数与耗时采用你提供的证据；没有修改文件、执行测试、联网或调用其他模型。以下是交给 ZCode 实施的 **P0-A `plan.v6.md` 有限增补**，不是 PASS。

v6 仅为下述修改提供 v1 禁改现有测试条款的例外；v1–v5 其余约束、已通过证据和最终硬审要求继续有效。

实际代码支持这个修复范围：
- `packageReadmes()` 在两个用例中分别执行六个 glob，再规范化路径、排序。
- 元数据用例覆盖全部枚举结果；正文结构用例仅覆盖 `file.split('/').length === 4` 的结果。
- `readFrontmatter()` 内含实际断言，必须继续在测试用例内执行。
- 成功的元数据检查每条调用一次 `expectedKind()`；错误消息分支才会再调用一次。跨语言和库登记检查仍会重复读取 manifest。
- 现有证据足以确认全库工作量与单例时间预算不匹配，但不能精确分摊 glob、读取、解析和断言各自的耗时。

永久修改范围限定如下；原计划已经批准的其他文件和产物继续按原授权处理。

| 精确文件 | v6 允许的改动 |
|---|---|
| `scripts/doc-standard.spec.ts` | 一次枚举、两组参数化用例、原非空断言迁移、下述小型负向用例 |
| `development/nodes/P0-A/plan.v6.md` | 保存本有限修订；不改写 `plan.v1.md` 至 `plan.v5.md` |
| `.agents/notes/implemented/testing/2026-09-08-static-document-corpus-test-granularity.md` | 记录逐文档测试粒度及保持完整覆盖的决定 |
| `.agents/notes/implemented/testing/2026-09-08-static-document-corpus-test-granularity.zh.md` | 对应中文 |
| `.agents/notes/implemented/testing/2026-09-08-static-document-corpus-test-granularity.i18n.yaml` | 正常配对记录 |

这份测试 Note 同时承担本次相应文档更新，不需要改动 `docs/testing.md`、ROOT `AGENTS.md`、技能、Vitest 配置、门禁注册、产品代码、依赖或锁文件。新增日志、清单和回执沿用既有 `logs/`、`evidence/` 位置，使用新 attempt 文件名。

先在修改前保存旧枚举函数得到的完整、有序路径数组 `L0`，以及由原深度条件过滤得到的 `S0`。保留六个 glob、排除项和规范化表达式的原文及哈希；一次性取证代码放在既有外部证据目录，不增加仓库公共 helper。

随后在现有 `describe('dsh-doc skill consolidation', ...)` 开头生成两份文件清单。新非空用例保留原断言；两组 `it.each` 分别替换原第 192、214 行的用例。下面只列需要加入或替换的片段，未列出的十个原用例全部保留：

```ts
const files = packageReadmes()
const leafFiles = files.filter(file => file.split('/').length === 4)

it('finds package READMEs', () => {
  expect(files.length).toBeGreaterThan(0)
})

it.each(files)(
  'maps package README kinds to their documentation standards: %s',
  (file) => {
    const metadata = readFrontmatter(file)
    expect(packageReadmeMetadataErrors(file, metadata), file).toEqual([])
  },
)

it.each(leafFiles)(
  'keeps every package README on the summary, contents, and Dev Note skeleton: %s',
  (file) => {
    const source = readFileSync(resolve(root, file), 'utf8')
    expect(packageReadmeStructureErrors(file, source), file).toEqual([])
  },
)
```

`packageReadmes()` 的函数体和六个 glob 原样保留，只剩上述一个调用点。共享数据仅为路径数组；采集阶段不读取、解析或校验 README 内容。

`readFrontmatter()`、`packageDir()`、`declaresBundle()`、`expectedKind()`、两个错误收集函数、`KIND_TEMPLATES` 和 `PACKAGE_LIBRARIES` 均不改动。保持原正则、错误文本、字段规则和 manifest 判定。

每个 README 用例继续使用当前运行环境的默认 5,000 ms 预算，不新增用例、suite 或 hook 的 timeout 设置。总扫描耗时可以超过五秒；本次没有“全库必须五秒完成”的性能验收指标。

正文结构仍只检查原来深度为四的路径。不得将根目录或包组 README 纳入结构检查，也不得排除中文、实验包、库或 bundle。

在同一 spec 内增加 **12 个短小、纯内存用例**，直接调用现有两个错误收集函数。它们验证规则，不引入文件夹、mock、计时断言或导出接口。

| 新用例 | 输入及必须得到的结果 |
|---|---|
| 4 个 description 负例 | 使用 `packages/example/README.md`、正确 `package-group`；description 分别缺失、`''`、纯空白、数字；均精确返回 `['description must be a non-empty string']` |
| 2 个结构正例 | 英文和中文分别提供三个完整标题；均精确返回 `[]` |
| 3 个英文结构负例 | 从完整英文字符串分别移除 Summary、Table of Contents、Dev Note；分别只返回对应的 `missing ...` |
| 3 个中文结构负例 | 从完整中文字符串分别移除概述、目录、开发备注；分别只返回对应的 `missing ...` |

结构用例使用 `packages/example/package/README.md` 和 `.zh.md` 作为纯字符串参数。完整英文输入为 `## Summary\n\n## Table of Contents\n\n## Dev Note\n`，中文输入使用对应三个标题。

保留现有“错误 kind 与冗余字段”和“README-local i18n”两例的全部精确错误数组，以及 Windows 分隔符正例。不得用宽松的 `toContain`、非空判断或异常吞掉原断言。

覆盖验收必须从实际执行报告取证：
- 修改后重新枚举得到 `L1`、`S1`；完整有序数组分别与 `L0`、`S0` 相等。
- 从 Vitest JSON 中取出两组参数化用例末尾的路径，分别得到 `M`、`T`。
- 排序后按数组精确比较 `M === L0`、`T === S0`，保留重复项检查；不能只比较数量或集合。
- 每条对应测试状态必须为 passed；没有 missing、extra、skipped、todo 或重复登记。
- 设 `N = L0.length`、`S = S0.length`，最终成功运行必须有 **`N + S + 23` 个通过用例**。
- 该数量来自原来保留的 10 例、新非空例、两组 `N + S` 例和新增 12 例；不能为了匹配数量减少检查。

另做一次通过真实文件读取与参数化登记的负向对照，证明实际入口确实拒绝损坏的 README。

仅为这次验证，授权 ZCode 临时修改下列三个文件；它们不属于永久改动范围：

| 临时文件 | 故意损坏 | 必须观察到的失败 |
|---|---|---|
| `packages/README.md` | 将首行 frontmatter 分隔符替换为等行数的无效文本 | 对应元数据用例报告该路径的 `YAML frontmatter` 断言失败 |
| `packages/session/session-persistence-jsonl/README.md` | 保持 YAML 有效，将 kind 改为 `v6-negative-kind` | 对应元数据用例明确报告 `kind must be ...` |
| `packages/session/session-persistence-jsonl/README.zh.md` | 将三个必需标题改为不匹配的标题，保持行数 | 对应结构用例列出三个预期 `missing ...` |

临时写入前保存原始字节和 SHA-256，并确认每个替换位置确实命中。使用最小范围 `try/finally` 恢复；中断后的恢复也依据这份备份，不使用宽泛的 `git restore` 覆盖现有工作。

负向窗口内独占这三个文件，不同时运行会读取它们的其他门禁。恢复后所有正式检查使用原并发设置；不增加全局串行配置。

负向运行命令为：

```powershell
pnpm exec vitest run scripts/doc-standard.spec.ts --reporter=default --reporter=json --outputFile.json=D:/Temp_projects/dsh861-p0-a-baseline/r01/logs/doc-standard-v6-negative-01.vitest.json
```

必须非零退出，报告上述 **三个指定用例因内容断言失败**，其余用例通过；timeout、收集错误或无关失败均不能代替成功的负向对照。回执明确标注 `negative-control`，不将其混入基线通过记录。

随后逐字节恢复三个文件，验证 SHA-256 全部等于备份值。验证前不运行任何会重写这些文档或 sidecar 的生成器，最终候选中不得留有这三处故意损坏。

恢复完成后运行一次完整 focused 验证：

```powershell
pnpm exec vitest run scripts/doc-standard.spec.ts --reporter=default --reporter=json --outputFile.json=D:/Temp_projects/dsh861-p0-a-baseline/r01/logs/doc-standard-isolated-02.vitest.json
```

这里只增加报告输出参数，没有 timeout、重试、筛选、worker 或并发调整。必须退出 0，满足上述完整路径覆盖及 `N + S + 23` 通过数量，并记录采集耗时、执行耗时和最慢用例。耗时用于解释结果，不新增性能断言。

若此时仍失败，保留该 attempt，停在实际失败 owner 上继续诊断；不能通过相同代码反复运行直到挑到一次绿色。

Agent Note 在实施时按 [现有格式规则](/D:/Projects/dsh861/.agents/notes/README.md) 写成 `Status: implemented`，包含 Problem、Decision、Alternatives considered、Consequences。内容限定为：
- 静态文档规则以单个 README 为验证单位，文件数量增长不应挤占单例预算。
- 文件发现共享一次，校验继续在每个测试内执行，保持完整路径集合及失败定位。
- 记录已考虑的提高 timeout、重复运行、全局串行、缓存已校验 metadata，以及它们未被采用的原因。
- 说明用例数量增加、总执行时间仍受文件系统影响，覆盖依赖完整枚举及实际报告核对。

保持英中对应结构、配对记录和恰好一个末尾换行。原有基线 Note 不改写为这个不同的测试策略决定；具体尝试编号、日志和耗时放在 evidence 中。

focused 验证通过后，严格从原失败点恢复：

| 顺序 | 命令或既有步骤 | 必需结果 |
|---|---|---|
| 1 | `pnpm run test:docs` | 原命令、原 15 gates 全部执行：15 PASS、0 failed、0 skipped；doc-standard 无 timeout |
| 2 | `pnpm run doc-sync` | 退出 0，文档、Note、配对与预算门禁通过 |
| 3 | `pnpm run lint` | 退出 0 |
| 4 | `pnpm run build` | 原 final full build 完整退出 0 |
| 5 | `pnpm run hygiene` | 退出 0 |
| 6 | source-help → built-version → built-tests → keyless-smoke | 逐条沿用 v1–v5 已冻结命令、环境与成功断言，使用这次 final build 的产物 |

每步成功才进入下一步。`test:docs` 必须重跑完整聚合，不能把旧的十四项成功与新的单文件成功拼成一次聚合 PASS。

保留 BuildTools2022 精确核验、`install-ntfs-02`、fs-ext 实际加载、锁文件未变、原 16 测试、公开 typecheck 和原文档预算检查的已有回执。新增 Note 的预算与配对仍由这次文档门禁重新验证。

**本 v6 不要求重跑完整公开 typecheck。** 修改面是测试组织与文档，没有改变 Host/Client 类型接口、源码依赖或编译配置；旧 typecheck 保留为其原候选的证据，不改写为“验证了新 spec”。本次受影响测试由 focused 执行及后续 lint 验证，最终完整 build 仍照原顺序执行。

如果后续修复实际触及编译输入、类型出口、依赖关系或配置，必须先指出具体文件和受影响的编译程序，再决定必要的类型检查；不能仅以“出现了新提交”为理由重跑六十分钟流程。

保留 `test-docs-01.*`、`doc-standard-isolated-01.*` 和 `evidence/doc-quick-failure-01.json` 原样。新增 inventory、negative-control、focused、`test-docs-02` 及后续 attempt 回执；文件名已存在时使用下一未占用编号，不覆盖旧证据。

新回执记录实际 argv、cwd、开始/结束时间、退出状态、候选标识及 stdout/stderr/JSON 路径。覆盖回执另保存 `L0/S0/L1/S1/M/T`、比较结果、测试状态和临时文件恢复哈希。

送审候选必须同时包含：
- 相对固定基准的全部修改、新增和删除状态，以及全部未跟踪候选文件；不能只交 `git diff`。
- 每个候选文件的原文或可还原内容与哈希；未跟踪文件同样纳入。
- `plan.v1.md` 至 `plan.v6.md` 全部原文与哈希，证明前五版未被重写。
- 原失败证据、保留的成功证据、新负向及正向验证、完整恢复链回执。
- 三个临时 README 已恢复、锁文件及越界文件未改变的核对结果。

分工保持真实 Codex `gpt-6-astra/max` 规划、ZCode 实施、真实 OpenCode `glm-5.3`、variant `max` 硬审；模型与参数以真实启动回执证明，不以文档声明替代。固定候选后提交硬审，失败则在 P0-A 修复、验证并形成新候选重新审查。

本修订授权范围到 P0-A 的上述修复与既有验收闭环为止；当前状态仍是**待实施、待真实 OpenCode 硬审**。
