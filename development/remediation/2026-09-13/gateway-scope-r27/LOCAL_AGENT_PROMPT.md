# r27：Gateway 作用域夹具接收与真实双池复验

仅处理 `C:\Albert\project\dsh861` 的 `chore/latest-stable-upgrade-20260912`，PR #13 保持草稿。源码基线是 `571550ebc6695a668fddc2894cda3c9da822f1f4`。本目录是待复验候选，不是已应用到测试文件的修复，不是指定 Codex 计划或 OpenCode 审核。

## 下载与应用

使用最终交接消息给出的完整交付 SHA，通过现有仓库的 `git fetch origin chore/latest-stable-upgrade-20260912` 取回对象；确认该 SHA 属于所取分支历史，工作区干净时快进到该固定 SHA。不要重新 clone、安装 gh、自动 stash、reset、强推或覆盖新工作。目录为 `development/remediation/2026-09-13/gateway-scope-r27/`。先读本文件和 [verification.json](verification.json)，再处理 [changes.patch](changes.patch)。不能仅 pull 后运行未打补丁的旧 spec。

交付 SHA 是 Git 对象版本，不是“分支当前最新”的同义词。若本地已有后续提交，先检查目标文件是否重叠，逐项整合；不倒退分支。原始测试文件 `packages/api/gateway/tests/gateway.client.spec.ts` 的 Git blob 必须是 `7fb0ec8bdc3403bf18f8c70ea6082a911d2676e7`，或明确记录与后续工作整合后的差异。可用 `git rev-parse HEAD:packages/api/gateway/tests/gateway.client.spec.ts` 核验，并单独确认该文件没有未提交修改。

补丁 SHA-256 必须是 `5e84f43c88779bf0f2c6f20db9dd99fd4be965a653a5ea2fdc9769c6d9cf01c9`。直接对 checkout 的补丁文件运行 `Get-FileHash -Algorithm SHA256`；不要用 PowerShell 文本重定向重写它，不剥空白或换编码。

```powershell
git apply --check development/remediation/2026-09-13/gateway-scope-r27/changes.patch
# 仅在上一命令退出 0 且基线、工作区检查通过后执行：
git apply development/remediation/2026-09-13/gateway-scope-r27/changes.patch
```

应用后只有一个测试文件发生源码变化，预期 +8/-6：三组 `fixtureId` 写入/读取换成文件已有的 `fixtureContextTag` Symbol；两个原负向断言后各增加一次 RPC 调用计数断言。原测试名称、参数、返回值、错误文字、卸载与服务移除断言全部保留。不要修改 Gateway 或 Cordis 运行源码、吞掉 identity 异常或放宽 inject 检查。

## 执行

沿用现有 Node 26.8.2、pnpm 12.4.1、Vitest 5 和已安装依赖。原始基线失败可复用 r26 封存日志；仅在无法核对时补一次定向首失，不重跑升级或全仓测试。

```powershell
pnpm exec vitest run packages/api/gateway/tests/gateway.client.spec.ts
```

必须使用真实仓库配置的两个 project，不能用 `scope-probe.mjs`、node:test、替身注册器或只选成功用例代替整个 Gateway suite。目标是原两个用例在两池中的四个失败消失，同时所有既有用例保持通过；按实际输出报告测试数、失败数、未处理错误和退出码，不预填 212/212。

若仍失败，先保留首失与确切调用栈，区分标记读取、Context 追踪、传输和测试注册包装问题，再最小修复。不要改预期错误来适应 `cannot get property`，不要删除未标记调用方用例。真实服务/消费者错误不能一律改成 `undefined`。

按既有脚本执行必要的严格类型检查、lint 和 `test:docs`；此候选只改测试夹具，不改变产品 API/行为，暂按机械局部修复处理，不新增“已实施”决策记录。若后续扩大到运行时修复，则按仓库规则补相应双语文档、Agent Note 和真实组合回归。此次未改变 Loader/Fiber 运行源码，不为新的提交重复 r26 的 122 项、Web 102 文件、依赖升级、锁生成或原 CSPRNG 取证矩阵。

## 证据、审核和提交

原始命令日志、退出码和摘要写到本目录的新 `windows-execution/` 子目录，不覆盖本目录作者记录或任何 r26/r25 证据。作者局部结果只是提取的 reflection get-trap 配合显式替身：旧标记 6/8、新标记 8/8，不是正式 Gateway 结果。作者仅在取回的源码片段上验证补丁正反向应用和 TS 5.8.3 语法；完整文件应用、真实 Vitest、项目 TS7 类型检查与独立审核由本地完成。

优先保存脱敏明文日志；使用归档时 uid/gid/mtime 归零、uname/gname 清空，并检查成员路径、内容、tar 头及压缩前后字节。不重复 r26 的账号头问题；不要重造缺失的 r25 stderr。保留首轮失败、修复及审核整改之间的对应关系。

按当前已授权的独立复审流程检查固定候选，修复后重新复审；不能将同上下文自检或作者 probe 冒充独立审核，也不能为此调用未授权模型或读取认证。按真实执行者标注，P0-B 指定规划/硬审核仍不被替代。源码提交前执行正常钩子，正常提交推送同一分支；不得强推或合并 master。返回实际远端 SHA、原两个用例的双池结果、整个 Gateway 结果、追加改动、真实门禁和可从 GitHub 取回的日志路径。

模型配置两文件、provider/endpoint/思考等级/credentialRef、P0-B state、依赖锁、pkg 补丁及历史证据不变。不读生产 Key、不调用模型、不登录、不改账号/ACL/Firewall/WFP/UAC、不使用 Remote Desktop Commander、不操作其他项目。Windows CSPRNG 子进程范围和文件 symlink 保持原未证明状态，不用此次 Gateway 通过替代它们；P0-B 不验收、不进入 P0-C。

## 后续交接规则

先由远端助手完成可执行工作，只有必须依赖本地环境时才交给本地 agent。给本地 agent 的文件全部先放到这个 GitHub 仓库；交接提示词必须提供完整固定提交 SHA、仓库路径、完整性检查及使用步骤，不以聊天附件或滚动分支链接作为唯一交付。
