# R48 DELIVERED: task-private bubblewrap 0.12.0 build candidate

按 [5740293063](https://github.com/wmqfl861/dsh861/pull/13#issuecomment-5740293063) 与 [5740288027](https://github.com/wmqfl861/dsh861/pull/13#issuecomment-5740288027) 执行并交付：`chore/latest-stable-upgrade-20260912` 分支新增前向安全候选提交（父提交 `73263dfe7593fa9f1bdc7617472a0be3eac7364d`，非强制推送，PR 保持 draft、base 不变、未合并）。两份权威评论均以无凭据 api.github.com REST 读取（HTTP 200）。

## 三输入可信链（实现前完成，原始件存仓库外 `C:\dsh-r48-tqt3s7\`）

1. **bubblewrap 0.12.0 源码包**：复用 r47-S 已验证件，本轮复算 SHA-256 `9760d007363e3abba7c747489910f9f82d9fca53ba3bd3282e396fa3c97a3314`（126452 B）一致；67 成员、2 个同目录符号链接，无越界成员。
2. **Meson 1.12.0 官方发行源码**：GitHub release asset 实测下载 HTTP 200（release-assets CDN），2518280 B、SHA-256 `88afe0c20e52030218924ac37d0c81c59b4b5f3ae3752c8c6d7470c7d365886c` 与发行方 metadata 相符（此前标记"待实测"，本轮完成实测）。入口 `meson.py` 可直接源码运行，Python ≥3.10 由其自身强制（源码核对）；无 pip/apt/MSI。
3. **libcap-dev 1:2.66-5ubuntu2.4**：期望哈希来自 Ubuntu 已签名 noble-updates 与 noble-security Packages 索引（两索引同一 stanza；InRelease→Packages.gz 哈希链核对通过，且两份 InRelease 经 gpgv 验签通过——Ubuntu Archive 2018 密钥自 keyserver.ubuntu.com 取入本轮临时 keyring，未写全局信任库，来源如实记录）。rolling archive 与 pinned snapshot 双源字节一致：595634 B、SHA-256 `07f2462867569a2119a2ad0f1593232663f2d1612b791c230d22a8d73a15abee`。control 字段匹配；102 成员全审计（绝对路径/穿越/设备/越界链接均无）；`usr/include/sys/capability.h`、`usr/lib/x86_64-linux-gnu/libcap.a`（6 个 ELF 目标文件的真实 ar 静态库）、`libcap.pc` 实际存在；包内测试程序仅为数据，绝不执行；不运行 maintainer script。**发现并处置**：包内 `libcap.pc` 声明 `libdir=/usr/lib64` 与实际安装路径不符——脚本改为生成私有 .pc（绝对路径）并限制 `PKG_CONFIG_LIBDIR`，删除悬空 `libcap.so`/`libpsx.so` 开发符号链接，使 `-lcap` 只能解析到已审计 `libcap.a`。

## 候选与验证

`scripts/prepare-ci-bubblewrap.sh` 重写为三输入私有构建：每输入先哈希后解包；成员清单安全审计（含末行无换行仍被审计的真实修复）；一切在 `RUNNER_TEMP/dsh-bubblewrap-private/`；meson `-Dprefer_static=true` + 仅构建 bwrap 目标（tests/man/completions 关闭，SELinux 保持上游 auto——受限路径下 meson 明示未找到，匹配 Ubuntu AppArmor 平台）；`--verbose` 编译日志必须含引用私有 libcap 目录的真实链接命令；产物必须 `elf64-x86-64`、objdump NEEDED 与 ldd 均无 libcap、版本恰为 `bubblewrap 0.12.0`；源码/依赖/产物三组哈希分行记录；sysctl 策略与失败语义不变；**GITHUB_PATH 延至探针通过后发布**（新增回归）。预检工具缺失即明确失败，不自动安装。

- 回归：`scripts/prepare-ci-bubblewrap.spec.ts` 重写为 36 项（真实脚本 + 全替身：uname/curl/sha256sum/tar/dpkg-deb/python3/cc/ninja/pkg-config/objdump/ldd/sudo/bwrap）。
- 两个负控均被捕获并逐字节恢复后复绿：NC-bypass-hash（摘要门槛置空操作，3 项摘要测试击中）；NC-fail-as-success（探针 ` || true`，恰好击中 fatal-probe 测试且发布被检出的场景）。byte/blob/SHA-256 与突变副本入库。
- 门禁：`bash -n` 0；`pnpm run typecheck` 0；`pnpm run lint` 0（首轮 3 处 `@stylistic(quotes)` 改单引号后过）；jscpd duplication 0 clones；`test:docs`（doc-quick）16/16 PASS；新 Note 双语 pairing --write + 全量检查 0。
- 零变化证明：`.github/workflows/` 与 `ci-workflow.spec.ts` diff 为空（no-apt 断言原样）；五处调用点不改——脚本唯一发布面仍是一个 GITHUB_PATH 目录。
- 新双语 Note：`.agents/notes/implemented/process/2026-09-19-private-bubblewrap-ci-build-r48.md`（+zh+pairing）。

## 独立复审：有条件 PASS → 整改 → 增量确认无条件 PASS

- 全新上下文独立复审核心结论：三输入可信链独立重导一致、libcap.pc libdir 不符发现重导证实、339 行脚本逐行语义审读通过、零变化与 NOT_RUN 诚实性成立——**有条件 PASS，两项强制整改均在 spec 替身层，脚本与信任链零变动**。
- 缺口 1（假绿，约 3%/全量轮）：objdump 替身按整个 argv 子串分派，随机临时目录名含 `-f`（如 `run-fXy9Z8`）时 `objdump -p` 被劫持进 `-f` 分支、动态 libcap 检测静默跳过。修法：对 `$1` 精确匹配（`-f)`/`-p)`）并加显式拒绝分支；确定性复刻验证（`run-fXy9Z8` → P 分支输出 NEEDED）通过。
- 缺口 2（假红，约 2.5–5%/每条 deb 管道）：tar 替身 stdin 分支不读 stdin，pipefail 下上游 dpkg-deb 替身可撞已关闭管道读端，脚本以无诊断行的"rejected unsafe member names/metadata"假拒绝。修法：stdin 分支先 `cat > /dev/null` 排空再回放；200 次管道迭代 0 失败。
- 整改后：连续 5 次全量独立物理运行 36/36 exit 0（独立日志入库）；两负控在新字节重演均捕获 + 逐字节恢复 + 靶向绿（收尾全量 36/36 为第 6 连绿）；`bash -n` 0、lint 0 复验；脚本 SHA-256 `28d31aa9…d53a3` 与全部信任链证据逐字节零变动。
- 增量确认（全新上下文）：**无条件 PASS**——两项整改经定向复刻验证消除（含旧形态对照组复现缺陷、新形态 0 失败的判别性证明），其自跑全量 36/36 exit 0，稳定性与负控日志核实真实，MANIFEST/FINDINGS 刷新准确。

## 交付信息

- 提交：见下方"交付回执"（推送成功并核验后回填完整 SHA 与链接，不预造）。
- 固定标识：`scripts/prepare-ci-bubblewrap.sh` blob `7d2428e2fa84b7fda9aeec24fa1de661cb90cb46` / SHA-256 `28d31aa9fd7db6f848796feca43725bcd547bca268b56384d6f9ed89068d53a3`；`scripts/prepare-ci-bubblewrap.spec.ts` blob `91bcd7fa4833b8687ebf66e8a136a65fe0c78e66` / SHA-256 `8a36f0a700767434356ebe22283c378ce19c03cd51f4d2bcdd0482d527920e79`。
- 提交范围：上述两文件 + Note 三件套 + `development/remediation/2026-09-19/private-bubblewrap-build-r48/` 证据树（44 文件）。保留项（r47s/ 与 3 个 r44 原件）不入提交。

## NOT_RUN 边界（明确未做，不因交付关闭）

真实 Linux 编译/meson 配置/对 libcap.a 的真实链接（静态 ABI 契合）/真实 ELF·ldd·sysctl·bwrap 探针：本机 NOT_RUN（Windows，仅替身控制流）；**首跑真实验收归原 CI（ubuntu-24.04 hosted），以新 run/attempt/checkout 核验**。`sandbox.yml` 独立 apt-get 入口未迁移，全仓 CVE 未关闭；libcap 静态 ABI 与隔离行为以 CI 实测为准。代码完成不等于迁移已验收。

## 交付回执（推送核验后回填）

- 提交 SHA / 父提交：待推送后回填。
- push 命令与真实退出码：待回填。
- 两端 HEAD（本地 / 远端 ls-remote）：待回填。
- 固定新 SHA 下的链接核验（HTTP 200）：待回填。

证据：`development/remediation/2026-09-19/private-bubblewrap-build-r48/`
