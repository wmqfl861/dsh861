你是 dsh861 仓库 r44-B 轮次的指定硬审核者：真实 OpenCode CLI，模型 zhipuai-coding-plan/glm-5.3，variant max（既定安排，不更换）。本运行实际 argv 已包含 --variant max（完整记录于本轮 invocation，见文末）：opencode run --model zhipuai-coding-plan/glm-5.3 --variant max --title r44b5-hard-review-round4 -。CLI 的 --variant 旗标存在性与 glm-5.3 的 max→{reasoningEffort:"max"} 映射已由独立证据核验（windows-execution/41-r44b5-cli-variant-probe.md、42-r44b5-max-mapping.md），你无需重复该核验，但请在证据中注明本轮为参数合规调用。仓库 C:Albertprojectdsh861，分支 chore/latest-stable-upgrade-20260912，HEAD e8d1858ca6a65710c346007e48809580f6064beb。你的唯一任务：对下面的固定候选给出明确裁决 PASS、FAIL 或 BLOCKED，并逐项给出依据。你只读仓库与证据，不修改任何文件，不读取任何密钥/凭据/用户 .env，不调用其他代理。

【背景与本轮性质（参数合规返工硬审）】第三轮硬审（review/r44b-hard-review-round3.md）对该候选出具了 PASS，但事后核实其 argv 缺少 --variant（PARAMETERS_NONCONFORMING，见 PR #13 代发布回执）：PASS 文本与 exit 0 是真实运行结果，但不构成参数合规的指定硬审，不得作为本轮的正式前置。第三轮的技术核验（两 manifest 62 行逐字节一致、api-catalog.ts 三元组与 +6/−2 纯投影、63/63 三元组复算、git status 对账、git diff --check、gen-cordis-catalog --check、doc-sync 同款独立复跑 34/34）作为技术记录可复用：对零字节改动的文件其复验结论继续有效，可抽查、可复核，但最终裁决必须由你本轮对整个候选独立负责，不能引用先前 PASS 作为依据。

【本轮增量（r44-B 第五次分派执行者 r44b5 已执行；除下列两文件外候选 63 项其余字节与 r44b4 逐字节一致）】
1. 双语最小修正（授权来源：PR #13 issuecomment 5724697192）：docs/event-producer-consumer.zh.md L88 internal/status 行补入 agent-team（唯一锚点单行替换，+14 字节；24579→24593 bytes，blob a729da9c…→714564a8…，SHA-256 60497305…→2e8fbd30…），使中文行与英文 L86 一致；docs/event-producer-consumer.i18n.yaml 经 pnpm run verify-translation-pairing --write docs/event-producer-consumer.md 重录（英文 blob 4f42fe34… 未变）。证据：windows-execution/40-r44b5-bilingual-fix.md（含逐行内容对照：两表 74 个机器事实行中 69 行逐字节一致，internal/status 两侧含 agent-team 一致；新发现并如实申报、未修的既有问题：中文表 5 个 declared-in 行号引用相对英文/实际源码滞后 2 行——agent-preset/selected types.ts:80 实为 :82；subagent/end :168 实为 :170；subagent/provider-added :142 实为 :144；subagent/provider-removed :148 实为 :150；subagent/start :159 实为 :161。修复它们需重生成整表，超出本轮授权的单行替换范围，按指示列明不扩围）。你需判断该既有滞后是否阻断。
2. 重冻结：windows-execution/candidates/candidate-r44b5.md（63 项 = r44b4 的 61 行逐字节保留 + 上述两行更新；manifest SHA-256 077ea3d43b3900e584741b493e21d015d162a9e07f26801fab42353a4b553472）。文件内附 S3 八项追认表：#6 docs/event-producer-consumer.zh.md、#7 docs/event-producer-consumer.i18n.yaml 哈希更新，其余 6 项（#1 scripts/session-snapshot-corpus.corpus.ts、#2-#4 docs/config-catalog 三件、#5 docs/event-producer-consumer.md、#8 packages/extensions/tool-cordis/src/api-catalog.ts）逐字节不变（63 项三元组全量复算：恰 2 处不符即上述两行）。旧 manifest r44b4/r44b3/r44b、38 号 S3 申报均原样保留。
3. 本轮新增证据文件（非候选产品文件）：windows-execution/40-r44b5-bilingual-fix.md、41-r44b5-cli-variant-probe.md、42-r44b5-max-mapping.md。

【审核输入】最终完整候选 candidate-r44b5.md（63 项）；planning/plan.v1.md 与 supplement-planning/plan.v1-supplement-s1.md（计划与范围确认）；r44b-progress.md、windows-execution/FINDINGS.md（历史与处置）；历轮审核 review/r44b-hard-review-round{1,2,3}*.md（round1 F1 修复+S14、round2 实质验收独立复现+唯一阻断、round3 技术记录）；39-r44b4-gate-rerun.md（最终字节门禁：清单 63/63、gen-cordis-catalog --check 0、git diff --check 0、基础 40 40/40、owner-local 33/33、doc-sync 34/34）——生产/测试文件自 r44b4 起零字节改动，该等真实测试结果可复用；本轮 40/41/42 号证据。

【裁决要求】
1. 核对增量：candidate-r44b5 与 candidate-r44b4 的 61 行逐字节一致、两行更新与 40 号证据一致；zh L88 行与 en L86 行两侧一致且含 agent-team；sidecar 记录当前 blob；S3 八项表 #6/#7 更新与其余 6 项不变。
2. 判断申报的既有问题（5 个中文 declared-in 行号滞后）定性：阻断或非阻断，说明理由。
3. 抽查你选择的既有验收（建议至少：候选三元组抽算、git diff --check、gen-doc-graphs/gen-cordis-catalog --check 对英文表、S3 申报与追认边界）。doc-sync 全量复跑可选（约 200 秒）。
4. 对整个候选给出技术结论（计划符合性、范围、验证充分性、治理残余含 S3 追认状态与未提交事实），单独一行给出 PASS 或 FAIL 或 BLOCKED。只有当 63 项候选满足计划全部必需验收、双语差异已按授权修复、且申报问题处置适当时才可 PASS。

【操作约束（必读；headless 运行任何权限请求都会被自动拒绝并可能终止）】不使用 Write/Edit 工具向任何路径写文件；校验一律 bash 内联执行（node -e / node --input-type=module -e / heredoc 管道），输出打印在回复中，不落盘任何新文件；不读取密钥/auth.json/.env；不调用其他代理。

【本轮调用身份】真实程序 opencode.exe（opencode-ai@1.18.31，SHA-256 0242a0dc…）；argv：run --model zhipuai-coding-plan/glm-5.3 --variant max --title r44b5-hard-review-round4 -；输入为本提示词文件 stdin；完整 invocation（argv/双流哈希/exit/起止时间）运行结束后写入 review/r44b5-hard-review-round4-invocation.md 并归档于本轮结果。
