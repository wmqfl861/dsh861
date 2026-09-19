# Agent Note：agent-team-teardown 快照触发器的已确认投递屏障

Status: implemented

[English](2026-09-19-team-delivery-fence-r46.md) | 中文

## 问题

`agent-team-teardown` 场景触发器（`snapshots/sdk/agent-team-teardown/teardown-trigger.mjs`）在"held 第二次模型调用、teammate 收件箱有待处理内容、Lead 空闲"三件事齐备时即武装 teammate 关闭。待处理收件箱这一事实由插件自己的 `agentTeams.sendMessage` 调用产生，但就绪判断从不等待该发送：发送的派发会同步向 teammate 收件箱插入消息，`agent/inbox/inserted` 处理器在发送 promise 尚未落定时就重入 evaluate，而 fulfill 与 reject 两个回调都只把 `pendingQueued` 置位、不检查返回结果。由此产生两种失败形态。其一，关闭可能在发送仍在途时触发，CI consumers run（35376750928）在 Linux 上输掉的正是这个竞态：root Session 持久化了期望 42 条中的 41 条，缺少场景第二条 team 消息的 `team/message/delivered`（`team/message/queued` 已落盘），因为 `drainContinuableChildren` 在 Lead 日志记录投递边之前就拆掉了 teammate。其二，落定为 `queued` 或被拒绝的发送仍计为成功，场景可能在一条未投递的消息上报告绿色关闭。

## 决策

触发器现在以该次发送的已验真落定作为就绪门槛。发送回调把结果交给单一的 `settleSendResult` 步骤，要求 `status: 'accepted'` 且 `messageId` 为可用字符串；`queued`、非字符串或空身份、不可用状态与拒绝分别记录独立的 `sendStatus`（`queued` / `invalid` / `rejected`），并把确切原因写入 `state.json` 新增的 `sendMessageId` / `sendError` 字段，而不是任何成功标志。就绪是原场景事实（held 调用、待处理收件箱、Lead 空闲）与 `sendStatus === 'accepted'` 的合取，因此两种顺序——收件箱先于发送落定插入、或确认先于其余条件到达——都恰好武装一次关闭，且任何路径都无法在 queued 或拒绝的发送上武装。自动与手动模式共用同一事实：手动轮询定时器要求同一个 `state.ready`，提前存在 trigger 文件也越不过确认屏障。只有确切 teammate 的收件箱插入计入待处理事实；无关 child 的插入不再武装任何东西。生产语义不变——`TeamMailbox.send` 只有在其派发把 `team/message/delivered` 检查点写入 Lead 日志后才落定 `accepted`，因此屏障等待的是持久化投递而非内存标志，真实关闭仍走 `subagents.drainContinuableChildren(lead, [teammateId])`，held 调用的 abort 握手、定时器卸载与 effect 清理全部保留。

确定性回归 `scripts/tests/agent-team-teardown-trigger.spec.ts` 通过测试自有子进程 fixture（`scripts/tests/fixtures/agent-team-teardown-trigger-driver.mjs`）驱动实际仓库模块，其 fake Context 显式控制发送与 drain 的落定顺序；spec 重新计算模块 SHA-256 以证明运行的是仓库文件而非抄本。七个场景钉住因果顺序：插入先于确认、确认先于条件、queued、拒绝、无效身份、手动模式（trigger 文件提前存在、无关 child、重复事件）以及 abort 握手与真实关闭错误。在未修改模块上该 spec 10 个测试失败 7 个，首失即所需形态——`no-close-while-send-pending` 观察到发送仍 pending 时 drain 已触发。两个独立负控只改动触发器：移除确认前置恰在 pending-发送断言处失败；把 queued 或拒绝当作确认成功使 queued 与拒绝两个不关闭分支失败；两个突变体都按字节恢复（SHA-256 复核一致），spec 回到 10/10。手动 teardown 适配器（`snapshots/sdk/teardown.snapshot.ts`）同时把屏障钉在真实运行时上：armed 门要求 `sendStatus === 'accepted'` 与消息身份，关闭前的 Lead 日志必须为该 `messageId` 同时包含 `team/message/queued` 与 `team/message/delivered`、目标为 teammate、投递晚于排队边，投递必须先于所有关闭产生的 root 事件，child 在 held 步骤之后的待处理收件箱插入必须携带同一消息身份，而未获确认的发送会带着已记录的 `sendError` 立即失败 armed 轮询而非超时。

## 考虑过的替代方案

**只等待收件箱插入。** 插入发生在发送派发期间、落定之前；把它当作确认正是 CI 丢失 `team/message/delivered` 的那个竞态。

**不看状态、把发送 fulfill 当成功。** `TeamMailbox.send` 在投递无法完成时落定 `queued`；在未投递消息上的绿色关闭正是本屏障要消除的假成功形态。

**由触发器读取 Lead 日志确认投递。** 触发器将重复实现 mailbox 已完成的 journal 观察；`accepted` 落定就是 mailbox 自己对投递边已持久的陈述。

**刷新 golden 删掉 delivered 事件。** golden 的 42 条 root session 是录制下来的契约；缺陷在触发器的顺序，不在期望本身。

## 后果

真实 SDK 适配器在本 Windows 主机 2/2 通过，同一消息身份在关闭 suffix 之前验证为 queued 与 delivered（`team-message-… delivered@32`，关闭 suffix 从 seq 33 开始），场景持久化输出现在确定性地匹配 CI 此前因竞态而丢失的已提交 golden 形态。未改动任何生产包、共享 `sdk.snapshot.ts`、normalizer、golden、replay 输入、锁文件或 workflow。共享自动 lane 在本 Windows 主机仍无法完成：其 fixture 水合把带反斜杠的原始 `{{cwd}}` 嵌入 JSONL 文本，`llm-replay` 加载失败、首个 prompt 报 `cannot create effect on inactive context`——这是 r44 已记录缺口在 golden 比较之前的原样复现，完整比较仍以 Linux CI lane 为权威。subagent-teardown 的 pwsh/bash tool-schema 平台差异及其余保留的 r44/r45 环境发现未触碰。证据：[windows-execution/FINDINGS.md](../../../../development/remediation/2026-09-19/team-delivery-fence-r46/windows-execution/FINDINGS.md)。
