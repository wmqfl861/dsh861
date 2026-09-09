# P0-B 责任矩阵

| 任务 | 当前责任 | 证据 |
|---|---|---|
| B0 治理、状态、候选和中央索引 | ZCode 主执行者 | `preconditions.json`、`source-index.json` |
| B1 OpenCode/Grok 发现 | 内部 GLM 发现子代理，ZCode 整合 | `D:/Temp_projects/dsh861-p0-b-harness-validation/discovery/` 原始输出；最终 manifest 待完成 |
| B2 受控 runner、schema、诱饵和外部采集 | 待 B0/B1 完成后由 ZCode 分配单一所有者 | 计划 `plan.v1.md` §6–§7 |
| Codex/Claude 真实运行 | 待 B2 后分别分配 provider 责任者 | 计划 B3/B4 |
| OpenCode/Grok 适配 | 仅 discovery PASS 后分配 | 计划 B5/B6 |
| Session、交接、恢复汇总 | 单一 Session 责任者 | 计划 B7 |
| Loader、文档、门禁和候选 | 单一集成/验证责任者 | 计划 B8–B10 |

中央 schema、根配置、锁文件、SessionEventMap 和迁移不可由多个并行任务同时修改。
