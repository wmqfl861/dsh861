# W01 report — 修正 Linux 准备中的真实外部命令契约(B01-20260919-01)

状态: 完成(本地直接回归 + 两负控 + Bash 语法全部实跑通过)。CP1 待独立复核。
证据: 同目录 `00-start.md`、`FINDINGS.md`、`logs/run-01..06`、`mutations/`;原始输出 `C:\dsh-b01-w01\raw\`。

## 实际改动

- `scripts/prepare-ci-bubblewrap.sh`:`7d2428e2…` → `4c03966f…`。旧多字段 `mapfile < <(dpkg-deb --field … Package Version Architecture)` 块删除,改为 Package/Version/Architecture 三次独立单字段调用,逐次直接捕获退出码与 stderr;非零、空值、缺字段、带标签输出、多/重复记录、错误身份均带诊断拒绝(D03,无宽松多字段分支)。三输入 pin、no-apt、安全目标、失败即停、GITHUB_PATH 顺序全部原样。
- `scripts/prepare-ci-bubblewrap.spec.ts`:`91bcd7fa…` → `56fc063b…`。stub dpkg-deb 实现真实 argv 协议(单字段=裸值,多字段=带标签 control 序);新增 12 项契约回归;唯一既有断言更新是主成功用例调用序列 dpkg-deb 4→6 次(新协议必然,非弱化);其余 35 项原文未动、全部通过。
- `scripts/prepare-ci-bubblewrap-test-support.ts`:NEW → `e598c38c…`(计划 3.2 预登记路径)。CI 证据契约 fixture(带标签控制块两种顺序)。

## 命令与真实退出码

| 命令 | exit |
|---|---|
| `bash -n scripts/prepare-ci-bubblewrap.sh`(改动后与终态复验) | 0 |
| `node node_modules/vitest/vitest.mjs run --project thread-safe scripts/prepare-ci-bubblewrap.spec.ts` | 0(48/48,129.94s) |
| 同上 `-t 'deb control-field protocol'`,NC-A 突变态 | 1(12 failed——全部契约回归拒绝旧脚本) |
| 同上,NC-A 恢复后 | 0(12 passed) |
| 同上,NC-B 突变态 | 1(仅"nonzero exit 即使 stdout 正确"一项失败——精确命中吞退出突变) |
| 同上,NC-B 恢复后 | 0(12 passed) |

环境:Node v26.8.2(PATH 前缀 `C:\dsh-r24-upgrade-20260912-01\node-v26.8.2-win-x64`);TMP/TEMP 重定向 `C:\dsh-b01-w01\tmp`;vitest 直连入口;超 60s 命令均后台+短轮询。

## 负控与恢复

- NC-A(恢复旧多字段裸值假设 = 原字节 blob `7d2428e2…`,经 `git cat-file` 只读取出):被 12/12 契约回归拒绝(exit 1);trap 恢复后 blob 回 `4c03966f…`(SHA-256 `0ded0a11…` 与预存备份一致),正向 12/12 通过。
- NC-B(三处 `|| deb_*_status=$?` → `|| true`,只吞字段命令 exit):被"exits nonzero even though its stdout is the correct value"精确拒绝(1 failed/11 passed);恢复核验同上,正向 12/12 通过。
- 未用 checkout/reset/stash;突变副本与 SHA-256 在 `mutations/` 留档。

## 移交声明

W01 到此停止写入。`prepare-ci-bubblewrap.spec.ts` 与 `prepare-ci-bubblewrap-test-support.ts` 写锁按计划 3.2 串行移交 W02;`prepare-ci-bubblewrap.sh` 写锁保留给 W01 返工场景(W03 只读)。

## NOT_RUN

真实 dpkg-deb 未实跑(本机无该工具;真实 pinned deb 控制字段验证为 W03 必需项,未声称已跑)。真实 Linux 编译/probe/CVE 关闭未执行。typecheck/lint/duplication/coverage 未运行(超出 W01 最小验证矩阵,归 CP1/整合)。CI 未触发。
