# W02 report — 让 Windows 替身测试确实执行替身(B01-20260919-01)

状态: 完成(本机全量 61 项:60 passed | 1 探测门控 skipped | 0 failed,exit 0;两负控被目标测试拒绝并可靠恢复)。CP1 待独立复核;A2 文件级证据就绪,CI 复验归 CP-A 后。

证据: 同目录 `00-start.md`、`FINDINGS.md`、`logs/`(逐运行日志+真实退出码)、`mutations/`;原始输出与备份 `C:\dsh-b01-w02\`。

## 根因证明(替身来源证据链)

1. **Bash 路径**: 每场景经 `resolveSpecBash()` 探测确认的绝对 Git Bash(`C:\Program Files\Git\usr\bin\bash.exe`,`--noprofile --norc`);`where.exe` 显示本机另有 System32(WSL)/WindowsApps bash——裸名解析多重,已弃用。
2. **`command -v uname` 解析**: 每场景在脚本运行前以同 env 探测,精确等于本次 run 的 `${stubBinPosix}/uname`;不符即抛错拒绝执行(身份守卫)。替身缺失/不可执行时实测落入宿主 `/c/Program Files/Git/usr/bin/uname`——守卫先于任何真实 curl/sudo/编译器拒绝(白名单 PATH 下本就无真实 curl/sudo/编译器可达,`/usr/bin` 普查证明)。
3. **sentinel**: 每场景唯一 `w02-<uuid8>`;每个替身调用向独立 `STUB_IDENTITY_LOG` 写 `<name> <sentinel>`;identity 记录数 == stub 调用数,全部携带本场景 sentinel。
4. **类别级根因**: 旧装配在 Windows `Path` 父环境下必然产出大小写重复键(整包 spread + `env.PATH` 追加),胜者由 runner 的 msys 运行时决定;NC-B 本机复现(宿主目录居前+守卫禁用)得 **27 failed | 5 passed**,与 CI run35436610274 签名一致(9/36 通过 = 4 源码级 + 5 e2e 偶然通过)。runner 内部确切择键不可本机复现,记 NOT_PROVEN_BEYOND_CLASS。
5. **空输出分支**: 平台门先于一切 stdout 输出,门处停止 → stdout 空/0 字节、stderr 非零、spawnError null、sentinel 在列(专测固化)。非超时:30s 预算未动,最长单项 14.6s。

## 环境构造改动

- 显式白名单:仅测试自有变量 + 单一规范 `PATH` 键(POSIX 冒号形,stub bin 居首);win32 父路径内容一律不继承(`Path`/`PATH` 重复、分号列表、盘符内容按构造排除,绝不按冒号拆 Windows 磁盘路径);POSIX 保留父 `PATH` 尾接(Linux 兼容契约不变)。
- win32 宿主段仅 Git `/usr/bin`(脚本/替身仍需的真实 coreutils);不安装/不切换 WSL;未改产品脚本平台拒绝条件(`prepare-ci-bubblewrap.sh` blob 全程 `4c03966f…`)。

## 新增测试(13 项,总数 48+13=61)

构造 5 项(Path/PATH 并存两种次序、win32 单键无分号无盘符、POSIX 尾接、path 名键冲突抛错)+ 身份/启动 8 项(绝对 Bash+来源证据、重复键父环境 e2e ×2、空格+非 ASCII 临时路径、宿主居前对照、替身缺失先拒绝、[探测门控]替身不可执行先拒绝、空输出分支)。既有 48 项断言零改动、零弱化。

## 全量结果(真实退出码)

| 运行 | exit | 结果 |
|---|---|---|
| run-02 全量(修正后) | 0 | 60 passed \| 1 skipped,344.49s |
| run-07 恢复后全量正向 | 0 | 60 passed \| 1 skipped,167.66s |
| run-03 NC-A 突变态 | 1 | 4 failed \| 1 passed(重复键行为测试拒绝旧拼接) |
| run-04 NC-A 恢复后 | 0 | 5 passed |
| run-05 NC-B 突变态 e2e | 1 | 27 failed \| 5 passed(CI 签名复现,真实命令路径不得误通过) |
| run-06 NC-B 突变态 identity | 1 | 6 failed \| 1 passed |

## 负控与恢复

NC-A(旧整包 env 复制/大小写不处理;突变体 `e9280445…`)与 NC-B(宿主居前+守卫禁用;突变体 `a97c10cc…`)均字节预存(SHA-256 入档)、单点精确替换、目标测试拒绝、`cp` 恢复后 blob(spec `d0f3e6a6…`/support `04fbb27d…`)与备份逐字节一致、恢复后正向全绿。突变副本在 `mutations/`(后缀 `.disabled`)。NC-B 仅在本机执行——平台门先于网络且白名单无真实 curl,突变态不可能触网。

## 文件起始/终态

| 文件 | 起始 blob | 终态 blob |
|---|---|---|
| `scripts/prepare-ci-bubblewrap.spec.ts` | `56fc063b69073ab230e133a471ba5ba7cfb53bff` | `d0f3e6a640be3bba4a1bdccd9d328290998098c1` |
| `scripts/prepare-ci-bubblewrap-test-support.ts` | `e598c38c026c5acb6f2f462309c1f94cc595b8ae` | `04fbb27dea525c19cf5bcb4d8e05e892b6f03b03` |
| `scripts/prepare-ci-bubblewrap.sh` | `4c03966fd769a3075a086a6a7daa1cbdfba413a3` | 未动 |

## A2 状态与 NOT_RUN

A2 文件级: 本机(即 Windows)全量 61 项证据如上。CI 文件级复验待 CP-A 候选触发——A2 整体保持未满足至 CI 证据到位。NOT_RUN: 全量 typecheck/lint/duplication/coverage(归 CP-A/整合);新 Windows CI run;替身不可执行用例本机执行(P4:平台不执行 exec 位;POSIX CI 将执行);真实 Linux 构建/probe/CVE(A3,归 W03);runner 侧 msys 择键复现。本任务未读密钥/.env、未调用外部代理、未提交未推送。

## 写锁释放

W02 到此停止写入。`scripts/prepare-ci-bubblewrap.spec.ts` 与 `scripts/prepare-ci-bubblewrap-test-support.ts` 写锁释放回总控(CP-A 整合点);若 CP1 复核要求返工,按计划 3.2 由总控重新移交。

## 返工附记(2026-09-19 晚,CP-A2 回派 run 35447649954)

真实 Linux 4 处平台可移植性失败已修复并本地全绿(64 passed | 1 skipped;终态 spec `7c5dfc42…`、support `4558bf48…`;`.sh` 未动);两负控在新字节上重演仍被拒绝并可靠恢复。详见 `rework-linux.md` 与 `logs/`(rw-run-01..06 + posix-approx)。写锁自此重新释放回总控(CP-A3 整合点)。
