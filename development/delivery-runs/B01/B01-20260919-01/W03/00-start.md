# W03 — 真实 Linux 编译与安全准备验收（观察开始）

- 开始时间：2026-09-19T13:25:39Z（本机 Windows，只做远端观察）
- 验证者角色：只读 CI 观察与记录；不本地构建、不干预 CI、不提交推送、不读密钥。
- CP-A 候选：commit `8d0dc41139827f0dd1e3c4a82178dc6ad8bb3b7e`（fast-forward 自 `7f63d035…`），已推送分支 `chore/latest-stable-upgrade-20260912`，CI 由该 push（PR #13 synchronize）触发。
- 本地 HEAD 核对：`git rev-parse HEAD` = `8d0dc41139827f0dd1e3c4a82178dc6ad8bb3b7e`（与 CP-A 一致）。

## 观察对象（对照 W03 卡 / formal-plan §2 W03 / BASELINE §2）

原失败 run `35436610274`（attempt1，run number 39）中两条 Linux 作业：

| 作业 id | job (workflow) | name | 原状态 |
|---|---|---|---|
| 105880239998 | `node-24-coverage` | node 24 / coverage | failure（准备步骤 exit 1） |
| 105880240119 | `node-24-consumers` | node 24 / snapshots and artifacts | failure（准备步骤 exit 1） |

两条作业的准备步骤均为 `bash scripts/prepare-ci-bubblewrap.sh &`（ci.yml 191–195、357–361 行区域），W01 修复后的脚本（CP-A 内 blob 待核对）预期：

1. 三输入真实下载 + SHA-256 固定：bubblewrap 0.12.0 `9760d007…a3314`、meson 1.12.0 `88afe0c2…886c`、libcap-dev `1:2.66-5ubuntu2.4` `07f24628…abee`。
2. dpkg-deb 逐字段单字段读取（Package/Version/Architecture），直接捕获退出状态，拒绝带标签输出。
3. Meson setup（`-Dprefer_static=true -Dtests=false -Dman=disabled -Dbash_completion=disabled -Dzsh_completion=disabled`，`PKG_CONFIG_LIBDIR` 指向私有 pkgconfig 目录）→ compile --verbose。
4. 链接命令必须含私有 libcap 目录 `-L…/libcap/usr/lib/x86_64-linux-gnu` 与 `-lcap`。
5. ELF `elf64-x86-64`、NEEDED 无 `libcap.so`、ldd 无 libcap 解析、`bwrap --version` = `bubblewrap 0.12.0`、binary sha256 记录。
6. `sudo sysctl -w kernel.apparmor_restrict_unprivileged_userns=0`（失败仅告警）→ 功能 probe `--ro-bind / / --dev /dev --unshare-pid --proc /proc --die-with-parent -- true`。
7. probe 通过后才把 build 目录 append 到 `$GITHUB_PATH`。

## 方法

- 无凭据 REST：`GET https://api.github.com/repos/wmqfl861/dsh861/actions/runs?head_sha=8d0dc41139…`（本机无 gh；curl 直连）。
- 轮询纪律：60–90 秒间隔分次查询；等待期间先做日志分析准备与既有证据整理。
- 原始 JSON 落盘：仓库内 `W03/raw-json/`（摘要+时间戳），全量留 `C:\dsh-b01-w03\raw\`。
- 日志获取：优先 jobs API + logs 端点；logs 端点若需凭据则改用 job 详情/公开 HTML 页面与 artifact。

## 安全分项预期（formal-plan §2 W03 / D13）

- 上游修复相关安全回归：脚本 `-Dtests=false`，普通 `true` probe 不替代。除非既有获准 Linux 通道实际执行了固定 0.12.0 源码的相关上游测试，安全分项记 `NOT_RUN`，A3 保持未满足。
- `sandbox.yml:87` 独立 apt 入口：始终记 `NOT_CLOSED`。

## 已知输入（来自 STATUS.run.json / CP-A 记录）

- CP-A 触发时 STATUS 记录："CP-A delivered: commit 8d0dc41139 (W01+W02 family + run bookkeeping), push exit 0, fast-forward 7f63d035..8d0dc411; whitespace-gate normalization recorded (formal-plan trailing spaces + 8 logs EOF blank lines, originals+dual hashes at C:/dsh-b01-cp-a/)"。
- W03 开始时任务状态：W03 `running`，W04 `wait_ci`（等待本任务的 Linux 证据：F4.2 agent-team 父 sidecar 默认平台、F4.3 子 sidecar 在 Linux 再生成）。
