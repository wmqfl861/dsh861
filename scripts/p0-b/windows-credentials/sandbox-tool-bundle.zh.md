# 准备钉版沙箱工具包

[English](sandbox-tool-bundle.md) | 中文

[prepare-sandbox-tool-bundle.mjs](prepare-sandbox-tool-bundle.mjs)按[已审查的 0.149.1 清单](sandbox-tool-bundle.0.149.1.json)核验三个本地文件，并复制到新目录。它不下载、安装、执行或激活程序。结果是三文件的沙箱诊断候选，不是完整 Codex 发行包或已工作的沙箱。

## 输入与完整性

清单固定仓库钉版主程序，以及同一官方版本的原始 x64 setup、runner 资产。公布的资产摘要不是压缩包摘要。辅助程序的大小和哈希来自发布 API；与之匹配不等于 Authenticode 或 Sigstore 验证。文件缺失、长度错误、字节变化、目录或链接输入均在分配目标目录前被拒绝。复制时和完整输出核验时都会再次核对哈希。

调用方须持续保护来源及已有暂存父目录，避免恶意并发替换。准备器以有界分块读取，绝不启动来源文件。它在随机自有目录中建立独立副本，使用原生相邻文件名，不建硬链接、不读取全局配置、不回退 PATH。拒绝暂存到 node_modules 或 Codex 命名的 home/sandbox 目录中。文件模式和身份检查不是 Windows ACL 或对抗性文件系统保证。

返回的 `verify()` 核验三个文件及精确清单，也拒绝额外条目。`dispose()` 只删除已知自有条目，合并并发清理，并拒绝被替换的根目录或未知文件；内部链接只解除而不遍历。清理失败保持失败。文件交给活跃消费者后不得销毁工具包；本工具既不启动也不停止这些消费者。

## 本地准备

无凭据取得两个精确的公开发布资产后，以明确的本地绝对路径调用 CLI。它始终加载相邻的已提交清单，不接受命令行清单覆盖。复用仓库钉版主程序，不复制全局程序或旧 runner。只读取下列显式路径；占位符须替换成实际路径。

```powershell
node scripts/p0-b/windows-credentials/prepare-sandbox-tool-bundle.mjs --parent '<existing-staging-parent>' --codex '<pinned-codex.exe>' --setup '<downloaded-setup.exe>' --runner '<downloaded-runner.exe>'
```

成功输出给出新目录并返回 `SANDBOX_TOOL_BUNDLE_PREPARED_NOT_ACTIVATED`。执行、系统变更、运行时兼容和产品通过标志仍为 false。拒绝以退出码 2 和固定错误返回，不会通过下载或运行 setup 来修补缺失输入。程序文件和下载缓存留在 Git 外，只提交脱敏验证记录。

## 共存与剩余授权

改变 CODEX_HOME 不会给钉版 setup 新的账号名或独立的 Firewall/WFP 标识。已有沙箱账号、保存的凭据、profile 和规则可能被全局 Codex 共用。工具包准备不重置密码、不复制旧秘密，也不删除这些资源。密码重置会使保存的账号密码过时；这并不证明所有者的 DPAPI 密钥变得不可解密。能够定位共享对象，不等于有权操作或能够完整回滚。

已审查的[机器清点](../../../development/nodes/P0-B/windows-elevated-inventory.r01.json)仍是历史观察，不是安装授权。任何激活都需单独确定具体共存／部署决定；工具包就绪不满足 OS 隔离、所有者登记、真实 CLI TLS、金额强制或指定规划／审核要求。见[决策说明](../../../.agents/notes/implemented/architecture/2026-09-12-pinned-sandbox-tool-preparation.zh.md)。
