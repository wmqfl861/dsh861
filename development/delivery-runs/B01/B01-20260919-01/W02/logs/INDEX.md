# W02 运行日志索引(真实退出码)

公共环境:Node `C:\dsh-r24-upgrade-20260912-01\node-v26.8.2-win-x64\node.exe`(PATH 前缀含 pnpm 目录),Vitest 直连 `node node_modules/vitest/vitest.mjs run --project thread-safe scripts/prepare-ci-bubblewrap.spec.ts`,cwd=仓库根,TMP/TEMP=`C:/dsh-b01-w02/tmp`。>60s 命令后台化+短轮询。原始字节同内容留存 `C:\dsh-b01-w02\raw\`。

| 日志 | 内容 | 真实退出码 | 结果摘要 |
|---|---|---|---|
| `probe-env.out` | 环境探测 P1-P5c(Bash 身份、白名单 env 语义、/usr/bin 普查、exec 位、旧装配重复键) | 0(探测脚本自身) | 见 FINDINGS §2.1 |
| `probe-dup.out` | 补充探测 P5d/P5e/P7/P6(重复键两种次序、Path-only 终态、父大小写) | 0 | 见 FINDINGS §2.1 |
| `run-01-full.out/.exit` | 全量首迭代 | 1 | 1 failed \| 59 passed \| 1 skipped(61):missing-stub 旧断言假设错误,已改守卫拒绝语义 |
| `run-02-full.out/.exit` | 全量(修正后) | 0 | 60 passed \| 1 skipped(61),344.49s |
| `run-03-nc-a-mutant.out/.exit` | NC-A 突变态,`-t 'scenario child environment construction'` | 1 | 4 failed \| 1 passed \| 56 skipped——带重复 key 的行为测试拒绝旧装配 |
| `run-04-nc-a-restored.out/.exit` | NC-A 恢复后同过滤 | 0 | 5 passed \| 56 skipped |
| `run-05-nc-b-mutant-e2e.out/.exit` | NC-B 突变态,`-t 'end to end'` | 1 | 27 failed \| 5 passed \| 29 skipped——CI run35436610274 签名复现 |
| `run-06-nc-b-mutant-identity.out/.exit` | NC-B 突变态,`-t 'stub-source identity'` | 1 | 6 failed \| 1 passed \| 54 skipped |
| `run-07-final-forward-full.out/.exit` | NC-B 恢复后全量正向(终态) | 0 | 60 passed \| 1 skipped(61),167.66s |

负控字节链:预存备份(SHA-256 spec `2e82993a…`/support `bab9a7a7…`,存 `C:\dsh-b01-w02\backup\`)→ 突变体身份(NC-A `e9280445…`,NC-B `a97c10cc…`,副本在 `../mutations/`)→ 恢复后 post_restore_blob(spec `d0f3e6a6…`/support `04fbb27d…`)与备份逐字节一致。
