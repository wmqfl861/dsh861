# Codex 原生 stderr：仓库内运行时修复与复验

[English](README.md) | 中文

基线：`38ed381accc8549886de65e482d99c66506e714e`。实施者为本轮 ChatGPT，依据用户停止本机连接并直接在仓库继续开发的授权。未访问本机设备，未调用 Remote Desktop Commander，未读取、导入、使用或提交真实凭据；不是指定 Codex 的新计划或 OpenCode 的硬审核。

## 本轮实际改动

[正式提供方](../../../../packages/subagent/subagent-codex/src/index.ts)取得 subprocess 句柄后，立即通过 [private-stderr.ts](../../../../packages/subagent/subagent-codex/src/private-stderr.ts) 屏蔽原生 stderr，再把句柄交给内部一次性运行器。屏蔽层持续读取原始管道，但不保留、转发或计算其内容摘要；流关闭后移除自己的监听器。stdout、stdin、实际退出结果、进程终止与等待仍委派原始所有者。

这里采用完整屏蔽而不是将已有选择性脱敏组件直接套在未知原生日志上：原生登录状态可能包含平台未登记的秘密，匹配已知 Key 不能充分保护这些内容。因此本轮牺牲原生排障文本，只保留既有的结构化协议／进程诊断。完整采集器、四种 harness 的全部输出和原生文件保护仍未交付，不能将屏蔽描述为完整审计、已经检测到泄漏或四产品安全验收。

内部 [run.ts](../../../../packages/subagent/subagent-codex/src/run.ts)及其原有测试保持不变；直接调用该内部测试接口的人仍须提供安全的进程边界。本轮关闭的是经注册 Codex Provider 进入的原生 stderr 转发路径，不是对任意绕开提供方的内部调用的全局承诺。

## 已完成的验证

[15 项共享回归](../../../../packages/subagent/subagent-codex/tests/private-stderr.cases.ts)在 Linux / Node 22.16.0 下全部通过，0 失败、0 跳过。包含未知原文、分块、Unicode、二进制、错误事件、并发隔离、方法接收者、失败退出、释放失败后的继续读取、真实 Node 子进程大量输出和取消。它们不调用真实 Codex。

[提供方接线夹具](../../../../packages/subagent/subagent-codex/tests/private-stderr-provider.fixture.mjs)执行实际 index.ts，经显式替换的 schema／registry／run 服务取得真实的 spawn 闭包，再运行合成 Node 子进程。原版本在正常与错误退出两种情况下分别向内部运行器暴露 560000 字节 stderr；修复版均为 0，stdout 和退出码不变。夹具不是完整 Cordis Loader、原生 Codex 协议或 Windows 验证。原始结果见 [baseline-provider.json](baseline-provider.json)、[fixed-provider.json](fixed-provider.json) 和 [TAP 日志](tests.r01.tap)。

TypeScript 5.8.3 的 transpileModule 仅完成语法转换检查，不是全库或依赖完整的类型检查。完整源码克隆在本轮环境因 DNS 失败；没有安装全仓库依赖。Node 22.16.0 低于仓库支持下限，因此本轮结果不能代替受支持引擎、正式构建、lint、文档门禁及原生测试。详细边界和文件摘要见 [verification.json](verification.json)。

## 本地人工复验

在已安装仓库依赖、Node 满足根 [AGENTS.md](../../../../AGENTS.md) 要求的开发分支工作副本中执行。不要向聊天提交 Key，不要改全局 agent 配置。本组命令不要求提供 Key，也不包含带凭据的 real-deepseek 测试。

```sh
pnpm exec vitest run packages/subagent/subagent-codex/tests/private-stderr.spec.ts packages/subagent/subagent-codex/tests/private-stderr-provider.spec.ts packages/subagent/subagent-codex/tests/subagent-codex.spec.ts
pnpm run typecheck
pnpm run lint
pnpm run test:docs
node scripts/p0-b/sync-node-status.mjs --check
```

先保留失败输出，再修复，不扩大 timeout 或删掉断言来获得通过。Windows 和原生产品测试、完整 Loader 组合与指定审核仍需在有效后继计划范围内完成。P0-B 继续 blocked，未新增产品 AC PASS，未开启 P0-C，未合并 master。用户锁定的四套模型声明、provider、Base URL、思考等级、凭据引用、历史计划及候选均不改变。
