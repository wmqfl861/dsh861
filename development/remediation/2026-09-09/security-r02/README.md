# P0-B B0：凭据引用与输出安全组件

基线：`a31d59210790e0e1d35c3d9405d76743f1cc6b60`，即用户要求合并的 PR #1。实施者：本轮 ChatGPT，按用户“你直接合并好，然后按照我的需求继续开发吧”的授权继续实施现有 P0-B v3 B0 中不涉及争议验收范围的安全组件。本记录不是新的 Codex 计划、ZCode 调用或 OpenCode 硬审核回执。

## 已实现

`credential-ref.ts` 只解析 `env:NAME` 和 `secret-reference:id`。所有来源到目标环境变量的映射必须先匹配可信调用者提供的 grants；全部映射检查通过前不会读取任何来源。该模块不读取 process.env、磁盘、聊天历史或全局配置，缺失时没有自动回退。grants 必须由平台授权层提供，不能接受模型自报授权。

凭据 lease 为一次性访问，默认 JSON 和 inspect 只暴露来源、目标变量名称与 nonempty 状态，不暴露值或值派生摘要。回调结束会关闭 lease 并尽力清除临时容器引用；JavaScript 不保证物理内存擦除，也不能撤销恶意回调已经复制的内容。平台/GBrain 的账号与真实凭据轮换不在本组件中实现。

`redaction.ts` 对每个输出通道独立处理 UTF-8 字节流，保留未决前缀，覆盖跨块和重叠匹配；支持原值、标准 JSON 字符串转义、规范 URL 大写/小写百分号编码、表单编码、base64/base64url。匹配替换为固定 `[SECRET_REDACTED]`，检测状态锁存。它不是对任意编码、未知秘密或信息侧信道的防护，也不等于操作系统隔离。maxSecrets 和 maxSecretBytes 由调用者明确配置，超限拒绝而不是截断秘密后继续。

`collectors/redacted-stream.ts` 在任何文件写入之前脱敏，采用 stream pipeline 背压、固定 stdout/stderr 文件名、排他新建和 POSIX 0600 模式；不覆盖已有文件或跟随已有日志文件符号链接。输出限额固定在本次调用开始时，只计算脱敏后 UTF-8 字节；只保存脱敏流摘要。异常时丢弃未决原始后缀，保留已经写入的安全部分，不产生成功收据。runRoot 及其父目录必须由可信 run owner 控制；此 helper 不提供恶意并发目录替换下的沙箱保证，Windows ACL 未验证。

`security-gates.ts` 在启动前逐个检查原始 argv 中的已知凭据，不先做可能掩盖转义的 JSON 二次编码。输出 gate 要求两个不同通道的完整采集记录；泄漏一律 FAIL，缺失或矛盾记录为 BLOCKED，安全采集只返回 OUTPUT_CAPTURED，始终 productAccepted=false。该文件目前不是 v3 计划要求的全仓库语法级安全扫描器，也不能鉴别伪造的外部证据。

## 已运行的验证

本轮实际使用 Linux、Node v22.16.0、TypeScript 5.8.3，对四个新 TypeScript 文件执行 focused 严格编译，再运行 Node 测试。最终 **55/55 通过，0 失败、0 跳过**；其中包含所有支持表示的逐字节边界测试、200 组固定种子分块/重叠对照、固定额度、输出异常、symlink/覆盖拒绝和真实 Node 子进程的 stdout/stderr 集成测试。子进程和全部凭据均为合成测试，不是四种产品的真实调用。

第一次运行 52 项中有 1 项失败：已转义 argv 被再次 JSON 编码后漏检。修复为逐参数扫描后 52/52 通过，再增加 lease 清理、配置固定和分块对照测试得到 55/55。三个原始 TAP 记录原字节封存在 [test-logs.tar.xz](test-logs.tar.xz)，具体命令、摘要与边界见 [验证回执](verification.json)。

Node v22.16.0 低于仓库支持范围；本轮未安装仓库依赖，没有完成仓库 tsx source 路径、构建产物组合、全库 typecheck/lint、文档门禁、Windows 或真实 CLI 测试。新增测试没有自动接入全部 CI。不得用本轮局部测试替代正式环境检查。

## 仓库中的复验入口

在已安装依赖的受支持仓库环境，按源码执行：

```sh
node --import tsx/esm --test scripts/p0-b/__tests__/security.test.mjs
```

P0B_SECURITY_MODULE_ROOT 仅用于显式指定 focused 编译输出的离线测试；不是产品构建目录声明。正常仓库复验不设置该变量。凭据通过可信 reader 及 lease 回调进入子进程环境；不要把真实凭据写入命令行、例子、提交或测试 fixture。

## 仍未完成与下一步

本轮没有修改 `packages/subagent/subagent-codex/src/run.ts` 的原始 stderr 转发；新 collector 尚未接入原有 provider/runner，不能声称该产品泄漏通道已经关闭。接线必须在宿主转发及所有持久化入口之前完成，而不是先转发后脱敏。真实 CLI 还需要配置隔离、工具权限、取消协议和资源静止等独立证据。

凭据是否已经撤销/轮换仍未核实，不使用受影响凭据运行真实任务。指定真实 Codex 后继计划、指定 OpenCode 硬审核、AST 级来源检查、真实 secret service、四产品 adapter/外部 collector 与产物交接仍待完成。P0-B 继续 BLOCKED，不创建新节点、不更改任何产品 AC 为 PASS、不重写旧计划、候选或审核。

接手时将本批源文件和测试纳入新的固定候选；在正式后继计划明确的范围内完成运行时接线和受支持环境复验。合并代码、离线安全测试和节点硬审核是三件不同的事。
