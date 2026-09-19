# W12 logs 索引 — 原始输出位置

原始字节一律在 `C:\dsh-b01-w12\raw\`（各 `.out` 文件尾行 `EXIT=` 为真实退出码）；本目录为索引。

| 本地编号 | 内容 | 原始文件 |
|---|---|---|
| run-01 | W06 五 desktop spec（候选树，thread-safe 直连） | `C:\dsh-b01-w12\raw\run-01-desktop-specs.out` |
| run-02 | expected 双目标（src 模式，首轮） | `C:\dsh-b01-w12\raw\run-02-expected-dual.out` |
| run-02b | expected 双目标（src 模式复跑） | `C:\dsh-b01-w12\raw\run-02b-expected-dual-rerun.out` |
| run-02c | expected 诊断（src 模式串行单文件） | `C:\dsh-b01-w12\raw\run-02c-diag-serial-diag.out` |
| run-03 | expected 双目标（**lib 模式**，正式载体） | `C:\dsh-b01-w12\raw\run-03-expected-dual-lib.out` |
| run-04 | 共享 lane win32 两场景（lib 模式，`-t` 过滤） | `C:\dsh-b01-w12\raw\run-04-shared-lane.out` |
| run-05 | 专用 teardown adapter（lib 模式） | `C:\dsh-b01-w12\raw\run-05-adapter.out` |
| run-06 | `pnpm run test:docs`（doc-quick 聚合） | `C:\dsh-b01-w12\raw\run-06-test-docs.out` |
| — | 候选差异全量清单 | `C:\dsh-b01-w12\raw\diff-name-status-full.txt` |
| — | 保护面逐 blob 复验脚本与输出 | `C:\dsh-b01-w12\raw\protect-check.sh` / `protect-check.out` |

环境（全部运行相同）: Node `C:\dsh-r24-upgrade-20260912-01\node-v26.8.2-win-x64\node.exe`（v26.8.2）直连 `node_modules/vitest/vitest.mjs`；PATH 双目录前缀（node + `pnpm-12.4.1`）；TMP/TEMP=`C:\dsh-b01-w12\tmp`；run-03/04/05 另设 `DSH_EXAMPLE_MODE=lib`（run-01…02c 未设=src；`DSH_SNAPSHOT` 全程未设=replay）。

清理核验（2026-09-20 02:3x）: `Get-Process electron,node` 与 `tasklist` 双视图 0 命中；`C:\dsh-b01-*` 全部保留为证据 raw。
