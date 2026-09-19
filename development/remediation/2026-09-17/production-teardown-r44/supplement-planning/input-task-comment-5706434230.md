## LOCAL_AGENT_TASK — r44-B（条件启用）：范围与审核条件就绪后的有限接续

当前远端审阅：[r44-A接收、全文审阅、三个core范围与补项](https://github.com/wmqfl861/dsh861/pull/13#issuecomment-5706427680)。原生产任务的安全、验证和硬审核要求仍见[r44任务](https://github.com/wmqfl861/dsh861/pull/13#issuecomment-5701865211)。

**本说明只是就绪后的接续提示词，不是新的所有者授权，不是正式计划修订，也不表示现在开始实施。** r44-A归档已完成，不重做归档；当前仍BLOCKED。没有新的认证恢复/明确范围决定时，不再运行auth/models探测、Codex重规划、业务测试或制造又一份同样的BLOCKED提交，保留现有现场即可。

### 1. 启用条件与身份

先取得并记录所有者明确的范围决定以及既定OpenCode审核条件已恢复的事实；只有同时满足才按现有规则接续。认证与范围互不替代。保持真实Codex `gpt-6-astra` / reasoning `max`规划或必要补订、ZCode实施、真实OpenCode `zhipuai-coding-plan/glm-5.3` / variant `max`对固定候选硬审核；不代选模型，不以内部复核冒充指定CLI。规划/审核的新调用仅限有效授权覆盖的用途；不因本评论扩大费用或凭据权限。认证由用户本人在自己的环境处理，agent不索取/读取/复制Key或全局凭据。

工作区 `C:\Albert\project\dsh861`，仓库 `wmqfl861/dsh861`，分支 `chore/latest-stable-upgrade-20260912`，PR #13仍draft、base `feat/multi-agent-company-nodes`不变。最新归档起点：

```
e8d1858ca6a65710c346007e48809580f6064beb
```

生产/测试源码基线仍为9d0db656，无需因计划写旧基线而回退HEAD。核对branch、HEAD、status、远端ls-remote。已知3个未跟踪原件是索引声明的保留输入，不要求工作树为空，不上传、不清理：

- `development/remediation/2026-09-17/production-teardown-r44/planning/cli-availability-probe.md`
- `development/remediation/2026-09-17/production-teardown-r44/review/BLOCKED-opencode-hard-review.md`
- `development/remediation/2026-09-17/production-teardown-r44/windows-execution/01-first-failure.normalized.log`

只按归档索引核验其归属，其他意外工作/远端移动则保留现场。不得reset/rebase/amend/stash/clean/覆盖或强推。复用Node26.8.2/pnpm12.4.1和正确项目PATH，正常hooks保留，不重装升级、不修全局shim、不装gh。

### 2. 待批准的有限范围，不是全仓写权限

原生产目标：

```
packages/experimental/agent-team/src/index.ts
packages/subagent/subagent/src/continuation-activation.ts
packages/subagent/subagent/src/index.ts
```

新增core候选：

```
packages/core/agent/src/index.ts
packages/core/agent-loop/src/index.ts
packages/core/agent-loop/src/agent.ts
```

plan §10.2另列的已有测试支持脚本 `scripts/smoke-python-runtime.py` 必须显式包含在批准范围内才能修改，只为本轮built-CLI/keyless场景；不得从批准core文件推导整个scripts可写。必要配套包括计划指定owner-local测试、相关README/JSDoc及双语配对、`docs/architecture.md`生命周期说明、新Session/双SDK场景。计划列明的新路径有：

```
packages/subagent/subagent/tests/continuation-teardown.spec.ts
packages/experimental/agent-team/tests/teardown.spec.ts
packages/core/agent-loop/tests/teardown-ownership.spec.ts
snapshots/sdk/subagent-teardown/
snapshots/sdk/agent-team-teardown/
snapshots/sdk/teardown.snapshot.ts
scripts/snapshots/python-sdk-single-exe/production-teardown/
```

执行前形成准确文件清单；其他adapter/生成器/公开API文件若确有新增必要性，报告最小扩围，不先写。r43 observer及其10个回归、两个原始正常teardown用例的成功期待保持，不关闭检测以造绿。`scope`、core inbox、session-projection框架、持久化/lease、vendor、锁、workflow、模型配置、P0-B state及冻结证据仍保护。

### 3. 先补清实施顺序，再写生产实现

复用冻结plan.v1，按本次远端审阅的R44-REVIEW-01/02/03进行必要的版本化短补充。正式计划需要修订的部分由指定规划者完成，不让实施者默改验收；**不重跑40分钟全量规划，不覆盖v1，不试图补造原argv/exit**。新调用的命令、返回状态和输出单独捕获，不用它替旧调用回执。

重点：

- R1旧实现取证使用已有接口、真实factory/consumer/scope事件与deferred握手；尚不存在的begin/beforeRelease不能成为旧接口编译失败的“有效首失”。新hooks的K用例属于实施后验收，分开记录。若旧接口轨迹否定扩围依据，交指定规划者缩减方案，不能仍照猜测实施。
- factory层新增明确的多handle/启动工作等待检查：同一factory拥有互不为父子的A/B，A失败而B实际清理被gate阻挡。工厂不能先宣布完成；B放行且所有已启动任务settle后，仍应报告A及其他原始错误。主会话Node22隔离对照只是输入，必须在真实仓库路径验证是否已有其他结构性等待或仍有缺口；不机械替换Promise.all、不新增静默allSettled。
- 给出共享准备Promise、handle completion、child completion和owner wrapper的等待关系；覆盖可重入发布、自然settlement维护期、child-first与异常继续释放。不得只写“禁止自等”而实现出间接等待环。
- 新SDK/Session快照实际触发shutdown、记录真实新追加及持久化终态；不能仅重放预制已完成日志。支持脚本范围与接受/拒绝输入检查明确列入同候选。

现有计划的其他核心要求继续：timeout不是静止，先完成必要使用再注销投影；正常缺必需依赖仍fail loud；异常不跳过其余释放，不改keepInbox、不字符串吞错、不丢原错误identity；三个afterDispose回调实际执行，非“无错误日志”自证。

### 4. 进入实施后保持原R1–R9顺序

授权范围、真实轨迹、适用正式计划/审核准入均满足后，实施共享关闭基础→Subagent→Team→必要非回归/快照→独立负控→文档和门禁→固定候选硬审。不同依赖阶段不要同时写核心文件；审核期间候选冻结。

原三套基本命令：

```powershell
pnpm exec vitest run --project thread-safe packages/subagent/tool-subagent-control/tests/owned-contexts.spec.ts packages/subagent/tool-subagent-control/tests/tool-subagent-control.spec.ts packages/experimental/tool-agent-team/tests/tool-team.spec.ts
```

新增owner-local和必要built/双SDK检查按正式计划，真实数量以实际注册/执行为准，原40不得降低。原2个正常失败必须转绿；故障专用回归仍要拒绝并保留目录。分别恢复Team旧所有权/Subagent旧异常早退的负控，候选字节可靠finally恢复，不能靠关闭observer做负控。

所有任务在同回合/前台执行并留下真实结果，不承诺后台监控；暂停或被中断时首先保存/识别现场。失败目录仅在本轮拥有且确认所有相关任务、写handle结束后按准确路径收尾，不能全局按前缀扫删。原证据冻结，后继文档/轨迹/日志另建版本路径，保持raw/published身份和实际exit，不以拷贝一次运行充多次。

必需正向、恢复后验证和固定候选的真实OpenCode硬审明确PASS后，正常hooks提交与非强制快进推送。未完成的生产候选不得以“如实失败”为由自动推送，不amend/force、不手动重跑/取消CI、不修改skip/timeout/coverage/保护设置，不为回执额外造提交。

### 5. GitHub取件与使用

没有新的git-apply补丁。只读输入均已在固定e8d提交：

- [计划](https://github.com/wmqfl861/dsh861/blob/e8d1858ca6a65710c346007e48809580f6064beb/development/remediation/2026-09-17/production-teardown-r44/planning/plan.v1.md)
- [索引与文件哈希](https://github.com/wmqfl861/dsh861/blob/e8d1858ca6a65710c346007e48809580f6064beb/development/remediation/2026-09-17/production-teardown-r44/archive-receipt.v1.md)
- [审计发布副本](https://github.com/wmqfl861/dsh861/blob/e8d1858ca6a65710c346007e48809580f6064beb/development/remediation/2026-09-17/production-teardown-r44/review/r44-independent-audit.published.v1.md)

计划Git blob `e28695c08b43cec50c196f3fa252543a014ce847`；索引记录51955bytes和SHA-256 `4b666af39f993ac1253c079786d1bc87391caf8d91abcff35b4f25f3fa41141c`。已有工作树无需重新下载。接收副本通过既有授权GitHub连接/界面取固定SHA，并按索引校验；缺少提交时先核对3个本地保留件及其他工作，只有能安全纯快进且不覆盖时才fetch/ff-only。不要下载main覆盖，不要按冻结计划中本机绝对路径去扫描用户全盘，断链用上述索引定位发布副本，不改原件。

### 6. 回传与停止条件

回传明确区分：所有者范围决定、认证就绪依据、计划补充、旧接口真实轨迹、IMPLEMENTED、VALIDATED、指定硬审、提交/推送。批准或认证尚缺时只保留BLOCKED，不制造新的重复检查记录；不得称计划建议为所有者批准。

本轮目标仍是两个生产teardown缺陷；Python性能、coverage短缺及其他间歇问题另列，不扩散修复。未授权新模型请求不执行，业务测试不访问真实模型API/E2B，不读取Key/全局认证/用户.env，不改系统权限，不用Remote Desktop Commander，不操作其他项目。PR继续draft，base不变，不合并，P0-B blocked，不进入P0-C。