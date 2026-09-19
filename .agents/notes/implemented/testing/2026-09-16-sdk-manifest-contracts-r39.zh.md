# Agent Note: Pin upgraded SDK and manifest identities through real installed evidence

Status: implemented

[English](2026-09-16-sdk-manifest-contracts-r39.md) | 中文

## Problem

latest-stable 升级（见[升级 Note](../process/2026-09-12-r24-latest-stable-upgrade.zh.md)）把 `@anthropic-ai/claude-agent-sdk` 从 0.3.263 升到 0.3.269（内置 Claude Code 2.1.263 到 2.1.269）、`@modelcontextprotocol/sdk` 从 `^1.29.0` 到 `^1.30.0`、`zod` 从 `^4.4.3` 到 `^4.6.2`、js-yaml 到 5.4.2，但三个 spec 仍固定旧身份。provider bundle 测试在第一条 SDK 依赖断言上失败，把它后面过期的 MCP、Zod 期待遮住了。snapshot manifest spec 保留的一行 `['', 'manifest must be a mapping']` 描述的是升级前的分层：js-yaml 5 在 `yaml.load` 内拒绝空文档，因此 `parseSnapshotManifest` 在 `record()` 尚未对值分类之前就抛出包装后的 `session-snapshot: <path>: invalid YAML: …`，而该 spec 断言的是一个解析器对该输入已不可能产生的类别。`record()` 对已解析 null、标量、序列的 mapping 拒绝此前也没有合法 YAML 覆盖——既有的非 mapping 路径全部经由解析错误或字段校验。

## Decision

三个 spec 以显式字面量固定已安装身份，每个字面量都从它命名的事物本身核验，而不是从 SDK 版本号推算：SDK `package.json`（version 0.3.269、`claudeCodeVersion` 2.1.269、全部八个平台 `optionalDependencies` 为 0.3.269）、provider `package.json` 声明（`^1.30.0`、`^4.6.2`）、当前平台二进制的 `--version` 输出（`2.1.269 (Claude Code)`）、以及 SDK init 消息的 `claude_code_version`（2.1.269）。SDK 版本常量与 Claude Code 版本常量保持为两个不同的产品字段；real-product 的 sentinel 字符串 `REAL_CLAUDE_CODE_SENTINEL_2_1_237` 是 fixture 文本，字节不变。manifest spec 现在区分两个失败原因：空文档行期待仓库自有的包装前缀及诊断路径（`session-snapshot: case/snapshot.yml: invalid YAML`），只断言解析器拥有的类别与路径、不锁定 js-yaml 的逐字异常文本；三行新增用例（`null\n`、`42\n`、`- item\n`）把合法 YAML 喂给真实 `yaml.load`，并期待 `record()` 的 `manifest must be a mapping`。解析器、`JSON_SCHEMA`、锁文件、provider manifest 以及三个文件中的其余全部断言保持原字节。

## Alternatives considered

**从被测 manifest 推导期待版本。** 读取已安装版本再与自身相等使固定失去意义——未来任何版本，包括非预期降级，都会通过。这些断言存在的意义就是在升级落地或回退时失败，因此携带显式字面量。

**接受任何格式合法的版本字符串。** 正则或非空检查完全移除固定，无法区分 0.3.269 与过期安装；本轮修复的 CI 失败恰是只有相等性固定才能捕获的版本值不匹配。

**删掉空输入行或用 `null` 替换。** 空与非 mapping 是不同层的不同失败原因；删除空输入行会让 js-yaml 的空文档拒绝无人观察，`null` 也无法替代它。

**对空输入用裸 `toThrow()` 或全消息相等。** 裸 throw 接受任何分类，包括未来丢掉包装层的回归；逐字相等会锁定仓库并不拥有的 js-yaml 异常文本。带路径的前缀恰好固定包装层类别与诊断路径。

**修改解析器去预裁剪或容忍空文档。** 分层是刻意的：`yaml.load` 拥有文档解析，`record()` 拥有形状分类。为让旧期待成立而改变已交付解析器行为超出测试对齐变更的范围，且会静默接受此前被拒绝的输入。

## Consequences

聚焦三文件基线 exit 1，恰好三项首失（3 failed / 88 passed，共 91）：real-product 的 SDK 版本断言、bundle 的 SDK 依赖断言、空文档行——MCP、Zod、CLI、平台断言在其后未执行。修复字节上同样的三个文件 94 / 94 通过（91 项既有测试加三行新增非 mapping 用例），这也是首次在升级后的安装上执行此前被遮住的 MCP `^1.30.0`、Zod `^4.6.2`、内置 CLI `--version` 与 init 消息断言。四项负控每次只恢复一个期待，各自产生对应的真实断言失败——SDK 常量、MCP 区间、Zod 区间（聚焦 bundle 用例各 `1 failed | 41 skipped`）与空输入旧 mapping 期待（`1 failed | 37 passed | 6 skipped`，因抛出的分类是 `invalid YAML` 而失败）——每次恢复都在最终正向运行前对保存的候选 blob 逐字节核验。typecheck、lint、duplication 与快速文档门禁在最终字节上通过。本对齐不解决 [run 35047469159](https://github.com/wmqfl861/dsh861/actions/runs/35047469159) 保留的其余失败（context/inject 与 client-helper 各例、Linux 专属超时与提示符各例、FileHandle 异常、Windows worker 退出、覆盖率阈值、Web React #185 pageError），它们仍在范围之外。证据：[windows-execution/FINDINGS.md](../../../../development/remediation/2026-09-16/sdk-manifest-contracts-r39/windows-execution/FINDINGS.md)。
