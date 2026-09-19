# W01 rework-2 — W03 CI 观察回派返工(CP-A 候选 8d0dc411 / run 35445600344)

日期: 2026-09-19。实施者: ZCODE(W01/W02 文件家族写锁重新持有,完成后释放回总控)。分支 `chore/latest-stable-upgrade-20260912`,HEAD 未移动,未提交未推送。CI 日志原件:`C:\dsh-b01-w03\job-*.log`。

## 0. 起始状态(返工受理时)

| 文件 | 返工起始 blob(= W02 交付态) | 返工终态 blob |
|---|---|---|
| `scripts/prepare-ci-bubblewrap.sh` | `4c03966fd769a3075a086a6a7daa1cbdfba413a3` | `cf6f7a13811e7c0fdcabd6a74dd989d195c94af7` |
| `scripts/prepare-ci-bubblewrap.spec.ts` | `d0f3e6a640be3bba4a1bdccd9d328290998098c1` | `1ab9fed914ee4f76ed72d55f6ce08c46de0805d3` |
| `scripts/prepare-ci-bubblewrap-test-support.ts` | `04fbb27dea525c19cf5bcb4d8e05e892b6f03b03` | `af3d9dcdc2434b9d38a23776809ea426f89834d1` |

净 diff:3 files changed, 88 insertions(+), 20 deletions(-)。三文件均恰好一个尾换行;两轮负控后终态字节与恢复核验一致。

## 1. 返工一:链接证据检查接受两种私有形态

**CI 实证(job-105903866688.log:482/485,逐字节)**:
`[7/7] cc  -o bwrap bwrap.p/bubblewrap.c.o bwrap.p/bind-mount.c.o bwrap.p/network.c.o bwrap.p/utils.c.o bwrap.p/chroot_realpath.c.o bwrap.p/safe_openat.c.o -Wl,--as-needed -Wl,--no-undefined /home/runner/work/_temp/dsh-bubblewrap-private/libcap/usr/lib/x86_64-linux-gnu/libcap.a`
Meson 配置与 6 个编译步全部成功;[7/7] 以**绝对 .a 操作数**直链私有静态库(零搜索路径歧义),旧检查只认 `-L${libcap_lib}`+`-lcap` 形态,导致链接成功后误报 fail。

**脚本改动(diff 精确到行)**:仅链接证据段。注释块改述两种可接受形态;判定由单条件
`if [[ "$link_line" != *" -L${libcap_lib}"* || "$link_line" != *'-lcap'* ]]; then`
改为两形态析取
`if [[ <旧条件> ]] && [[ "$link_line" != *"${libcap_lib}/libcap.a"* ]]; then`
即:形态 (a) `-L<私有目录>` 且 `-lcap`,或形态 (b) 含绝对路径 `${libcap_lib}/libcap.a`(宿主 `/usr/lib/.../libcap.a` 不含私有前缀,天然不匹配)。无任何私有引用、仅宿主 `-L`、仅宿主 `.a` 均仍拒绝;`grep ' -o bwrap '`、`--no-undefined` 等其他语义未动。

**test-support 改动**:新增 `CI_RUNNER_PRIVATE_LIBCAP_LIB`(run 35445600344 私有 libdir 前缀)、`CI_LINK_LINE_ABSOLUTE_LIBCAP_A`(上述 CI 链接行逐字节常量)、`ciAbsoluteLibcapALinkLine(privateLibdir)`(仅把 runner 私有目录前缀替换为场景私有目录,其余字节冻结)。

**spec 改动**:`linkMode` 增加 `'private-absolute-a' | 'host-absolute-a'`;stub python3 增两分支(绝对 .a 私有行 = `$STUB_LINK_LINE_ABS_A`;宿主绝对 .a 行);env 增 `STUB_LINK_LINE_ABS_A`。新增 3 项回归:
1. `accepts the -L plus -lcap private search-path link form (form a)` — 显式钉住形态 (a);
2. `accepts the CI-observed absolute private libcap.a operand link form (run 35445600344, form b)` — CI 实证行(场景本地化)整流程通过,并断言 stdout 无 `-lcap`(fixture 防漂移:形态 b 本质就是无 linker-name);
3. `rejects a link command that names the host libcap.a operand` — 宿主绝对 .a 操作数仍拒绝(objdump 未被调用)。
原 `linkMode: 'private'` stub fixture(-L+-lcap)保留为形态 (a) 用例;既有 no-private/host 拒绝用例原样。

## 2. 返工二:duplication 克隆去重

**CI 实证(job-105903866970.log:542-560)**:`prepare-ci-bubblewrap.spec.ts [1171:60-1180:6] (10 lines, 63 tokens)` 克隆 `[1185:50-1194:6]`,jscpd minTokens 60/minLines 6,exit 1。两块是 W02 的 both-Path/PATH 双序环境构造测试。

**spec 改动**:两个 `it(...)` 原文合并为一个 `it.each([{label:'Path first',...},{label:'PATH first',...}])`,两种顺序成为参数化用例(名称携带 `$label` 保持语义可见),构造与断言逐句保留,测试执行数不变。语义未弱化:同一构造、同一断言、两序均执行。

## 3. 验证运行与真实退出码

| 运行 | 命令 | 退出码 | 结果 |
|---|---|---|---|
| run-07 | `bash -n scripts/prepare-ci-bubblewrap.sh` | 0 | 语法通过(终态复验同样 0) |
| run-08 | `node node_modules/vitest/vitest.mjs run --project thread-safe scripts/prepare-ci-bubblewrap.spec.ts` | 0 | **63 passed \| 1 skipped (64)**,166.73s。64 = W02 期 61(其中两序用例去重后仍各计 1)+ 3 项新链接回归。唯一 skip 为 W02 既有 `describe.skipIf(!execBitEnforced)`(Windows 无 exec-bit 强制;POSIX CI 执行),非本次弱化 |
| run-09 | `pnpm run duplication` | 0 | **Found 0 clones**(旧克隆消失;新增测试未引入新克隆) |
| run-10 | 同 run-08 + `-t 'link'`,NC-C 突变态 | 1 | 1 failed \| 5 passed \| 58 skipped:仅形态 b 用例失败(AssertionError expected 0 received 1) |
| run-11 | 同上,NC-C 恢复后 | 0 | 6 passed \| 58 skipped |
| run-12 | `pnpm run duplication`,NC-D 突变态 | 1 | Clone found:spec [1204:57-1213:6]/[1218:50-1227:6](10 lines, 63 tokens — 与 CI 证据同签名) |
| run-13 | 同上,NC-D 恢复后 | 0 | Found 0 clones |

环境:node-v26.8.2 + pnpm-12.4.1(PATH 前缀 `C:\dsh-r24-upgrade-20260912-01\...`);TMP/TEMP=`C:/dsh-b01-w01/tmp`;>60s 命令后台+短轮询。原始输出:`C:\dsh-b01-w01\raw\`(run-07..13、四份 driver 日志、void-attempts/)。

## 4. 两负控与恢复核验

| 项 | NC-C:恢复旧 -L+-lcap 单形态检查 | NC-D:重引入 W02 克隆块 |
|---|---|---|
| 突变方式 | 字节精确替换:两形态条件(137B)→ 旧单条件(81B,offset 16687);node exit 0;mutant bash -n exit 0;驱动含"未应用即中止"守卫 | 字节精确替换:it.each 块(817B)→ 原两个重复测试(1075B,offset 57185);同一替换器 |
| 突变体 blob / SHA-256 | 脚本 `cf6c8d22aa755ab8c5d4f88374751f32e1a4fcfa` / `5bfdae43…9346` | spec `451af07a285765e7804ed25c941b074531fc04f2` / `28367863…ac49` |
| 失败位置 | 仅 `accepts the CI-observed absolute private libcap.a operand link form (run 35445600344, form b)` 失败;形态 a 与 no-private/host/host-.a 拒绝在旧检查下行为不变仍通过 — 突变只切除形态 b 且被其 fixture 用例精确命中 | duplication 门禁 exit 1,克隆签名 10 行/63 tokens 与 CI 证据一致 |
| 恢复 | trap EXIT + 显式 cp;post_restore_blob `cf6f7a13…`,SHA-256 `8e6746df…` 与预存备份一致 | 同左;post_restore_blob `1ab9fed9…`,SHA-256 `5373ca53…` 一致 |
| 恢复后正向 | run-11 exit 0 | run-13 exit 0 |

突变副本:`mutations/nc-c-old-lform-only-check.sh`、`mutations/nc-d-reintroduced-clone.spec.ts`。

**过程首失(保留)**:NC-C 第一次尝试无效——`replace-exact.mjs` 在 `.mjs`(ESM)中使用 `require` 报 ReferenceError,突变从未应用(mutant_blob 与原样相同、run-10 exit 0),该次全部输出保存在 `raw/void-attempts/`;修复为 `replace-exact.cjs` 并给两驱动加"字节未变即中止"守卫后重跑得上述有效闭环。仓库文件在该次中未被改动(恢复核验一致)。

## 5. NOT_RUN

- 未在真实 Linux 上重跑构建/probe(本轮为本地契约回归;两 Linux 作业的真实复验属 W03 复查下一候选)。
- typecheck/lint/coverage 未运行(diff 仅限测试与 shell 脚本文件家族;归 CP-A2/整合按需)。
- 未提交未推送;未读密钥/.env;未调用外部代理。
- AGENTS.md 词数(static 作业)归总控,未触碰。

## 6. 写锁释放声明

W01 rework-2 完成:终态 `prepare-ci-bubblewrap.sh` = `cf6f7a13…`、`prepare-ci-bubblewrap.spec.ts` = `1ab9fed9…`、`prepare-ci-bubblewrap-test-support.ts` = `af3d9dcd…`。三个文件的写锁自此释放回总控(CP-A2 整合);除总控正式回派新返工外,本实施者不再写入。
