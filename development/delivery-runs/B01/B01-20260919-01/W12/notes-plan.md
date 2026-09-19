# W12 Agent Note 计划与验证记录

运行: B01-20260919-01 / W12。日期: 2026-09-19/20。

## 1. 分组与预登记路径的对应

formal-plan §3.7 预登记三组 NEW 路径（权限 N / 总控整合；各任务提供事实）。本任务按派发分组生成，与预登记一一对应，无新增路径、无改名：

| 组（派发建议） | 归属工作包 | 落盘三件套（`.agents/notes/implemented/testing/`） | 分类依据 |
|---|---|---|---|
| ① prepare 管线三连修 + 契约回归 | W01/W02（含 W02 Linux 返工） | `2026-09-19-prepare-command-contracts.{md,zh.md,i18n.yaml}` | 测试基础设施：外部命令契约 fixture + 替身来源证明 |
| ② 快照平台契约 + pi-ai 守护 | W04/W05 + W11-F（含 W04 轮二） | `2026-09-19-sdk-platform-fixtures.{md,zh.md,i18n.yaml}` | 测试基础设施：平台解析 sidecar 选择器 + 水合转义 + 空闲预算守护 |
| ③ 桌面预览 + fs-ext 迁移收尾 | W06/W07 | `2026-09-19-desktop-preview-evidence.{md,zh.md,i18n.yaml}` | 测试基础设施：keyless 预览 fixture 三件 + 冒烟承接面迁移 |

三组均落在 `implemented/testing/`（预登记路径即此目录）；分类为 testing——决策对象是测试规格、fixture、快照预期与冒烟检查，非运行时行为（W07 的产品源码改动是死代码清理，其决策本质仍是"打包冒烟验证什么"，随本组记录）。

## 2. 内容口径

- 每篇含 问题/决策/考虑过的替代方案/后果 四节，双语逐节对应；事实取自各包 FINDINGS 终版（含 CP1 修正），不自创数字。
- 证据链接为相对路径（README 规则：跨引必须相对 markdown 链接），指向各包 FINDINGS/round-2/artifact-index。
- Status: implemented（决策已随 89dce53b80 交付）。

## 3. 验证（真实命令与退出码）

| 步骤 | 命令 | 退出码 | 结果 |
|---|---|---|---|
| 具名配对记录 ×3 | `pnpm run verify-translation-pairing --write .agents/notes/implemented/testing/2026-09-19-{prepare-command-contracts,sdk-platform-fixtures,desktop-preview-evidence}.md`（逐一执行） | 0×3 | 3 record(s) written |
| 全量配对校验 | `pnpm run verify-translation-pairing` | 0 | **853 pair(s) checked … all consistent**（含新 3 对） |
| doc-quick 聚合 | `pnpm run test:docs` | 0 | **16 passed, 0 failed, 0 skipped**（104.11s；含 doc budgets、markdown links、翻译提示、文档标准等） |
| 纪律抽查 | 尾随空白扫描 + 尾字节 | — | 6 个 md 均无尾随空白、恰一个尾换行；3 个 i18n.yaml 由工具生成 |

原始输出: `C:\dsh-b01-w12\raw\run-06-test-docs.out`。

## 4. 未做（边界）

- 未运行全量 `doc-sync`（聚合含重型构建面；本阶段输入未变的既有 doc-sync 证据在 CP-A4，Note 新增面已由 test:docs 16/16 覆盖；如总控 CP-F 需要完整 doc-sync，可在合入后执行）。
- 未提交：9 个 Note 文件为未跟踪状态，按派发由总控并入 CP-F。
