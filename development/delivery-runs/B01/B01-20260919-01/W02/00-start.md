# W02 00-start — 让 Windows 替身测试确实执行替身(B01-20260919-01)

启动: 2026-09-19。实施者: ZCode。分支 `chore/latest-stable-upgrade-20260912`,HEAD `6528141bc9f435f8a2361f4c0c56eb9393092c02`(与 W01 交接记录一致,未移动)。

## 起始文件身份(git hash-object 工作树,与 W01 移交声明一致)

| 文件 | 起始 blob | 权限 |
|---|---|---|
| `scripts/prepare-ci-bubblewrap.spec.ts` | `56fc063b69073ab230e133a471ba5ba7cfb53bff` | W(串行锁已接管) |
| `scripts/prepare-ci-bubblewrap-test-support.ts` | `e598c38c026c5acb6f2f462309c1f94cc595b8ae` | W(串行锁已接管) |
| `scripts/prepare-ci-bubblewrap.sh` | `4c03966fd769a3075a086a6a7daa1cbdfba413a3` | 只读(W01 返工锁;W02 不改) |

工作树另有 W08 的未跟踪 `scripts/event-producer-consumer-pair.spec.ts`,不属于本任务,不触碰。

## 任务输入

- formal-plan v1 §2 W02 卡与 §3.2 文件锁;WORK_PACKAGES W02;BASELINE §2(run35436610274 Windows 27 失败现象)。
- W01 FINDINGS §7 移交:runScenario 仍以裸 `bash` 启动并整包复制 `process.env`——本任务工作面。

## 实施计划(先证后改)

1. 环境探测(P1-P5,脚本与原始输出在 `C:\dsh-b01-w02\raw\`):Git Bash 候选绝对路径与身份;最小白名单 env 下 bash 的 PATH 语义(单 `PATH` 键、POSIX 冒号形、是否自动前置 /usr/bin、SystemRoot 必要性);/usr/bin 工具普查(真实工具可达面);exec 位是否被执行;旧环境拼接在 Path 大小写父环境下的子进程 uname 解析(根因证明)。
2. 改 `prepare-ci-bubblewrap-test-support.ts`(直接启动辅助)与 `prepare-ci-bubblewrap.spec.ts`(场景与新增回归)。
3. 全量 spec 后台运行 + 短轮询;两负控(NC-A 旧环境拼接、NC-B 去掉替身身份保护)字节预存、突变、目标失败、finally 恢复、恢复后正向。
4. 产物:本目录 FINDINGS.md、logs/、mutations/、report.md;原始输出 `C:\dsh-b01-w02\raw\`。

## 环境固定

- Node: `C:\dsh-r24-upgrade-20260912-01\node-v26.8.2-win-x64\node.exe`(PATH 前缀);pnpm 目录同前置;不动全局 PATH。
- Vitest 直连入口 `node_modules/vitest/vitest.mjs`,`--project thread-safe`。
- TMP/TEMP 重定向 `C:/dsh-b01-w02/tmp`(场景自有临时树根)。
- Bash: `C:\Program Files\Git\usr\bin\bash.exe`(实测 GNU bash,`OSTYPE=cygwin`,`uname -s`=MINGW64_NT-10.0-26200)。
- 不提交、不推送、不跑全量 typecheck/lint、不读密钥/.env、不调用外部代理。

## 约束确认

- 不修改 `prepare-ci-bubblewrap.sh`(平台拒绝条件与非 Linux/x86_64 拒绝逻辑不动)。
- 保持 W01 48 项全部通过且不弱化;新增覆盖 Path/PATH 并存、空格/非 ASCII 临时路径、PATH 次序、替身缺失/不可执行、真实退出码与 stderr、空输出分支解释。
- 超时预算不变(30s),不以扩大 timeout 掩盖。
