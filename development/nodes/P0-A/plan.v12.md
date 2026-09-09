P0-A v12（极小修订）

本轮只修复 v11 在 `scripts/verify-doc-site-fragments.ts:86` 的目标 oxlint 失败。仅允许修改该文件，`scripts/project-doc-site.spec.ts` 保持不变。`readBuiltPages` 继续使用 `document.querySelectorAll('*')` 返回的静态 `NodeList`，保留现有索引循环及遍历顺序；将当前 `const element = elements.item(index)` 后的 `element === null` 判断和抛错删除，直接使用 `element` 读取 `id`、`name`、`href`。TypeScript DOM 类型已将 `NodeListOf<Element>.item(index)` 声明为 `Element`，这是与 `no-unnecessary-condition` 兼容的最小表达。不得加入无效 null 分支、non-null assertion、类型转换、规则禁用或 `HTMLCollection` 的 `for…of` 重复扫描。

保持 480 个既有用例的身份、顺序和全部语义：输出内容、文档顺序、SVG、`noscript`、`template`、重复 `href`、`window.close()` 与 `finally` 均不得变化；不更新 Note 或 pairing，不改依赖、锁文件、VitePress、Vitest 全局配置、模型或其他代码，HEAD、锁 SHA、P0A-01..09 及产品 AC 边界保持不变。

验证必须严格有序且不得并行：先用承载该脚本的最小 leaf tsconfig 执行 focused `tsc --noEmit`；通过后只对 `scripts/verify-doc-site-fragments.ts` 执行目标 oxlint；再运行 `project-doc-site.spec.ts` 中现有两个正式 spec480 用例，共 480 项。三步通过后重跑正式全局 `pnpm run lint`；全局 lint 通过后，按既有顺序继续完整 `pnpm run build`、`pnpm run hygiene`、源码 `help`、built 版本 `help`、五个固定 built 用例及一个 keyless smoke。

由于本次只有不可达分支删除，文档输入、投影输出和断言语义不变，不重跑 docs-check、test-docs、doc-sync；可引用 v11 前已通过的 `docs-check-02`、`test-docs-04` 15/15、`doc-sync-02` 33/33、v10 同输入旧新 report 等价、v9 build+480 和 v8 投影对照，但不得记作本轮重新通过。固定候选交由真实 OpenCode `glm-5.3/max` 硬审，必须取得 `PASS`；若失败，修复和复审继续留在 P0-A。不得提交、推送或发布。
