# Agent Note: 任务私有源码构建替换 CVE 在列的 CI bubblewrap pin

Status: implemented

[English](2026-09-19-private-bubblewrap-ci-build-r48.md) | 中文

## Problem

`scripts/prepare-ci-bubblewrap.sh` 此前安装 r47 恢复的 pin `bubblewrap_0.9.0-1ubuntu0.1_amd64.deb`，该版本仍被 UBUNTU-CVE-2026-87766 列为受影响，上游 0.12.0 版本包含修复。升级需要一个不在系统层面安装任何东西的构建路径：五处 workflow 调用点与 `ci-workflow.spec.ts` 的 no-apt-get 断言必须保持不变，任何 runner 的包数据库都不得修改，且 runner 自带的开发库绝不能在暗中代替固定输入满足构建。

## Decision

脚本现在在自有 `RUNNER_TEMP` 目录内以三个哈希固定的输入构建 `bwrap` 0.12.0，每个输入在解包或执行前都与发行方记录的摘要核对：官方 bubblewrap 0.12.0 发行源码包（复用 r47-S 已验证字节）、以 `meson.py` 直接运行的官方 Meson 1.12.0 发行源码（不涉及 pip/apt/MSI；Python >= 3.10 下限由 Meson 自身强制）、以及仅作为数据处理的 Ubuntu `libcap-dev 1:2.66-5ubuntu2.4` deb——control 字段与已签名的 noble-updates/noble-security Packages 索引核对（两个索引列出同一文件；InRelease 签名已在 r48 证据中经 gpgv 验证），成员清单经过审计，仅执行 `dpkg-deb --extract`，绝不运行 maintainer script。审计拒绝绝对路径、`..` 穿越、设备成员和解析到解包根之外的链接，允许名称中含空格（真实 Meson 包内含 `manual tests/`），并对末尾未换行的行同样审计。由于包内自带的 `libcap.pc` 声明 `libdir=/usr/lib64` 而实际载荷安装在 `usr/lib/x86_64-linux-gnu`，脚本生成一份指向已审计绝对路径的私有 `libcap.pc`，将 `PKG_CONFIG_LIBDIR` 限制为该目录，删除包内悬空的 `libcap.so`/`libpsx.so` 开发符号链接使 `-lcap` 只能解析到已审计的 `libcap.a`，并以 `prefer_static` 配置。验收基于证据而非假设：详细编译日志必须包含引用私有 libcap 目录的真实链接命令；产物 ELF 必须是 `elf64-x86-64`、`objdump -p` NEEDED 与 `ldd` 均不出现动态 libcap、版本输出恰为 `bubblewrap 0.12.0`；源码、依赖与产物的摘要分别记录。`GITHUB_PATH` 发布移至功能探针通过之后，探针失败即零发布。sysctl 策略、平台门槛与 r47 的全部失败出口语义保持不变；全程没有 apt-get、没有全局 `LD_LIBRARY_PATH`、没有 `--not-a-security-boundary`、没有 setuid。

重写的直接回归（`scripts/prepare-ci-bubblewrap.spec.ts`，36 项测试）在全部外部效果均为测试自有 PATH 替身的条件下执行真实脚本——`uname`、`curl`、`sha256sum`、`tar`、`dpkg-deb`、`python3`（同时扮演 Meson 并放置替身 `bwrap`）、`cc`、`ninja`、`pkg-config`、`objdump`、`ldd`、`sudo` 与构建出的 `bwrap`。覆盖完整成功顺序（35 次按序记录的调用、哈希记录、单一成功行、发布内容）、可容忍的 sysctl 缺失、逐输入的下载与摘要失败、全部四类不安全成员、缺失构建工具、deb control 与载荷不匹配、私有 pkg-config 解析失败、meson 配置与编译失败、链接证据缺失与宿主回退、错误架构、动态 libcap 的 NEEDED 与 ldd 检出、错误版本身份、探针失败且零发布、平台与环境拒绝、解包失败。两个负控——摘要门槛置为空操作、探针追加 ` || true`——恰好各自击中对应测试，并在每次绿色复跑前逐字节恢复（r48 证据树）。

## Consequences

五处 workflow 调用点零变化：脚本唯一发布面仍是一个 `GITHUB_PATH` 目录条目，只是从解包 deb 的 `usr/bin` 换成私有构建目录。真实 Linux 编译、链接、ELF 检查与沙箱探针仍由原 CI 对该候选的首跑负责；在本 Windows 主机上它们 NOT_RUN，由替身控制流套件替代。在受限 pkg-config 路径下 Meson 报告 `libselinux` 未找到，SELinux 特性自动关闭——与 Ubuntu 的 AppArmor runner 平台及 Ubuntu 自身 bwrap 打包一致，属记录在案而非静默假设；对 SELinux 强制的主机该边界仍在证据中注明。`libcap.a` 的静态 ABI 契合由 runner 上的真实链接证明，非本机证明。`sandbox.yml` 仍通过自身 master-only 的 apt-get 路径安装 bubblewrap，是尚未迁移的独立入口：在该入口迁移且 CI 验收本构建之前，全仓 CVE 状态保持未关闭。证据：[private-bubblewrap-build-r48](../../../../development/remediation/2026-09-19/private-bubblewrap-build-r48/inputs-verified.md)。

## Alternatives considered

**在五处调用点以 apt-get 安装构建依赖。** 拒绝：对 runner dpkg 数据库的包事务，违背 no-apt 不变量与本轮的无系统安装路线。

**通过 sysroot 消费包内自带的 `libcap.pc`。** 拒绝：其 `libdir=/usr/lib64` 与载荷安装路径不符，链接会回退到宿主查找路径——正是本次变更要消除的静默回退。

**私有动态 libcap。** 拒绝：还需额外取 `libcap2` 运行时包；本轮将私有依赖路线限定为静态 libcap 加动态 glibc。

**保留 r47 的 deb pin。** 拒绝：取件已恢复，但版本仍在 CVE 列表；所有者决定前向替换该 pin，而非重新追认。
