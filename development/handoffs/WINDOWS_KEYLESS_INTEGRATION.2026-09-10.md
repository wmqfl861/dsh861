# Windows 验证、凭据接入与 P0-B 规划交接

仅处理 `wmqfl861/dsh861`，项目为 `C:\Albert\project\dsh861`。PR #11 已接收 `6cf516949e81ab0aace2c5c8b0dad66ee9274755` 的[只读清点](../nodes/P0-B/windows-elevated-inventory.r01.json)，合并为 `78adb4b3ec0da2183566605559948c2892c335cc`。清点和原申请均未批准；P0-B 仍 blocked，master 未合并，不进入 P0-C。

## r22 清点的接收与共存决定

接收读取实际提交、结构化清点及相关钉版源码，没有重复本机查询或独立认证机器事实。已有两账号、组、全局 Codex home 和旧 runner 不动；WFP 的 UNKNOWN 不改写为不存在。新 CODEX_HOME 不隔离固定的系统账号和过滤器标识，不能据此初始化或重置密码。密码重置的风险是已有保存的账号密码失配，不能据此断言 DPAPI 本身失效。可按名定位的已有共享规则／目录也不等于可无损移除；原清点的“可恢复”条目不是清理授权。

不再要求用户逐项决定九个内部设置。当前操作默认保留现有全局 Codex；具体系统共存／部署方案未批准，既不提权修补旧环境，也不购买或新建虚拟机。未解释的旧规则变化不推断为攻击或某个已知行为方。原生 unelevated 限定读取已证明 BLOCKED，不重跑。

## r23：补齐程序文件，不执行初始化

清点显示安装包未确认齐备独立 setup／runner。钉版上游通过主程序旁或 codex-resources 查找 helper；原生主程序的 help 通过不证明 helper 可用。同版官方发布提供独立原始 x64 资产，已固定资产 ID、字节数和摘要到[工具清单](../../scripts/p0-b/windows-credentials/sandbox-tool-bundle.0.149.1.json)。现有旧 runner 不混用，不更改 pnpm 依赖或模型配置。

[准备器说明](../../scripts/p0-b/windows-credentials/sandbox-tool-bundle.md)定义离线复制与完整校验。程序只接受本地文件，不下载、不执行，不写 node_modules、全局 home 或 sandbox 持久目录。三文件完整验证后创建新自有目录，返回 `SANDBOX_TOOL_BUNDLE_PREPARED_NOT_ACTIVATED`；版本兼容、系统变更、执行和产品批准均不成立。[本轮验证记录](../remediation/2026-09-12/sandbox-bundle-r23/verification.json)只证明 Linux 合成字节测试，未取得或执行真实 Windows 资产。

## 本地仅执行新文件准备

从任务分支 `feat/p0b-sandbox-bundle-20260912` 继续，沿用现有 Node26.4.0、pnpm11.7.0 和依赖。运行新增准备器测试；在项目外自有临时工作目录，从清单的精确官方 HTTPS 下载两个原始 exe 到普通文件，不执行。此次仅此两个无凭据公共发布下载，拒绝身份材料、模型中转、版本替换及证书校验关闭。已有相同摘要的缓存可复用，失败不无限重试。

使用已钉版的本机 codex.exe 与两资产调用 CLI，保留实际返回、文件大小／SHA-256 和完整输出 verify 结果。确认来源没变、输出不是硬链接；不运行任何新 exe（包括 --help）、不把输出放进 PATH 或覆盖原调用配置，不启动 sandbox/setup/doctor。下载不等于安装。真实文件缺失或摘要不符保持 BLOCKED，不能改清单使其通过。

新 `.mjs` 和 JSON 按影响做检查；新 Agent Note 对用原程序点名生成侧车。scripts 下非 README 双语参考不在语料，不给它造侧车、不重跑已知退出2命令。只补本轮必要 lint／文档检查，不重做旧账号清点、62/1、TLS、凭据和门控。正常提交推送同一任务分支，证据脱敏可取回；程序和缓存不入 Git。

## 下一次系统决定仍独立

工具包真实字节准备好后，若继续在此机器使用 elevated 路径，仍需处理共享账号和已有规则的具体共存范围，以及显式系统授权；若改用独立环境也需用户批准部署范围。本轮不选择或执行其中任何安装路径。不把本地文件准备升级为 Codex 原生隔离、真实 CLI TLS、金额控制、生产签署或指定计划／审核完成。

四个保护文件 models.v1.json、models.v1.lock.json、pnpm-lock.yaml、state.json 和历史证据不改。不读生产 Key 或全局认证、不复制旧沙箱秘密、不重置密码、不改 ACL／注册表／Firewall／WFP、不触发 UAC，不使用 Remote Desktop Commander，不操作其他项目。网页团队后台需求保留，不加新的通用前置框架。
