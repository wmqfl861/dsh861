v15（P0-A）仅修订 ACP fixture 的路径引用。根因已确认：`apps/cli/tests/profiles/acp/cordis.yml` 的单行标量被 loader 视为非法根值；v14 改成单项字符串数组后，仍在 `entry` 解析阶段失败，因为数组成员必须是对象。ZCode 实施前只读取并核对 `scripts/cordis-yaml.ts` 与 `scripts/verify-cordis-config.ts`，确认 `loadCordisYaml` 的路径引用字段、entry 允许字段，并找出一个仓库内真实同类 fixture 作为证据。唯一永久修改是把该 fixture 改成 loader 已证实的路径 entry 对象，字段采用源码实际允许的 `path` 字段，内容为：

```yaml
- path: ../../../../../snapshots/acp/escalation-approved/cordis.yml
```

不得把路径写成字符串 entry；不得复制 snapshot、调整 snapshot 顺序或内容、删改任何 ACP 配置、环境或测试语义；不得修改验证器、依赖、锁文件、生产代码或其他文件。若源码核实字段名不是 `path`，必须以现有同类 fixture 的确切字段替换上述唯一对象形式，并在回执引用源码及 fixture 行号，禁止猜测。

修改前保存 fixture 与 snapshot 的原始字节及哈希。先只执行一次直接 `verify-cordis-config`，确认全仓配置扫描通过；随后按正式顺序运行 hygiene 的 16 个 gate，逐条保存 stdout、stderr、退出码、输入/输出哈希及 skip/retry 事实。hygiene 通过后依次执行 source-help、built-version、5 个固定 built-bin 和 1 个 keyless smoke。v12 已有代码、480 测试、docs-check、test-docs15、doc-sync33、v10 报告、lint、build 证据按语义复用，不虚报重跑；CLI 不在 hygiene 前启动。旧 hygiene 与 v14 失败日志保持归档且不可覆盖。通过全部检查后冻结完整候选，交由真实 OpenCode `glm-5.3/max` 硬审至 `PASS`；失败继续留在 P0-A。无提交、推送或发布，HEAD、lock、P0A01..09 与产品 AC 边界均保持不变。
