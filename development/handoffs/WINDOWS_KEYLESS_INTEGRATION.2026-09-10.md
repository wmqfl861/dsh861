# Windows 验证、升级收尾与 P0-B 交接

仅处理 `wmqfl861/dsh861` 和本地 `C:\Albert\project\dsh861`，继续 `chore/latest-stable-upgrade-20260912` 与草稿 PR #13。已接收 r26 远端 `571550ebc6695a668fddc2894cda3c9da822f1f4`；本次增加 r27 候选材料与交接，不改实际测试或运行源码。P0-B 仍 blocked，不合并 master、不开放 P0-C，不代写指定计划或硬审核。

## 固定交付规则

远端助手先完成能直接执行的工作，只有依赖本地环境的步骤才交给本地 agent。所有给本地 agent 的文件先提交到此 GitHub 仓库；提示词给出完整固定提交 SHA、文件路径、摘要和下载／使用步骤。通过现有仓库 fetch 固定对象后使用，不依赖聊天附件，不把滚动分支链接当作固定交付。工作区或远端有新工作时逐项整合，不覆盖、不重置、不自动 stash、不强推。

## 已接收结果与证据边界

[r25 回执](../remediation/2026-09-13/upgrade-consumers-r25/verification.json)保留工具链、主版本迁移、Cordis 重放和锁/补丁哈希整改结果，不重装、不重新扫描版本、不重做升级。

[r26 Windows 回执](../remediation/2026-09-13/loader-entry-r26/windows-execution/verification.json)记录 Loader 方法级 20/20、原目录选择器组合 16/16、失败恢复 16/16、六套件 122/122，以及类型、lint、文档和配对检查。目录选择器原失败断言未改，合并树已通过真实组合；归因保留为 Loader 事务性和 Fiber 闩锁共同在场，不拆成单独已证明结果。失败恢复测试的双句柄观察方式不改变 Fiber 闩锁。

[r26 归档](../remediation/2026-09-13/loader-entry-r26/windows-execution/logs.tar.xz)的回执摘要为 `56614d9e9586f2f3201898af8fbcdd8912f6e0b541f580c5db6c5dade395a184`。回执记录归零头重封存、47 个成员内容不变及原历史 blob 仍可达。此次远端接收读取回执、提交信息和 21 文件差异；没有重新运行 Windows 命令或重新解压扫描该归档，不能将接收核对称为新的独立全量验收。r25 池探针的独立原始 stderr 仍缺失，禁止重造。

## r27 当前任务

[r27 固定候选说明](../remediation/2026-09-13/gateway-scope-r27/LOCAL_AGENT_PROMPT.md)和[作者记录](../remediation/2026-09-13/gateway-scope-r27/verification.json)是本轮执行入口。`changes.patch` 尚未应用到实际 Gateway spec，先按说明核对基线并应用，再跑正常 Vitest 双池；不是仅 pull 后复测。

r26 的 Gateway 基线为 208 过、4 败，即两个用例各在两个 project 失败。三个夹具用普通 `fixtureId` 字段保存身份；经服务 shadow 检查无标记调用方时，缺失字符串属性进入 Cordis 注入检查，先于 Gateway 预期的参数／作用域错误抛出。候选复用同文件已有的 `fixtureContextTag` Symbol，保留所有原断言，新增两处无额外 RPC 的计数断言；一个测试文件 +8/-6，不修改运行时注入检查。

作者提取 reflection get-trap 并显式替换 Context/Fiber/追踪协作者，旧标记 6/8、新标记 8/8；这不是实际 Gateway、真实 Context/Vitest 或 Windows 通过证明。补丁仅在取回源码片段上验证应用/反向检查，TS5.8.3 仅检查片段语法。完整文件应用、真实双池和项目类型检查仍待本地；独立审核未被作者检查替代。

## 分开保留的限制

Windows CSPRNG 子进程问题维持 r25 矩阵及原证据不足范围。r26 六套件在真实 Vitest 池中通过，但未经过同类崩溃子进程，不能认证整个 Node 平台。`present-open.host` 的文件 symlink 仍 UNVERIFIED；目录 junction 不能替代，不提权、不删除断言。三个不可达 vendor 来源仍独立记录，不将它们扩大为重做已完成升级的前置。

接收 SHA 的 Actions 查询显示主 CI `34751797589` queued，Issue lifecycle / Issue policy / Build PR preview failure，real-API skipped；另外三个流程 success。该快照不是新候选结果，不用排队或跳过作为全绿，也不根据流程名猜失败根因。新提交状态需另查，不为求绿修改工作流权限或外部凭据。

## 检查与授权

按 r27 说明保存真实最终日志、退出码、文件摘要及独立复审结果，正常钩子提交推送。未受影响检查复用原证据，不为每次提交重复全仓测试、Loader 122 项、Web 102 文件、CLI 版本或平台探针。依赖锁与 pkg 补丁保持原字节，不剥补丁空白。

模型配置两文件、provider/endpoint/思考等级/credentialRef、`development/nodes/P0-B/state.json` 和历史回执不改。升级与有限修复授权不是模型调用或系统初始化授权。不读生产 Key、不登录、不调用模型、不复制旧沙箱秘密，不改全局工具、账号/ACL/Firewall/WFP/UAC，不使用 Remote Desktop Commander、不操作其他项目。
