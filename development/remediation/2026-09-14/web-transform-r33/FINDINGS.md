# r33 — worker transform 重复与两处语义缺陷：证据索引

仓库 `wmqfl861/dsh861`，分支 `chore/latest-stable-upgrade-20260912`，源码基线 `acca50b616c48ba816492fe5d1152401e3abdd85`（fetch 后确认在历史中，工作树起点干净），transform 起始 blob `48d4d6ec996c49c186f5f7d627c8e7b7b814ea32` 与基线一致。工具链 Node 26.8.2 + pnpm 12.4.1（`C:\dsh-r24-upgrade-20260912-01` 显式 PATH），DSH_SNAPSHOT=replay，真实 Chromium，未加载生产 `.env`。

接续评论 https://github.com/wmqfl861/dsh861/pull/13#issuecomment-5666347460 本机两次 WebFetch 超时且无 gh（按红线不装不索取）——按用户明示以提示词信息开展源码定向复现，未读取原文如实记录。

## 首失 → 根因 → 修复 → 复测

| # | 项 | 首失 | 根因 | 修复（拥有者 `packages/experimental/webworker-runtime`） | 复测 |
|---|----|------|------|------|------|
| A | duplication 门禁 | logs/01（exit 1，唯一 clone：transform.ts [826:38–833:4] 对 [841:51–848:6]，8 行 87 tokens） | `blockScopeNames` 与 `switchScopeNames` 重复同一段词法声明收集循环 | 抽取 `collectLexicalNames(statement, into)` 共享函数；let/const/class/function 收集、var/函数作用域区分、switch 全 case 单一词法作用域均不变；`.jscpd.json` 未动 | logs/04（exit 0，0 clone） |
| B | 具名导入被调方/标签 receiver | logs/02（三条 `expected 'false' to be 'true'`：直接调用/可选调用/tagged template 的 `this === undefined` 均为 false——receiver 是 held 模块） | `importedRead` 具名读取为成员表达式 `held["name"]`，Identifier visitor 在 callee/tag 位置原样替换，调用带上了 held 模块 receiver | Identifier visitor 识别 CallExpression/OptionalCallExpression `callee` 与 TaggedTemplateExpression `tag` 位置的具名导入，该处发射 `(0,held["name"])` 逗号表达式恢复无接收者调用；`new` 被调方、值读取、namespace 成员调用、default 括号访问器不动。发射样本 logs/12 | logs/03、07（含 15 条新用例全过） |
| C | switch 判别式作用域 | logs/02（`expected '"threw: selected is not defined"' to be '2'`：判别式被 case 声明遮蔽后未改写，运行时 ReferenceError） | `SwitchStatement` 在遍历 discriminant 前压入 `switchScopeNames`，case 内声明错误遮蔽外层判别式里的导入 | 判别式在压入 case 作用域前按外围作用域访问一次；cases（含 test 表达式）仍共用同一词法作用域；TDZ 与 case 间遮蔽保留（fall-through 控制组先败先过均通过） | logs/03、07 |

B/C 改变发射代码，`LOWERING_VERSION` 按其自身合同（"Bump on any change to emitted code"）由 `dsh-worker-transform/2` 升至 `/3`（`src/image-layout.ts`）；host 拒绝旧镜像的合同检查不变。包 README 双语（en/zh 第 29 行）补述 receiver 与判别式规则并重录 `.i18n.yaml` 配对。

## 门禁与测试（真实结果）

- `pnpm run duplication`：logs/01 首失 exit 1 → logs/04 exit 0（0 clone，1746 文件）。
- `pnpm exec vitest run …/transform.spec.ts …/image-loadable.spec.ts`：logs/02 首失 8 failed | 322 passed（330；两 Vitest project 各 165，B×3+C×1 每 project）→ logs/03、07 均通过：4 个测试文件（两 project × 两文件）、356 用例（transform 330 + packer 26）。transform 项目计数 300→330（新增 15 条/每 project 15 条）。
- `pnpm run typecheck`：logs/05 exit 0。
- `pnpm run lint`：logs/06 exit 0（0 warning 0 error，3594 文件）。
- `pnpm --filter @deepseek-ai/dsh-web-frontend run build:preview`：logs/08 exit 0；镜像 `apps/web/dist/preview/vfs-image.tar.gz` 内 `config/vfs-manifest.json` 携带 `dsh-worker-transform/3`（本文件目录核验）。
- `DSH_SNAPSHOT=replay pnpm exec vitest run --config vitest.web.config.ts apps/web/tests/preview-boot.e2e.ts`：logs/09，1 文件 1 用例通过（30447ms）。
- 文档：logs/10 首次 `test:docs` exit 1（README 配对需重录）→ `verify-translation-pairing --write`（README 与新 Agent Note 各一次，logs/13）→ logs/11、14 `test:docs` 16 门禁全过。
- 未执行（按红线）：全部 Web 矩阵、完整 coverage、exe-wheel 矩阵、六 Windows golden、其他五个 r32 Web 文件复跑、CI 重跑/取消；record 模式与生产预览部署未进。

## r32 更正（保留并补充；r29–r32 冻结日志未改动）

1. 保留 r32 既有更正：transform.spec 新增 15 条用例、项目计数 270→300（本轮再增至 330）。
2. r31 run 34826069700 的 artifact 10340308315 确实包含 Web 错误输出（此前记为无 Web 输出不确）。
3. 原 queue #185（CI-only "Minified React error #185"）对应 queue-actions 首个编辑/删除/保留场景，而非第二个布局场景。
4. r32 对 `/goal`、慢机与 #185 之间的联系仍非真实栈证明——维持未确认状态，不盲目重跑 queue。
5. CI 事实引用（远端已核验）：run 34859637639（#21 attempt1）consumers artifact 10354308279（ZIP 5,487 字节，SHA-256 71c95121b7e2c28eb839f1d2d259051210d8287219f754d38fd0d7e4b17f062a；manifest 5 成员+manifest 共 6 文件）；PR head=acca50b616…、checkout=0148bd1bfa60…、共同 tree=bdf3a3675f…、aggregate=ci-consumers；Linux consumers 3 passed/1 failed/7 skipped、Windows observational 53 passed/1 failed/0 skipped，唯一根因同为本处 duplication；Web 未执行（不据此判成败）。本机未下载原 ZIP（无 gh、按指示不装不建），如实记录。

## 决策记录

Agent Note：`.agents/notes/implemented/bug-fix/2026-09-14-webworker-transform-r33-remediation.md`（双语，配对已录）。
