# r44-B 双语修正轮独立审计记录（发布副本 v1）

归档者注（r44-B 最终收尾执行者，2026-09-18）：
- 性质：主会话委派、全新上下文、只读+验证性重跑的独立审计，2026-09-18，裁决 PASS；不构成、不替代指定 OpenCode 合规硬审。
- 生成方式：该审计当时仅存在于会话回执、未落盘；本文件由收尾执行者自所有者任务转达逐字转录落盘，不改实质。
- 审计对象：r44-B 双语修正轮（candidate-r44b5）证据集——63 项候选、r44-B 证据树、CLI/映射探测（41/42 号）、第四轮合规硬审（round4b）与权威评论核验。
- 逐字声明：除本头注外正文为逐字转录（含原有全角破折号与编号）；无占位符替换，发布副本不得称为审计方原始输出文件。

--- 以下为审计报告原文（逐字转录） ---

—— 0. 现场基线与红线全部成立：HEAD=e8d1858ca6a65710c346007e48809580f6064beb、分支 chore/latest-stable-upgrade-20260912、stash 空、reflog 自 2026-09-17 07:54 后零移动（无 commit/amend/reset）——未提交未推送；status 82 条=32 M+50 ??；-uall 111=63 清单文件+48 证据树文件，清单外零文件；评审时点恰为 109=63+46（多出的 2 条是评审 stdout 定格 13:28:48 之后归档的 round4.md 13:33:16 / round4-invocation.md 13:33:42，均在证据树内）；较上轮 +8（40/41/42 号+5 个 round4 系列文件）全在证据树；3 保留原件逐字节在位（32d2801d/f631f694/aacfedb6）。
—— 1. 双语修正最小性成立（字节级决定性证明）：当前 zh.md 24593B / blob 714564a8 / SHA 2e8fbd30… 与主张一致；仅撤销 L88 的 14 字节插入后重算得 24579B / a729da9c / 60497305 = r44b4 清单三元组——其余每个字节不变，单行替换数学上封死；en.md 24358B / 4f42fe34 / d459cf72 与 r44b4 完全相同（未动）；i18n.yaml c38a0c3e / fc840175，sidecar 记录当前真实 blob；复跑单对 pairing check exit 0（"1 named pair(s) consistent"）、全语料 pairing 846 对全一致 exit 0、git diff --check exit 0；全表对比（72 数据行 diff）仅 5 行差异且全为 declared-in 行号（zh=en−2）；internal/status 两侧含 agent-team 一致；5 个滞后行号属实且未修（活源码实为 types.ts:82 / index.ts:170/:144/:150/:161，与英文表一致，zh 表 :80/:168/:142/:148/:159 滞后）。
—— 2. 候选 r44b5 成立：manifest SHA-256 077ea3d4…（14227B）；63/63 三元组对工作区全量复算全符；与 r44b4 diff 恰 2 个数据行（#6/#7）+头部说明+重建 S3 表；61 行逐字节一致；旧 r44b4(74cc5349)/r44b3(b734dfc9)/r44b/38 号原样保留；重建八项表注明来源且诚实（回执评论实连确认其本无完整八项清单，仅 #5/#6/#7 三件套锚点）。
—— 3. CLI 与映射成立（亲测复现）：exe 179998248B / SHA 0242a0dc… / mtime 2026-09-17 10:16:11+0800（早于第三轮 15:52:23Z 调用窗）/版本 1.18.31；安装目录 Sep 17 12:00 后零文件改动；where.exe 解析到同目录 shim，无 PATH 影子；自己重跑 run --help：exit 0，--variant 在列（描述逐字同 41 号），stderr 与归档 cli-run-help.stderr 逐字节相同（d62299eb）；重跑 models --verbose：glm-5.3 variants {low,high,max}→{reasoningEffort:*}、reasoning:true（与归档差仅为 provider 新增 glm-5.3-highspeed 的外部目录演进，glm-5.3 条日本身一致，非篡改；归档 raw 自身哈希 543543c4 与记录相符）；exe 内嵌串证实 effort 结构与 values:[\"low\",\"high\",\"max\"] 编译实现；PARAMETERS_NONCONFORMING 未改写：round3-invocation 的 argv 原文无 --variant、round3.md 措辞原样、r3b 外部 stdout 6660B/2d080185/末行 PASS 与记录一致、回执归档+实连一致。
—— 4. 硬审 round4b 真实性成立：两次尝试 argv 逐字含 --variant max，无 --thinking/--auto/--yolo；attempt1（05:07:14–05:13:58Z，2042B/9a160a78）stderr 含逐字 external_directory (C:\\dsh-r24-upgrade-20260912-01\\*)；auto-rejecting 拒权实录并归档；attempt2（05:19:05–05:28:48Z，exit 0，stdout 10740B/9a09707c 末行"裁决：PASS"）全部哈希/字节/时间与记录一致；prompt 哈希 bf2447db/396a9949 与当前文件一致；round4b prompt 操作约束在案（仅限仓库内、不落盘、不读凭据、不调用其他代理），并明示第三轮 PASS 不得作前置；授权引文属实：registration.md L28"返工和固定候选硬审核"、L32"OpenCode zhipuai-coding-plan/glm-5.3、variant max 硬审核"原文在案；任务评论（实连）§B/C/D/E 逐点印证；r4b stderr 的 5 处 auth/env 匹配均为仓库源码行（npm_execpath 可行性检查），无凭据读取。
—— 5. 门禁增量替代合理且闭合：doc-sync 全量未跑已如实披露；独立复现评审引用的全部五个门且数字逐一吻合：pairing 846 对、md-wrap 1680、md-links 1671、doc-graphs 6/6、cordis-catalog 97，均 exit 0；结合字节级证明（vs r44b4 仅 2 文件变、非清单文件全在证据树），"其余门输入与 34/34 通过时全同"逻辑成立。
—— 6. 权威评论双重核验一致：无凭据 REST 实连两条评论成功：任务评论（5724697192，2026-09-18T03:26:40Z）§B 单行唯一锚点授权/§C 探测（明示勿以根 help 判定）/§D 映射/§E 命令含 --variant max；回执（5724684848，03:25:34Z）PARAMETERS_NONCONFORMING + BILINGUAL_MISMATCH 结论与归档逐点一致。
—— 缺口（不构成阻断）：推送状态无法直接网络核验（设计内不推送；HEAD/reflog 证明无本地提交）；评论实连为要点级比对（非全文逐字节），全部承重点已验证，本地 .json 归档可供字节级溯源；重跑 models 输出较归档多出 provider 新模型条目（外部演进）；41 号文件正文中有一处路径反斜杠显示剥损，纯排版瑕疵；未复跑全量 doc-sync（设计内），以五门独立复现+增量链闭合替代。
—— 裁决：PASS。
