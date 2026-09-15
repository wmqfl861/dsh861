# Agent Note: 阻止 Vitest 5 内联项目继承根配置

Status: implemented

[English](2026-09-15-vitest-project-inheritance.md) | 中文

## Problem

Vitest 5 起内联项目默认继承声明它的配置文件，且继承值经 Vite 的 `mergeConfig` 合并、数组会串联。[vitest.config.ts](../../../../vitest.config.ts) 的两个项目因此各自在自身 include 之外又继承了根 `test.include`，`vitest list --filesOnly` 显示 1236 个文件中有 1229 个同时归属 `thread-safe` 与 `process-bound`，每个普通套件每次执行都跑两遍；r34 的 Chokidar 记录里单个 spec 报成 2 个文件 28 条用例。根插件还会与各项目自身副本叠加注册，Vitest 以重复插件警告报告。[coverage-partitions.ts](../../../../scripts/coverage-partitions.ts) 的覆盖清单解析器对被两个项目同时声明的文件保留最后一次归属，分区协调器因此可能把文件交给错误项目而不报错。

## Decision

两个内联项目在顶层设置 `extends: false`（不是 `test.extends`，也不是只隐藏警告但保留 include 合并的 `extends: true`），并通过根 test 配置同用的 `testSetupFiles` 共享常量显式声明 `test.setupFiles`；项目插件、esbuild、execArgv、forks 池、各项目 include/exclude、平台规则，以及根 coverage include/exclude、阈值、reporter 与分区模式均不变。无需按项目复制 coverage：Vitest 对每个项目的 coverage 都取根配置解析。`parseListOutput` 在解析前展开豁免选择器、归一反斜杠、同项目重复保持幂等，并在一个非豁免文件被两个项目声明时抛出含文件与两项目名的错误；豁免文件既不进入清单也不触发该检查。新增 [vitest-project-inheritance.spec.ts](../../../../scripts/vitest-project-inheritance.spec.ts) 用实际安装的 Vitest 解析仓库项目，断言每个项目恰好解析两个初始化脚本、每个目标插件恰好注册一次，本 spec 在清单中只归属一个项目，并用真实 Vitest CLI 枚举协调器生成的分区配置，证明缩小后的分区不重新继承根部宽泛 include、空文件一侧不扩展为运行全部。

## Alternatives considered

显式 `extends: true` 只会消除重复插件警告而保留 include 重叠。改为删除各项目的插件与 esbuild，则 `setupFiles` 与 `include` 仍靠隐式根继承到达，项目继续依赖根配置合并。`parseListOutput` 保留最后归属并在下游去重，会掩盖实际执行该文件的项目，而不是拒绝重叠。

## Consequences

已在 Windows 用实际安装的 Vitest 5.0.0 按[两种清单模式](../../../../development/remediation/2026-09-15/vitest-project-inheritance-r35/windows-execution/FINDINGS.md)验证：唯一文件并集不变（普通 1236、豁免 1191，零丢失零新增），两项目交集为空，`process-bound` 恰为声明清单中 win32 允许的 7 个文件，重复插件警告消失，每个项目解析出两个初始化脚本与各一份目标插件。负控均为真实执行：恢复隐式继承后 `parseListOutput` 对真实清单输出抛错、新回归失败（插件重复、初始化脚本翻倍、spec 本身被双归属）；仅移除项目 `setupFiles` 后各项目解析不到任何初始化脚本、接线回归失败。分区配置因 `partitionConfigSource` 展开项目条目而一并获得修复。本轮未运行完整插桩 coverage，也未运行 Linux 通道。
