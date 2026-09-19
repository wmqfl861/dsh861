# Agent Note: 以固定时刻的 Ubuntu 快照取件恢复 CI 的 bubblewrap 载荷

Status: implemented

[English](2026-09-19-ci-bubblewrap-acquisition-r47.md) | 中文

## Problem

`scripts/prepare-ci-bubblewrap.sh` 从滚动的 `archive.ubuntu.com` 池下载固定的 `bubblewrap_0.9.0-1ubuntu0.1_amd64.deb`（SHA-256 `1b506492…`）。该池已下架此文件，CI run 35413575204 的两条 Linux 通道（job 105817753016 与 105817753073）都在准备步骤的第 4 次 HTTP 404 处以步骤退出码 22 失败，任何测试都未启动。恢复 CI 需要同一字节的可复现取件；换用更新的 bubblewrap 会改变固定载荷身份，让沙箱基线无声漂移。

## Decision

脚本改为从 Ubuntu 官方快照服务的固定 UTC 时刻（`https://snapshot.ubuntu.com/ubuntu/20260901T000000Z/pool/main/b/bubblewrap/bubblewrap_0.9.0-1ubuntu0.1_amd64.deb`）下载同一固定载荷，并新增三行来源说明，记录滚动池 URL 为何失效、载荷身份始终由 SHA-256 绑定而非来源主机。脚本其余部分零改动：版本、SHA-256、curl 失败检测旗标、校验先于解包、平台与环境检查、被容忍的 sysctl 行为、功能探针与失败退出全部保持。改 URL 之前先用真实字节完成验证：快照返回 HTTP 200、零重定向、50178 字节，Git Bash `sha256sum` 与 PowerShell `Get-FileHash` 双哈希均与固定 SHA-256 一致；只读列出 deb 的 control 成员确认 `Package: bubblewrap`、`Version: 0.9.0-1ubuntu0.1`、`Architecture: amd64`。

直接回归 `scripts/prepare-ci-bubblewrap.spec.ts` 在真实 Bash 下执行仓库真实脚本，全部外部副作用（`uname`、`curl`、`sha256sum`、`dpkg-deb`、`sudo`、提取出的 `bwrap`）换成测试自有 PATH 替身：只记录 argv 并按场景返回受控退出码；受控替身网络只供应已验证的快照 URL，对失效滚动来源与任何未验证来源一概拒绝。13 个测试钉住：从已验证来源的端到端成功（调用顺序、成功输出仅一次、`GITHUB_PATH` 发布、按固定身份做摘要校验）、sysctl 旋钮缺席被容忍、404 与连接失败的下载中止（退出 22/7 且不进入后续阶段）、摘要不匹配在校验处拒绝且绝不解包、解包失败先于特权与探针、探针失败保持致命且不输出成功行（探针前写入 `GITHUB_PATH` 的既有行为被断言为发布而非探针成功）、非 Linux 与非 x86_64 在下载前拒绝、缺 `RUNNER_TEMP`/`GITHUB_PATH` 大声失败。全程离线，写入只落在每次运行的随机临时目录并由 `afterAll` 回收；在没有 POSIX/Git Bash 的环境套件自跳过，与仓库 bash 依赖套件的既定约定一致。在未修改的脚本上，该 spec 恰在失效来源处 13 失败 6。两个负控证明真实发现：只恢复失效 URL 使同样 6 个测试失败；只给摘要校验行追加 ` || true` 使摘要不匹配用例恰好失败，因为脚本越过了校验进入提取；两个突变体语法均有效（`bash -n` 为 0），恢复经 cmp、git blob、SHA-256 三重复核字节一致，每次恢复后 spec 回到 13/13。

## Consequences

Linux CI 通道能再次按字节一致地取得固定载荷，准备步骤解除阻断；这不承诺整个 CI 转绿（schema、快照与 coverage 的既有发现仍由新 run 认领）。Canonical 的 UBUNTU-CVE-2026-87766 仍将 0.9.0-1ubuntu0.1 列为受影响版本：本轮是取件恢复，不是关闭 CVE，也不是安全升级；升级阶段与 P0-B 继续 blocked，且不得把该固定版本解读为对运行真实不可信任务的新部署的批准。仓库供应链政策尚未覆盖 CVE 列名的 CI 载荷（[policy-conclusion.md](../../../../development/remediation/2026-09-19/ci-bubblewrap-acquisition-r47/windows-execution/policy-conclusion.md) 记录了"未覆盖"结论），同字节固定版本因此在显式记录的风险下继续使用，直到后续轮次固定一个经核验的 Noble 修复构建：给出其官方来源与 SHA-256、runner 依赖兼容性（`libc6`/`libcap2`/`libselinux1`）并重跑功能探针。真实的 Linux 解包、sysctl 行为与 bwrap 功能探针仍只由原 CI 在其临时 runner 上执行；本地替身只证明控制流，不证明平台行为。证据：[windows-execution/FINDINGS.md](../../../../development/remediation/2026-09-19/ci-bubblewrap-acquisition-r47/windows-execution/FINDINGS.md)。

## Alternatives considered

**跨镜像自动回退。** 否决：未验证镜像与 latest 链接会把固定身份替换成它们碰巧提供的任何字节；在官方固定时刻来源得到验证之前，失败必须保持大声。

**本轮直接升级到修复版本。** 否决：换版本就是换载荷身份，需要各自核验的官方来源、SHA-256、runner 依赖兼容性与沙箱行为验证（USN-8779-x 的次序）；那是单独的迁移提案，不是 URL 修复。

**把文件名当作包身份。** 否决：deb 的 control 字段只做了只读核对，身份绑定仍是与实际下载字节核验过的固定 SHA-256。
