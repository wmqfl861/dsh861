**P0-A v5 有限修订：仅替换 v3 对 `catalog.productDisplayVersion` 的判定，其余 v1–v4 要求全部保留。**

本次 `Installed product version differs from the pinned plan.` 源于验证脚本把官方显示后缀当成版本差异。已获取的 `installationVersion` 与 `catalog.buildVersion` 均精确匹配 `17.14.37614.0`，不构成产品版本漂移。安装器已退出 `0`、无需重启；冻结依赖重试尚未执行。

1. **实例与构建号必须同时满足以下条件。** 沿用已给出的完整 `vswhere` 查询及三个必需组件条件，结果必须唯一；`[17.14,17.15)` 仅用于检索，不能作为版本验收规则。目标 `installationPath` 必须为 `D:\BuildTools\dsh861-p0-a-vs2022`，`productId` 必须精确为 `Microsoft.VisualStudio.Product.BuildTools`；`isComplete=true`、`isLaunchable=true`、`isRebootRequired=false`。`installationVersion` 和 `catalog.buildVersion` 必须**分别精确等于** `17.14.37614.0`。

2. **显示版本仅允许以下完整字符串映射。** 原值完整保留，规范化只分离本次已取证的精确官方后缀；规范化版本必须精确等于 `17.14.39`。

| `catalog.productDisplayVersion` 原值 | 规范化产品版本 | 分离出的展示后缀 |
|---|---|---|
| `17.14.39` | `17.14.39` | 空字符串 |
| `17.14.39 (August 2026)` | `17.14.39` | ` (August 2026)`，包含开头空格 |

任何其他完整字符串均判定失败。不得使用 `17.14.*`、前缀匹配、任意括号删除或其他宽松规则；显示版本通过也不能替代构建号、产品身份和实例状态检查。

3. **保留结构化版本证据。** 新验证回执须保存完整 `vswhere` 原始 JSON、显示原文、规范化版本、分离后缀，以及各项检查的预期值、实际值和通过状态。原始 JSON 必须保留 `catalog.productSemanticVersion='17.14.39+37614.0.-august.2026-'`、`catalog.productPatchVersion='39'`、`installationName='VisualStudio/17.14.39+37614.0.-august.2026-'`，供交叉核对。

4. **允许修复并重验本节点临时脚本。** 修改 `D:\Temp_projects\dsh861-p0-a-baseline\verify_build_tools.ps1`，仅落实上述显示版本判定及必要证据记录。保留修改前脚本副本、修订差异和本次执行脚本的 SHA-256；使用下一个未占用的新 attempt 记录验证，不重复安装，也无需用户重复批准同一安装或此次脚本修正。

5. **保留失败 01，按验证结果恢复后续任务。** 原样保留 `D:\Temp_projects\dsh861-p0-a-baseline\r01\logs\toolchain-followup-01.json` 和同目录 `verify-toolchain.followup.stderr.log`，不得覆盖或改写为成功。新 attempt 使用独立回执及 stdout/stderr 文件，记录执行命令、起止时间、退出码和检查结果；验证失败则继续停止后续步骤。

6. **新验证全部通过后**，执行原定 `install-ntfs-02` 冻结依赖重试及 `fs-ext` 加载检查，保存各自命令、输出、退出码和加载结果，再按 v4 执行任务 D/E。最终仍由真实 OpenCode（`glm-5.3`，variant `max`）对固定候选硬审，修复并复审直至 `PASS`；保留原定计划、测试、候选及审查证据要求，不规划下一节点。
