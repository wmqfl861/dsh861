# Windows 验证、依赖升级与 P0-B 交接

仅处理 `wmqfl861/dsh861`，本地项目为 `C:\Albert\project\dsh861`，继续分支 `chore/latest-stable-upgrade-20260912` 与草稿 PR #13。接收基点为 `c9b8fa4e6d2a55c4d9b90e3bc53e013f26618480`；其 [r24 执行回执](../remediation/2026-09-12/latest-upgrade-r24/verification-full.json)与[升级记录](../maintenance/latest-upgrade.r24.json)保留，不将该批成功改写成失败，也不称全部依赖已是最新。

## 已完成与尚未完成

r24 已完成上游源码整合、专用 Node 26.8.2／pnpm 12.4.1、TS7 编译及 TS6 API 兼容包、四个 CLI 包和依赖范围内更新。锁已由包管理器生成，并有本地 frozen／类型／lint／快速文档检查记录；不要重做安装或再次合并同一上游提交。历史说明中“锁尚未生成”和“Node尚未安装”已过期。

React、Vite、Vitest、状态库、编辑器等超出原有范围的版本，以及 Cordis 源码同步仍未完成。用户已授权必要兼容性迁移，不能仅以范围外、上游 harness 尚未迁移或需要单独变更为由结束任务。三个 `deepseek-harness` vendor fork 在当前连接也返回404，保持来源不可解析，不推断永久删除或要求用户在聊天发送令牌。独立可访问的升级继续进行。

## r25 已修复的两条使用路径

[Vitest 共享配置](../../vitest.shared.ts)原来仍从 `typescript` 导入 `transpileModule`。现改为已有的 `@typescript/typescript6`，新增[配置行为测试](../../scripts/vitest-shared.spec.ts)。原有39处迁移不能代表仓库根配置也已覆盖；完整构建也不代表测试配置能加载。

[原生沙箱测试](../../scripts/p0-b/windows-credentials/codex-sandbox-qualification-native.test.mjs)原来仍绑定0.149.1的路径和摘要。现从 provider 的精确依赖声明选择版本化清单，使用[项目包解析器](../../scripts/p0-b/windows-credentials/codex-installed-tools.mjs)解析实际 CLI／平台包并核验三个程序文件，不再猜测 pnpm 存储目录。该更改不初始化沙箱、不改变权限配置，也不将旧版原生结果转用于新版。

[r25 记录](../remediation/2026-09-12/upgrade-consumers-r25/verification.json)区分9项真实文件解析测试与5项局部配置测试。后者在作者环境使用已有TS5.8 API和测试注册替身，不能认证本机TS6包或真实Vitest启动；Windows原生未运行。依赖锁本轮修复未改。

## 本地先执行新的真实配置与包解析验证

沿用已安装的新工具链，安全同步新后继提交，不重置、不强推、不自动stash。先运行新增9项解析器测试；对实际项目调用解析器，记录所选版本、三个路径的必要脱敏信息和哈希一致结果，不执行setup或读取全局配置。然后通过正常Vitest配置运行新增5项配置测试及受影响Codex／Claude provider和Loader组合；若原生插件是这些测试的前置，按现有构建脚本准备，而非绕过依赖。

检查所有跟踪文件的旧编译器API引用，包含根配置、网站／应用配置、构建脚本和第三方插件的实际入口，不只统计原39处。其他直接或间接使用旧API的消费者如有失败，按所属包显式接入兼容依赖并验证；不得用空模块、全局alias或关闭类型／装饰器转换掩盖问题。保留首次真实失败。

## 连续完成剩余主版本和可访问的 vendor 迁移

基于r24已列出的延期项，按依赖关系确定新的有限批次，向各自官方registry查一次当前稳定目标并固定。React／ReactDOM及类型、Lexical和状态管理消费者协同迁移；Vite与React插件、Vitest／coverage及测试配置协同迁移；其他已列直接依赖和补丁工具逐项处理。不强行override不兼容传递依赖，不只再跑一次范围内update。

Cordis按现有vendor流程从原始固定上游到已解析新提交做三方重放，逐项保留或核实淘汰本地修改，检查实际Fiber／Loader／配置重载及销毁行为。不以覆盖目录、删除补丁或任意换fork取得通过。不可访问的fork单独留阻塞，不能阻止Cordis及其他公开依赖的迁移。

由单一责任者更新锁，其他独立源码迁移可并行。真实安装／frozen后做相应构建、类型、lint、运行行为和完整文档检查。完成项目要绑定实际测试命令，不以版本输出或35项文件准备测试替代provider、UI或Loader验收。新故障按根因修复；确实不兼容时给出目标版本、错误和最小未完成改动，而不是泛称等待拥有者。

## CI 状态与仓库维护

基点的Actions已有8个运行，不再是零运行。主CI排队；两个issue流程在上游组织App token步骤失败；预览构建步骤成功、Cloudflare上传失败。它们与本地源码验证分别记录。PR正文更新由远端完成，不需要安装gh作为前置，也不需要模型Key。不能把可选部署失败改写为类型构建失败，或将排队／跳过当作测试通过。

不为消除红灯关闭断言、扩大令牌权限或将受信策略checkout改成PR源码；涉及新增外部服务凭据／runner配置的真实部署决定单列。只有匹配当前候选的实际CI结果才能作为证据，历史成功不认证新提交。

## 提交及不变边界

继续同一分支按组件提交推送，PR #13保持草稿；不合并master、不开放P0-C。新Agent Note核对双语后点名重录配对，scripts下非README参考不制造侧车。记录实际已迁移、已最新、源码不可达、仍有具体兼容故障等状态；不复制一份相同的全项目升级申请。

本轮持续授权项目专用依赖／锁及源码迁移，不授权模型、provider、endpoint、思考等级、credentialRef改变。模型配置两文件、节点状态与历史记录保持原字节。r24记录中的executionAuthorized只适用于该升级任务，不是模型调用或系统初始化批准。不读生产Key／全局认证，不登录、不请求模型、不复制旧沙箱秘密，不操作共享账号／ACL／Firewall／WFP／UAC，不使用Remote Desktop Commander或改其他项目。
