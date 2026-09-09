# P0-B 受控验证基础设施

`validate-harness.ts` 是 P0-B B2 的 adapterless evidence foundation。它只接受明确的 harness、allow/deny case、source/artifact mode 和可选的真实产品要求；参数错误会立即失败。当前没有注册任何真实产品 adapter，因此每个合法调用都创建唯一的临时运行目录，写入脱敏的 `manifest.json` 与 `result.json`，并以 `BLOCKED` 表示没有真实程序、协议、凭据或允许/拒绝操作观察。它不会把 mock、普通 shell、DSH SDK、通用 ACP、内置 GLM 子代理或开发审核 OpenCode 当作产品成功。

运行根目录位于 `D:\Temp_projects\dsh861-p0-b-harness-validation`，每次使用随机私有子目录和独立的 config、auth-reference、home、cache、session、logs、work、bait、artifacts、process、raw 子目录。当前 B2 runner 不启动外部进程，也不读取凭据值；只记录继承环境变量名称，`secretValuesRecorded` 永远为 `false`。产品 adapter 接入后必须由 B3-B6 负责真实程序路径、版本、协议、配置隔离、工具 allow/deny、进程树、Session、handoff、artifact、usage、native events 和 quiescent cleanup 证据。

`schema.v1.json` 定义了这些证据字段及 `PASS`、`FAIL`、`BLOCKED`、`NOT_RUN` 状态。`BLOCKED` 是当前预期状态，不是产品支持结论；没有真实 provider 返回和外部世界观察时，usage、native trace、Session、handoff 和工具集合保持 `UNKNOWN`。P0-B 完成前不能将此基础设施描述为四种 harness 已接入。

真实运行必须从 B2 之后的明确 adapter 入口开始，使用一次性独立 run-id、外部文件和进程观察，并等待自有资源达到 quiescent 状态。没有凭据、网络、官方协议或可隔离配置时，相关矩阵保留 `BLOCKED` 或 `NOT_RUN`，不以跳过替代通过。
