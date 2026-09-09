P0-A v11（极小修订）

本轮仅扩展 v10 验收范围，允许修改且只修改 `scripts/verify-doc-site-fragments.ts` 与 `scripts/project-doc-site.spec.ts`；不改源码语义、480/480 身份、输入哈希、迭代器、断言、依赖、锁、时间预算或模型配置，不新增测试，不更新双语 Note，也不重新 pairing。

在 `verify-doc-site-fragments.ts` 保留 `querySelectorAll('*')`、静态 `NodeList` 和现有 `for (let index = 0; index < elements.length; index += 1)` 索引遍历。将 `const element = elements[index]!` 改为 `const element = elements.item(index);`，紧接 `if (element === null) { throw new Error(...) }`。该分支只处理静态列表长度与索引不一致这一不可达状态，绝不跳过、回退或改用 `HTMLCollection`，其余处理保持原样。

在 `project-doc-site.spec.ts` 的 795、807、818、830、841 五处，仅把 `expect(() => emitRawMarkdownPages(...))` 改为块体回调：

```ts
expect(() => {
  emitRawMarkdownPages(...);
}).toThrow(...);
```

保留原参数、异常断言和用例顺序。将 882 的 `describe.sequential(...)` 改为 `describe('...', { concurrent: false }, () => { ... })`，保持共享 manifest 输出块的原顺序、同一迭代器及局部并发约束，不改成全局串行。

本轮不执行命令。实施后的验证严格按以下顺序：先用承载这两个文件的最小 leaf tsconfig 执行 focused `tsc --noEmit`；再按 `scripts/run-oxlint.ts` 支持的路径参数，只 lint 这两个文件；随后运行 `project-doc-site.spec.ts` 中现有两个 spec480 用例。三步通过后，执行正式 `pnpm run lint`；再执行完整 `pnpm run build`、`pnpm run hygiene`、源码 `help`、built 版本 `help`、原五个 built 冲突用例及一个 smoke。

已有 `docs-check-02`、`test-docs-04`（15/15）和 `doc-sync-02`（33/33）可依据上述语义等价改动、未触及文档输入及既有断言而复用；不得把它们写成重新通过。v10 保存的 2590+`broken[]` 报告及哈希证据继续有效，不重复 21 分钟旧运行；只有 focused 用例显示 fragment 输出变化时，才运行新实现一次并与旧报告对照。
