# W02 rework — Linux 平台可移植性(CP-A2 回派,run 35447649954)

日期: 2026-09-19(晚)。实施者: ZCode。触发: 总控 CP-A2 回派(coverage 作业,真实 Linux 4 处失败;脚本本体在两路真实 CI 准备管线已全通过)。分支 `chore/latest-stable-upgrade-20260912`;返工基线为总控已整合提交 `1863a0ddfd`(含我的 W02 `8d0dc41139` 与他人 CP-A2 link-form 返工),返工仅改 W02 名下两文件。

## 1. 输入证据与精确 diff

证据: `C:\dsh-b01-w03\gate-evidence-coverage\aggregate-stdout.log`(::error 原文,6524 行起)、`gate-results.json`、`job-a2-snapshots.log`。coverage gate exit 1。同一 aggregate 的第一条 ::error 是 `packages/experimental/code-runtime-python/tests/runtime.spec.ts` 的 wall-clock 超时(历史 flake,非本文件,不在本返工范围)。

| # | 位置 | CI 原文(精确) |
|---|---|---|
| 1 | spec:907 `fails loud when a build tool is missing, before any download` | `AssertionError: expected +0 to be 1`(status 0 实收) |
| 2 | spec:1279(Path-first 双键 e2e) | `Error: stub-source check failed: command -v uname resolved to '' (probe status null), expected '/home/runner/work/_temp/dsh-prepare-ci-bubblewrap-W0Z4WT/run-VLsLYQ/bin/uname'; refusing to run the script against host commands` |
| 3 | 同上(PATH-first 双键 e2e,run-EdSAjV) | 同形态 `probe status null` |
| 4 | spec:787 主成功场景 callNames deep-equal | diff(aggregate 原文,deb 段):expected `…dpkg-deb,dpkg-deb,dpkg-deb,[dpkg-deb],tar,dpkg-deb,tar,dpkg-deb…`;received `…dpkg-deb,dpkg-deb,dpkg-deb,tar,[dpkg-deb],dpkg-deb,tar,dpkg-deb…`——即 expected 为 `F F F FS1 T1 FS2 T2 EX`,received 为 `F F F T1 FS1 FS2 T2 EX` |

## 2. 根因(全部由证据+本机验证证实)

1. **缺件场景(status 0)**: POSIX 契约在显式条目后尾接父 PATH;Linux CI runner 父 PATH 携带真实 cc/ninja/python3/pkg-config,删掉 ninja 替身后真实 ninja 仍可达,预检不缺件,全脚本经替身+真实工具混合走完(status 0)。Windows 侧因白名单仅 stubbin:/usr/bin 且 /usr/bin 无 ninja,从未暴露。
2-3. **双键场景 probe status null**: POSIX 分支此前以裸名 `bash` 启动;libuv 对带自定义 env 的 spawn 按**子 env 的 PATH** 搜索可执行文件,双键 fixture 的 `PATH` 值是 Windows 垃圾串(无任何 bash 目录)→ ENOENT(status null)→ 守卫按设计拒绝。这是 Windows 裸名脆弱性(P5a)的 POSIX 对偶;且即便守卫放行,该垃圾尾接也提供不了脚本所需 coreutils。
4. **序列断言(竞态)**: `dpkg-deb --fsys-tarfile | tar -tf -` 管线内两个替身并发启动,启动期各写 STUB_LOG,写入次序由调度决定。CI 单次运行内 pipeline 1 的 tar 先于其 dpkg-deb、pipeline 2 的 dpkg-deb 先于其 tar——同 run 混合次序证明是竞态而非确定的平台次序;Windows 本机调度恰好稳定为 dpkg-deb 先,故此前未暴露。

## 3. 修复(零弱化)

| # | 修复 | 位置 |
|---|---|---|
| 1 | `ScenarioEnvInput.posixParentPath: 'append' \| 'omit'`(默认 append,普通场景契约不变);`ScenarioOptions.omitPosixParentPath`;缺件场景用 `omitPosixParentPath: true` 构造 stub-only PATH,预检缺件语义为真。win32 无此路径(本就不继承父内容),行为不变 | test-support + spec |
| 2-3 | `resolveSpecBash()` POSIX 分支改为经 vitest 父进程 `command -v bash` 解析并保留**绝对路径**(校验后),所有 spawn 不再经子 env PATH 搜索 bash;双键 fixture 的精确名 `PATH` 条目值改为功能性 POSIX 尾接 `/usr/bin:/bin`(POSIX 语义本就尾接该条目;`Path` 条目保持 Windows 垃圾形——POSIX 忽略、win32 丢弃),场景在两平台都真实跑通并保持双键输入语义 | test-support + spec |
| 4 | stdin 模式 tar 替身把调用记录移到 stdin 排空(EOF)之后:上游 dpkg-deb 在启动时记录并先退出,tar 在 EOF 后记录,`dpkg-deb \| tar` 次序在所有平台确定。**deep-equal 断言字节未动,未加任何顺序容忍**;文件参数路径的 tar 记录仍即时(顺序上下文,无竞态) | spec(tar 替身) |

配套:新增 builder 回归 `posix omit: builds a stub-only PATH…`(第 6 项);identity 首测的 POSIX `bashCommand` 断言从 `toBe('bash')` 改为 `/^\/.*\/bash$/`(绝对路径);两文件头注释与接口 JSDoc 同步。

## 4. POSIX 近似验证(本机 Git Bash,如实标注)

`C:\dsh-b01-w02\raw\posix-approx.mjs`(.out 同目录,经仓库 tsx hook 导入**真实** `prepare-ci-bubblewrap-test-support.ts`):

- A1 `buildScenarioChildEnv(platform:'linux')` 双键输入 → PATH=`<stubbin>:/usr/bin:/bin`,唯一 `PATH` 键。
- A2 绝对 bash + 双键毒化 env:`command -v uname` → stub(status 0);**对照:裸名 `bash` 同 env → ENOENT**——即 CI `probe status null` 失败形态在本机复现,且修复机制成立。
- A3 尾接模式下诱饵真实 ninja 可达;`omit` 下不可达(exit 1)——缺件语义为真。
- A4 重构后 stdin 模式 tar 记录:20/20 次迭代管线日志均为 dpkg-deb 先。

**runner 差异标注**: 本机为 msys(bash 5.3.15/cygwin 运行时),非 glibc Linux;/usr/bin 内容与 Ubuntu runner 不同(本机无真实 cc/ninja,故缺件场景的真缺性靠 A3 诱饵证明);调度器不同(A4 的次序确定性由 EOF 因果保证,CI 证据仍是修复前竞态的权威)。POSIX 平台分支(process.platform 分流、exec 位、绝对路径解析形态)的真值以 CI 复验为准。

## 5. 运行与真实退出码(公共前缀同 FINDINGS §4;Windows 本机)

| 运行 | 内容 | exit | 结果 |
|---|---|---|---|
| rw-run-01 | 全量(修复后) | 0 | **64 passed \| 1 skipped(65)**,144.11s |
| rw-run-02 | NC-A 突变态,builder 过滤 | 1 | **5 failed \| 1 passed**(含双键两序与新的 omit 用例) |
| rw-run-03 | NC-A 恢复后同过滤 | 0 | 6 passed |
| rw-run-04 | NC-B 突变态,`-t 'end to end'` | 1 | **30 failed \| 5 passed**(守卫拆除后含 CP-A2 link 三项在内的全部成功路径失败) |
| rw-run-05 | NC-B 突变态,`-t 'stub-source identity'` | 1 | 6 failed \| 1 passed |
| rw-run-06 | NC-B 恢复后全量正向(终态) | 0 | 64 passed \| 1 skipped(65) |

POSIX 近似 harness exit 0(§4)。日志:本目录 `logs/rw-run-*.out/.exit`、`logs/posix-approx.out`;原始字节 `C:\dsh-b01-w02\raw\`。

## 6. 负控重演(返工改变了 NC-A 突变目标块,两负控均重演)

| 项 | NC-A(旧整包拼接) | NC-B(宿主居前+守卫禁用) |
|---|---|---|
| 驱动 | `mutate-nc-a.mjs` 更新到新 builder 块(含 omit 分支);突变体 blob `3439c8806cbef59d07135dcda126c361f026f0f3` / SHA-256 `7e0038c2…`,副本 `mutations/nc-a-old-env-assembly-rework.test-support.ts.disabled` | 锚点未变;突变体 blob `b456e71fb7c17f8754da98fcee66d2ecd7e9c00e` / SHA-256 `ed44c3e6…`,副本 `mutations/nc-b-guard-removed-rework.spec.ts.disabled` |
| 拒绝 | rw-run-02:5/6 失败(双键两种次序+omit+win32 主用例+posix 尾接) | rw-run-04:30/35;rw-run-05:6/7 |
| 恢复 | post_restore_blob `4558bf48…` 与备份(SHA-256 `88b89c20…`)一致;恢复后 6/6 | post_restore_blob `7c5dfc42…` 与备份(SHA-256 `8467f84b…`)一致;恢复后全量正向 |

NC-B 仍仅在本机执行(平台门先于网络,白名单无真实 curl)。

## 7. 文件身份与保持

| 文件 | 返工前(HEAD `1863a0dd`) | 返工终态 |
|---|---|---|
| `scripts/prepare-ci-bubblewrap.spec.ts` | `1ab9fed914ee4f76ed72d55f6ce08c46de0805d3` | `7c5dfc4285e48158d3caec68f4fa4df813717e9a` |
| `scripts/prepare-ci-bubblewrap-test-support.ts` | `af3d9dcdc2434b9d38a23776809ea426f89834d1` | `4558bf48354116df40d0ed284c6d022605762f19` |
| `scripts/prepare-ci-bubblewrap.sh` | `cf6f7a13811e7c0fdcabd6a74dd989d195c94af7` | 未动(非 W02 锁) |

Windows 侧 64 passed | 1 skipped 全绿,既有断言零改动、零弱化(唯一断言更新:POSIX `bashCommand` 绝对路径化,与修复 2-3 配套);30s 超时预算未动。测试计数 65 = 64(既有 48 + CP-A2 link 3 + W02 13 + 本次 builder omit 1)——其中 1 项为 exec 位探测门控 skip(POSIX CI 执行)。

## 8. NOT_RUN

- 真实 Linux 复验未执行(候选归 CP-A3 后 CI 触发);POSIX 平台分支以 §4 近似+证据论证。
- 全量 typecheck/lint/duplication/coverage(归 CP-A3/整合);未读密钥/.env;未调用外部代理;未提交未推送。
- `job-a2-snapshots.log` 等同 run 其他作业证据未逐行归类(总控 W11 职责)。
