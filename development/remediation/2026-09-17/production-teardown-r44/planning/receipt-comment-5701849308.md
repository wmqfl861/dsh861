COMMENT 5701849308
author: wmqfl861
created_at: 2026-09-16T17:37:55Z
url: https://github.com/wmqfl861/dsh861/pull/13#issuecomment-5701849308
---
## r43 接收与新 CI：观察器10/10，两处生产 teardown 失败在两平台复现；下一步转入受控生产修复规划

### 1. 接收事实，不把审核PASS等同测试全过

PR head **`9d0db65683b7925e37dc84578e23cba2a83e589c`**，parent **`c791b40e35580efd63ebc85607a8c898c64177fb`**，compare ahead1/behind0。本轮实际两个测试/helper净 **+288/-18**，+7171包括Note和证据；两套main spec及生产运行实现未变。PR保持draft，base `feat/multi-agent-company-nodes`不变，未合并，P0-B blocked、不进入P0-C。

已读固定SHA的r43 FINDINGS、10号缺陷诊断及实际owned-contexts helper。用户转达独立复审PASS、push exit0、工作树干净；远端提交链已核对。本次接收已推送的诊断性提交，不重写历史或撤回观察器，也不把2 failed/38 passed写成验收全绿。审核结论、测试退出码与生产缺陷状态分别记录。此前任务要求相关验证通过，不能从本次回执推导“以后任何失败候选都可直接推送”。

历史文档的“未提交/未推送”是执行阶段快照；不覆盖现在的远端状态。证据首失仅在仓库外、早期/最终候选时点等已有披露继续保留，本会话没有逐字节重验全部本地日志或重新执行独立复审。

### 2. 最新主CI与证据身份

[run **35120957257**](https://github.com/wmqfl861/dsh861/actions/runs/35120957257)，attempt **1**、run number **33**，head9d0d，最终 **completed/failure**。UTC 2026-09-16 16:17:38–16:35:21，即Asia/Taipei **2026-09-17 00:17:38–00:35:21**。

实际checkout **`90cd5058de46921cff76597a0d02d99a97cf04ef`**；分别读取head/checkout Git commit，tree均为 **`332b578528330085d1bf7ee6982d14f9d57516f0`**；checkout parents为base `5434305c5dcf7ddc3ebf939226647b7b608335e6` 与head9d0d。三包identity的run/attempt/head/base/checkout/parents相符，实际Node **26.8.2**、pnpm **12.4.1**。

主CI17 jobs：**13 success / 4 failure**。失败是Linux coverage **104878302891**、Windows coverage **104878303195**、consumers **104878302556**和依赖汇总 **104883647184**。静态、三个Node兼容性、Windows build/native/observational、benchmark、keyless Python及相关发行形态作业成功；没有把真实API跳过或未下载wheel当作独立验收。

### 3. 本次确实下载核验的三个ZIP

| Artifact | ZIP bytes | 实测SHA-256，匹配GitHub digest |
| --- | ---: | --- |
| [Linux **10457902399**](https://github.com/wmqfl861/dsh861/actions/runs/35120957257/artifacts/10457902399) | 180023 | `0190281e366b6a7e717754bf6d7bbbad787f379ea82e0bdab11233e3c843f7fa` |
| [Windows **10457393411**](https://github.com/wmqfl861/dsh861/actions/runs/35120957257/artifacts/10457393411) | 194475 | `3d8b30ef0920df1fe78da0ed34e8c9e0722a90d7cfbeab6986c8e7d5aedcf1ee` |
| [consumers **10457417947**](https://github.com/wmqfl861/dsh861/actions/runs/35120957257/artifacts/10457417947) | 18981 | `f57dd0da2cd58aa162161af8c2ef06e43ffc719e282d78d05803e14c56bba51a` |

三包CRC、精确五成员、无重复/绝对或上级路径/符号链接通过；manifest所列identity、gate-results、stdout、stderr共 **12/12** 文件长度/SHA-256一致。两个coverage外层均2passed/1failed/0skipped，分区coverage exit1，非aborted/allowFailure；consumers为10passed/1failed/0skipped，失败web-snapshot exit1。

完整性：Linux stdout original1120582/retained1048064/omitted72518，含标记成员1048163bytes；Windows original1207707/retained1048064/omitted159643，含标记成员1048164bytes。两份stderr256854/249997bytes无manifest截断标记。consumers stdout53411/stderr84774bytes，manifest无截断记录。不称两个coverage stdout完整，不把分区合并报告/重复尾部再累计。

### 4. 新run真实结果

r43三套目标测试在**两平台均38passed/2failed**：owned-contexts **10/10**；control **17passed/1failed**；team **11passed/1failed**。两失败与本地回执相同：control的held-model teardown、team的双setup teardown。control聚合1个subagent错误；team聚合Team投影错误及同类subagent错误；不是把它们全部当两个独立日志事件。r41 helpers.client仍两平台10/10。

| 平台 | 四分区测试汇总 | 文件汇总 |
| --- | --- | --- |
| Linux | **23051passed/3failed/46skipped/1expected fail** | 1225passed/3failed/8skipped |
| Windows | **22033passed/4failed/58skipped/1expected fail** | 1179passed/4failed/10skipped |

各分区类别总和与括号总数一致。除两处teardown外，Linux还有Python wide completion的60000ms上限失败；Windows还有session-projection-cache在turn/end未观察到期望checkpoint（收到seq=-1/val=null，期待seq=1/marks[a]），以及gen-client-catalog工作区扫描30000ms超时。没有把r42的watchdog/Inspector/HTML资产路径旧失败当作本run的失败。

coverage阈值：Linux **182条/62文件**，Windows **185条/63文件**；Windows额外文件为`packages/lsp/lsp-stdio/src/instance.ts`。这些是失败运行报告，不能直接认定为63个独立产品缺陷。阈值、include/exclude与reporter不改。

Web批次 **354passed/1failed/13skipped**、99passed文件/1failed文件；`apps/web/tests/present-svg.e2e.ts:112`浏览器错误列表再次含React #185。它是本次重新观察到的历史间歇问题，不删除浏览器错误检查或刷新golden接受它。本次未见FileHandle/ERR_INVALID_STATE未处理摘要；新helper主动聚合的teardown错误仍是明确失败，不能借“无Unhandled”忽略。

### 5. 源码复核：保留观察器，优先修所有权与销毁顺序，不接受泛化吞错

已读TeamService、TeamRoster、SubagentRuntime、ContinuableActivationRegistry、SubagentInbox、ReactLoopAgent/Inbox、SessionProjectionRegistry、Cordis错误栈拼接及节点规则。

**Team的已证实结构：** `agent-team/src/index.ts:116–124`在Team自己的effect内，用`ctx.root.sessionProjections.register`创建root-owned投影注销，再在Team disposer内try/finally调用它。投影注册实际是调用方fiber的effect。根卸载时，独立root注销可与Team `disposeRuntime()`并发，单个Team函数里的finally不能约束那份独立root effect。应把真实资源所有权和串行释放放到能覆盖runtime排空的同一生命周期中；仅把源码行挪到同一函数、仅改root为ctx但仍保留两个并行disposer，均不足以证明顺序。

**Subagent新增的关键审查点：** `continuation-activation.ts`的`finishDisposal`在受保护的收尾之前调用`agent.cancel({kind:'parent'})`；`ReactLoopAgent.cancel`先`inbox.clear()`、后abort，而`ReactLoopInbox`真实读取有生命周期的投影。若cancel同步抛错，这个close transaction的后续child处理、显式handle.dispose、resident/ownership/lifecycle终态清理可能被跳过。根侧另一个owner可能仍关闭handle，不等于当前Activation已正确收尾。因此要同时证明依赖存活至最后读取、并发关闭共享终态，以及单步失败不跳过其他释放。不得仅匹配错误文本吞掉、使用keepInbox改变取消语义、删除投影存在检查或把journal.state默认成空表。

**校正一个尚未证明的历史归因：** r43诊断把错误栈中的`Fiber._reload`视为“销毁期间重新加载”。当前`vendor/cordis/src/utils.ts`的composeError/handleError会将注册时捕获的outer frames拼入异步异常。因此该栈本身**不能证明发生了实时重新加载**；需由实际fiber事件/握手时序证据区分。保留原始诊断，不重写历史文件；下一正式计划不以这个未经时序证明的解释为既定根因。

### 6. 下一阶段与边界

下一修复目标选定为上述两类**生产生命周期**问题，而不是再改变测试的通过标准。必须保留r43观察器、根/子fiber故障回归和两处真实失败用例。此阶段已经超出此前“只改测试”的保护面；按仓库NODE_DEVELOPMENT_RULES先完成适用的真实规划与范围核验，固定候选硬审核和必要行为验证不能被普通内置子代理报告替代。未具备现有授权/正式计划/指定工具前，只交明确BLOCKED及规划输入，不先改受保护源码，不借本评论新增收费或凭据授权。

本会话已完成提交接收、三ZIP实际字节与失败核验、源码级审查、候选方向取舍和归因校正。尚未执行项目Node26测试或生产修复，也没有完成正式Codex规划/OpenCode硬审核。本容器Node22.16.0、无项目依赖/pnpm，当前公开源码curl取件实际DNS失败；没有绕过本地hooks写生产补丁。

本轮只更新PR评论/元数据；没有新增源码或文件提交、移动ref、手动重跑/取消CI或操作用户主机。原始ZIP和全部固定源码已在GitHub，不需要聊天附件或新git-apply包。辅助policy/lifecycle/preview列表仍失败，两release及Node Addon System成功、realAPI E2E跳过；本轮未重新分析辅助失败日志，不改授权/部署。模型配置、P0-B state、锁、pkg补丁、vendor、工作流、历史证据继续保护，不读Key/全局凭据/用户.env，不用Remote Desktop Commander，不操作其他项目，不合并、不进入P0-C。
