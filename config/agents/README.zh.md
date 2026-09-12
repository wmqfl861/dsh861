# Agent 模型配置参考

[English](README.md) | 中文

[models.v1.json](models.v1.json) 是所有者指定的四种产品 harness 的版本化期望配置，只包含非密钥路由和固定凭据引用，不包含 API Key。它与 CLI 安装目录和程序版本分开管理。[models.v1.lock.json](models.v1.lock.json) 保存非密钥配置摘要，不是加密凭据库，也不是签名。

## 检查配置

在仓库根目录使用 Node 执行：

```sh
node scripts/p0-b/model-config.mjs check
node --test scripts/p0-b/__tests__/model-config.test.mjs
```

`check` 仅在声明有效且匹配锁文件时退出零。报告明确标注 `CONFIG_VALID_NOT_ACTIVATED`、`productAccepted=false`、原生兼容性 `NOT_RUN`，以及本次未导入凭据。未知字段、明文凭据字段、含认证材料的 URL、自动回退策略和锁文件不匹配都会被拒绝，错误不回显不可信输入。HTTP 地址原样保留并报告，但不会被访问。

## 凭据与产品适配

轮换后的 Key 应安全导入仓库外的受保护凭据库，分别绑定 `providers/codex`、`providers/claude-code`、`providers/grok` 和 `providers/opencode`。这些 ID 不随升级改变。可信平台读取器可通过[凭据引用组件](../../scripts/p0-b/credential-ref.ts)解析；本配置没有实现或初始化该凭据库。聊天中提供的 Key 需要替换。这里不存原值、末尾片段、密钥派生摘要、密钥密文或解密材料。忽略规则只防误提交，不构成安全边界。

OpenCode 选择内置 `zhipuai-coding-plan`。`baseUrl` 为 null，因为所有者未提供覆盖地址：不捏造地址，也不授权继承全局 OpenCode 认证目录。适配器必须在隔离安装中核验 provider ID、实际解析地址、协议及凭据机制。产品 OpenCode 和独立硬审核 OpenCode 仍保持独立运行身份和存储；这些默认配置不改变规划者或审核者分工。

模型与思考等级是所有者指定的原始值。特别是 Codex 的 `max` 保持原样，不替换成 `xhigh`。执行前必须核验所选 CLI 与中转站的真实兼容性；不支持时阻塞，不静默改值。中转协议、鉴权请求头及原生配置投影仍由适配器负责；本清单不是 Codex、Claude Code、Grok 或 OpenCode 的原生配置文件。

三条中转地址使用 HTTP，凭据传输保护尚未核验。不要经未保护的公网连接发送 Key；应使用获准 HTTPS 或经验证的受保护传输，不静默改写批准的路由。本次修改没有发送网络请求，也没有导入凭据。

## 升级合同

仅升级 CLI 时必须保留同一份非密钥模型配置及固定凭据引用。将待升级声明与已批准声明比较：

```sh
node scripts/p0-b/model-config.mjs compare-upgrade --candidate path/to/candidate.json
```

任何受保护字段变化都会返回非零。比较通过不等于原生兼容性验证，也不会激活升级。接入后的升级器还必须核验实际设置、辅助模型调用、协议及凭据处理；对活跃工作流固定批准的配置与 CLI 版本；只让新工作流采用已验证的新版本；不兼容时保留旧兼容版本或阻塞。这些运行时动作不是离线比较命令已实现的功能。

锁摘要采用 `sha256-sorted-json-v1`：递归排序对象键、序列化为紧凑 JSON、保持数组顺序，再计算 UTF-8 字节的 SHA-256。全部输入必须是验证后的非密钥配置。排版与 LF/CRLF 不影响摘要；该算法不是 RFC 8785，也不替代候选的原始字节摘要。可信的已批准锁必须独立于升级提案保留；同时能修改清单与锁的进程仍可重定义基线。合法模型或路由变更需要所有者授权和新版本，不能自动重新生成锁来放行。

参见[决策记录](../../.agents/notes/implemented/architecture/2026-09-09-owner-model-config-lock.zh.md)及[验证边界](../../development/remediation/2026-09-09/model-config-r03/README.zh.md)。
