**P0-A v10 有限验收修订**

v9 的生产修改已经完成：`readBuiltPages()` 使用 `querySelectorAll('*')` 返回的静态 `NodeList` 做索引遍历，正式用例为 480/480，真实站点构建通过，2590 条引用、197 个 Markdown 文件和 `llms.txt` 均已确认。v9 的跨独立构建 HTML 二进制验收必须原样保留为失败证据：185 条路径全部相同，185 个字节长度全部相同，但 SHA-256 相同数为 0；`site-v9-rebuilt-html-mismatch.json` 已记录检查器在输入 hash 阶段停止、尚未取得结构化 report，临时 runner 和原文备份已清理。不得删除、改写或把该失败改成通过。

该失败不再作为本节点的二进制可复现性承诺。已知每个非 MPA HTML 都内嵌相同的 `window.__VP_HASH_MAP__=JSON.parse(...)`，VitePress 1.6.4 的 `generateMetadataScript(pageToHashMap, config)` 会序列化全局 map，因此单页 hash 变化可能传播到所有 HTML，同时保持长度不变。这只能作为可能的全局传播机制；v8 没有保存原始 HTML 字节，旧站点也已被正常构建清理，无法精确重建差分，不能把该机制写成此次差异的完整事实，也不能规范化或移除 hash 来强行通过。

v10 只补充验收归因和新 evidence，不修改 v9 源码、测试、双语 Note、pairing、VitePress、全局配置、模型配置或其他生产实现。冻结当前 HEAD、lock、P0A-01..09 和产品 AC 未完成状态；不提交、推送或发布。保留 `site-after-v9-bytes-preserved.json` 指向的 847 文件、47,860,051 字节站点树，逐文件验证 185 个 HTML 的原始字节仍与清单一致，并生成按相对路径排序、包含 `byteLength` 与 `sha256` 的完整同源输入 manifest。该树是旧、新检查器共同读取的唯一输入，运行期间禁止重建或修改。

从 `site-before-v9-fragments.json` 记录的备份逐字节复制旧检查器，校验其源 hash 后，在 `D:/Temp_projects/dsh861-p0-a-baseline/r01` 语义目录中建立唯一临时 `scripts` 模块。保留原有相对 import、`import.meta.dirname` 和模块层级关系；相关 `project-doc-site.ts` 仅以同源只读关系解析，不改写源码。用独立 ESM 进程分别调用旧模块和当前模块导出的真实 `inspectSiteFragments(preservedRoot)`。旧检查器全站只执行一次并保存完整结果；新检查器执行一次。临时模块、进程辅助文件和输出目录统一放在该 Temp 语义目录，并由 `finally` 删除；185 HTML、manifest、源备份和 evidence 不得删除。

分别保存 `site-v10-old-report.json`、`site-v10-new-report.json` 及执行元数据，比较两个 report 的完整 JSON 结构：`checked`、`broken` 数组长度、每个对象的 `source`、`href`、可选 `target`、`fragment` 以及数组顺序都必须逐项相等，禁止只比较计数、过滤字段、排序 broken 项或做 hash normalization。两份真实 report 必须精确为 `{ "checked": 2590, "broken": [] }`。480 个已冻结用例及其 SVG、noscript、重复 broken 顺序、跨页隔离和错误路径覆盖作为独立语义证据直接复用，不能用“同样的 2590”掩盖 report 内容变化；v8 的 201 文件投影和 3/476 负向证据继续引用，不重复昂贵 mutation。

在冻结候选上按顺序执行一次有效的 `docs:check`（包含 480 用例和真实构建），随后执行新轮 `test:docs` 15/15、`doc-sync` 33/33、含 Host 的 `lint`、完整 `build`、`hygiene`、`source-help`、`built-version`、原 5 个 built 用例及 1 个 keyless smoke。不得降低预算、串行化既有测试、减少页面或重命名旧失败；失败时保留首次输出，从受影响的最小前置检查重新开始。完成后冻结全部 evidence，由真实 OpenCode `glm-5.3/max` 硬审至明确 `PASS`；`FAIL` 或 `BLOCKED` 留在 P0-A 修复并复审。
