# Agent Note：CI prepare 规格中的逐字段 deb 控制契约与替身来源证明

Status: implemented

[English](2026-09-19-prepare-command-contracts.md) | 中文

## 问题

CI bubblewrap 准备脚本（`scripts/prepare-ci-bubblewrap.sh`）原以 `mapfile -t control < <(dpkg-deb --field "$libcap_archive" Package Version Architecture)` 校验 pinned libcap 包。CI run 35436610274 证明了两个缺陷：多字段 `dpkg-deb --field` 输出带字段名前缀（`Package: libcap-dev`），裸值数组比较在编译前即 exit 1——这是 Linux 准备 lane 的已记录首失；进程替换吞掉子命令退出状态，stdout 看似正确的失败 `dpkg-deb` 无法被发现。另一侧，Windows 规格套件以裸名 `bash` 启动脚本，子环境由 `{ ...process.env }` 加追加的 `env.PATH` 拼出；父环境存 OS 规范 `Path` 键的主机上这会产生大小写重复键，胜者由 runner 的 msys 运行时决定，且裸名解析可到达多个已装 bash 之一。结果是 36 项 Windows 规格中 27 项停在平台拒绝，且无法证明应答者是替身而非宿主命令。

## 决策

脚本改为对 `Package`、`Version`、`Architecture` 做三次独立的单字段 `dpkg-deb --field` 调用，每次直接捕获退出状态（`|| deb_*_status=$?`，无管道、无进程替换）。非零退出、空值、带标签输出、内嵌换行或多余记录、身份不符各自拒绝，诊断携带字段名、退出码与捕获的 stderr；接受值须精确匹配 `libcap-dev`、`1:2.66-5ubuntu2.4`、`amd64`。不保留任何宽松多字段解析分支。规格 stub 实现真实 argv 协议——单字段请求回裸值，多字段请求按 control 文件序回带标签行（与请求序无关）——fixture 冻结的是观察到的 CI 字节而非假设形态。

规格的场景运行器改为以探测验证过的绝对 Git Bash 路径加 `--noprofile --norc` 启动，并按白名单构造子环境：win32 仅一个 POSIX 冒号形 `PATH` 键，stub bin 居首、Git `/usr/bin` 随后（目录普查证明后者提供脚本与替身仍需的 coreutils，且不含 curl、sudo、编译器），父内容零继承；POSIX 上父精确 `PATH` 接在显式条目后。来源身份守卫在脚本运行前以同一环境解析 `command -v uname`，不等于本次 stub 路径即拒绝执行，替身缺失或不可执行在任何真实命令可达之前被拒。每个场景携带唯一 sentinel，各替身向独立身份日志追加记录；证据字段记录 bash 身份、解析结果、spawn 错误、signal 与流字节数，从而把"空输出早退分支"（平台门拒绝）与启动失败分开解释。Linux 可移植性返工（runner PATH 上的真实工具、POSIX 双路径处理、管线日志排序）关闭了四处仅 CI 可见的失败，未弱化任何 Windows 断言。

## 考虑过的替代方案

**剥掉标签后保留单次多字段调用。** 仍丢失逐命令退出状态并保留输出顺序依赖；任何标签变体下 CI 失败形态都会回来。

**扩大 30s 超时吸收 Windows 慢。** 失败是来源问题而非计时问题；预算未动，实测最差 14.6s。

**继承父环境并把 stub bin 前置。** 即旧装配；`Path`/`PATH` 重复键使胜者依赖运行时版本，正是解释 CI 27 项失败的那一类。

**仅凭 `STUB_LOG` 证明来源。** 该日志只证明某个替身运行过，不证明没有宿主命令先应答；身份守卫在脚本启动前检查解析结果。

## 后果

prepare 规格从 36 项增至 64 项（W01 协议轮后 48，W02 来源轮后 60+1，Linux 可移植性返工后 64+1），原始断言字节零改动。负控重放真实突变体：恢复旧多字段裸值脚本使 12 项协议用例全败；吞掉字段命令退出仅精确击中退出传播用例；恢复旧环境装配使重复键与白名单用例失败；去掉身份守卫并把宿主工具居前复现 CI 的 27 失败签名。CI run 35447649954 与 35450138445 中两条 Linux 准备管线全通过——下载、hash、审计、真实 pinned deb 上的逐字段控制契约、Meson、编译、绝对私有 `libcap.a` 链接、ELF 检查、版本 0.12.0、probe、PATH 发布——static 与 observational 门在两平台转绿。上游安全测试套件仍被 `-Dtests=false` 禁用；普通 `true` probe 不能替代它。证据：[W01 FINDINGS](../../../../development/delivery-runs/B01/B01-20260919-01/W01/FINDINGS.md)、[W02 FINDINGS](../../../../development/delivery-runs/B01/B01-20260919-01/W02/FINDINGS.md)。
