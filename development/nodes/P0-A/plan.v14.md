**P0-A v14 极小修订计划**

基线保持不变：HEAD 为 `d347e703908d0406b7a7ef80e3a0e594d86b2215`，锁文件 SHA 为 `2c903ab870f821ee2db62fa9417d11b1c2b9c65fbeec30e851ddc53c4cc8c383`；保留 `P0A01..09`、产品 AC 边界、`hygiene-v12-failure.json` 与 `plan.v13.md` 原文。已确认 `apps/cli/tests/profiles/acp/cordis.yml` 当前是单行相对路径标量，`verify-cordis-config.ts` 的 `loadCordisYaml` 会扫描每个 `cordis.yml` 并要求根值为 `Loader` 条目数组，因此 v13 不能直接实施。

核对引用目标后，以仓库现有路径解析流程表达该快照引用；`snapshots/acp/escalation-approved/cordis.yml` 保持其完整顶层 Loader 数组及原有条目、顺序、`disabled`、`config`、环境变量和插件配置。唯一永久修改是将 fixture 改为一项 YAML 序列，文件内容精确为：

```yaml
- ../../../../../snapshots/acp/escalation-approved/cordis.yml
```

这是数组化现有路径引用，不拼接字符串、不删除字段、不放宽验证器；snapshot 文件无需调整。修改前保存 fixture 原始字节及 SHA-256，并核对引用文件字节；若解析事实与上述不符，停止并将差异留在 P0-A。

验证严格按序执行：先直接运行一次 focused `verify-cordis-config`（固定全仓扫描时仅此一次），通过后正式 hygiene，要求 16/16；随后运行 `source-help`、`built-version`、原五个 built-bin 测试及一个 keyless smoke。v12 已有代码、480 项测试、docs gates、doc-sync、lint、build 证据按语义复用；fixture 仅作为 hygiene 配置输入，不参与编译，说明该复用理由。hygiene 通过后冻结完整候选，交由真实 OpenCode `glm-5.3/max` 审核至 `PASS`；审核失败则停留在 P0-A。全程不提交、推送或发布。
