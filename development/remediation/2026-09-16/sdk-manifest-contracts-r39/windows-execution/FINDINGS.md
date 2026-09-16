# r39 FINDINGS：已升级 SDK/CLI/平台/MCP/Zod 身份断言对齐 + 空 YAML 与非映射拒绝分层（Windows 执行）

日期：2026-09-16。分支 `chore/latest-stable-upgrade-20260912`，起点提交 `9bd5c20ff49568a9fb7da80861f7d03220f620d8`（本地 HEAD 与远端 `git ls-remote` 一致、工作树起点干净、未重复 fetch）。PR #13 保持草稿，base `feat/multi-agent-company-nodes` 不变。任务来源：PR #13 评论 issuecomment-5691707371（A–G 任务说明）与 issuecomment-5691696495（CI 取证），均经无凭据 api.github.com REST 读取全文（HTTP 200）。本轮为升级收尾的测试身份/诊断对齐，不是 P0 节点规划/硬审核，未调用任何外部代理。

工具链：Node v26.8.2（`C:\dsh-r24-upgrade-20260912-01\node-v26.8.2-win-x64`）+ pnpm 12.4.1（`C:\dsh-r24-upgrade-20260912-01\pnpm-12.4.1\pnpm.exe`），两条目录显式 PATH 前缀。系统 pnpm shim（指向缺失 AppData 路径）未修复、未安装/升级任何工具、未安装 gh、未改任何认证。

## 1. 起点与允许范围核验

任务 A 节起始 blob 与本地 `git ls-tree HEAD` 全部一致（三个可改文件起点 blob 与保护面 blob 见 00-start-state.md）。修改面：仅三个测试文件 + 新中英 Note 三件套 + 本证据目录。

## 2. 已安装身份证据（全部实际读取，无推算）

- `@anthropic-ai/claude-agent-sdk` package.json（经 `import.meta.resolve` 自 provider 包解析）：version **0.3.269**；claudeCodeVersion **2.1.269**；optionalDependencies 全部 8 个平台包（darwin-arm64/-x64、linux-arm64/-x64（含 musl×2）、win32-arm64/-x64）均为 **0.3.269**。
- 本机平台包 `@anthropic-ai/claude-agent-sdk-win32-x64` package.json version **0.3.269**，同目录含 claude.exe（约 222.7 MB）。
- **claude.exe --version**（隔离 HOME/CLAUDE_CONFIG_DIR/XDG_CONFIG_HOME、fake key、禁遥测环境执行）：stdout `2.1.269 (Claude Code)`，exit 0。
- **SDK init 消息 claude_code_version**：修复后 real-product 首用例真实通过 `expect(initMessage?.claude_code_version).toBe('2.1.269')`（logs/11）——CLI 身份三条证据（package.json / 二进制 --version / init 消息）闭合，非从 SDK 版本号推算。
- provider package.json dependencies：`@anthropic-ai/claude-agent-sdk` **0.3.269**、`@modelcontextprotocol/sdk` **^1.30.0**、`zod` **^4.6.2**；dependencies 无 `@deepseek-ai/dsh-subagent-codex`。
- pnpm-lock.yaml：全部平台包 `@0.3.269` 条目与 SDK optionalDependencies 映射行齐全（00-start-state.md 记录）。
- js-yaml（session-snapshot 解析环境）**5.4.2**：`yaml.load('', {schema: JSON_SCHEMA})` 抛 `YAMLException: expected a document, but the input is empty`；`'null\n'`→null、`'42\n'`→42、`'- item\n'`→["item"]；真实 `parseSnapshotManifest` 包装消息分别为 `session-snapshot: case/snapshot.yml: invalid YAML: …` 与 `session-snapshot: case/snapshot.yml: manifest must be a mapping`。

## 3. 三文件实际改动（起始 blob → 终态 blob）

| 文件 | 起始 blob | 终态 blob | 改动 |
| --- | --- | --- | --- |
| packages/subagent/subagent-claude-code/tests/subagent-claude-code.spec.ts | 781a13a58750c0a8aa4060eaef7cabdfb86e58ac | 468dba8a80f5b05a8ae5fb22efcd2f2e1da868bb | 行 61–62 常量 0.3.263/2.1.263→0.3.269/2.1.269；行 355–359 MCP `^1.29.0`→`^1.30.0`、Zod `^4.4.3`→`^4.6.2` |
| packages/subagent/subagent-claude-code/tests/real-product.spec.ts | 279c844e0b381c100b48c088bbbf097916df6b59 | 776a6702121cfde8f825170b097a48adb4ff2d9a | 行 289 describe 标题、行 299–301 sdkPackage 三断言、行 305 二进制 --version、行 318 init claude_code_version：0.3.263/2.1.263→0.3.269/2.1.269。sentinel `REAL_CLAUDE_CODE_SENTINEL_2_1_237` 未动 |
| packages/test-support/session-snapshot/tests/manifest.spec.ts | 974d07e7e8fb88bd554b0b5e803722907f4bf846 | 98eb9e15d31e810a647b988cdddda2ea79c862d1 | 行 162 空输入期待 `['', 'manifest must be a mapping']`→`['', 'session-snapshot: case/snapshot.yml: invalid YAML']`（保留诊断 path、不锁上游逐字文本）；行 163–165 新增 `null\n`/`42\n`/`- item\n` 三行均期待 `manifest must be a mapping` |

保护面终态复验（`git diff HEAD` 为空）：provider package.json（9bb358b7…）、src/manifest.ts（d42ac977…）、scripts/run-gates.ts（664e1a0e…）、scripts/run-gates.spec.ts（ffbaf61e…）、pnpm-lock.yaml 全程未动。

## 4. 真实基线、修复复测、负控与恢复（每步命令与真实退出码）

| 步骤 | 命令 | exit | 结果 | 日志 |
| --- | --- | ---: | --- | --- |
| 基线首失 | `pnpm exec vitest run --project thread-safe <三文件>` | 1 | **3 failed / 88 passed（91）** | logs/10 |
| 修复后完整复测 | 同上 | 0 | **3 文件 / 94 passed（94）**（91+3 新行） | logs/11 |
| NC1 恢复 SDK 旧常量 0.3.263 | 同上 + `-t "ships one independently installable provider-only Bundle patch"` | 1 | **1 failed / 41 skipped（42）** | logs/20 |
| NC2 恢复 MCP 旧期待 ^1.29.0 | 同上 | 1 | **1 failed / 41 skipped（42）** | logs/21 |
| NC3 恢复 Zod 旧期待 ^4.4.3 | 同上 | 1 | **1 failed / 41 skipped（42）** | logs/22 |
| NC4 恢复空输入旧 mapping 期待 | `… manifest.spec.ts -t "rejects invalid metadata"` | 1 | **1 failed / 37 passed / 6 skipped（44）** | logs/23 |
| 恢复后最终正向 | `pnpm exec vitest run --project thread-safe <三文件>` | 0 | **3 文件 / 94 passed（94）** | logs/12 |

基线三项首失（与 CI run35047469159 诊断一致）：
1. manifest.spec.ts it.each 空输入行（旧行号 198）：`expected [Function] to throw error including 'manifest must be a mapping' but got 'session-snapshot: case/snapshot.yml: invalid YAML: YAMLException: expected a document, but the input is empty'`。
2. real-product.spec.ts:299：`expected '0.3.269' to be '0.3.263'`（其后 CLI/平台/init 断言未到达）。
3. subagent-claude-code.spec.ts:351：`expected { …(6) } to have property "@anthropic-ai/claude-agent-sdk" with value '0.3.263'`（其后 MCP/Zod 断言被遮）。

负控失败的准确断言位置与消息（恢复旧期待逐项进行，聚焦 bundle/manifest 用例，执行数非零）：
- NC1 @ subagent-claude-code.spec.ts:351:35 — `toHave property "@anthropic-ai/claude-agent-sdk" with value '0.3.263'`（Expected "0.3.263" / Received "0.3.269"）。
- NC2 @ 355:35 — `toHave property "@modelcontextprotocol/sdk" with value '^1.29.0'`（Expected "^1.29.0" / Received "^1.30.0"）。
- NC3 @ 359:35 — `toHave property "zod" with value '^4.4.3'`（Expected "^4.4.3" / Received "^4.6.2"）。
- NC4 @ manifest.spec.ts:201:70 — `to throw error including 'manifest must be a mapping' but got 'session-snapshot: case/snapshot.yml: invalid YAML: …'`——因真实错误分类不同而失败，非语法/导入/超时/零测试。

恢复核验：候选字节预存（SHA-256：subagent-claude-code.spec.ts 628a8cee…、real-product.spec.ts ea12a232…、manifest.spec.ts 124fb4dd…，见会话记录）；每次负控后无条件恢复，`git hash-object` 复验与候选一致（468dba8a…/776a6702…/98eb9e15…），随后最终正向 94/94 通过。负控期间未 mock 包元数据、未变更产品 manifest/锁/parser。

## 5. 门禁（最终字节）

| 命令 | exit | 备注 | 日志 |
| --- | ---: | --- | --- |
| `pnpm run typecheck` | 0 | 首跑即过 | logs/30 |
| `./node_modules/.bin/jscpd --config .jscpd.json packages scripts` | 0 | 0 clones（`pnpm run duplication` 的 .cmd shim 本机指向缺失路径，按 r38 先例直调同一 jscpd sh shim） | logs/31 |
| `pnpm run lint` | 0 | 0 warnings / 0 errors，3595 文件 | logs/32 |
| `pnpm run verify-translation-pairing --write …sdk-manifest-contracts-r39.md` | 0 | 1 record（zh 侧跨 Note 链接按配对规则指向 `.zh.md` 目标） | logs/33 |
| `pnpm run test:docs` | 首失 1 → 复跑 0 | 首失唯一项 markdown links：两份新 Note 指向当时尚未写入的 FINDINGS.md（target does not exist）；FINDINGS.md 写入后复跑 **16 passed / 0 failed / 0 skipped** | logs/34（首失）、35（复跑） |

Note 三件套：`.agents/notes/implemented/testing/2026-09-16-sdk-manifest-contracts-r39.md`（blob 522699ab…）、`.zh.md`（730d8786…）、`.i18n.yaml`（49fc3b03…）。r29–r38 冻结记录未改写。

入库日志规范化（提交阶段，沿 r34–r38 先例）：CRLF→LF、去 ANSI OSC/CSI/ESC 转义、去行尾空白、单一结尾换行；诊断内容不变。原始字节留存于仓库外执行 scratch 目录（Git Bash /tmp/r39-raw-logs），逐文件 raw/normalized SHA-256 对照见 logs/37-hash-normalization.txt；logs/36 为最终入库字节的 SHA-256 清单（其此前版本记录的是规范化前 raw 状态，即独立复审核验 15/15 吻合的那组哈希）。

## 6. 资源清理与隔离（spy 无关）

本轮测试改动不含 spy；负控恢复经字节级复验（见上）。real-product 用例沿用文件内既有 afterEach 清理（contexts dispose、fixtures close、roots 递归删除、observedSdkMessages 重置），复测中全部真实执行且通过——`expectQuiescent`/进程退出验证未改动。消息 fixture 仅绑定 127.0.0.1 随机端口；realInstanceFixture 测试专有 HOME/CLAUDE_CONFIG_DIR/XDG_CONFIG_HOME + fake key + 禁遥测/非必要流量，未读用户认证、未调外部模型服务、未 login。本会话 --version 取证用的临时目录已删除。

## 7. NOT_RUN / 边界

- 未提交、未推送（阶段门要求；等待独立复审 PASS 后另行执行）。
- 未运行完整 coverage、全 Web、Gateway212、Loader122、exe-wheel、六个既有 Windows golden、r38 六项回归复跑（任务明示不要求；r37/r38 已由新 CI 验证）。
- 未下载/重跑 CI artifacts（任务 F 节明示本轮不要求；主会话已完成字节核验）。
- CI 其余保留失败不在本轮范围：Linux 11 项中的其余 8 项与 5 个 FileHandle 异常、Windows 8 项中的其余 5 项与 worker exit 3221225477、Linux64/Windows66 文件覆盖率阈值、Web present-svg React #185、abort-kill 负载敏感观察项。
- 三个用例通过不等于上述任何一项已解决，不预测新的总失败数。
- 补记（提交阶段）：负控期间的逐次恢复 hash-object 输出与预存候选字节副本仅存于执行会话记录、不在本证据目录，此为如实记录的缺口，不补造日志或新增文件（终态三文件 blob 已由独立复审复核吻合；logs/36 中 FINDINGS.md 行为本次补记之前生成时点的哈希）。
- 本机无 gh CLI（未安装）；REST 无凭据读取仅用于任务来源评论。

## 8. 证据文件清单（本目录）

- 00-start-state.md（起点/blob/身份/隔离核验记录）
- FINDINGS.md（本文）
- logs/10-baseline-first-failures.txt（基线 exit 1，3 failed/88 passed）
- logs/11-fixed-full-rerun.txt（修复复测 exit 0，94 passed）
- logs/12-post-restore-final-positive.txt（恢复后最终正向 exit 0，94 passed）
- logs/20–23-negative-control-*.txt（四项负控，各 exit 1，真实断言失败）
- logs/30-typecheck.txt、31-duplication.txt、32-lint.txt、33-translation-pairing.txt、34-test-docs.txt（首失）、35-test-docs-rerun.txt（通过）
- logs/36-evidence-manifest.txt（最终入库字节 SHA-256 清单，17 文件）
- logs/37-hash-normalization.txt（逐文件 raw/normalized SHA-256 与规范化说明）
