以下是 `P0-B plan.v2.md` 的只读正文草案。本轮没有写入仓库、没有安装依赖、没有运行模型/API/真实 harness，也没有读取或保存用户提供的任何密钥。`plan.v1.md`、P0-A、B0–B4 证据及现有失败记录均保持不变。

# P0-B：四种真实 Harness 验证

**节点 ID：** `P0-B`
**计划版本：** `v2`
**计划性质：** 只读规划；本计划本身不修改仓库、不安装依赖、不运行模型/API/真实 harness。
**规划者：** 真实 Codex，固定使用 `gpt-6-astra`，reasoning `max`。
**实施者：** ZCode，依照本计划实施、测试、整合并修复。
**硬审核者：** 真实 OpenCode，使用独立的 zhipu coding plan、`glm-5.3`、reasoning `max`，仅对冻结候选执行只读硬审核。
**工作分支：** `feat/multi-agent-company-nodes`。
**下一节点限制：** 在真实 OpenCode 硬审核对当前冻结候选明确给出 `PASS` 以前，不得进入 P0-C，也不得调用真实 Codex 规划下一节点。

## 1. 基线、历史证据与不可覆盖规则

P0-B v2 继承已经通过并归档的 P0-B v1 计划及其证据。以下文件和事实只读保留：

- `development/nodes/P0-B/plan.v1.md`
- `development/nodes/P0-B/state.json`
- `development/nodes/P0-B/evidence/README.md`
- `development/nodes/P0-B/evidence/schema.v1.json`
- `development/nodes/P0-B/evidence/b0-b4-source-evidence-index.json`
- `development/nodes/P0-B/evidence/b2-validation.json`
- `development/nodes/P0-B/evidence/codex-capability-matrix.json`
- `development/nodes/P0-B/evidence/claude-code-capability-matrix.json`
- `development/nodes/P0-B/evidence/discovery/index.json`
- `development/nodes/P0-B/evidence/discovery/opencode.json`
- `development/nodes/P0-B/evidence/discovery/grok.json`
- `development/nodes/P0-B/evidence/discovery/summary.json`
- `development/nodes/P0-B/evidence/governance/preconditions.json`
- `development/nodes/P0-B/evidence/governance/responsibility-matrix.md`
- `development/nodes/P0-B/evidence/governance/source-index.json`
- `development/nodes/P0-B/evidence/governance/source-index.md`
- `development/nodes/P0-B/evidence/governance/b2-delegation-failure.json`

P0-A 的以下资料继续作为只读前置条件：

- P0-A 候选 SHA-256：`04bb71cbace30c5fbd2a15f4056d9c3067e76df9e658dd543c93f57c870c39bd`
- P0-A 当前候选：`development/nodes/P0-A/candidate.r03.json`
- P0-A 硬审核：`development/nodes/P0-A/reviews/r03.json`
- P0-A 计划：`development/nodes/P0-A/plan.v15.md`
- P0-A 状态、恢复验证、hygiene、依赖解析和全部历史失败证据

不得修改、重命名、覆盖、重新解释或删除 `development/nodes/P0-A/` 下的任何候选、审核、计划和失败记录。P0-B v2 只引用这些文件，不复制后改变其内容。

## 2. v1 BLOCKED 状态的变化和未解决前置条件

v1 的状态仍然是历史上正确的 `BLOCKED`，但用户现在提供了受控验证所需的临时 provider、endpoint、model、reasoning 和 credential 授权条件，因此部分前置状态发生变化。

### 2.1 因用户授权而解除的前置条件

以下条件现在可以进入受控验证流程：

- Codex 真实 provider 运行可以从用户授权的临时 credential source 读取凭据引用。
- Claude Code 真实 provider 运行可以从用户授权的临时 credential source 读取凭据引用。
- Codex 和 Claude Code 的临时 provider/base URL/model/reasoning 配置可以进入一次性隔离进程环境。
- 运行器可以对这两个 provider 执行真实配置兼容性探测、真实 allow/deny 运行和外部进程、文件、协议观察。
- OpenCode 产品和 Grok CLI 的发现工作现在可以在用户授权的网络和凭据条件下继续，但并不代表已经满足协议或隔离条件。

### 2.2 仍然没有被自动解除的前置条件

用户提供的配置不能直接证明以下事实：

- native Codex SDK 是否支持把用户提供的 OpenAI-compatible endpoint 映射为其真实 app-server/provider 配置。
- native Codex SDK 是否接受用户请求的 model 字段和 reasoning 字段，并把它们传到实际请求。
- native Claude Code SDK 是否支持自定义 base URL，或者是否只接受 Anthropic 原生 wire protocol。
- 用户提供的 Claude endpoint 是否实现 Claude SDK 所需要的请求、响应、错误、工具和 usage 协议。
- 当前 OpenCode 产品 binary 是否能在隔离的 config/home/state/cache/log 目录中运行。
- OpenCode 产品 binary 是否支持实际的 `run --format json`、ACP、`serve` 或其他可核实协议。
- `@xai-official/grok@1.0.24` 的安装脚本是否安全，CLI 的 flags/env/config/base URL/model 是否真实存在。
- Grok CLI 是否支持用户提供的 endpoint 和 model。
- native tool trace、usage、session id、continuation/resume 是否进入父 Session。
- 现有 B2 adapterless runner 是否已经能注入凭据、采集原始输出、记录进程树和完成 filesystem-before/after。
- 产品默认 provider、model、endpoint、reasoning 或全局配置是否可以被修改。P0-B v2 不授权这些修改。

任何未被源码、实际帮助输出、实际协议事件、外部网络观察或真实运行结果证明的兼容性，都必须保持为 `UNKNOWN`、`BLOCKED` 或 `NOT_RUN`。

## 3. 用户配置的安全边界

用户已经提供凭据，但本计划不会读取、复制、回显或保存凭据值。

凭据只允许在一次受控运行中通过以下方式进入子进程：

```text
D:\Temp_projects\dsh861-p0-b-harness-validation\<run-id>\
```

允许记录的内容只有：

- 变量名；
- 来源类别，例如 `authorized-environment`、`invocation-reference`；
- 是否存在；
- 非敏感、运行时生成的存在性 fingerprint 或 hash；
- 目标 provider 期望的变量名；
- 是否成功传递到受控子进程的布尔结果。

禁止把凭据值写入：

- 仓库；
- 配置文件；
- `stdout`；
- `stderr`；
- npm 日志；
- Session；
- handoff；
- artifact；
- evidence；
- snapshot；
- candidate；
- Agent Note；
- 任何持久化记忆。

凭据不得出现在命令行参数、进程标题、临时配置文件、错误消息、诊断输出或进程树采集结果中。运行器必须禁止环境变量 dump；进程树只能记录变量名清单和脱敏状态，不能记录变量值。

如果 native 程序要求把 API key 写入配置文件，而没有经过源码和实际命令验证的安全环境注入方式，则该 harness 为 `BLOCKED`。不得为了通过验证把 secret 写入临时配置文件。

日志脱敏规则：

- 运行器在写入磁盘前对已知 secret 及其直接编码形式做脱敏。
- 持久化的 `stdout.raw`、`stderr.raw` 指经过强制脱敏的原始字节流。
- hash 只计算已持久化的脱敏字节流。
- 如果发现疑似 secret 泄漏，立即停止该运行，不保存未脱敏内容，并记录 `secretLeakDetected=true`、泄漏位置类别和脱敏输出 hash。
- 真实 secret 不得进入 npm install 环境；Grok 安装阶段必须使用无凭据的隔离 npm 环境。

## 4. 临时岗位和身份分离

用户请求的配置只用于受控验证，不修改仓库默认设置，也不改变本计划规划者或硬审核者的调用参数。

| 角色 | 临时 provider | 请求的 model/reasoning | 允许用途 | 必须证明 |
|---|---|---|---|---|
| Codex 产品运行 | 用户提供的 `my-gpt` provider | `gpt-6-astra` / `max` | 仅用于隔离的 Codex native provider 运行 | endpoint、model、reasoning 是否被 native Codex 实际接受并传递 |
| Claude Code 产品运行 | 用户提供的 `my-claude` provider | `claude-opus-5` / `max` | 仅用于隔离的 Claude Code native SDK 运行 | endpoint 是否兼容 Claude SDK wire protocol，model/reasoning 是否实际生效 |
| Grok 产品运行 | 用户提供的 `my-grok` provider | `grok-4.6` / `xhigh` | 仅用于隔离的 Grok CLI 运行 | CLI 是否接受 endpoint、model、reasoning 和真实协议 |
| OpenCode 硬审核 | zhipu coding plan | `glm-5.3` / `max` | 仅用于冻结候选的只读硬审核 | 审核进程与产品 OpenCode 运行身份完全分离 |

模型名称本身不是供应商内部路由证明。`gpt-6-astra`、`claude-opus-5`、`grok-4.6`、`glm-5.3` 只能作为请求字段或审核请求字段记录；只有 native 请求、实际响应、外部 endpoint 观察、版本输出或协议事件能够证明最终使用的路由。

硬审核 OpenCode 和产品 OpenCode 必须有不同的：

- `roleId`；
- `run-id`；
- 进程树；
- cwd；
- config directory；
- home directory；
- state directory；
- cache directory；
- log directory；
- credential reference；
- Session；
- evidence root。

即使两者使用相同的 binary、endpoint 或 model，也不得共享运行目录、全局配置、认证状态或进程。硬审核凭据不得自动作为产品 OpenCode 凭据。若产品 OpenCode 没有独立授权的 credential reference，则产品 OpenCode 保持 `BLOCKED`。

## 5. Codex 和 Claude Code 的真实兼容性计划

### 5.1 共同兼容性门

Codex 和 Claude Code 都必须先通过配置兼容性门，才能进入真实 allow/deny 运行。

兼容性门按以下顺序执行：

1. 读取 package-local SDK 的实际版本、入口和配置类型。
2. 读取源代码或官方分发包中关于 endpoint、model、reasoning、permission、env 和 session 的真实支持信息。
3. 构造只含非敏感字段的隔离配置描述。
4. 通过 provider-specific adapter 将用户授权的 credential reference 映射到子进程环境。
5. 通过外部观察确认 native 程序实际使用的 endpoint host/path。
6. 通过 native 请求、协议事件或产品输出确认 model 字段。
7. 通过 native 请求、协议事件或实际帮助/配置输出确认 reasoning 字段。
8. 对不支持的字段停止运行，不静默丢弃、不改名、不降级到默认值。
9. 保存兼容性回执，再决定是否进入真实 allow/deny。
10. 如果兼容性门失败，后续依赖该门的真实运行标记为 `NOT_RUN`，兼容性本身标记为 `BLOCKED` 或 `FAIL`，不得用 mock 或 loopback 代替。

### 5.2 Codex 映射规则

当前已知事实：

- DSH 使用 package-local `@openai/codex`。
- native 入口是 app-server stdio 协议。
- 当前 provider Config 已确认支持显式 env、model、permissionMode 等字段。
- 当前源码没有证明任意 OpenAI-compatible base URL 一定可用。
- 当前实现不会自动提供 `CODEX_HOME`、config、cache、session、log 的完全隔离。
- 父 Session 只接收最终文本、错误和退出结果，native tool request、tool result、usage、产品 session id 和 raw stderr 不会自动进入父 Session。
- 当前没有 native continuation/resume。

v2 必须实际核实：

- native Codex 是否通过显式 env 接受自定义 endpoint；
- 是否需要特定的 OpenAI base URL 变量、provider 配置字段或 app-server 参数；
- 该字段是否被 `@openai/codex` 真实读取，而不是只存在于 DSH 自己的 Config；
- endpoint 路径是否需要 `/v1`、是否由 SDK 自动追加路径；
- model 是否作为 `thread/start` 或 turn 请求中的实际字段发送；
- reasoning `max` 是否有 native 字段、允许值和实际请求映射；
- permission mode 是否作用于产品工具和工作目录；
- 如果 SDK 只读全局 config 或只能使用默认 endpoint，是否可以在不写入 secret 配置文件的前提下隔离。

Codex 的合法映射结果只有：

- `COMPATIBLE_OBSERVED`：源码、实际启动和外部观察都证明 mapping 生效；
- `INCOMPATIBLE_WIRE_PROTOCOL`：endpoint 响应不是 native Codex 所需协议；
- `UNSUPPORTED_BASE_URL`：native SDK 没有安全的自定义 endpoint 入口；
- `UNSUPPORTED_MODEL_FIELD`：model 无法显式传递；
- `UNSUPPORTED_REASONING_FIELD`：reasoning 无法显式传递；
- `AUTH_REJECTED`；
- `MODEL_UNAVAILABLE`；
- `NETWORK_REJECTED`；
- `CONFIG_NOT_ISOLATABLE`；
- `UNKNOWN`：证据不足，不能宣称兼容。

`my-gpt` endpoint 不能仅因名称或 URL 形式而被视为 Codex native endpoint。必须证明真实请求到达该 endpoint，并且 native Codex 能处理返回协议。

### 5.3 Claude Code 映射规则

当前已知事实：

- DSH 使用 `@anthropic-ai/claude-agent-sdk`。
- provider 通过官方 `query()` 启动 Claude Code。
- SDK Config 已确认支持显式 env、model、permissionMode。
- `settingSources` 当前被省略，用户、项目和本地设置可能仍然是 native 权威来源。
- `persistSession=false`。
- 当前没有 native continuation/resume。
- 父 Session 不自动接收 native tool events、usage、中间事件、stderr 和 workspace diff。

v2 必须实际核实：

- Claude SDK 是否支持自定义 base URL；
- 支持方式是 `env`、显式 SDK option、CLI 参数还是其他真实入口；
- endpoint 需要 Anthropic 原生协议还是可以接受 OpenAI-compatible 协议；
- 如果用户提供的 endpoint 只提供 OpenAI Responses/Chat Completions 语义，是否存在官方 native mapping；
- model 是否真实出现在 Claude SDK 请求中；
- reasoning `max` 是否是 Claude SDK 支持的字段、允许值或 provider-specific mapping；
- `settingSources` 省略后，实际运行是否加载用户、项目或本地全局配置；
- `CLAUDE_CONFIG_DIR`、`HOME`、`XDG_CONFIG_HOME`、session/cache/log 是否真正隔离；
- 不能用普通 HTTP 代理或自行重写响应来假定 Claude SDK 已经兼容。

如果 Claude SDK 期待 Anthropic wire protocol，而 `my-claude` endpoint 只返回 OpenAI-compatible 响应，则配置兼容性门必须记录 `INCOMPATIBLE_WIRE_PROTOCOL` 并保持 `BLOCKED`。除非源码和实际协议证明存在官方支持的转换入口，否则 P0-B 不实现未授权的通用协议转换器。

### 5.4 失败分类

兼容性门和真实运行都必须使用统一的 `failureClass`：

- `CONFIG_UNSUPPORTED`
- `BASE_URL_UNSUPPORTED`
- `WIRE_PROTOCOL_INCOMPATIBLE`
- `AUTH_REJECTED`
- `ACCOUNT_NOT_AUTHORIZED`
- `MODEL_UNAVAILABLE`
- `REASONING_UNSUPPORTED`
- `NETWORK_REJECTED`
- `LOCAL_PROTOCOL_UNAVAILABLE`
- `PERMISSION_DENIED`
- `TOOL_POLICY_VIOLATION`
- `GLOBAL_CONFIG_LEAK`
- `FILESYSTEM_ESCAPE`
- `PROCESS_TREE_LEAK`
- `CANCEL_FAILED`
- `NATIVE_CONTINUATION_UNSUPPORTED`
- `OBSERVATION_INCOMPLETE`
- `PRODUCT_ERROR`
- `SECRET_LEAK_DETECTED`

状态分类：

- `BLOCKED`：真实执行前置条件未满足，或 provider、账号、网络、model、wire protocol、隔离方式不能使用；未宣称产品支持。
- `FAIL`：真实程序已经在满足的前置条件下运行，但违反了隔离、权限、取消、进程、文件、Session 或候选声明。
- `NOT_RUN`：因前一阶段失败或停止门而没有执行；不能计入通过。
- `PASS`：真实程序、真实 provider、成功和拒绝路径、外部观察、取消和清理证据全部满足要求。
- 字段级 `UNKNOWN`：某个观察项无法从外部或 native 协议取得；必须附原因，不得用模型自报补齐。

账号失败、model 不存在、网络拒绝和 endpoint wire 不兼容通常属于 `BLOCKED`，因为它们阻止真实产品支持声明。若候选已经错误地宣称该路径可用，而实际运行暴露了本应在兼容性门被发现的缺陷，则该候选实现记为 `FAIL`，修复后才能重新运行。

## 6. OpenCode 产品与硬审核的完全分离

现有 B1 证据只发现了与硬审核角色有关的 OpenCode executable，产品 OpenCode 仍为 `BLOCKED/NOT_RUN`。硬审核 binary、配置、认证状态、cache 和 session 不得被重命名为产品 OpenCode 证据。

产品 OpenCode 必须先通过以下独立发现门：

1. 在隔离 run root 下定位产品 binary 或官方 package 的绝对路径。
2. 读取真实版本。
3. 读取 `--help`、子命令帮助或官方协议说明。
4. 仅探测实际帮助中出现的入口：
   - `run --format json`；
   - ACP；
   - `serve`；
   - 或其他有明确原始证据的协议。
5. 为产品 OpenCode 建立独立的 config/home/state/cache/log 目录。
6. 通过环境变量或非敏感配置字段注入 provider、model、base URL。
7. 通过授权的子进程环境注入 credential reference。
8. 外部确认实际请求使用的 endpoint 和 model。
9. 验证产品 binary 是否读取了全局 config、auth、state、cache 或 log。
10. 验证 allow、deny、取消、交接和真实响应。
11. 验证 `run --format json`、ACP 或 `serve` 的真实输入输出协议。
12. 记录产品 OpenCode 与硬审核 OpenCode 的不同 roleId、run-id、进程树和目录。

产品 OpenCode 的成功条件：

- binary、版本和入口可确定；
- provider/model/base URL/API key 的注入方式有实际证据；
- 没有加载或修改全局 OpenCode 配置；
- 有真实 allow 和 deny；
- 有真实响应和协议事件；
- 取消后产品 OpenCode 自有进程树归零；
- Session、handoff、artifact、usage、native trace 的可见范围有证据；
- 产品 OpenCode 的配置和凭据没有进入硬审核目录。

如果出现以下任一情况，产品 OpenCode 保持 `BLOCKED`：

- 当前 binary 只能使用全局配置；
- 无法建立独立 home/config/state/cache/log；
- 只发现硬审核 binary，没有产品运行入口；
- `run --format json`、ACP、serve 或其他协议无法从帮助或实际响应确认；
- API key 只能写入无法接受的配置文件；
- provider/model/base URL 注入方式未知；
- 取消或进程树无法外部确认；
- native continuation、usage 或工具轨迹无法观察且会影响支持声明。

OpenCode 硬审核只在 P0-B 候选冻结后运行。硬审核结果只证明审核者对当前候选的审查结论，不证明产品 OpenCode 已经成功运行。

## 7. Grok package-local 安装和协议核实

Grok 的现有 B1 证据只证明 npm metadata 可解析，未安装 package、未确认 bin、未确认 CLI 协议、未执行真实运行。

当 Grok 阶段获得执行资格后，安装必须首先使用以下 package-local 命令：

```text
npm --prefix <isolated-root> install --no-save --no-package-lock @xai-official/grok@1.0.24
```

其中 `<isolated-root>` 必须位于：

```text
D:\Temp_projects\dsh861-p0-b-harness-validation\<run-id>\grok-install
```

严格禁止：

```text
npm -g
npm install -g
```

安装约束：

- npm prefix、user config、cache、logs、home 全部指向本次 run 的隔离目录；
- 安装阶段不注入任何 API key；
- 不继承用户全局 npm auth、npmrc、Grok config 或 shell profile；
- 安装前记录 filesystem-before、process-tree-before 和全局配置 hash；
- 安装期间记录 npm 子进程、postinstall 子进程、网络连接和文件写入；
- 安装后记录 filesystem-after、process-tree-after 和全局配置 hash；
- 发现 postinstall 写入 run root 以外、修改用户或机器级 npm 配置、启动未授权长期进程、读取 secret 或产生无法归属的网络副作用时，停止后续协议探测；
- 已授权安装但违反隔离要求，记录 `FAIL`；
- 无法安全判断 postinstall 的边界，记录 `BLOCKED`，不能继续真实 Grok 运行。

安装完成后必须从实际 package manifest 和实际绝对 bin 路径核实：

- resolved package version；
- `bin` 字段；
- package entry；
- `scripts`；
- postinstall 行为；
- `<bin> --version`；
- `<bin> --help`；
- 子命令帮助；
- flags；
- 环境变量；
- 配置文件位置；
- base URL 参数；
- model 参数；
- reasoning 参数；
- stdio、JSON、ACP、serve 或其他实际协议。

不得假定以下任一项存在：

- `--base-url`；
- `--model`；
- `--reasoning`；
- `GROK_API_KEY`；
- 某个 config 文件；
- 某个 JSON 输出格式；
- ACP；
- serve；
- 用户提供的 my-grok endpoint；
- 用户提供的 model。

只有在帮助信息、package source、官方文档和实际启动结果至少形成闭合证据后，才允许实现 Grok adapter。若没有机器可用的协议或帮助信息，Grok 保持 `BLOCKED`，不得把交互式普通 shell 文本包装成 harness。

## 8. B2 runner 的 v2 扩展

现有 B2 runner 继续作为历史基础设施证据保留。v2 需要增加真实 provider 能力，但不得把 adapterless 的 `BLOCKED` 结果改写成真实成功。

### 8.1 Provider-specific adapter 接口

每个 provider 必须有独立 adapter，不允许用通用 ACP、DSH SDK、普通 shell 或硬审核 OpenCode 改名。

建议接口责任：

```text
discover()
resolveVersion()
checkCompatibility()
prepareIsolatedRun()
injectAuthorizedSecrets()
start(request)
observeNativeEvents()
interrupt()
waitForQuiescence()
collectResult()
classifyFailure()
dispose()
```

每个 adapter 必须自己负责：

- 官方入口解析；
- 版本核实；
- provider-specific endpoint 映射；
- model/reasoning 字段；
- permission mode；
- cwd；
- config/home/state/cache/log 隔离；
- native 协议；
- tool observations；
- cancellation；
- process-tree cleanup；
- provider-specific error mapping。

通用 runner 只负责生命周期、证据目录、secret redaction、schema 校验和外部采集，不负责猜测 provider 协议。

### 8.2 Secret injection

secret injection 只接受：

- 本次调用参数中的授权 credential reference；
- 已授权的父进程环境变量；
- provider adapter 声明的目标环境变量。

运行器必须：

- 在内存中解析 credential reference；
- 只向受控子进程传递所需变量；
- 不将值写入 `config/`、`auth-reference/`、`session/`、`logs/`、`raw/` 或 `artifacts/`；
- 清理子进程退出后的内存引用；
- 记录源变量名、目标变量名、来源类别和存在性；
- 使用运行时随机 salt 生成非敏感 presence fingerprint；
- 禁止在 manifest、命令摘要、进程树、错误分类和文件 hash 中包含值。

如果 adapter 需要配置文件中的明文 key，直接返回 `BLOCKED`，不得生成该文件。

### 8.3 v2 证据字段

`schema.v1.json` 不得原地修改。中央 schema 责任者可以创建 successor，例如 `schema.v2.json`，并在 README 中记录 v1/v2 的关系。

v2 至少需要覆盖：

```text
node
planVersion
harness
roleId
case
mode
status
failureClass
blockedConditions
runId
program
packageSource
version
command
commandSummaryHash
environment
credentialReferences
baseUrlReference
modelRequest
reasoningRequest
compatibility
directories
cwd
permissions
tools
native
usage
session
handoff
artifacts
stdout
stderr
processTree
filesystem
networkObservations
timestamps
cancellation
cleanup
```

其中：

- `stdout`、`stderr` 保存脱敏后的原始输出和 hash；
- `command` 不保存 secret 参数；
- `environment` 只保存变量名、来源类别和存在性；
- `baseUrlReference` 保存非敏感 host/path 标识或 hash，不保存 secret；
- `modelRequest` 和 `reasoningRequest` 区分“请求字段”“native 观察字段”“最终确认字段”；
- `native` 允许 `OBSERVED`、`UNKNOWN`、`NOT_RUN`；
- `usage` 允许 `OBSERVED`、`UNKNOWN`、`NOT_RUN`；
- `session` 和 `handoff` 区分“父 Session 可见”“产品本地可见”“外部采集可见”；
- `cancellation` 必须记录请求时间、协议动作、进程终止、等待完成和 quiescent 结果；
- `filesystem` 必须包含 before/after、允许目标、拒绝目标、全局 bait 和外部副作用；
- `processTree` 必须包含 before/during/cancel/after/quiescent；
- 任何 `UNKNOWN` 都必须附 reason 和影响范围。

### 8.4 统一证据输出

每个真实 run 至少保存：

```text
manifest.json
stdout.raw
stdout.sha256
stderr.raw
stderr.sha256
compatibility.json
process-tree-before.json
process-tree-during.json
process-tree-cancel.json
process-tree-after.json
filesystem-before.json
filesystem-after.json
tool-observation.json
native-events.jsonl
session.jsonl
handoff.json
artifacts.json
usage.json
global-bait-check.json
subprocess-receipt.json
result.json
```

这些文件必须只写入本次 run root。中央 schema owner 负责字段和验证器；其他任务不得复制或分叉 schema。

## 9. 四个 Harness 的成功/拒绝运行矩阵

所有 harness 都必须分别验证：

- 一个真实允许操作；
- 一个真实拒绝操作；
- 取消；
- 自有进程树归零；
- filesystem-before/after；
- global bait 未被读取、执行或写回；
- usage、native trace、Session、handoff 和 artifact 的可见性；
- source plane；
- artifact plane。

### 9.1 Codex

**身份和入口**

- 角色：`product-codex`。
- DSH provider：现有 `codex` provider。
- native 入口：package-local `@openai/codex` 的实际 app-server binary。
- 协议：实际 `initialize`、`initialized`、`thread/start`、turn 和结束事件。
- 版本：从 package manifest、实际 binary 和协议启动结果核实。

**凭据和配置**

- credential source：用户授权的临时环境引用，manifest 只记录变量名、来源类别和存在性。
- target env：只有 native Codex 实际支持的变量名。
- endpoint：用户授权的 `my-gpt` endpoint，通过 adapter 输入，不写入默认配置。
- model：请求 `gpt-6-astra`，必须观察 native request 中的最终字段。
- reasoning：请求 `max`，必须观察 native 支持字段；不支持时为 `REASONING_UNSUPPORTED`。
- `CODEX_HOME`、cache、session、logs 和配置隔离是否有效必须实测；不能依据当前 Config 类型直接声称已隔离。

**目录和 cwd**

```text
<run-root>\codex\
  config\
  auth-reference\
  home\
  cache\
  session\
  logs\
  work\
  bait\
  artifacts\
  process\
  raw\
```

cwd 必须从父 Session header 派生到本次 `work` 目录，并由外部 collector 核实。

**允许运行**

- 使用真实 Codex provider；
- 在 `work\allowed` 内通过 native 或 DSH 可见工具创建固定 sentinel；
- 保存 native tool call、tool result、文件 hash 和父 Session 关联；
- 证明实际 endpoint、model、permission mode 和工具集合。

**拒绝运行**

- 尝试读取或写入 `bait\global-secret.txt`；
- 尝试执行只存在于诱饵 PATH 的程序；
- 使用 `permissionMode=never` 或 native 等效拒绝模式；
- 外部检查确认 bait 未被读取、执行、写回，work 外没有副作用。

**取消和进程树**

- 通过 `wire.interrupt()` 或 native 等效协议触发；
- 记录取消请求、stdin/protocol 关闭、子树终止和 `waitForExit`；
- 检查 app-server、子进程、监听和临时锁归零；
- 其他 run、全局 CLI 和用户进程必须继续存活。

**usage、Session 和 handoff**

- native usage 有实际事件则保存脱敏字段；
- 没有 usage 事件则为 `UNKNOWN`，不能使用模型文本估算；
- 父 Session 只有最终文本、错误和退出信息时，必须明确标为“父 Session 不可重建 native tool/usage/session”；
- `persistSession` 或 native resume 不存在时，必须明确记录不支持；
- 步骤级 handoff 只包含 branded SessionId、角色、授权摘要、artifact hash、工具 allow-list 和规则版本，不能称为 native resume。

### 9.2 Claude Code

**身份和入口**

- 角色：`product-claude-code`。
- DSH provider：现有 `claude-code` provider。
- native 入口：官方 SDK `query()` 启动的实际 Claude Code CLI。
- 版本：从 SDK 分发包、实际 CLI `--version` 和运行回执核实。
- SDK 版本、CLI 版本和 DSH package 版本分别记录。

**凭据和配置**

- credential source：用户授权的临时环境引用。
- target env：仅使用 Claude SDK 或 CLI 源码、帮助或实际运行证明的变量名。
- endpoint：用户授权的 `my-claude` endpoint，不能假定其实现 Anthropic wire protocol。
- model：请求 `claude-opus-5`，必须观察 native 请求或实际响应。
- reasoning：请求 `max`，必须确认 Claude SDK 实际支持的字段和值。
- 若 SDK 只支持 Anthropic 原生协议而 endpoint 返回 OpenAI-compatible 协议，则配置门为 `BLOCKED`。
- `settingSources` 的实际行为必须记录，不能宣称省略后就完全 hermetic。

**目录和 cwd**

```text
<run-root>\claude-code\
  config\
  auth-reference\
  home\
  cache\
  session\
  logs\
  work\
  bait\
  artifacts\
  process\
  raw\
```

实际检查：

- `CLAUDE_CONFIG_DIR`；
- `HOME`；
- `XDG_CONFIG_HOME`；
- SDK session/cache/log；
- 用户、项目和本地 settings 是否进入运行；
- 全局目录 hash 是否保持不变。

**允许运行**

- 在 `work\allowed` 内通过真实 Claude Code 工具创建或读取 sentinel；
- 保存工具可见集合、实际调用、结果、文件 hash 和进程观察；
- 只有 native success 条件满足时才标 `PASS`：subtype success、`is_error=false`、非空 result、异步迭代器正常完成。

**拒绝运行**

- 使用 `dontAsk` 或实际等效拒绝模式；
- 尝试访问全局 bait、work 外文件或诱饵 executable；
- 外部确认拒绝由真实权限或系统边界产生；
- 确认拒绝操作没有文件、进程、网络和日志副作用。

**取消和进程树**

- 通过 SDK/API 或真实 stdin/protocol interrupt；
- 关闭通知，终止 Claude Code 子树，等待 SDK 等效退出；
- 检查自有进程、监听、临时锁和文件写入归零；
- 其他运行和全局进程不受影响。

**usage、Session 和 handoff**

- SDK/CLI 实际提供的 usage 才能记录为 `OBSERVED`；
- 中间事件、tool trace、stderr、workspace diff 如果只留在产品本地，父 Session 不能宣称拥有；
- `persistSession=false` 时原生续接为不支持；
- 步骤级 handoff 必须明确是显式交接，不是 native resume。

### 9.3 OpenCode 产品

**身份和入口**

- 角色：`product-opencode`。
- 不能使用 `hard-review-opencode` 的 process、目录、Session 或证据替代。
- binary、package source 和版本必须从独立发现回执确定。
- 入口只能使用实际帮助、官方协议或实际响应证明的 `run --format json`、ACP、`serve` 或其他协议。

**凭据和配置**

- 产品 OpenCode 必须拥有独立 credential reference。
- 如果只有硬审核 credential reference，而没有产品运行授权，则为 `BLOCKED`。
- provider、model、base URL 和 credential 只能通过实际支持的 env 或非敏感配置注入；
- 禁止修改全局 OpenCode 配置；
- 若只能写入 secret 配置文件，则为 `BLOCKED`。
- 产品 OpenCode model、endpoint 和 reasoning 不能因硬审核使用 `glm-5.3/max` 而自动视为已验证。

**目录和 cwd**

```text
<run-root>\opencode-product\
  config\
  auth-reference\
  home\
  state\
  cache\
  session\
  logs\
  work\
  bait\
  artifacts\
  process\
  raw\
```

硬审核使用另一套完全不同的目录树。

**允许运行**

- 通过真实产品协议执行 allow 操作；
- 在 `work\allowed` 内创建 sentinel；
- 外部观察协议请求、真实响应、工具调用、artifact 和文件副作用；
- 证明请求使用产品 OpenCode 的实际 provider/model/base URL。

**拒绝运行**

- 通过产品真实权限或工具机制拒绝 work 外路径、全局 bait 或未授权工具；
- 不能用 adapter 自己预先拦截 shell 参数冒充产品拒绝；
- 必须保存 native refusal 或真实系统拒绝证据。

**取消、usage、Session 和 handoff**

- 使用产品协议的真实 cancel；
- 记录产品自有进程树归零；
- 记录 native session id、usage、tool trace 和 continuation 是否存在；
- 若只有 ACP 一次性响应，不能称为 OpenCode native continuation；
- 如果无法确认交接协议，handoff 标记 `UNKNOWN` 或 `BLOCKED`。

### 9.4 Grok CLI

**身份和入口**

- 角色：`product-grok`。
- 来源固定为 `@xai-official/grok@1.0.24` 的 package-local 安装。
- 绝对 bin、resolved version、package manifest 和 postinstall 结果必须保存。
- CLI 入口、flags、env、config、base URL、model 和 reasoning 都要从实际 package/help/协议核实。

**凭据和配置**

- credential source：用户授权的临时环境引用；
- 安装阶段不注入 key；
- 运行阶段只通过实际 CLI 支持的环境变量或安全入口注入；
- endpoint 使用用户提供的 `my-grok` 引用，但不能假定 CLI 接受它；
- model 请求 `grok-4.6`，必须有实际请求或响应证明；
- reasoning 请求 `xhigh`，不支持时标记 `REASONING_UNSUPPORTED`；
- 如果 CLI 没有 base URL/model/credential 的安全入口，保持 `BLOCKED`。

**目录和 cwd**

```text
<run-root>\grok\
  grok-install\
  npm-config\
  npm-cache\
  config\
  auth-reference\
  home\
  cache\
  session\
  logs\
  work\
  bait\
  artifacts\
  process\
  raw\
```

**允许运行**

- 通过实际 Grok CLI 协议在 `work\allowed` 创建或读取 sentinel；
- 记录真实 native response、工具调用、artifact、usage 和版本；
- 外部确认 endpoint 和 model。

**拒绝运行**

- 通过 CLI 的真实权限、工具或协议拒绝全局 bait、work 外路径和未授权工具；
- 如果 CLI 只是交互式文本程序，没有可核实的请求/响应协议，则不能把普通文本输出来作为拒绝证据；
- 无协议时保持 `BLOCKED`。

**取消、usage、Session 和 handoff**

- 通过 CLI 实际支持的 stdin/protocol interrupt；
- 外部确认 Grok 自有进程树和临时文件归零；
- usage、native tool、session 和 continuation 只能来自真实协议或外部日志；
- 没有 native resume 时，只能记录显式步骤 handoff。

## 10. 外部观察要求

模型文本或命令 `exit 0` 不能单独证明成功。每个真实运行必须由外部 collector 观察：

- 启动前、运行中、取消时、结束后的进程树；
- PID、PPID、owner、命令绝对路径和参数摘要 hash；
- 监听端口和网络连接；
- cwd；
- config/home/state/cache/session/log 路径；
- 全局配置、全局 cache、全局日志和 bait 的前后 hash；
- run root 内文件的前后 hash；
- 允许目标与拒绝目标；
- 诱饵程序是否启动；
- native protocol events；
- tool advertised、tool callable、实际 allowed、实际 denied；
- stdout/stderr 脱敏原文和 hash；
- usage；
- 产品 Session id；
- 父 Session 可见性；
- handoff 输入、输出和 artifact hash；
- cancellation、退出码、信号和 quiescent cleanup；
- 人工介入、平台耗时、provider 耗时和不可观测字段。

外部 collector 不得：

- 广泛 `taskkill /F`；
- 按进程名杀用户进程；
- 修改全局配置；
- 读取或打印环境变量值；
- 依赖固定 sleep 掩盖 readiness 或 teardown；
- 使用无限 retry；
- 使用全局串行锁隐藏竞争。

## 11. Session、handoff 和原生 continuation

现有 Codex、Claude Code 和 B2 ACP 基础设施都按 one-shot 处理，不能在 v2 中默认宣称原生续接。

每个真实运行必须区分：

- 父 DSH Session；
- native 产品 Session；
- 外部 evidence Session；
- explicit handoff package；
- artifact lineage；
- native continuation/resume。

父 Session 已有事件继续记录：

- `turn/start`；
- `step/start`；
- 子 agent descriptor/lifecycle；
- `assistant/message`；
- `tool/call`；
- `tool/result`；
- `session/end-seed`；
- 现有 SessionEventMap 支持的其他事件。

如果新增模型可见输入、handoff metadata、工具选择或 usage 事件，则：

- `SessionEventMap` 由唯一 Session 责任者修改；
- 同步更新 TypeScript SDK；
- 同步更新 Python SDK；
- 同步更新 snapshot 和 projection；
- 更新迁移和文档；
- 不允许只增加一个端的事件。

显式 handoff 至少包含：

- branded `SessionId`；
- source role；
- target role；
- 任务标识；
- 授权摘要；
- 获准记忆范围；
- tool allow-list；
- rule version；
- input artifact hash；
- output artifact hash；
- source Session 路径；
- native continuation support status。

handoff 不得包含：

- API key；
- 全局认证文件；
- 未授权 home/cache/session；
- 未记录的 prompt；
- 隐式全局上下文。

如果 native provider 没有 resume/session API：

1. 先让 native API 明确返回 unsupported 或从实际能力矩阵证明不存在；
2. 再创建显式步骤级 handoff；
3. 第二个实例只能读取 handoff package；
4. 第二个实例不能读取第一个实例的全局 home、cache、session 或隐式上下文；
5. 结果标记为“步骤级 handoff”，不得称为“native resume”。

## 12. 并行任务和文件所有权

以下任务可以并行，但必须遵守依赖和单一责任者规则。

| 任务 | 责任范围 | 可并行对象 | 依赖 |
|---|---|---|---|
| V2-0 治理和基线 | P0-A/P0-B 引用、状态、历史证据索引 | runner、collector、源码兼容性阅读 | 无 |
| V2-1 discovery/adapter runner | provider-specific adapter 接口、配置兼容性入口 | Codex/Claude 源码核查、collector | B0 |
| V2-2 Codex/Claude real composition | 两个 native provider 的 source 运行和真实 allow/deny | OpenCode discovery、Grok install 准备 | V2-1 |
| V2-3 OpenCode product separation | 产品 binary、隔离 config、协议和真实运行 | Codex/Claude artifact 验证 | B1、V2-1 |
| V2-4 Grok isolated install | package-local install、postinstall、bin、help、协议 | OpenCode product separation | B1、V2-1 |
| V2-5 external collectors | 进程树、filesystem、network、stdout/stderr、secret redaction | 所有 adapter 实现 | B2 |
| V2-6 Session/handoff evidence | Session、handoff、cancel、usage、native continuation | 各 harness 的真实运行 | 至少一个真实运行完成 |
| V2-7 source/artifact checks | source plane、build、artifact plane、docs、focused checks | 不同 package 的 focused checks | 所有适配器完成 |
| V2-8 candidate freeze | 候选、hash、证据索引、审核材料 | 无 | V2-0 至 V2-7 |

单一责任者：

- **中央 evidence schema：** V2-1 runner/schema owner。
- **`SessionEventMap`、Session projection 和 SDK expected output：** V2-6 Session owner。
- **根 lockfile：** V2-4 Grok/package discovery owner；其他任务不得并行修改。
- **节点状态、candidate、review 包：** V2-8 governance owner。
- **全局 profile、root config 和生成目录：** integration owner。
- **每个 provider adapter 的 package-local 文件：** 对应 provider owner。

任何任务都不得同时修改中央 schema、`SessionEventMap`、根 lockfile、节点状态或另一个 provider 的目录。若需要跨责任边界的修改，先生成接口或 evidence contract，由唯一责任者合入。

## 13. 命令顺序和停止门

以下是实施阶段的严格顺序。本次规划不执行这些命令。

### 阶段 0：只读基线确认

- 核对 P0-A candidate SHA-256；
- 核对 P0-B v1 evidence hash；
- 核对工作树；
- 确认没有修改 P0-A；
- 生成本次 v2 run 的 governance receipt。

前置失败时停止所有后续任务。

### 阶段 1：隔离 discovery 和配置兼容性

先为每个角色创建唯一 `<run-id>` 和隔离目录。

执行：

- Codex package、binary、version、native config source 核查；
- Claude SDK、CLI、version、env/config source 核查；
- OpenCode 产品 binary、version、help、配置来源核查；
- Grok package metadata、安装准备和来源核查；
- endpoint、model、reasoning 的非敏感配置兼容性回执；
- provider-specific credential variable mapping 回执；
- 外部观察器和 secret redaction 自测。

本阶段不把模型自报、包名或 model 名称当作兼容性证明。

如果 Codex 或 Claude 配置兼容性门失败，则对应真实 allow/deny 标记 `NOT_RUN`，兼容性记录 `BLOCKED` 或 `FAIL`。如果 OpenCode 或 Grok 入口和协议未确认，则停止对应后续依赖。

### 阶段 2：Codex 和 Claude Code 真实 allow/deny

对每个 harness 分别执行：

1. source plane allow；
2. source plane deny；
3. source plane cancel；
4. 外部 quiescent 检查；
5. build；
6. artifact plane allow；
7. artifact plane deny；
8. artifact plane cancel；
9. usage/native/session/handoff 收集；
10. 生成独立结果回执。

不得把 source 运行结果复制为 artifact 运行结果。artifact 运行必须只加载 `lib/` 和实际 package/bin，使用 plain Node，不能混入 source import。

建议命令形态：

```text
node --import tsx/esm scripts/p0-b/validate-harness.ts --harness codex --case allow --source --require-real-product
node --import tsx/esm scripts/p0-b/validate-harness.ts --harness codex --case deny --source --require-real-product --expect-denied
node --import tsx/esm scripts/p0-b/validate-harness.ts --harness claude-code --case allow --source --require-real-product
node --import tsx/esm scripts/p0-b/validate-harness.ts --harness claude-code --case deny --source --require-real-product --expect-denied
pnpm run build
node scripts/p0-b/validate-harness.mjs --harness codex --case allow --artifact --require-real-product
node scripts/p0-b/validate-harness.mjs --harness codex --case deny --artifact --require-real-product --expect-denied
node scripts/p0-b/validate-harness.mjs --harness claude-code --case allow --artifact --require-real-product
node scripts/p0-b/validate-harness.mjs --harness claude-code --case deny --artifact --require-real-product --expect-denied
```

命令名称以实际 v2 runner interface 为准；不得通过命令行传递 secret。

### 阶段 3：OpenCode 产品隔离

只有 OpenCode 产品发现门 `PASS` 才执行：

1. 创建独立 product OpenCode run root；
2. 注入产品 credential reference；
3. 核实 provider/model/base URL；
4. 启动实际 `run --format json`、ACP、serve 或已确认的协议；
5. 执行 allow；
6. 执行 deny；
7. 执行 cancel；
8. 收集 native/session/usage/tool/process/filesystem 证据；
9. 重复 source plane 和 artifact plane；
10. 检查硬审核 OpenCode 的目录、进程和配置完全未被使用。

发现产品 binary 只能使用全局配置或协议不能确认时，停止 OpenCode 后续任务并保留 `BLOCKED` evidence，不修改全局配置。

### 阶段 4：Grok package-local install 和协议

只有 Grok 阶段到达时才允许执行安装：

```text
npm --prefix <isolated-root> install --no-save --no-package-lock @xai-official/grok@1.0.24
```

安装后按以下顺序：

1. postinstall process/filesystem/global hash 检查；
2. package manifest 和 bin 核实；
3. 实际 `--version`；
4. 实际 `--help`；
5. 子命令帮助；
6. flags/env/config/base URL/model/reasoning 核实；
7. protocol readiness；
8. source plane allow/deny/cancel；
9. artifact plane allow/deny/cancel；
10. usage/native/session/handoff 收集；
11. package-local filesystem 和全局 filesystem 对比。

如果安装脚本不安全、bin 不存在、帮助信息没有协议、flags/env/config 不能核实或 endpoint/model 不兼容，停止真实 Grok allow/deny，保留 `BLOCKED` 或 `FAIL` 结果。

### 阶段 5：Session、handoff、崩溃和取消汇总

每个成功运行或明确阻塞的 harness 都必须生成：

- cancel receipt；
- process-tree receipt；
- filesystem receipt；
- Session visibility receipt；
- handoff receipt；
- usage/native observation receipt；
- artifact hash receipt；
- `UNKNOWN` 字段及原因；
- provider-specific failure classification。

### 阶段 6：检查、候选冻结和硬审核

source/artifact 分离检查完成后：

```text
pnpm run typecheck
pnpm run lint
pnpm run build
pnpm run hygiene
pnpm run test:docs
```

按影响范围运行 focused tests、real composition tests、built smoke 和必要 snapshot。缺少真实 key、网络或 provider 协议时必须记录 `BLOCKED`，不能作为通过。

候选冻结前必须固定：

- `git status --short`；
- 未跟踪文件；
- 每个 changed file hash；
- P0-A 引用 hash；
- B0–B4 历史证据 hash；
- 每个真实 run 的 manifest、stdout/stderr hash、process tree、filesystem、native、usage、Session、handoff、artifact；
- 每个 BLOCKED/FAIL/NOT_RUN 的原因、责任者和支持声明影响；
- source/artifact 命令、退出码和证据路径。

冻结候选后，只将该候选提交给真实 OpenCode 硬审核。硬审核使用独立 zhipu coding plan、`glm-5.3`、reasoning `max`，不得调用产品 OpenCode binary 代替审核，也不得让产品 OpenCode 的运行结果代替硬审结果。

## 14. Source plane 和 artifact plane

Source plane：

- 通过 tsconfig paths 指向 `src`；
- 使用 `node --import tsx/esm`；
- 运行真实 provider adapter 和真实产品入口；
- 不把 built `lib/` 的结果混入 source 证据。

Artifact plane：

- 先完成 `pnpm run build`；
- 只加载 `lib/`、built package 和 package-local binary；
- 使用 plain Node；
- 不通过 tsx、source import 或工作树中的未构建文件补充行为；
- 重新执行 allow、deny、cancel 和外部观察。

source 与 artifact 的版本、命令、cwd、进程树、文件树和 evidence run-id 必须分别保存。

## 15. 成功标准

P0-B v2 只有在以下条件全部满足时，才可冻结候选并提交硬审核：

1. Codex、Claude Code、OpenCode、Grok 各自有独立 role、入口、版本、配置、凭据变量、隔离目录和能力矩阵。
2. Codex 和 Claude Code 的 endpoint mapping 已通过源码和实际运行证明，或明确记录为不兼容并保持 `BLOCKED`。
3. Grok 已执行 package-local 安装；没有使用 `npm -g`；postinstall、bin、version、help、flags、env、config 和协议均有证据，或明确保持 `BLOCKED`。
4. 产品 OpenCode 与硬审核 OpenCode 完全分离；产品 binary 若不能安全隔离则保持 `BLOCKED`，不得修改全局配置。
5. 每个宣称支持的 harness 都有真实 allow 和真实 deny；拒绝由 native 权限、工具、路径、网络或系统边界产生。
6. 每个真实运行都有外部 process-tree、filesystem-before/after、stdout/stderr hash、tool observation、native observation、usage、Session、handoff、artifact 和 cancellation 证据。
7. 任何 usage、native tool trace、session id、continuation 或 provider 路由未被外部观察时，均记录 `UNKNOWN`，不能由模型文本补齐。
8. 步骤级 handoff 没有被描述为 native resume；native continuation 缺口单独列出。
9. secret 只进入一次性受控进程环境；仓库、配置文件、stdout/stderr、Session、evidence、candidate、npm 日志和持久记忆中没有 secret 值。
10. 中央 schema、`SessionEventMap`、SDK projection 和根 lockfile 分别只有一个责任者。
11. source plane 和 artifact plane 独立验证，不能用 source 结果证明 built artifact。
12. 所有 `BLOCKED`、`FAIL`、`NOT_RUN` 都有明确分类、证据、缺少条件和支持声明影响。
13. 真实 OpenCode `glm-5.3/max` 硬审核对当前冻结候选给出明确 `PASS`。
14. 在硬审核明确 `PASS` 以前，P0-B 不进入 P0-C。

## 16. P0-B v2 的非目标

P0-B v2 不授权：

- 修改产品默认 model；
- 修改产品默认 provider；
- 修改产品默认 endpoint；
- 修改产品默认 reasoning；
- 修改全局 OpenCode、Claude、Codex、Grok 配置；
- 把硬审核 OpenCode 改作产品 OpenCode；
- 把普通 shell 文本包装成 Grok/OpenCode harness；
- 把通用 ACP 或 DSH SDK 改名为产品适配器；
- 为了兼容未知 endpoint 编写未经 native SDK 支持证明的通用协议转换器；
- 把 keyless fixture、loopback provider、mock model 或 exit code 当作真实成功；
- 覆盖 P0-A 或 P0-B v1 的任何历史证据；
- 在未通过硬审核前开始 P0-C。
