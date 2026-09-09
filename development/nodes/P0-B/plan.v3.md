# P0-B plan.v3

规划者固定为真实 Codex：`gpt-6-astra`，`model_reasoning_effort="max"`。本计划只定义 ZCode 的实施、验证和候选交付，不执行真实模型/API/harness，不读取或保存任何 API key 值，不修改仓库，不调用其他代理、模型、Skill、AskUser 或规划工具，也不规划 P0-C。

P0-A 的 `candidate.r03`、OpenCode `r03 PASS`、P0-B `plan.v1`、`plan.v2`、现有失败证据和归档文件均保持不变。P0-B v3 使用新的版本化文件名和证据目录，禁止覆盖旧计划、旧 schema、旧 candidate 或 `config-v2` 原始收据。

## 当前基线和状态

以下文件是只读前置证据：

- `development/nodes/P0-B/evidence/authorized-isolated-compatibility-v2.json`
- `development/nodes/P0-B/evidence/b2-validation.json`
- `development/nodes/P0-B/evidence/codex-capability-matrix.json`
- `development/nodes/P0-B/evidence/claude-code-capability-matrix.json`
- `development/nodes/P0-B/evidence/discovery/opencode.json`
- `development/nodes/P0-B/evidence/discovery/grok.json`
- `development/nodes/P0-B/evidence/governance/*`
- `D:/Temp_projects/dsh861-p0-b-harness-validation/config-v2/`

当前状态仍为 `BLOCKED`：

- Codex、Claude Code、Product OpenCode 的简单响应只能记为 `COMPATIBILITY_RESPONSE_RECEIVED`。
- 这些响应没有证明真实工具 allow/deny、取消、handoff、外部进程、filesystem 或网络观察。
- Grok 的 `grok-4.6-build` 与请求的 `grok-4.6` 仍未闭合，状态保持 `BLOCKED`，不得把请求模型改成 build 别名。
- `scripts/p0-b/validate-harness.ts` 是 adapterless B2 foundation，只能作为现有验证器保留；不能把它描述成真实 adapter runner 或完整 harness PASS。
- `controlled.py` 是临时探索脚本，不是可信产品实现或证据来源。

统一结果枚举：

```text
COMPATIBILITY_RESPONSE_RECEIVED
PASS
BLOCKED
FAIL
NOT_RUN
INCONCLUSIVE
```

所有结果必须带 `failureClass` 或 `blockReason`。至少支持：

```text
CREDENTIAL_MISSING
CREDENTIAL_SOURCE_FORBIDDEN
SECRET_LEAK_DETECTED
ENDPOINT_UNREACHABLE
AUTH_REJECTED
MODEL_UNAVAILABLE
WIRE_PROTOCOL_MISMATCH
MODEL_OR_RESULT_NOT_CONFIRMED
NATIVE_PERMISSION_UNOBSERVED
TOOL_NOT_AVAILABLE
CANCEL_PROTOCOL_UNCONFIRMED
QUIESCENCE_NOT_REACHED
HANDOFF_UNSUPPORTED
COLLECTOR_UNAVAILABLE
EXTERNAL_SIDE_EFFECT_UNOBSERVED
```

## B0：治理和凭据安全

目标文件：

- `scripts/p0-b/credential-ref.ts`
- `scripts/p0-b/redaction.ts`
- `scripts/p0-b/security-gates.ts`
- `development/nodes/P0-B/governance/p0-b-v3-security.json`
- `.agents/notes/implemented/architecture/2026-09-09-p0-b-real-harness-evidence-v3.md`

`controlled.py` 的处理要求：

1. 从任何产品 runner、npm script、证据生成路径中移除对 ZCode 内部会话数据库、本地 SQLite 文本、聊天记录或未知文件的读取。
2. 不把该脚本复制到仓库或候选目录。若临时目录仍保留它，必须标记为探索残留，不能列为可信证据。
3. 通过静态 gate 拒绝 runner 中的 SQLite 会话路径、任意文件凭据读取、环境变量全量转储、shell command substitution 和未经 allowlist 的 credential source。
4. 产品 runner 只接受显式 `credentialRef`，例如环境变量引用或受控 secret reference。credential reference 只包含引用标识，不包含值。
5. 解析器只允许显式 source-to-target 映射，记录 source env 名称和 target env 名称；子进程 argv 永远不放置凭据值。
6. 凭据只在父进程内存和子进程启动环境中存在。不得写入 stdout、stderr、Session、evidence、snapshot、candidate、npm 配置、日志、临时配置文件或进程命令行。
7. 无授权环境变量或 secret reference 时，结果为 `BLOCKED/CREDENTIAL_MISSING`，不进行重试。

建议的内部接口：

```ts
type CredentialRef =
  | { kind: "env"; name: string }
  | { kind: "secret-reference"; id: string };

type ResolvedCredential = {
  sourceName: string;
  targetName: string;
  presentFingerprint: "missing" | "empty" | "nonempty";
  value: string; // memory-only; never serialised
};
```

`presentFingerprint` 只记录 `missing`、`empty` 或 `nonempty`，不保存原值、原值摘要或可离线猜测的稳定 hash。若实现需要内存中的临时比对材料，必须在进程结束前清除，且不得进入证据对象。

密钥泄漏检测必须在持久化前执行：

- stdout/stderr 采用分块流式扫描，匹配内存中的实际凭据值及必要的转义、URL 编码形式。
- 检查 JSON、环境快照、进程命令行、HTTP 记录、错误诊断和文件内容摘要。
- 命中后立即替换为固定 `[SECRET_REDACTED]`，设置 `secretLeakDetected=true`，终止该 case 的 PASS 判定。
- 持久化的只能是脱敏后的原文、脱敏流 hash、命中位置类别和 source/target env 名称。
- 加入负向测试，验证凭据值不会出现在 argv、文件、日志、Session、snapshot、npm 配置或 evidence 中。
- 扫描结果本身不能回显匹配值。

## B1：协议和产品发现

目标文件：

- `scripts/p0-b/discovery/collect-product-facts.ts`
- `scripts/p0-b/discovery/protocol-facts.ts`
- `development/nodes/P0-B/evidence/discovery-v3/`

只使用真实产品的本地帮助、源码或已授权的安装内容确认能力。发现结果必须区分：

```text
CONFIRMED_FROM_HELP
CONFIRMED_FROM_SOURCE
OBSERVED_AT_RUNTIME
ASSUMED
```

`ASSUMED` 不能支持 PASS。

需要重新确认并记录：

- Codex app-server 的启动参数、permission mode、tool event、native cancel、session/continuation 方法。
- Claude SDK/CLI 的 permission mode、工具回调实际事件、Anthropic Messages 请求和响应事件、cancel、session persistence 和 continuation 能力。
- Product OpenCode 的 `run --format json`、`acp`、`serve`、工具权限、cancel、session/handoff 方法。
- Grok 的 `agent` 协议、工具权限、cancel、session/handoff、模型配置和输出事件。帮助未确认的 flag、env 或协议不得直接使用。
- 每个角色的 native usage、native model、native reasoning 字段来源。

Grok 的模型核验必须单独完成：

1. 检查 quoted `[model."grok-4.6"]` 配置是否被 `inspect` 正确解析。
2. 记录实际发出的请求 JSON 中的 `model` 字段。
3. 记录 native usage 中的模型字段和最终响应模型字段。
4. 请求 endpoint 的模型列表并检查是否存在精确 `grok-4.6`。
5. 比较 config inspect、请求字段、endpoint 返回、native usage 和最终响应。
6. 任何一处仍显示 `grok-4.6-build`、缺少字段或无法观测，都保持 `BLOCKED/MODEL_OR_RESULT_NOT_CONFIRMED`，不得改用 build 别名制造通过结果。

B1 是 `pnpm-lock.yaml` 的唯一责任者。若 package-local Grok 安装不需要仓库依赖，禁止修改 lockfile。

## B2：版本化 schema、runner 和 collector

目标文件：

- `scripts/p0-b/schema-v2.ts`
- `scripts/p0-b/run-v3.ts`
- `scripts/p0-b/runner-config.ts`
- `scripts/p0-b/collectors/redacted-stream.ts`
- `scripts/p0-b/collectors/process-tree.ts`
- `scripts/p0-b/collectors/network.ts`
- `scripts/p0-b/collectors/filesystem.ts`
- `scripts/p0-b/collectors/global-bait.ts`
- `scripts/p0-b/collectors/native-events.ts`
- `scripts/p0-b/collectors/session-artifacts.ts`
- `scripts/p0-b/__tests__/`

中央 successor 使用新的 `p0-b-evidence.v2` schema。不得原地修改任何 `schema.v1` 文件或旧 evidence。读取器可以同时读取 v1 和 v2，但写入器只能写 v2。

每个 run 生成独立目录：

```text
development/nodes/P0-B/evidence/runs-v3/<run-id>/<role>/
  run.json
  stdout.redacted.log
  stderr.redacted.log
  process-tree.json
  network.json
  filesystem-before.json
  filesystem-after.json
  global-bait.json
  tools.json
  native-events.jsonl
  usage.json
  session.json
  handoff.json
  artifacts.json
  verdict.json
```

`run.json` 至少包含：

```text
schemaVersion
planVersion
runId
role
caseId
sourcePlane
artifactPlane
runRoot
cwd
executable/hash
argvRedacted
credential source/target env names
presenceFingerprint
endpoint host/path
model requested/native/final
reasoning requested/native/final
startedAt/finishedAt
status
failureClass/blockReason
```

采集要求：

- source plane 只解析仓库 `src` 和 tsconfig paths；artifact plane 只运行构建后的 `lib`、CLI 或 package-local 安装。两者不能混合。
- 每个角色拥有独立 run root、cwd、HOME/config、cache、state、session、log 和 socket。
- filesystem before/after 同时覆盖 run root、外部 bait 目录和角色全局配置目录。内容只记录类型、大小、hash、创建/修改/删除状态；可能含敏感值的文件不保存正文。
- global bait 必须位于 run root 之外，至少覆盖外部文件、外部目录和全局配置诱饵。
- 进程树记录 PID、父子关系、可执行文件、退出状态、开始/结束时间和脱敏 argv；无法取得完整树时标记 `COLLECTOR_UNAVAILABLE`。
- 网络观察记录监听端口、目标 host/path、连接时间、状态和异常目标；不记录 Authorization、API key 或完整请求头值。
- native events、permission decision、tool call、usage、session id、artifact id 和取消确认均来自真实产品事件或协议。
- `tools.json` 必须区分 declared、visible、requested、actuallyCalled、completed、denied；“模型说调用了”或“未调用”不是工具证据。
- 参数只保存脱敏后的结构和 hash；不保存可能含凭据的原始工具参数。

取消参数必须来自经过验证的 `RunnerConfig`，例如 `cancelRequestMs`、`cancelGraceMs`、`quiescentStableMs` 和 `collectorPollMs`。不得在插件中隐藏部署 tunable，也不得通过无限重试、长时间 sleep、全局串行或扩大 timeout 掩盖不确定性。

取消证据必须包含：

```text
cancelRequestedAt
nativeCancelMethod
nativeCancelAcceptedAt
processExitAt
descendantExitAt
listenerClosedAt
lastFilesystemMutationAt
quiescentObservedAt
```

若产品没有真实取消协议，只能记为 `BLOCKED/CANCEL_PROTOCOL_UNCONFIRMED`；强制杀进程不能单独构成 cancel PASS。

## B3：Codex adapter

目标文件：

- `scripts/p0-b/adapters/codex.ts`
- `scripts/p0-b/protocols/codex-app-server.ts`
- `scripts/p0-b/fixtures/codex/`
- `scripts/p0-b/__tests__/codex-*.test.ts`

隔离：

- 独立 `CODEX_HOME`、cwd、run root、session/log/cache 和进程树。
- 使用 package-local app-server；permission mode、model、effort 和 endpoint 由显式 config 注入。
- argv 只出现 flag 和非敏感路径，不出现 credential 值。

wire 验证：

- 通过受控 HTTP 观察确认 Codex native Responses 请求的 method、path、JSON 字段、stream/event 类型和响应 model。
- 单独验证 gateway 是否接受 Responses wire；Claude 的 Messages 成功不能替代该结论。
- `Model metadata for gpt-6-astra not found` 只能记录为 diagnostic warning，不能清除或转化为 PASS。

真实操作：

- allow：使用产品实际暴露的 shell/filesystem 工具，在 run root 内创建确定性的 marker，并同时观察 native tool request、permission allow、工具进程和文件 hash。
- deny：请求产品实际工具写入 run root 外的 global bait；必须看到 native permission deny/blocked 事件和工具尝试，且 bait 不得改变。adapter 预拦截、模型拒答或普通文本均为 `NOT_RUN`。
- cancel：启动产品确认支持的长运行工具或 turn，调用 native cancel 方法，验证事件、子进程退出和 quiescent。
- handoff：只有 app-server 确认存在 native session/continuation 方法时才执行；否则 `BLOCKED/HANDOFF_UNSUPPORTED`，不能拼接文本模拟。

## B4：Claude Code adapter

目标文件：

- `scripts/p0-b/adapters/claude-code.ts`
- `scripts/p0-b/protocols/claude-messages.ts`
- `scripts/p0-b/fixtures/claude-code/`
- `scripts/p0-b/__tests__/claude-*.test.ts`

隔离：

- 独立 `CLAUDE_CONFIG_DIR`、HOME、XDG、cwd、cache、session、log 和 run root。
- 使用 SDK/CLI 的显式 `model`、`effort`、permission mode、`settingSources` 和 `persistSession=false`。
- 不读取用户全局 Claude 配置，不把 secret 写入 settings 或命令行。

wire 验证：

- 单独观察 Anthropic Messages 请求和响应：path、content type、`model`、`messages`、`system`、`tools`、`stream`、usage 和 native event 类型。
- 若 OpenAI-compatible gateway 返回 404、auth rejection、model unavailable 或非 Anthropic response，记录对应 `failureClass` 并保持 `BLOCKED`。
- 不能用 Codex Responses 的成功响应证明 Claude Messages 兼容。

真实操作：

- allow：使用 Claude Code 实际可见的 Write/Bash 或发现阶段确认的等价工具，对 run root 执行允许的文件或进程操作；保存 native permission、tool call、退出和 artifact 证据。
- deny：在产品 permission mode 或产品原生权限回调实际产生请求后拒绝外部 bait 操作；只有 native deny 和无副作用才算 PASS。
- cancel：使用 SDK/CLI 已确认的 cancel/abort 协议，记录 native ack、进程树和 quiescent。
- handoff：当前 `persistSession=false` 不得推断支持 continuation；除非发现并实测 native session 接口，否则明确 BLOCKED。

## B5：Product OpenCode adapter

目标文件：

- `scripts/p0-b/adapters/opencode-product.ts`
- `scripts/p0-b/protocols/opencode-json.ts`
- `scripts/p0-b/protocols/opencode-acp.ts`
- `scripts/p0-b/fixtures/opencode/`
- `scripts/p0-b/__tests__/opencode-*.test.ts`

Product OpenCode 与硬审核 OpenCode 必须完全隔离：

```text
config-v3/opencode-product/<run-id>/
config-v3/opencode-hard-review/<review-id>/
```

两者不得共享 `OPENCODE_TEST_HOME`、`OPENCODE_CONFIG_CONTENT`、`OPENCODE_AUTH_CONTENT`、cwd、cache、state、session、logs、socket、进程或 credential reference。不得修改用户全局 OpenCode 配置。

优先使用帮助已经确认的真实 `run --format json`；若需要交互式权限、取消或 handoff，则使用帮助已确认的 ACP/serve 协议。非交互 JSON 输出若无法证明模型配置、API 请求、tool event 或 permission event，结果为 `BLOCKED`。

真实操作：

- allow：产品原生工具在 run root 内完成文件或进程操作，记录 JSON/ACP tool event、权限决策、usage 和 artifact。
- deny：产品原生权限系统拒绝外部 bait 操作，并记录拒绝事件；adapter 预筛选或模型文本拒绝无效。
- cancel：调用已确认的 ACP/serve/native cancel 方法；无协议时 BLOCKED。
- handoff：使用产品 native session/handoff 方法验证 session id、continuation 和产物关联，不能伪造 SessionEventMap 事件。

当前没有 DSH OpenCode adapter。新增 adapter、工具桥、skill/MCP 中央桥之前，相关 AC 不能标记完成。

## B6：Grok adapter 和 package-local install

目标文件：

- `scripts/p0-b/adapters/grok.ts`
- `scripts/p0-b/protocols/grok-agent.ts`
- `scripts/p0-b/fixtures/grok/`
- `scripts/p0-b/__tests__/grok-*.test.ts`
- `development/nodes/P0-B/evidence/discovery-v3/grok-model-resolution.json`

安装目录必须全部独立：

```text
prefix
cache
userconfig
globalconfig
GROK_HOME
leader socket
work
session
log
```

对应 npm 配置和环境变量只指向该 package-local 树。postinstall 前后检查源码、安装脚本和外部文件，确认不会把凭据或 run root 内容写到仓库、用户 HOME、全局 npm 目录或共享 socket。安装阶段不注入 key。

安装后只能使用真实 `--help`、`inspect`、`agent help`、`models help` 和已确认的 agent protocol。不得根据命名猜测 env、flag、tool 或 cancel 行为。

真实操作：

- allow/deny/cancel/handoff 只有在发现阶段确认相应 native protocol 后执行。
- allow 必须有 native tool request、permission allow、真实副作用和 artifact。
- deny 必须有 native deny/blocked 事件及无副作用。
- cancel 必须有 native cancel ack 和 quiescent。
- 缺少账号、网络、模型权限或 endpoint 可达性时立即记 `NOT_RUN` 或 `BLOCKED`，不重试。

模型核验继续使用请求的 `grok-4.6`。若请求字段、配置 inspect、endpoint 模型列表、native usage、最终响应中仍有不一致，结果保持 `BLOCKED/MODEL_OR_RESULT_NOT_CONFIRMED`。

## B7：Session、handoff 和 artifact

目标文件：

- `scripts/p0-b/session-observer.ts`
- `scripts/p0-b/handoff-observer.ts`
- `scripts/p0-b/artifact-manifest.ts`
- `scripts/p0-b/__tests__/session-*.test.ts`
- `development/nodes/P0-B/evidence/runs-v3/*/session.json`
- `development/nodes/P0-B/evidence/runs-v3/*/handoff.json`

只记录 native session id、continuation token 的存在性、关联关系、事件序列和 artifact manifest；任何 token 值如可能含凭据，必须脱敏或只记录不可逆的存在状态。

`Shared SubagentResult` 当前没有 native usage/tool/session bridge。除非实现确实改变 model-visible 或 session-visible 产品行为，否则不修改 `SessionEventMap`、TypeScript SDK 或 Python SDK projection。若实现原生 continuation 或新增 logged input，则必须同时：

- 更新 `SessionEventMap` 和其 JSDoc；
- 更新 TypeScript、Python SDK 的 expected output；
- 增加 keyless recorded-session snapshot；
- 运行对应 snapshot harness；
- 记录结构变化是否需要新的 `SESSION_FORMAT_VERSION`。

不能用普通文本、拼接 transcript 或 adapter 自己生成的 session id 伪造 handoff。

## 并行任务和文件责任

| 任务 | 唯一责任文件 |
|---|---|
| B0 治理/凭据 | `credential-ref.ts`、`redaction.ts`、`governance/*`、Agent Note |
| B1 发现 | `discovery/*`、package inspection、`pnpm-lock.yaml` |
| B2 schema/collector | `schema-v2.ts`、`run-v3.ts`、`collectors/*`、schema tests |
| Codex | `adapters/codex.ts`、`protocols/codex-app-server.ts`、Codex fixtures/tests |
| Claude Code | `adapters/claude-code.ts`、`protocols/claude-messages.ts`、Claude fixtures/tests |
| Product OpenCode | `adapters/opencode-product.ts`、JSON/ACP protocols、OpenCode fixtures/tests |
| Grok | `adapters/grok.ts`、`protocols/grok-agent.ts`、Grok fixtures/tests |
| Session/handoff | `session-observer.ts`、`handoff-observer.ts`、`artifact-manifest.ts` |
| docs/tests/candidate | `development/nodes/P0-B/README.md`、evidence index、candidate manifest、文档和测试汇总 |
| 根配置 | B0 单一责任者；只允许为 P0-B 显式隔离配置增加必要字段 |

中央 schema、`SessionEventMap`、lockfile、root config 不允许多个任务同时编辑。任务之间通过接口和 evidence fixture 协作，不通过共享临时状态协作。

## 验证顺序和命令

ZCode 按以下顺序实施，每个阶段只运行一次必要命令；角色 case 可并行，但每个 case 必须有独立 run root。

1. 静态安全和类型检查：

```text
pnpm exec vitest run scripts/p0-b/__tests__/security-*.test.ts
pnpm exec vitest run scripts/p0-b/__tests__/schema-*.test.ts
pnpm run typecheck
pnpm run lint
```

2. 协议发现和安装检查：

```text
pnpm exec tsx scripts/p0-b/discovery/collect-product-facts.ts --role <role>
pnpm exec tsx scripts/p0-b/security-gates.ts --plan P0-B/v3
```

3. 每个真实角色执行单次兼容性 case。credential 参数只能是引用名称，例如 `--credential-ref env:<AUTHORIZED_ENV_NAME>`，绝不传值：

```text
pnpm exec tsx scripts/p0-b/run-v3.ts --plan P0-B/v3 --role <role> --case compatibility --credential-ref <reference> --run-root <unique-root>
```

4. 只有兼容性和协议条件满足时，执行真实 allow、deny、cancel、handoff case：

```text
pnpm exec tsx scripts/p0-b/run-v3.ts --plan P0-B/v3 --role <role> --case allow ...
pnpm exec tsx scripts/p0-b/run-v3.ts --plan P0-B/v3 --role <role> --case deny ...
pnpm exec tsx scripts/p0-b/run-v3.ts --plan P0-B/v3 --case cancel ...
pnpm exec tsx scripts/p0-b/run-v3.ts --plan P0-B/v3 --case handoff ...
```

5. 汇总和证据校验：

```text
pnpm exec tsx scripts/p0-b/validate-harness.ts --schema p0-b-evidence.v2 --evidence-root development/nodes/P0-B/evidence/runs-v3
pnpm exec tsx scripts/p0-b/security-gates.ts --scan-evidence development/nodes/P0-B/evidence/runs-v3
pnpm run test:docs
```

若代码影响已发布产品路径，再运行受影响包的 focused tests、构建 smoke 和必要的 `test:snapshot`。没有 loop、SessionEventMap 或 SDK projection 变化时，不添加无意义 snapshot；发生这些变化时，snapshot 必须同一 PR 更新。

任何 endpoint 失败、auth 拒绝、model unavailable、响应格式不匹配、权限事件不可观测、collector 受 sandbox 限制或 quiescent 未达成都保留明确失败证据，不通过 retry、sleep、扩大 timeout 或删除失败收据来改变结果。

## AC 映射

| AC | v3 判定 |
|---|---|
| AC-01 | 四角色配置已有兼容性收据，但尚未形成完整隔离 harness PASS，保持 `PARTIAL/BLOCKED` |
| AC-02 | 凭据 source、target env、进程和文件隔离完成前为 `BLOCKED` |
| AC-03 | Codex/Claude 仅可分别证明各自 native wire；OpenCode/Grok 未完成 adapter 前为 `BLOCKED` |
| AC-04 | 必须同时记录 requested/native/final model 和 reasoning；任一缺失为 `BLOCKED` |
| AC-07 | 四角色真实 allow 和 deny 未全部取得 native 权限及副作用证据前为 `BLOCKED` |
| AC-10 | 四角色真实 cancel、退出和 quiescent 未全部闭合前为 `BLOCKED` |
| AC-21 | 未实现 DSH Product OpenCode provider 前为 `BLOCKED` |
| AC-23 | 未有 native session continuation/handoff 和 artifact 关联前为 `BLOCKED` |
| AC-24 | 未实现并验证真实 tool/skill/MCP 中央桥前为 `BLOCKED` |
| AC-31 | 只能提交带部分验证、部分阻塞矩阵的候选，不能宣称完成 |

因此，在 DSH OpenCode/Grok provider、工具/skill/MCP 中央桥、原生 continuation 或四角色真实 allow/deny/cancel 尚未全部实现和验证前，不得宣称 AC-01、AC-02、AC-03、AC-04、AC-07、AC-10、AC-21、AC-23、AC-24、AC-31 已完成，也不得进入 P0-C。

## 候选、清理和硬审核准入

候选使用新的版本化目录，例如：

```text
development/nodes/P0-B/candidate.v3/
  plan.v3.md
  implementation-manifest.json
  evidence-index.json
  capability-matrix.v3.json
  blocked-matrix.v3.json
  checks.txt
  review-request.md
```

允许冻结“部分验证 + 部分阻塞”候选的条件：

- 旧计划和旧证据未被修改。
- v2 schema validator、secret leak gate、类型检查、focused tests 和文档检查通过。
- 每个角色都有 run manifest；未运行的 case 有明确 `NOT_RUN/BLOCKED` 原因。
- Codex、Claude Code、Product OpenCode 的简单响应明确标记 `COMPATIBILITY_RESPONSE_RECEIVED`。
- Grok 的模型不一致完整保留，未改成 build 别名。
- 所有 stdout/stderr、HTTP 记录、argv、filesystem manifest、Session 和 artifacts 均完成脱敏。
- 证据中没有任何 API key 值或 secret-derived stable value。
- 候选明确列出尚未实现的 provider、工具桥、continuation 和 AC 状态。

硬审核必须由独立真实 OpenCode 进程完成，配置为 `zhipuai-coding-plan/glm-5.3`、`--variant max`，使用独立 review root、cwd、home、cache、state、logs、session、socket 和 credential reference。审核进程不得复用 Product OpenCode 的任何目录、进程或 Session。审核输入只包含候选、脱敏 evidence index、diff 和检查结果。

只有在真实 OpenCode 硬审核返回 `PASS`，并且审核确认：

- schema successor 没有破坏 v1；
- secret source 和持久化检查闭合；
- 四角色隔离可重复；
- 每个已标记 PASS 的 allow/deny/cancel/handoff 都有 native event、实际工具或协议、进程/filesystem/network 观察；
- Codex Responses 与 Claude Messages 分别验证；
- Grok 精确请求模型与 native/final 结果闭合；
- Product OpenCode 与硬审核角色完全分离；
- 所有未完成 AC 仍正确标记为 BLOCKED；

才可冻结 P0-B v3 候选。即使硬审核通过部分验证候选，也只能作为 P0-B 的审查结果，不能绕过上述 AC 阻塞进入 P0-C。
