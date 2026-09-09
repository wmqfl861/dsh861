v13 仅修正 `apps/cli/tests/profiles/acp/cordis.yml` 的 Loader 根节点格式。先读取 `scripts/verify-cordis-config.ts` 的 `LoaderEntry` 类型守卫与解析流程，并核对 fixture 实际 YAML 根节点；记录结论：验证器要求顶层为 Loader entry YAML 数组，数组元素按允许的字符串或带 `path` 的条目对象解析，对象中的 `config`、`disabled` 等字段必须属于既有 Loader 元数据集合；当前 fixture 根节点是映射容器，导致 hygiene 报告 `root must be a Loader entry array`。

修改前以字节方式复制原 fixture，并计算 SHA-256，写入新的 v13 回执目录，禁止覆盖 `D:/Projects/dsh861/development/nodes/P0-A/evidence/hygiene-v12-failure.json` 及其原始 stdout/stderr。永久修改只允许该 fixture；预计不需要配套 spec，若读取测试发现必须同步的现存 spec，只列出该明确路径。将当前映射中的 Loader 条目按原顺序提升为顶层 `-` 数组成员，移除仅用于包裹条目的根键；逐字保留 ACP 插件包路径、插件配置、环境变量引用、文件路径、禁用状态及其他测试语义，不删字段、不改值、不调整依赖或锁文件。

按严格顺序执行并分别保存命令、stdout、stderr、退出码、结果文件 SHA-256 与无 skip/retry 事实：先运行 `verify-cordis-config` 的直接脚本校验，限定该 fixture（若脚本固定扫描，则使用其最小 ACP 相关入口）；通过后只运行一次正式 `pnpm run hygiene`，确认 16 个 gate 全部通过。随后依既有顺序执行 source-help、built-version、原 5 个 built-bin 用例及 1 个 keyless smoke。由于改动仅为测试数据且构建输入未变，复用 v12 已归档的 focused tsc、目标 oxlint、完整 build、正式 lint，以及 docs-check、test-docs、doc-sync、v10 等价性、v9/v8 对照证据，明确标注为复用，不虚报重跑。

hygiene 通过后冻结包含未跟踪文件的候选，保存状态与完整哈希清单；HEAD `d347e703908d0406b7a7ef80e3a0e594d86b2215`、锁 SHA `2c903ab870f821ee2db62fa9417d11b1c2b9c65fbeec30e851ddc53c4cc8c383`、P0A01..09 及产品 AC 边界保持不变。不提交、不推送、不发布；再交由真实 OpenCode `glm-5.3/max` 审核，持续修复并复审至 `PASS`，`FAIL` 或 `BLOCKED` 均留在 P0-A。
