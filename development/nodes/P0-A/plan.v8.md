**P0-A v8 有限修订**

本次只读核对确认 v7 的迭代器、`projectPagesInto()` 共享 claims、197 个实际输出路径和逐页链接检查没有设计错误。超时 owner 在 [`rewriteMarkdown()`](/D:/Projects/dsh861/scripts/project-doc-site.ts:156)：它保留完整 GFM AST 后，对每个 replacement 反复重建整页字符串。

现有证据不能支持“一个优化后默认 5 秒必然通过”的说法：

| 路径 | 正式 v7 用例 | 临时源码外探针 |
|---|---:|---:|
| `en/reference/config-catalog.md` | 7498.2167ms，超时 | 148,995 bytes；parse 3804.8587ms；replace 704.5932ms；total 5110.8904ms |
| `en/reference/tool-catalog.md` | 8188.3665ms，超时 | 90,381 bytes；parse 2099.8689ms；replace 21.0018ms；total 2224.1249ms |

配置页的重复字符串重建是确定的可删除成本；工具页的正式失败则证明它不是唯一原因。`fromMarkdown(...gfm())` 是完整 GFM 语义的主成本，当前直接依赖只有 `mdast-util-from-markdown`、`mdast-util-gfm` 和 `micromark-extension-gfm`，没有可在“不新增依赖、不改锁文件”范围内替换的已声明低层 parser。因此，5 秒是 Vitest 默认单用例预算，不是已证实可适用于这四个完整 catalog 文档的性能承诺。

**允许改动的永久文件**

- [`scripts/project-doc-site.ts`](/D:/Projects/dsh861/scripts/project-doc-site.ts:156)
- [`scripts/project-doc-site.spec.ts`](/D:/Projects/dsh861/scripts/project-doc-site.spec.ts:856)
- 现有 Agent Note 的中英和 `.i18n.yaml`：
  `.agents/notes/implemented/testing/2026-09-08-static-document-corpus-test-granularity.{md,zh.md,i18n.yaml}`
- `development/nodes/P0-A/plan.v8.md`、状态和新的 v8 evidence。

不改 [`scripts/markdown.ts`](/D:/Projects/dsh861/scripts/markdown.ts:142)、`website/build.ts`、fragment 实现、manifest、Vitest 配置、`package.json`、锁文件、业务代码或任何 v7 既有规则。`sourceMap()`、`rewriteMarkdown()` 的链接决策、`rawMarkdownRoute()`、GFM parser、`markdownDestination()` 的原始 offset 语义均不变。

**最小实现**

在 `rewriteMarkdown()` 中仅替换当前的反向循环：

```ts
let projected = source
for (const replacement of replacements.sort((a, b) => b.start - a.start)) {
  projected = projected.slice(0, replacement.start) + replacement.value + projected.slice(replacement.end)
}
return projected
```

为一次升序切片和一次 `join()`：

```ts
const parts: string[] = []
let cursor = 0

for (const replacement of replacements.sort((left, right) => left.start - right.start)) {
  parts.push(source.slice(cursor, replacement.start), replacement.value)
  cursor = replacement.end
}

parts.push(source.slice(cursor))
return parts.join('')
```

`markdownDestination()` 已从完整 AST 节点的原始 UTF-16 offsets 定位非重叠 destination token。升序拼接从未改写的 `source` 读取每一个片段，因此和旧的降序替换严格等价，同时避免每个链接都复制整份 149KB 文档。它保留：

- GFM 解析、代码围栏排除、图片、inline link、reference definition。
- angle destination、title、转义括号、percent encoding、fragment/query。
- CRLF、Unicode、未改动文本和原始 Markdown 表示。
- `placeImage()` 的每个 image occurrence 调用与既有文件 claims。
- 所有路径解析、缺失文件、GitHub URL 和语言切换规则。

不加 AST/source 缓存，不预解析 collection，不 memoize image placement，也不改用正则切分 Markdown。

**测试修改**

在现有 `rewriteMarkdown` suite 增加一个新 identity：

```text
rewriteMarkdown rewrites non-overlapping inline, image, and definition destinations in one source-order pass
```

它使用一个精确期望字符串，单个 source 同时覆盖：

- fenced `[ignored](b.md)` 不变；
- `<b.md>` inline destination，保留 title；
- image `../packages/logo.svg#view`，保留 fragment；
- reference usage 和 `[definition]: x%28y%29.md "..."`；
- 编码路径解码到已有 `docs/x(y).md`，但 title 原字节不变。

这不是性能基准，而是新的 replacement assembly 语义回归。现有 478 个 identity 全部保留；新登记后精确总数为：

```text
69 原 identity + 2 * 197 manifest identity + 15 v7 regressions + 1 v8 regression = 479
```

v7 的 `it.each(routes)` 逐页落盘块改为按原 `routes` 顺序注册的 `for ... of`，使 identity 名称不变，并仅为完整 catalog 文档设置局部集成预算：

```ts
const catalogRoutes = new Set([
  'reference/config-catalog.md',
  'en/reference/config-catalog.md',
  'reference/tool-catalog.md',
  'en/reference/tool-catalog.md',
])

for (const route of routes) {
  const emit = () => {
    expect(steps?.next()).toEqual({ done: false, value: route })
    expect(existsSync(join(outputRoot(), route)), route).toBe(true)
  }

  if (catalogRoutes.has(route)) {
    it(`emits the manifest output file: ${route}`, { timeout: 15_000 }, emit)
  } else {
    it(`emits the manifest output file: ${route}`, emit)
  }
}
```

这保留同一 `describe.sequential`、同一 generator、同一 197 路径顺序和同一全树链接检查。其余 193 个落盘用例、全部 197 个链接用例及所有非 catalog 测试继续使用默认 5 秒。没有全局 timeout、retry、worker 配置或全局串行化改动。

四条而非只给两条英文路径设置局部预算，是为了按同一种完整生成 catalog 文档处理，避免按 locale 随意分支。中文 config baseline 已为 149,606 bytes / 4808.2383ms，接近默认限制。

Agent Note 只补充一项事实：逐页执行没有使完整 GFM parser 成本消失；这四个完整 catalog 输出使用显式局部集成预算，预算不是性能通过声明。中英文本同步后重新生成 pairing record。

**字节与 SHA 对照**

先确认当前 v7 baseline source hash 仍为：

```text
scripts/project-doc-site.ts
2c9971b48d6d1fae39f2f3af1fd160f109ad3c164255fff2598c4e287356f3b5
```

它与 `D:\Temp_projects\dsh861-p0-a-baseline\r01\preservation\site-before-v8\scripts__project-doc-site.ts` 一致。现有 [`site-before-v8-output.json`](/D:/Projects/dsh861/development/nodes/P0-A/evidence/site-before-v8-output.json) 给出四个精确基线：

| route | 输入 bytes | rewritten bytes / SHA-256 | raw bytes / SHA-256 |
|---|---:|---|---|
| `en/reference/config-catalog.md` | 148995 | 164120 / `b1da5aaf60c2773fce8ddeadd739bb56bbb0bbcaffdc5f1095bb48b128da67e2` | 同 rewritten |
| `en/reference/tool-catalog.md` | 90381 | 93974 / `b5f4d52395f94300b5c6c0085206386f9d5b17a55ac3d38338981c924d5dce88` | 同 rewritten |
| `reference/config-catalog.md` | 149606 | 164717 / `49e17565633131ae8efa47de45ff480b1229d113728da3f8ca9cf712968c53b5` | 164662 / `bd914fa6a8be8149368a67af85cfcce31f9c024a8d136f9ada17816d8fdbbfa9` |
| `reference/tool-catalog.md` | 89908 | 93514 / `0f94156b2172ca5d3eac4eef67887387ede9141b921a017a234caa0a1686b780` | 93461 / `81cf6ce1d68c8e63b48173aef47d73a5a53200a618a3372ab582a7bd67d9e1a9` |

v8 使用一个新的临时 comparison runner，不插桩源码：

1. 排他复制保存的 v7 `project-doc-site.ts` 到 `scripts/` 下的唯一临时模块，以保持其相对 imports 和 `import.meta.dirname`。
2. 对保存的 v7 module 和 v8 candidate，各自用完整 `docsPages`、真实 `emitRawMarkdownPageSteps()` 和独立临时输出树，推进全部 197 个路由。
3. 对每棵树生成排序后的 `relativePath + byteLength + sha256` 清单，要求路径集合和每一文件 byte/SHA 完全相等，含 emitted images。
4. 对上表四路直接调用各自的 `rewriteMarkdown()` 与 `rawMarkdownPageContent()`；输入 hash、rewritten bytes/SHA、raw bytes/SHA 必须逐项等于表中基线。
5. 对新旧 `next()` 的四条路由分别记录真实 wall-clock 耗时，但只作为 owner-cost evidence，不作为通过条件。
6. 临时 module、两棵 tree 和 runner 总在 `finally` 删除；comparison 记录写入新的 `site-v8-large-page-equivalence.json`，不覆盖 v7 profile 或 baseline。

这比单次插桩 probe 更强：它调用实际 emitter、完整 manifest、完整 claims 和实际文件输出；正式 Vitest focused run 仍是独立验收。已有小 fixture 继续使用精确字符串 `toBe()` 断言，新用例补足同一 source 内多 replacement 的位置组合，因此不以 hash 取代行为断言。

**负向与验证**

`rewriteMarkdown()` 的拼接实现位于原投影路径，故不得复用 v7 negative 的 PASS 作为 v8 证据。复用 `negative_site_v7.py` 的排他创建、注入位置、cleanup 和完整 stderr validator 机制，但以新的 v8 attempt、临时 spec 和 evidence 名称执行。

v8 negative 必须基于最终 candidate，预期总数 479：

```text
3 failures:
- website source layout contains no tracked or unignored documentation copies
- raw Markdown projection ... resolves links ... en/index.md
- raw Markdown projection ... resolves every relative link inside the emitted tree

476 passes, 0 skips, 0 pending, 0 todo
```

完整 stderr 仍须证明两个链接 failure 含 `en/index.md: ./p0a-v8-missing.md`；JSON `failureMessages` 的截断不能替代它。清理后要重新核对 source 与 lock hash，旧 `site-v7-negative-validated.json` 保持不改。

执行顺序应避免用 comparison 或 negative 预热正式测试进程：

1. 新的最小 `tsconfig.site-v8.json` 仅列 `scripts/project-doc-site.ts` 与 `scripts/project-doc-site.spec.ts`，运行 focused `pnpm exec tsc -p ... --pretty false`。
2. 从新进程运行正式 focused 两个 spec，要求 `479 passed / 0 failed / 0 skipped`，并用 v8 expected identity record 验证原 478 身份逐一存在且通过。
3. 在独立新进程运行实际 emitter 的 old/new byte-SHA comparison 和直接耗时记录。
4. 在独立新进程运行新的 v8 negative，再完成清理和恢复核对。
5. 之后按既有顺序恢复 `docs:check`、`test:docs`、`doc-sync`、`lint`、`build`、`hygiene` 和 v7 冻结的 built CLI 启动/入口验收。

不重跑无关的公开 `pnpm run typecheck`；v8 没有 client、依赖、锁文件或编译配置变化，focused tsc 与 `lint` 的既有 Host build 覆盖本次 TS 改动。任何新失败停止其后的依赖步骤，不用重复运行挑选绿色结果。

所有 v1-v7 失败、v7 负向和两条正式超时记录保留。通过上述验证后，候选仍留在 P0-A，按既定规则接受指定真实 OpenCode `glm-5.3/max` 硬审核；`FAIL/BLOCKED` 留在当前节点修复和复验，不进入下一节点。

本轮没有修改文件、执行测试、运行模型或请求额外授权。当前节点修复、既有依赖和后续 ZCode 实施已经获授权；v8 不引入新依赖。
