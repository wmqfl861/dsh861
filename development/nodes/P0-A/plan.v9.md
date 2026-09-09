**P0-A v9 有限计划**

v8 的修复序列已经结束，不能把本轮目标重新扩大为 Markdown 投影或站点生成器优化。当前唯一待处理的问题在 [`scripts/verify-doc-site-fragments.ts`](/D:/Projects/dsh861/scripts/verify-doc-site-fragments.ts) 的 `readBuiltPages()`：`for (const element of document.getElementsByTagName('*'))` 触发已安装 jsdom 的 `HTMLCollection` iterator 和 `Proxy` 行为，每次推进都会读取 `length`，随后由 `namedItem('length')` 扫描整组元素。限定探针在 650157 字节、9216 元素的配置页上只推进 100 个元素，就产生 100 次 `length` 名称查找、921600 个候选扫描、1056.0587ms 遍历成本；同页 DOM 解析为 1423.545ms。185 个 HTML 输入合计 27212453 字节。探针只改动独立子进程中的原型并在 `finally` 恢复，没有修改磁盘源码，因此它是 v9 的缺陷证据，不是验收结果。

v8 已确认的事实继续作为基线：限定 `tsc` 通过；正式测试为 479/479；478 个旧身份和 1 个 v8 新身份全部保留；197 个 Markdown 加 4 个图片的 201 个完整 manifest 文件逐字节和 SHA 完全相等；四个 catalog 的直接输出对照相等；负向运行准确为 3 个指定失败、476 个通过并完成清理；`docs:check-01` 退出 0，包含 479 个测试、VitePress build 340.71 秒、2590 个内部片段引用、197 个 Markdown 和 `llms.txt`；总命令约 23 分钟。`test-docs-03` 是 `command_not_started` 的 BLOCKED 检查点，退出码 125 来自自有检查点，不是测试执行失败。不得把它改写成失败证据，也不需要等待或终止任何进程。

本轮的固定边界是原基线 HEAD `d347e703908d0406b7a7ef80e3a0e594d86b2215`、lock SHA `2c903ab870f821ee2db62fa9417d11b1c2b9c65fbeec30e851ddc53c4cc8c383`，以及 P0A-01..09 和 AC 未完成边界。ZCode 只允许修改 fragment 实现和测试、现有双语 Agent Note、其 pairing 记录以及本节点新的 evidence；不改 `project-doc-site.ts`、Markdown parser、manifest、VitePress 配置、Vitest 全局配置、`package.json`、锁文件、模型配置、业务代码或其他节点。不得扩大 timeout、串行化测试、缩小检查范围、删除页面、引入依赖或改变锁定版本。

最小实现保持现有 `new JSDOM()`、`window.DOMParser()` 和 `parseFromString(..., 'text/html')`，只替换元素收集循环。先取得完整文档的静态元素列表，再使用索引遍历，避免 `HTMLCollection` iterator：

```ts
const elements = document.querySelectorAll('*')
for (let index = 0; index < elements.length; index++) {
  const element = elements[index]
  const id = element.getAttribute('id')
  if (id !== null) ids.add(id)
  if (element.localName === 'a') {
    const name = element.getAttribute('name')
    if (name !== null) ids.add(name)
    const href = element.getAttribute('href')
    if (href !== null) hrefs.push(href)
  }
}
```

`querySelectorAll('*')` 仍由已有完整 HTML parser 生成，不增加 parser 或依赖；索引访问不调用 NodeList iterator。它必须返回与原遍历相同的文档顺序，并覆盖 `html`、`head`、`body` 等 document-level 元素、HTML 与 SVG 元素、`template` 元素本身以及 scripting disabled 下解析出的 `noscript` 元素。`template.content` 不属于文档树，因此其中的元素仍不可达；脚本和注释文本也不会变成元素。保留 `id` 的全元素收集、`a[name]`、`a[href]`、重复 href 计数、href 顺序、SVG anchor、route alias、URL 解析、URI 解码、错误抛出顺序、每页隔离和 `window.close()` 的 `finally` 清理。不得借机修改 `byRoute`、`aliasesFor`、`decodedFragment` 或主函数输出。

在 [`scripts/verify-doc-site-fragments.spec.ts`](/D:/Projects/dsh861/scripts/verify-doc-site-fragments.spec.ts) 中增加且仅增加一个行为身份：

```text
inspectSiteFragments preserves duplicate broken fragment order across document, SVG, and noscript elements
```

fixture 在同一 HTML 文档中按顺序放置 SVG anchor、`noscript` anchor 和普通 HTML anchor，三者都指向同一个不存在的 fragment；断言必须精确比较 `{ checked: 3, broken: [...] }`，并按源文件和 href 出现顺序保留三个 broken 记录。该断言验证静态遍历没有漏掉元素、没有去重、没有改变输出顺序，不使用计时阈值，也不暴露实现名称。现有 479 个测试身份必须逐一保留，加入该 1 个身份后正式总数精确为 480；不得通过重命名或合并旧用例制造“数量相同”。

旧 spec 中的负向身份全部继续执行，包括空目录、冲突 route、非法 URL、缺失 id、缺失 route、template/script/comment 不可达、noscript、SVG、零字节页面、跨页 id 隔离、重复 href 以及后续检查。每个结果继续用精确 `toEqual()` 或精确错误消息断言。新用例只补充重复 broken 的文档顺序，不以性能或运行时间替代语义证明。v8 的 3-failure/476-pass 负向 harness 针对 source layout 和 raw-Markdown link mutation，未涉及本轮 fragment 实现；若基线和 harness hash 不变，可保留其证据而不重复那次昂贵 mutation。fragment spec 的 480 身份和实际整站报告仍是本轮必须重新取得的负向与正向覆盖。

实施前先核对 HEAD、lock SHA、工作树和 [`development/nodes/P0-A/evidence/site-before-v9-fragments.json`](/D:/Projects/dsh861/development/nodes/P0-A/evidence/site-before-v9-fragments.json)。该 evidence 与 `D:/Temp_projects/dsh861-p0-a-baseline/r01/preservation/site-before-v9` 是恢复和输入核对来源，不得编辑。候选 build 完成后，按 evidence 中同一排序和 SHA-256 算法生成 185 个 HTML 的 `relativePath + byteLength + sha256` 清单，要求路径集合、字节数和每个 SHA 全部相等；任一输入 hash 改变都先停下归因，不能用“2590 个引用”掩盖输入变化。再对实际 `website/.dist` 运行现有 `inspectSiteFragments()`，保存新的节点 evidence，要求报告精确为：

```json
{ "checked": 2590, "broken": [] }
```

同时确认 197 个 raw-Markdown 文件和 `llms.txt` 存在。`docs:check` 的整站输出必须与 v8 的 2590/空 broken 语义等价；如果候选新增 1 个测试，测试总数应为 480，而不是把 v8 的 479 当作本轮总数。不得只检查 stdout 文本；要保存结构化报告、输入 HTML manifest、输出文件清单及其 hash。v8 已经完成的 project-doc-site 201 文件逐字节等价、四个 catalog 直接输出 SHA 对照和 catalog 成本探针不受 fragment 改动影响，可以直接引用原 evidence，不必重跑；v8 的 340.71 秒只作历史记录，不转化为新的时间门槛。

执行顺序固定如下。ZCode 完成最小实现、一个新身份、双语 Note 和 pairing 更新后，先运行 fragment 实现与 spec 的 focused `tsc`，再运行 focused spec，要求 480/480、0 failed、0 skipped、0 todo、0 pending，并校验原 479 身份集合完整存在。随后在独立进程执行站点 build、185 HTML 输入 hash 对照和 2590/空 broken 结构化报告，所有临时复制、临时 runner 和临时输出树都在 `finally` 删除。接着运行有效候选的 `docs:check`；同一候选同一工作树运行 `test:docs`，要求既定 15/15；再运行 `doc-sync`，要求 33/33；运行 `lint`，包括既有 Host 编译；运行完整 `build`，覆盖全部 Host、Client 和 Web；运行 `hygiene`；沿用 v8 已冻结命令运行 `source-help`、`built-version`、5 个预先指定的 built 用例和 1 个 keyless smoke。任何一步出现新失败，停止后续依赖步骤，修复后从受影响的最小前置检查重新开始，不重复挑选偶然绿色结果。

所有新 evidence 必须记录候选源码和 lock hash、480 测试结果、185 HTML 输入清单、整站 fragment report、197 Markdown/`llms.txt` 检查、15/15、33/33 和最终链各命令的退出状态。更新现有双语 Note 时只补充已测事实：HTMLCollection iterator 的 `length` 扫描成本、静态 NodeList 索引遍历的选择、语义保持范围，以及“不以时间阈值验收”的限制；英文、中文和 pairing 必须逐段对应。不得编辑归档计划、失败 evidence 或 v8 既有记录。

完成全部检查后冻结候选，保留源备份、185 HTML 完整 hash、480 测试身份清单、整站报告和清理证明，随后交由真实 OpenCode `glm-5.3/max` 进行硬审，直到明确 `PASS`。若审查为 `FAIL` 或 `BLOCKED`，留在 P0-A 由 ZCode 修复并重新执行受影响检查和硬审；不得进入下一节点。整个过程不提交、不推送、不发布，也不改变模型。
