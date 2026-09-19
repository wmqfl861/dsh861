# W02 FINDINGS — 让 Windows 替身测试确实执行替身

运行: B01-20260919-01 / W02。实施者: ZCode。日期: 2026-09-19。分支 `chore/latest-stable-upgrade-20260912`,HEAD `6528141bc9f435f8a2361f4c0c56eb9393092c02` 未移动,未提交未推送(总控统一 Git)。`scripts/prepare-ci-bubblewrap.sh` 未动(blob 全程 `4c03966fd769a3075a086a6a7daa1cbdfba413a3`)。

## 1. 文件身份(起始/终态)

| 文件 | 起始 blob | 终态 blob | 权限 |
|---|---|---|---|
| `scripts/prepare-ci-bubblewrap.spec.ts` | `56fc063b69073ab230e133a471ba5ba7cfb53bff`(W01 移交) | `d0f3e6a640be3bba4a1bdccd9d328290998098c1` | W(本任务) |
| `scripts/prepare-ci-bubblewrap-test-support.ts` | `e598c38c026c5acb6f2f462309c1f94cc595b8ae`(W01 移交) | `04fbb27dea525c19cf5bcb4d8e05e892b6f03b03` | W(直接启动/fixture 辅助) |
| `scripts/prepare-ci-bubblewrap.sh` | `4c03966fd769a3075a086a6a7daa1cbdfba413a3` | 同(未动) | 只读 |

两负控循环后终态字节与备份一致(spec SHA-256 `2e82993a…`、test-support `bab9a7a7…`)。两文件均恰好一个尾换行。

## 2. 根因证明(证据链)

### 2.1 探测事实(脚本与原始输出:`C:\dsh-b01-w02\raw\probe-env.out`、`probe-dup.out`)

| 编号 | 事实 |
|---|---|
| P1 | `C:\Program Files\Git\usr\bin\bash.exe` 通过 `--noprofile --norc` 探测(status 0,stdout `w02-bash-ok` 等价物);`OSTYPE=cygwin`;`uname -s`=`MINGW64_NT-10.0-26200`(≠Linux,平台门确定拒绝);`where.exe bash` 另有 `C:\Windows\System32\bash.exe`(WSL)与 WindowsApps 项——裸名 `bash` 在此类主机上确实多重解析 |
| P2a/b | 最小白名单 env(仅单 `PATH` 键,POSIX 冒号形,stub bin 在前)下 bash 正常运行;`SystemRoot` 非必需;`command -v uname` 精确解析为 `${stubBinPosix}/uname` |
| P2c | PATH 只给 stub bin 时 `cat` 不可解析——bash 不自动前置 `/usr/bin`,次序完全由传入 PATH 决定 |
| P2d/e | 单 `Path` 大小写键同样被 msys 转换;Windows 分号形 PATH 也被转换(两种键名、两种值形都合法,但混拼不保证) |
| P3 | Git `/usr/bin` 工具普查:真实 `uname/tar/sha256sum/ldd/grep/tee/tail/cat/cp/chmod/ln/rm/mkdir/env` 在;`curl/dpkg-deb/sudo/cc/ninja/pkg-config/objdump` 不在——stub-first 次序被破坏时,可误达的真实命令是 `uname/tar/sha256sum/ldd`;白名单 PATH 下无任何真实 curl/sudo/编译器可达 |
| P4 | 本机不执行 exec 位(noacl 挂载):0644 脚本照常执行——"替身不可执行"在本机不可构造,POSIX CI 可构造 |
| P5a/b | 裸名 `bash` + 自定义 env 的 `spawnSync` 直接 ENOENT(libuv 按子 env 的 PATH 搜索可执行文件)——裸名启动本身脆弱 |
| P5c/d/e | 子 env 同时携带 `Path`+`PATH` 时,本机 msys 运行时在两种插入次序下都选精确大小写 `PATH` 键——重复键的胜者由 msys 运行时版本决定,不是跨环境保证 |
| P6 | 本会话(Git Bash 父)存储键为 `PATH`(大写);cmd 启动的子进程继承会话大小写。Windows OS 规范大小写是 `Path`;从本会话内部无法观察干净的非 bash 父环境(记录为探测限制) |
| P7 | 仅 `Path` 键(内容无 stub bin)时:真实 `/usr/bin/uname` 应答 `MSYS_NT-10.0-26200` → 脚本平台拒绝——CI 观察到的终态在本机复现 |

### 2.2 根因链(已证部分与类别级证明)

1. CI run35436610274:36 项中 27 失败,多为 `supports only Linux x86_64 hosted runners`——脚本确实在 bash 内执行,但 `uname` 由非替身应答。
2. 旧装配(W01 末态)在 Windows 父环境存 `Path`(OS 规范形)时必然产出大小写重复键:整包 spread 复制 `Path`,再赋值 `env.PATH` 追加第二个键;胜者由 runner 的 msys 运行时决定(本机探测:精确 `PATH` 胜;无跨运行时保证)。裸名 `bash` 的解析目标由 runner PATH 决定(本机即有三种 bash.exe)。两者叠加使"替身 bin 是否真的在子进程 PATH 首位"失去确定 answer——这是 CI 失败的缺陷类别,已证存在于旧装配。
3. **本机复现(NC-B,run-05)**:把宿主 `/usr/bin` 置于 stub bin 之前并去掉身份守卫 → end-to-end describe **27 failed | 5 passed**,失败差异与 CI 相同(期望 0 实收 1,stderr 为平台拒绝)。这证明"stub bin 未实际居首"这一类别完整解释 CI 的 27 失败 + 5 个偶然通过(2 平台拒绝断言、2 runner 环境缺失、1 工具缺失 preflight——与 BASELINE §2 的 9/36 通过 = 4 源码级 + 5 e2e 完全吻合)。
4. runner 侧 msys 对重复键的确切择键行为无法在本机复现(版本差异);以类别级证明 + 本机复现代替,记录为 NOT_PROVEN_BEYOND_CLASS。
5. **空输出分支单独解释**:平台门先于一切 stdout 输出(脚本首个 echo 在门后),门处停止的场景 stdout 为空、stderr 携带拒绝消息——新增专测固化(stdout `''`、stdoutBytes 0、stderrBytes>0、spawnError null、sentinel 证明到达的是替身 uname)。不是超时:30s 预算未动,实测最长单项 14.6s。

## 3. 实施改动

### 3.1 `prepare-ci-bubblewrap-test-support.ts`(新增直接启动辅助,保留 W01 fixture)

- `resolveSpecBash()`:win32 依序探测绝对 Git Bash 候选(固定两处 → `%LOCALAPPDATA%\Programs\Git` → `%SystemRoot%\System32\where.exe bash` 各行),以 `--noprofile --norc -c 'printf …'` 验证可执行且 `OSTYPE` 为 msys/cygwin;POSIX 沿用套件约定的裸 `bash` 并同样验证。不依赖裸名偶然解析。
- `toMsysPosixPath()`:盘符绝对路径 → MSYS POSIX 形(`C:\a b` → `/c/a b`);非盘符输入仅斜杠归一(契约注明)。
- `buildScenarioChildEnv()`:白名单环境构造。win32:仅 `PATH` 一键 = `pathEntries.join(':')`(POSIX 冒号形,stub bin 在前),父路径内容一律不继承——`Path`/`PATH` 重复与 Windows 分号/盘符内容按构造排除;POSIX:精确名 `PATH` 的父值接在显式条目后。空 `pathEntries` 或测试变量占用 path 名键即抛错(misconfiguration fails loud)。
- `probeExecBitEnforcement()`:一次性探测平台是否执行 exec 位(0644 脚本须 126 拒绝);本机 false(P4),POSIX CI true。

### 3.2 `prepare-ci-bubblewrap.spec.ts`(runScenario 重构 + 13 项新增;48 项既有断言零改动)

- 每场景经 `specBash.command`(绝对路径)以 `--noprofile --norc` 启动;env 经 `buildScenarioChildEnv` 白名单构造;win32 PATH = stub bin + Git `/usr/bin`(P3 普查证明后者提供脚本/替身仍需的真实 coreutils 且不含 curl/sudo/编译器),POSIX = stub bin + 父 PATH(与旧行为等价,保留 Linux 兼容契约)。
- **身份守卫(前置拒绝)**:脚本运行前同 env 探测 `command -v uname`,必须精确等于本次 run 的 `${stubBinPosix}/uname`,否则抛错拒绝执行("refusing to run the script against host commands")。唯 `pathOrder: 'host-first'` 场景豁免(该场景本身即记录宿主解析后果)。替身缺失/不可执行时查找落入宿主 `/usr/bin/uname`——守卫先拒绝,这正是"来源检查失败必须在可能调用真实 curl、sudo 或编译器之前拒绝"的实现。
- **sentinel**:每场景唯一 `w02-<uuid8>`;每个替身在 shebang 后插入一行,调用时向独立 `STUB_IDENTITY_LOG` 追加 `<name> <sentinel>`。`STUB_LOG` 行格式不变——W01 全部既有断言(含 `dpkg-deb --field \S+ Package$` 行尾锚)零改动。
- **证据字段**:`bashCommand`、`unameResolution`/`expectedUnameResolution`/`unameProbeStatus`、`sentinel`、`identityRecords`、`spawnError`、`signal`、`stdoutBytes`/`stderrBytes`。
- 新增场景旋钮:`tempPathShape`(`dsh-w02-准备 probe-` 前缀的含空格+非 ASCII scratch 根)、`pathOrder`、`breakUnameStub`、`parentPathEntries`。

### 3.3 新增测试(13 项;总数 48+13=61)

`scenario child environment construction (path-variable uniqueness)`(5 项,纯构造,全平台运行):
1. win32:单一 `PATH` 键、stub 居首、无 `;` 无 `C:`(父内容零继承)、键集合 ⊆ 白名单;
2. 父携 `Path`+`PATH`(Path 在前)→ 同一确定 PATH;
3. 父携 `PATH`+`Path`(PATH 在前)→ 逐字节相同;
4. POSIX:父精确 `PATH` 接在显式条目后(冒号连接,不拆任何条目),异大小写变量忽略;
5. 测试变量占 path 名键 → 抛错。

`prepare-ci-bubblewrap.sh stub-source identity and launch environment (W02)`(8 项,bash 可用时运行):
6. 绝对 Bash 启动 + 完整来源证据(status 0、probe 0、解析精确等于期望、identity 记录数=stub 调用数、每条含 sentinel、`uname <sentinel>` 在列、stdoutBytes>0);
7-8. 父环境同时携带 `Path`/`PATH`(两种次序)e2e 照常成功发布;
9. 含空格+非 ASCII 临时路径 e2e 成功(路径标记断言、github-path 内容精确);
10. (win32)宿主工具目录居前:真实 uname 应答、平台拒绝、零替身调用、stdout 0 字节——PATH 次序的行为证明,也是 NC-B 的常设对照;
11. uname 替身缺失:身份守卫先拒绝(错误消息含宿主解析路径与"refusing to run the script against host commands");
12. (探测门控:exec 位执行平台)uname 替身不可执行:同样先拒绝;
13. 空输出分支解释:替身 uname 应答 Darwin → status 1、stdout 空/0 字节、stderr 非零字节、spawnError null、sentinel 在列——区分"早退空输出"与"启动失败"。

第 12 项本机被 P4 证据门控跳过(skip 原因即探测结果);POSIX CI 将实际执行。

## 4. 物理运行与真实退出码

| 运行 | 命令(公共前缀:`node node_modules/vitest/vitest.mjs run --project thread-safe scripts/prepare-ci-bubblewrap.spec.ts`;Node v26.8.2 绝对入口,PATH 前缀 node+pnpm 目录,TMP/TEMP=`C:/dsh-b01-w02/tmp`) | 退出码 | 结果 |
|---|---|---|---|
| run-01 | 全量(首迭代) | 1 | 60 项中 1 失败——missing-stub 用例的旧断言错误假设"command not found"(实际:查找落入宿主 /usr/bin/uname,平台拒绝);已改为守卫拒绝语义 |
| run-02 | 全量(修正后) | 0 | **60 passed \| 1 skipped(61)**,344.49s |
| run-03 | NC-A 突变态 + `-t 'scenario child environment construction'` | 1 | **4 failed \| 1 passed**(含两个重复键行为用例;失败差异显示旧分号拼接);负控有效 |
| run-04 | NC-A 恢复后同过滤 | 0 | 5 passed(56 skipped) |
| run-05 | NC-B 突变态 + `-t 'end to end'` | 1 | **27 failed \| 5 passed**——与 CI run35436610274 的 27 失败签名一致,真实命令路径不得误通过 |
| run-06 | NC-B 突变态 + `-t 'stub-source identity'` | 1 | 6 failed \| 1 passed(唯一通过与预期的宿主解析对照用例) |
| run-07 | NC-B 恢复后全量正向 | 0 | 60 passed \| 1 skipped(61)(终态复验) |

全部 >60s 命令后台化+短轮询。日志:本目录 `logs/` 索引;原始输出 `C:\dsh-b01-w02\raw\run-0*.out/.exit`。

## 5. 负控与恢复核验

| 项 | NC-A:恢复旧环境拼接(整包复制/大小写不处理) | NC-B:去掉替身身份保护(宿主目录居前 + 守卫禁用) |
|---|---|---|
| 突变方式 | `buildScenarioChildEnv` 主体替换为 `{ ...process.env, ...testVars }` + `env.PATH = join(';')+process.env.PATH`(旧语义);驱动脚本 `mutate-nc-a.mjs`,单次出现精确替换 | spec 两处精确替换:PATH 条件强制 `true`(host-first)+ 守卫条件前缀 `false &&`;驱动脚本 `mutate-nc-b.mjs` |
| 突变体 blob / SHA-256 | `e9280445f362e5c51947d2e779d28819947ed49f` / `69f78bb443de24cd3d66a647364344afde3a2b213d715d7518b5426a0a7e08da` | `a97c10cc02441a5d85ea7a56fbfcbf01a86399a7` / `c093aca0474fb6921fb9164a26863c2f1e168b02bf0f98e541efce5cdfbe956a` |
| 目标失败 | run-03:exit 1,4/5 失败;"Path+PATH(Path first)"/"(PATH first)"两个带重复 key 的行为用例均拒绝;win32 主用例另被 `;`/`C:`/白名单键集断言拒绝 | run-05:exit 1,27/32 失败(成功路径全灭,expected 0 received 1,平台拒绝 stderr);run-06:exit 1,6/7 失败 |
| 恢复 | 备份 `cp` 回写 | 同左 |
| 恢复核验 | post_restore_blob `04fbb27d…`,SHA-256 `bab9a7a7…` 与备份一致 | post_restore_blob `d0f3e6a6…`,SHA-256 `2e82993a…` 与备份一致 |
| 恢复后正向 | run-04:exit 0,5/5 | run-07:exit 0,全量 60 passed \| 1 skipped |

突变副本:`mutations/nc-a-old-env-assembly.test-support.ts.disabled`(blob `e9280445…`)、`mutations/nc-b-guard-removed.spec.ts.disabled`(blob `a97c10cc…`)。未用 checkout/reset/stash。NC-B 仅在本机 Windows 执行:平台门先于任何网络调用,且白名单 PATH 无真实 curl 可达(P3),突变态不可能触网——POSIX 上该突变会让真实工具链可达,不在本机执行。

## 6. 既有 48 项的保持

- 源码级 4 项、e2e 32 项、W01 契约回归 12 项断言文本零改动;run-02/run-07 全绿。
- 唯一行格式影响面:`STUB_LOG` 不变(身份记录写入独立文件);`dpkg-deb --field \S+ Package$` 等行尾锚不受影响。
- 30s testTimeout 与 30s spawn 预算未动;未增加任何 timeout。
- 产品脚本平台拒绝条件未动(.sh blob 不变)。

## 7. NOT_RUN(不冒称已执行)

- 全量 typecheck/lint/duplication/coverage:超出 W02 最小验证矩阵(契约回归 + 来源证明 + 负控),归 CP-A/整合。
- 新 Windows CI 文件级结果:候选归 CP-A 后触发;本机全量为 A2 的文件级证据。
- 替身不可执行用例本机未执行(P4:平台不执行 exec 位;POSIX CI 将执行)。
- runner 侧 msys 对重复键的确切择键:无法本机复现特定运行时版本;以类别级证明 + NC-B 本机复现代替(§2.2)。
- 真实 Linux 编译/probe/CVE(A3)未执行;`ci-workflow.spec.ts` 等其他文件未触碰。

## Correction (appended at CP-A integration per CP1 OBS-1)

CP1 OBS-1: in section 2.2 item 3, the fifth incidentally-passing NC-B test is `rejects a libcap digest mismatch before any deb handling` (its all-negative-path assertions are satisfied by the early platform stop), not a tool-missing preflight case; `fails loud when a build tool is missing` actually fails under NC-B (expected stderr `requires on PATH: ninja`, received the platform refusal message). Counts (27|5) and signature consistency are unaffected.
