COMMENT 5701865211
author: wmqfl861
created_at: 2026-09-16T17:39:11Z
url: https://github.com/wmqfl861/dsh861/pull/13#issuecomment-5701865211
---
## LOCAL_AGENT_TASK — r44：生产 teardown 的正式规划与受控修复；不再把投影缺失当可忽略错误

依据：[r43接收、三包CI核验和源码归因校正](https://github.com/wmqfl861/dsh861/pull/13#issuecomment-5701849308)。r43观察器保留；当前三套测试两平台均38passed/2failed，owned-contexts自身10/10。目标是消除真实生产销毁错误，同时保留“有真实错误就失败并保留目录”的保护，不把两个失败改成expected fail或接受AggregateError。

### A. 工作区与权限前置

仅 `C:\Albert\project\dsh861`、`wmqfl861/dsh861`、分支 `chore/latest-stable-upgrade-20260912`、草稿PR #13。起点：

```
9d0db65683b7925e37dc84578e23cba2a83e589c
```

逐条记录branch、完整HEAD、status、远端 `git ls-remote --exit-code origin refs/heads/chore/latest-stable-upgrade-20260912`。本地与远端一致且干净不重复fetch；只有干净、纯落后且远端仍为上述SHA才fetch指定分支并ff-only。其他工作/远端移动保留现场，不reset/rebase/amend/stash/clean/强推/覆盖。中断重派先核对现有候选和证据，不推断“前代理未做工作”。

复用Node26.8.2/pnpm12.4.1和现有依赖；工具链PATH贯穿所有命令与正常hooks。不修全局shim、不装gh、不重装升级、不改Git/GCM/认证或系统。无活动push才允许启动一次正常push，GCM交互由用户本人处理。

**本轮不同于r36–r43的测试限定修复：候选可能涉及生产源码。** 先读取当前AGENTS、NODE_DEVELOPMENT_RULES、packages/AGENTS、docs/architecture.md、docs/defensive-patterns.md、测试/快照政策、预推送skill，以及既有当前节点计划和有效授权记录。不能把“继续开发”或本评论解释成解除所有生产保护、允许新收费请求或推进下一节点。

正式规划/必要计划修订依仓库规则由真实Codex CLI（`gpt-6-astra`、reasoning `max`）完成，ZCode实施，固定候选由真实OpenCode（`zhipuai-coding-plan/glm-5.3`、variant `max`）硬审；不得用内置子代理/本评论冒充。如果既有明确授权没有覆盖相应调用或生产范围，指定CLI/参数/认证不可用，或P0-B前置条件不允许这个修复计划，**只在当前回合整理源码证据、计划输入和精确BLOCKED报告，不先改受保护源码，不自行换模型、读凭据或创建下一节点**。禁止尝试新的Key/登录/全局设置来解除阻断；本任务不新增费用或凭据读取授权。

这是当前升级收尾/当前节点的修复子任务，不是P0-C。P0-B state不改、不宣布通过；正式产物沿用实际已有节点位置，不凭空发明节点通过记录。

### B. 已固定的源码输入与候选范围

| 首要生产诊断文件 | 固定Git blob |
| --- | --- |
| `packages/experimental/agent-team/src/index.ts` | `6fa0500eebff1f4eb865d5e290fa251c3beff0ea` |
| `packages/subagent/subagent/src/continuation-activation.ts` | `df2b6da439776918aaf5d6f4cbad07e9c7ef6dab` |
| `packages/subagent/subagent/src/index.ts`（仅若正式计划需要调整continuation owner接线） | `8a91e06e56c63006d473d421113936ed2d0331ad` |

上述是**正式计划的候选目标清单，不是未经计划即可直接修改的补丁指令**。计划必须具体确定每个文件的必要变更、行为责任与验收。优先在这两个领域包中解决；不得顺手改整个Cordis并发卸载算法或给所有投影读取加默认值。

只读辅助链路包括：
- Team journal/roster/lifecycle、SubagentInbox、continuation manager；
- `packages/core/agent-loop/src/agent.ts`（`06e1f51b57277ba296698b6c8b810f0e455e3695`）：cancel先clear inbox再abort；
- `packages/core/agent-loop/src/inbox.ts`（`db89cd3072677ebd6acbd40f7d496bab15c19cef`）：inbox投影随注册者scope存活；
- AgentLoop主文件的真实memoized handle teardown、session-projection register的caller-fiber所有权；
- Cordis fiber的并发_unload、utils.composeError的注册栈拼接。

AgentLoop/core inbox、session-projection注册框架、scope、持久化/lease、vendor先保持只读；若严谨方案必须改它们，规划者须给出不能在首要范围解决的时序证据、最小文件集合及所需授权，不能自行扩大保护面。

必须保留：r43 `owned-contexts.ts` blob **`7713e57d18adab01b5ed4ceb59c08ebb66e3bfd5`** 和 `owned-contexts.spec.ts` **`56a60a2f9c8cc753522ae53ae4bdb9d5dc886291`** 的检测语义。正常情况下这两个文件不改。允许owner-local生产回归与两main spec必要的测试资源清理；不改其“正常teardown应resolve”的业务期待。新文档/Note/配对/证据允许，r29–r43冻结记录不动。

### C. 正式计划必须先消除的归因歧义

r43诊断文件可作为证据入口，不当作所有因果已经证明：`_reload`等帧可能是composeError拼入的注册时调用栈，**不是销毁时重加载的直接证据**。必要时用真实root/child fiber事件、实际disposer入口/完成与Promise握手记录顺序；不得仅从长栈编造发生顺序，也不改历史诊断来掩盖校正。

计划分别标明：哪个fiber拥有Team投影注销、Team runtime、Agent inbox投影、continuation owner scope、AgentHandle、写持久化；每个资源最后一次合法使用在何时、谁开始/等待它的清理；根卸载、单插件HMR、依赖撤销及并发close各走哪条实际路径。需要复现时只跑两个已定位单测或三套小范围，不重演全部r43负控/门禁。

### D. 选定修复原则

**D1 / Team：先完成runtime停止，再撤回它仍需要的投影。** 当前ctx.effect内部调用ctx.root.sessionProjections.register，造成独立root effect可提前撤销；函数内finally并不能控制该独立注销。优先修正真正的所有者与有序释放：在能覆盖整个drain的同一生命周期中保留投影，runtime关闭/等待后再注销。若使用generator/effect序列，必须证明注销真的从并行兄弟effect中转移到该序列，而不仅是把两行写在一起。保持正常HMR注销、重新注册/重放、权限与live roster语义。

不得让journal.state在投影缺失时返回空Team、跳过liveChildrenByRoot或只捕获“projection not registered”后返回成功；这些做法可能留下仍运行的成员。运行期真正缺少必需投影仍应fail loud。

**D2 / Continuable activation：正确处理多个owner竞争关闭，任何前置步骤失败也不能跳过释放。** finishDisposal当前在保护块之前调用agent.cancel；cancel的inbox.clear可同步拒绝，跳过后续handle.dispose、resident/ownership清理与终态通知。计划需同时解决真实依赖生命周期/重复关闭竞态和这条异常安全漏洞。

区分仍活动Agent与已经由另一个明确owner启动/完成销毁的**同一AgentHandle**。后者应按实际所有权证据加入已存在的memoized清理，而不是再次访问已销毁scope；不能仅因某个投影不存在便推断“已清理”。仍活动的关闭须保持取消原因、inbox处理、child-first释放、已接纳工作和终态事件原义。单个cancel/capture/child/handle步骤失败后，其余释放义务仍须执行，原错误和后续错误可追溯，真正失败仍由r43观察器报告。

禁止字符串匹配吞错、统一keepInbox:true、把ACTIVATION_TEARDOWN_FAILED降级warning、清空resident自证、跳过handle.close，或让whenIdle提前成功。不要先dispose掉Agent再无条件读取其投影/请求终态；保持最后合法读取与释放顺序。

先解决共享subagent关闭路径，再整合依赖它的Team关闭；独立只读分析可并行，互相依赖的生产写入与最终审核不能并行。

### E. 验收必须同时覆盖正常退出和故障退出

在正式计划授权范围内先写实际owner-local回归，保留真实首失；然后最小实现。不得只修改测试调度，让两个fixture在销毁前主动结束而避开真实root卸载。

1. **两原始失败转绿**：r43观察器不弱化，control held-gate和team双setup通过，三套现有40个用例全部通过（另列新增用例实际数量）；两个写锁afterDispose探针必须实际执行而非因先捕获错误而跳过。
2. **真实生产入口**：单Team/Subagent插件HMR、root整体卸载、挂起模型gate、已存在子/孙activation以及重复/并发关闭。模型全部用本地fake，必须是同一真实dispose路径。观察runtime停止、agent/session registry退出、handle close完成、原目录写所有权释放及之后目录删除，非“未看到错误”自证。
3. **顺序观测**：用Promise/deferred握手让清理暂停，证明所需投影保持到最后合法使用，结构性注销不能越过drain；根与子owner参与时也成立。避免sleep、扩大timeout或只断言代码里出现finally。
4. **异常安全**：对测试自有真实参与者的cancel/子关闭等注入有身份的sentinel，验证其它child/handle/ownership仍清理、所有原始失败均可报告；有真实故障时测试级清理应拒绝并保留诊断目录，不得输出假success。
5. **非回归**：现有权限、selected child/descendant隔离、未受影响parent树、fork/冷恢复、inbox/终态事件、Team roster/CAS/wait与HMR仍保持；终态不得重复，不允许丢失应持久化的事件。按仓库政策确定需要的keyless session快照；不能刷新golden吸收错误输出。
6. **两个修复独立负控**：分别恢复Team旧所有权/过早注销，和Subagent旧关闭顺序/异常早退，各应由对应真实回归拒绝；不能只用关闭r43 observer做这轮负控。固定候选、独立运行、可靠finally恢复，bytes/blob/SHA-256与真实退出码入证据。负控只能触及正式计划批准且无并发写入的文件，不用checkout/reset/stash。

被保护保留的目录不是无条件垃圾。仅对本轮明确拥有的随机目录，在保存失败证据、确认所有相关任务完成且写handle释放后做测试驱动最终清理。不能按前缀扫描并删除所有历史目录，不能靠rm/重建后重新拿锁伪证原锁释放；若不能证明已停止，保留并报告。

### F. 项目执行与交付门禁

现有三套聚焦组合：

```powershell
pnpm exec vitest run --project thread-safe packages/subagent/tool-subagent-control/tests/owned-contexts.spec.ts packages/subagent/tool-subagent-control/tests/tool-subagent-control.spec.ts packages/experimental/tool-agent-team/tests/tool-team.spec.ts
```

正式计划新增的owner-local lifecycle spec加入命令；按实际影响跑必要的相关子集、类型/lint/duplication/doc-sync和必要keyless记录/内建产物smoke。不要默认全coverage/Web、Gateway212、Loader122、exe-wheel或旧六个Windows golden；若生产改动确实要求额外验证，正式计划逐项说明必要性，不能以旧轮禁止大矩阵为由跳过新增必要验收，也不机械跑全仓。

所有日志逐物理运行独立命名，真实保存exit与命中数量；不接受过滤零测试、不复制同一run充当两次验证。文件最终内容与哈希清单同步，raw/normalized双哈希含时点。缺失历史证据如实保留，不补造。

新增中英文Agent Note、正确配对及涉及的README/JSDoc。说明顺序、幂等、错误传播及持久化/终态不变或经计划明确的必要变更。新证据建议：

```
development/remediation/2026-09-17/production-teardown-r44/
```

可分planning、windows-execution、review；这是新建建议，不是已有远端文件。正式节点记录用现有真实节点位置/版本并链接，不改P0-B通过状态。

先完成适用的真实Codex计划，再实施，最后固定包含新增文件的完整候选交真实OpenCode硬审；各自记录实际二进制路径/版本、模型/等级参数、退出码、提示输入哈希、输出和候选身份。可以另做全新上下文独立代码复核，但不能替代指定规划/硬审。认证或指定参数不可用则BLOCKED，不降级换模型或以自述冒充。

**生产修复交付不得以2F/38P继续宣布完成。** 目标失败、新负控恢复后的正向及必需受影响检查实际通过，审核对固定候选明确PASS后，才正常hooks提交；核对远端仍可纯快进，再非强制推送同分支。不绕过hooks、不amend/force、不手动重跑/取消CI、不为push回执追加无必要提交。无法完成生产修复时提交的是精确阻断回执，而不是伪通过；未另有明确诊断提交授权，不自行推送未完成的生产补丁。

### G. 文件下载与使用

本轮没有新git-apply补丁或聊天附件；本评论及接收报告是规划输入，不能当成已经完成的正式Codex计划。固定9d0d源码与r43诊断/日志已在仓库；已有工作树直接使用，缺少时按A的安全fetch/ff-only流程取件，不从main下载覆盖。

需要读取本次CI原始失败时，现成Artifacts在run35120957257/attempt1：

- Linux： https://github.com/wmqfl861/dsh861/actions/runs/35120957257/artifacts/10457902399 ，180023bytes，SHA-256 `0190281e366b6a7e717754bf6d7bbbad787f379ea82e0bdab11233e3c843f7fa`。
- Windows： https://github.com/wmqfl861/dsh861/actions/runs/35120957257/artifacts/10457393411 ，194475bytes，SHA-256 `3d8b30ef0920df1fe78da0ed34e8c9e0722a90d7cfbeab6986c8e7d5aedcf1ee`。
- consumers： https://github.com/wmqfl861/dsh861/actions/runs/35120957257/artifacts/10457417947 ，18981bytes，SHA-256 `f57dd0da2cd58aa162161af8c2ef06e43ffc719e282d78d05803e14c56bba51a`。

用既有授权连接/浏览器下载，Get-FileHash核验；检查无绝对/上级路径、重复或symlink、精确五成员；仓库外新目录读取identity/gate-results再stderr/stdout，核对manifest四个文件hash/bytes。两个coverage stdout有截断；不要执行日志、不修改ZIP。主会话已完成取证，不要求本地重复下载所有包，更不跑全coverage只为取包。

### H. 回传及其余边界

回传先区分PLAN_READY/IMPLEMENTED/VALIDATED/REVIEW_PASS/BLOCKED。列出有效授权与正式计划位置、实际候选生产文件及必要性、原始/新增回归、两独立负控和恢复、真实资源/终态/错误传播验证、必要门禁、指定硬审证据、完整提交SHA、本地/远端HEAD、push退出码、工作树及GitHub证据路径。未运行不写PASS，不能只回“独立复审通过”省略实际测试失败。

Linux Python、Windows checkpoint/cache及catalog扫描、Web React #185、Linux62/Windows63文件阈值短缺和历史间歇问题另列，不顺手改timeout、金样、覆盖率或错误检查。无FileHandle摘要也不代表所有历史根因闭合。

模型配置/provider/endpoint/思考等级/credentialRef、P0-B state、锁、pkg补丁、vendor、工作流、历史证据继续保护；生产修改只在已有有效授权和正式计划明确的最小范围内。禁止全局串行化Cordis、关闭observer/采样/fail-fast、扩大豁免、continue-on-error、吞错误或强退造绿。测试不调用真实模型API/E2B；开发规划/审核工具也仅按现有明确授权，不新增收费授权，不读生产Key/全局凭据/用户.env。不改系统/账号/ACL/注册表/防火墙/UAC/Developer Mode，不用Remote Desktop Commander，不操作其他项目。PR draft、base不变，不合并，P0-B blocked，不进入P0-C。
