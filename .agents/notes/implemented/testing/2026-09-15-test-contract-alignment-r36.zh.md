# Agent Note：工具链升级后五项测试契约漂移的重新对齐

Status: implemented

[English](2026-09-15-test-contract-alignment-r36.md) | 中文

## 问题

Node 26 / pnpm 12 / action 版本升级与 r35 的配置重构之后，五项测试契约仍在断言已被取代的形态，两条 coverage 通道因契约漂移而非产品行为失败。[test-proxy-environment.spec.ts](../../../../scripts/test-proxy-environment.spec.ts) 的接线检查用只匹配数组字面量的正则发现 `setupFiles` 槽；r35 把根配置改到共享 `testSetupFiles` 常量后，`vitest.config.ts` 被发现阶段过滤，其三个槽（根、`thread-safe`、`process-bound`）完全逃出逐槽检查——那里的代理初始化若被删除将静默通过。preview workflow 契约仍期待 `PRIMARY_NODE_VERSION: '24'`，而 [build-preview-cloudflare.yml](../../../../.github/workflows/build-preview-cloudflare.yml) 已固定为 26。两个自托管 CI 契约仍查找 `pnpm/action-setup@v4` 与 `actions/upload-artifact@v4`，workflow 中已分别升至 @v6/@v7；@v4 查找还把执行顺序比较建立在没有先断言目标步骤存在的 `findIndex` 结果上，步骤改名后退化为与 -1 比较。E2B subprocess 契约用 `void expect(...).rejects.toThrow(...)` 丢弃每个 `spawnTerminal` 拒绝，Vitest 5 将其判为未 await 的异步断言。

## 决策

各契约以原有严格度钉住当前形态：代理接线契约把每个 `setupFiles:` 槽解析到其命名的数组字面量——内联字面量，或同文件内声明的 `const` 标识符的初始化式——没有数组字面量声明的引用使契约失败而不是被跳过；五配置发现期待、对 `TEST_PROXY_SETUP_FILE` 的逐槽包含检查、根配置条目均不变。preview 契约期待 Node 26；[release.yml](../../../../.github/workflows/release.yml) 与 [release-vendor.yml](../../../../.github/workflows/release-vendor.yml) 保持 Node 24，其测试从未断言该值。自托管 CI 契约以精确字符串钉住 `pnpm/action-setup@v6` 与 `actions/upload-artifact@v7`（绝不用前缀或任意版本匹配），保留全部缓存、隔离、保留期与命令断言；compatibility 契约先断言 pnpm setup 步骤存在（下标 ≥ 0）再与缓存隔离步骤比较执行顺序。E2B graceMs 用例改为 `async` 并逐项 `await expect(...).rejects.toThrow(...)`，保留四个非法值、同步 `spawn` 抛错、以及任何远程工作之前的拒绝。未改任何 workflow 文件，未全仓批量替换 Node 版本。

## 备选方案

把代理接线检查放宽为"配置文件中出现过初始化脚本名"会在单项目断接时通过；从发现期待中删掉根配置会让常量形态再次隐身。不带版本匹配 `pnpm/action-setup@` 能保住顺序检查但不再钉住经审计的 action 版本。跳过 E2B 测试或用 `vi.waitFor` 包住 rejects 链只会掩盖丢弃而不是 await 它。

## 后果

在 Windows 上以真实工具链（Node 26.8.2、pnpm 12.4.1）验证：每个文件先跑到真实首失（代理契约 1 失败——`vitest.config.ts` 不在发现清单；preview 1 失败于 `'24' ≠ '26'`；release 契约 5 失败于两处版本漂移；E2B 1 失败于 Vitest 5 的"rejects assertion was not awaited"；compatibility 契约本机通过、含 2 个 Windows 跳过的 Bash 测试，跳过不算 Linux 通过——其漂移由 workflow 文本证实）。修复后五文件全部通过（8/8、3/3、4 过 + 2 跳、79/79、70/70），[vitest-project-inheritance.spec.ts](../../../../scripts/vitest-project-inheritance.spec.ts) 保持绿。负控真实执行且恢复经字节复验：共享常量删除代理项使逐槽检查失败；一个槽改名到未声明常量以"no array-literal const declaration"失败；单个项目改列不含代理项的自有初始化使该槽失败；重新引入 `void` 丢弃再次以未 await 断言失败。证据与门禁输出见 [windows-execution/FINDINGS.md](../../../../development/remediation/2026-09-15/coverage-test-contracts-r36/windows-execution/FINDINGS.md)；typecheck、lint、duplication、test:docs 全部通过。本轮未运行完整插桩 coverage 与 Linux 通道。
