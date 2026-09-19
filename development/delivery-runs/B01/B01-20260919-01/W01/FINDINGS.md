# W01 FINDINGS — 修正 Linux 准备中的真实外部命令契约

运行: B01-20260919-01 / W01。实施者: ZCode。日期: 2026-09-19。分支 `chore/latest-stable-upgrade-20260912`,HEAD `6528141bc9f435f8a2361f4a0c56eb9393092c02` 未移动,未提交未推送(总控统一 Git)。

## 1. 实际改动(起始/终态身份)

| 文件 | 起始 blob | 终态 blob | 权限 |
|---|---|---|---|
| `scripts/prepare-ci-bubblewrap.sh` | `7d2428e2fa84b7fda9aeec24fa1de661cb90cb46`(与计划 3.2 一致) | `4c03966fd769a3075a086a6a7daa1cbdfba413a3` | W(I/W01) |
| `scripts/prepare-ci-bubblewrap.spec.ts` | `91bcd7fa4833b8687ebf66e8a136a65fe0c78e66`(与计划 3.2 一致) | `56fc063b69073ab230e133a471ba5ba7cfb53bff` | W(串行移交 W02) |
| `scripts/prepare-ci-bubblewrap-test-support.ts` | NEW(计划 3.2 预登记) | `e598c38c026c5acb6f2f462309c1f94cc595b8ae` | N(fixture 辅助) |

终态工作树字节在两次负控循环后保持不变(post_restore_blob 均为 `4c03966f…`,SHA-256 `0ded0a11…` 与备份一致)。三个文件均恰好一个尾换行。

## 2. 脚本改动内容(D03:逐字段读取 + 直接捕获退出)

删除了旧的 `mapfile -t control < <(dpkg-deb --field "$libcap_archive" Package Version Architecture)` 块(两个已证缺陷:多字段模式实收带标签输出;进程替换丢失子命令退出状态)。替换为对 `Package`、`Version`、`Architecture` 三个字段各自独立的单字段 `dpkg-deb --field "$libcap_archive" <Field>` 调用,每次调用:

- 退出码直接捕获(`|| deb_*_status=$?`,无管道、无进程替换),非零即 `fail` 退出,诊断包含字段名、退出码与捕获的 stderr(落 `${root}/libcap-control-field.stderr`);
- 空值(缺字段且工具不报错的形态)拒绝;
- 多行/多记录(内嵌换行)拒绝;
- 带标签输出(`<Field>:` 前缀,即 CI run35436610274 首失形态)拒绝;
- 身份精确匹配 `libcap-dev` / `1:2.66-5ubuntu2.4` / `amd64`,原 fail 消息原文保留。

未保留任何宽松多字段解析分支;未做"去前缀后接受任意三行"。设计选择:三个字段为三段对称的内联块而非公共 helper——每条拒绝路径在安全关键处显式可见,且源码级测试对 `dpkg-deb --field "$libcap_archive"` 字面量的位置断言无需重写。

保护不变项(源码级测试逐项锁定的均未动):三输入版本/URL/SHA-256、先验 hash 后解包顺序、workflow/no-apt、无 apt-get/LD_LIBRARY_PATH/setuid、apparmor sysctl 单处、失败即停语义、GITHUB_PATH 最后发布顺序。

末行无 LF:命令替换会剥离全部尾随换行,`value` 与 `value\n` 等价接受(契约回归覆盖);尾随额外空行同样被吸收,但身份仍受精确匹配约束,不构成放行面。

## 3. 测试改动(既有 36 项不弱化 + 新增 12 项)

- 新文件 `prepare-ci-bubblewrap-test-support.ts`:CI 证据契约 fixture(`CI_LABELED_CONTROL_PACKAGE_FIRST` 首行 `Package: libcap-dev` 为 CI 日志原文,其余两行按文档化多字段契约;`CI_LABELED_CONTROL_REORDERED` 演示 control 序)。本机无真实 dpkg-deb,fixture 冻结的是观察到的字节形态;真实 pinned deb 验证归 W03。
- stub `dpkg-deb` 改为实现真实 argv 协议(D03):单字段请求回裸值行;多字段请求回带标签、control 序的行(与请求 argv 序无关)。既有 `debVersion` 旋钮语义不变;新增 `debPackage`、`debArch`、`debFieldContract`、`debMissingField`。
- 既有断言更新一处:主成功用例的精确调用序列中 dpkg-deb 由 4 次变为 6 次(3 次单字段读取 + 2 次 `--fsys-tarfile` + 1 次 `--extract`)。这是新协议的必然结果,属契约驱动更新而非弱化;其余 35 项断言原文未动,全部通过。
- 新增 describe `deb control-field protocol (per-field argv contract)` 12 项:
  1. 逐字段单次调用 + 接受 pin 身份(argv 断言:3 次 `--field <archive> <Field>`);
  2. 末行无 LF 的合法单值接受(全流程成功);
  3. 带标签单字段输出拒绝(CI 首失形态,stderr 断言含 `Package: libcap-dev` 原文);
  4. 整块带标签多字段输出到达单字段读取时拒绝;
  5. 同块乱序到达同样拒绝(顺序不救活);
  6. 子命令非零即使 stdout 正确也拒绝(stderr 断言含退出码 2 与捕获的 stderr);
  7-9. Package/Version/Architecture 缺字段(空值 + exit 0)逐项拒绝(it.each ×3);
  10. 重复记录行拒绝;
  11. 错误 Package 身份拒绝;
  12. 错误 Architecture 身份拒绝。

## 4. 物理运行与真实退出码

| 运行 | 命令 | 退出码 | 结果 |
|---|---|---|---|
| run-01 | `bash -n scripts/prepare-ci-bubblewrap.sh` | 0 | 语法通过(终态文件复验同样 exit 0) |
| run-02 | `node node_modules/vitest/vitest.mjs run --project thread-safe scripts/prepare-ci-bubblewrap.spec.ts`(TMP/TEMP 重定向 `C:/dsh-b01-w01/tmp`,PATH 前缀 node-v26.8.2-win-x64) | 0 | 48/48 通过(36 既有 + 12 新增),129.94s |
| run-03(NC-A 突变态) | 同上 + `-t 'deb control-field protocol'` | 1 | 12 failed \| 36 skipped:全部 12 项契约回归拒绝旧脚本 |
| run-04(NC-A 恢复后) | 同上 | 0 | 12 passed \| 36 skipped |
| run-05(NC-B 突变态) | 同上 | 1 | 1 failed \| 11 passed \| 36 skipped |
| run-06(NC-B 恢复后) | 同上 | 0 | 12 passed \| 36 skipped |

日志:本目录 `logs/`;原始输出:`C:\dsh-b01-w01\raw\`(run-01..06、两 driver 日志、备份)。

## 5. 负控与恢复核验

| 项 | NC-A:恢复旧多字段裸值假设 | NC-B:只吞掉字段命令 exit |
|---|---|---|
| 突变方式 | 以 `git cat-file blob 7d2428e2…` 原字节恢复旧脚本(只读 cat-file,无 checkout/reset/stash) | node 精确串替换三处 `|| deb_*_status=$?` → `|| true`;mutant bash -n exit 0 |
| 突变体 blob / SHA-256 | `7d2428e2fa84b7fda9aeec24fa1de661cb90cb46` / `28d31aa9fd7db6f848796feca43725bcd547bca268b56384d6f9ed89068d53a3` | `34f7506ffee579e284f324b2d8737cd181502840` / `dfeb6b111ee8bf24fa0ada89a83d1621020d454bab697bc95fc6de6f85cc8f81` |
| 失败位置 | 12/12 全部失败;代表性断言:`reads each control field through its own single-field dpkg-deb call…` AssertionError expected 0 received 1(旧脚本实收带标签块后 exit 1) | 仅 `rejects a field read that exits nonzero even though its stdout is the correct value` 失败(吞掉退出后脚本放行,期望拒绝得到 0);值形态拒绝(带标签/多记录/缺字段/身份)11 项仍通过,证明突变只切除了退出传播且被精确命中 |
| 恢复 | trap EXIT + 显式 `cp` 备份恢复 | 同左 |
| 恢复核验 | post_restore_blob `4c03966f…`,SHA-256 `0ded0a11…` 与预存备份一致 | 同左 |
| 恢复后正向 | run-04:exit 0,12/12 通过 | run-06:exit 0,12/12 通过 |

突变副本:`mutations/nc-a-old-multifield-bare-values.sh`、`mutations/nc-b-swallow-field-exit.sh`(SHA-256 与上表一致)。

## 6. NOT_RUN(不冒称已执行)

- 真实 `dpkg-deb` 未在本机实跑(Windows 主机无该工具):契约 fixture 来自 CI 原始输出形态 + 文档化协议;真实 pinned deb 控制字段读取是 W03 必需项。
- 真实 Linux 编译、ELF/ldd、功能 probe、CVE 关闭(A3)未执行,W01 不关闭任何 CVE。
- `pnpm run typecheck` / `lint` / `duplication` / coverage 未在本任务运行(W01 最小验证矩阵为脚本契约回归、Bash 语法、字段与命令 exit,均已实跑;重型构建按 D12 归 CP1/整合按需)。
- CI 未触发(候选归 CP-A/W02 之后)。

## 7. 移交声明(→ W02)

W01 固定输出已就绪:`scripts/prepare-ci-bubblewrap.spec.ts`(终态 blob `56fc063b…`)与 `scripts/prepare-ci-bubblewrap-test-support.ts`(终态 blob `e598c38c…`)的写锁自此移交给 W02,按计划 3.2 串行接管;W01 不再写这两个文件及 `prepare-ci-bubblewrap.sh`。W02 注意事项:runScenario 的子进程仍以裸 `bash` 启动并复制整个 `process.env`(W02 的既定工作面,本任务未动);新增旋钮与 stub 协议均可直接复用。
