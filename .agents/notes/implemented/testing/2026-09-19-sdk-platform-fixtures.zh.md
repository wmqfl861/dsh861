# Agent Note：平台解析的 SDK 快照 sidecar、Windows 水合修复与 pi-ai 空闲预算守护

Status: implemented

[English](2026-09-19-sdk-platform-fixtures.md) | 中文

## 问题

共享自动 SDK 快照 lane（`snapshots/sdk/sdk.snapshot.ts`）原以一组平台中立预期比较两个 teardown 场景，三个相互独立的事实使其在 Windows 不可能、在 Linux 不完整。其一，`hydrateReplayFixtures` 以裸 `cwd` 字符串替换 JSONL 文本中的 `{{cwd}}`，任何反斜杠分隔符都产生非法 JSON 转义，`llm-replay` 在插件加载即失败（`Bad escaped character in JSON at position 87`）；专用 teardown adapter 早已使用正确的 JSON 转义拼写。其二，父级工具 schema 与系统提示是平台分味的——win32 组合 `pwsh` 与 Windows-kill 退出码节（团队场景另加 Agent-Teams 指引块），而共享 `session/text-turn` 类钉源携带 bash 组合——共享源在 win32 不可能通过。其三，已提交的子级 sidecar 是 win32 捕获，Linux 子级比较对着 pwsh 字节失败；反过来 agent-team 父级在每个平台都是组合特定的（六个团队工具加团队作用域重定义），run 42 在 Linux 证明了这一点。另外，diagnostic expected 套件只按单反斜杠拼写分词 `{{cwd}}`，win32 沙箱策略文本——内嵌 JSON 双反斜杠的 workspace 根——永不匹配 POSIX 录制的 golden。最后，headless pi-ai expected 用例固定计数 2 个请求，而 CI 调度饥饿可把标题请求派发拉伸越过 fixture 的 1000ms 流空闲预算，产生使计数断言失败的重试，并经 fail-fast 跳过 Linux sidecar 证据所需的 snapshot gate。

## 决策

水合改为 `JSON.stringify(cwd).slice(1, -1)`——与专用 adapter 相同拼写——水合字节只落入运行期临时 fixture 文件。预期选择经 `sdk.snapshot.ts` 内显式注册表变为平台解析：win32 从 `.win32` sidecar 解析父 schema、父提示与子 schema；非 win32 从 `.default` sidecar 解析 agent-team 父 schema 与提示及两场景的子 schema 与提示；未注册场景与未选槽位保持共享源。选中即缺的文件经 `readFile` 响亮失败——没有跨平台回退、没有仅名替换、没有比较期字段过滤；record/refresh 写回使用同一选择器，未来 refresh 不可能改错平台的字节。每个 sidecar 均源自真实 keyless 运行：win32 schema 来自 `DSH_TEARDOWN_DUMP` 捕获、以 lane 自有格式化器提取；Linux 默认值从 run 42 的统一 diff hunk 重建，每个锚点、上下文与删除行都对照重建的预期侧逐行验证，且派生的 subagent 子提示与共享源逐字节相同——组合自身的预测。diagnostic expected 测试传入 `cwdAliases: [JSON.stringify(cwd).slice(1, -1)]`——公共 `NormalizeContext` 字段——双反斜杠拼写因此可分词而无需触碰 normalizer；POSIX 上该别名去重为无操作。pi-ai 修复把 fixture 的 `streamIdleTimeoutMs` 从 1000 提到 20000（约为实测未拉伸派发滞后下限的三倍，仍在 30s 子进程诊断时限内，死流照样响亮失败），并加 r29 款测试内守护断言预算至少 10s；2 请求契约与全部既有断言字节不变。

## 考虑过的替代方案

**把生产 patch 层在 Windows 切到 bash。** bundle 的平台 shell 选择是生产配置，本次冻结；平台差异属于预期侧，不属于交付组合。

**比较期替换工具名或过滤字段。** 二者都弱化比较；对完整捕获 schema 的全量 deep-equal 正是被验证的契约。

**从 bash 源手写 win32 schema。** 未经检查即拒绝；只接受由真实运行经 lane 自有格式化器产出的字节，结构 diff 作为评审证据。

**放宽 normalizer 接受双反斜杠拼写。** golden 比较的分词集合在调用点是公共 API；别名是既定扩展点，normalizer 保持未动。

**掩盖 pi-ai 重试计数或放宽断言。** 计数是场景契约；在饥饿下制造幻影请求的预算是 fixture 自己的旋钮，守护保证未来任何回退到 1000ms 的行为在 5ms 内确定性失败。

## 后果

十二个新 sidecar 文件覆盖全矩阵（4 个 win32 schema、2 个 win32 提示、6 个 Linux 默认），win32 共享 lane 2/2 通过——全会话比较、父 schema、父提示——含空格加 Unicode 临时根与负控恢复后复跑；expected 双目标 2/2、专用 adapter 2/2 且 r46 投递屏障完好。身份选择保持 15/15。run 42 的两处 Linux 不匹配正是这些 sidecar 服务的比较，批次推送后的 CI snapshot gate 是派生 Linux 字节的权威。pi-ai 用例在新旧字节下本地均过，负控（旧 fixture 配新测试）在守护处 5ms 失败；CI `test:expected` gate 仍是饥饿形态的最终判据，本地 Windows 无法在无插桩下复现该形态。未改任何生产包、normalizer、golden、replay 输入或锁文件。证据：[W04 FINDINGS](../../../../development/delivery-runs/B01/B01-20260919-01/W04/FINDINGS.md)、[W04 轮二](../../../../development/delivery-runs/B01/B01-20260919-01/W04/round-2.md)、[W05 FINDINGS](../../../../development/delivery-runs/B01/B01-20260919-01/W05/FINDINGS.md)、[W11F FINDINGS](../../../../development/delivery-runs/B01/B01-20260919-01/W11F/FINDINGS.md)。
