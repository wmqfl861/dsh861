# W13 硬审第一轮 — 裁决记录

运行: B01-20260919-01 / W13。评审者: 真实 OpenCode CLI（zhipuai-coding-plan/glm-5.3，`--variant max`，参数合规见 invocation）。对象: 冻结候选 `9fec63de9056c140c155ab51da52a41b2fcd6a72`（未推送）。时间: 2026-09-19T19:12:03Z–19:30:06Z，exit 0。

## 裁决

**PASS**

（原文首行: `**PASS**`。评审者同时声明: 本裁决针对候选与证据链质量；阶段形态维持 W12 自评的 PARTIAL_WITH_BLOCKERS，不将 U1—U3、A5 人验子路径或 CP-A5 推送后的 CI 再验证转为已关闭。）

完整逐字文本见 `hard-review-round1-stdout.txt`（8245 bytes，SHA-256 `e2ef34afdb4324840bf036d55a24f19571be699e9385b5488ff95a31aec71cad`；最终评审消息自 `**PASS**` 行起）。

## 八项审核问题结论摘要（详见原文）

1. **候选范围与保护面 — 通过**: 363 文件实测一致（CP-A4=338 / CP-A5=14 / 冻结层=18）；保护面 vendor/.github/packages 零命中、12 指纹全对、P0-B §3.2 勘误属实且字节未动；无密钥面；扩围均有登记。
2. **复核与返工闭环 — 通过，未发现弱化**: W01/W02/W06/W08/W03/W04/W11/W11-F/CP-A5 逐项核验；CP-A5 diff 实测恰 4 处 `?? ''` 移除、行为保持。
3. **负控链 — 有效，抽查可重放**: 突变体 SHA-256 逐字节重算匹配、恢复闭环在候选字节上成立。
4. **A1—A9 判定与证据相符 — 通过**: `product_accepted=0` 如实呈现；部分项均如实为部分而非掩盖。
5. **W12 组合核验充分 — 通过**: src 模式超时归因经 `loader-smoke/src/index.ts:28` 实证。
6. **CI 身份与结论 — 支撑成立**: run `35460812553`（merge `9ddc0cfe` 全树 diff 为空，最强级身份链）gate 表权威；G 群隔离成立；CP-A5 后再验证未被标绿。
7. **未运行项清单 — 完整、归因精确，无降级**。
8. **三组 Agent Note 忠实 — 通过**（事实与 FINDINGS 吻合，i18n 配对 blob 逐一实测一致）。

## 评审者随裁决提出的非阻断备注（供阶段报告/CP-F 吸收，不构成返工）

1. `W12/candidate-manifest.md` §2 标题"48 文件"应为 33（表列与总数 338 自洽，系算术混入的计数标注误差）。
2. `W04/platform-contract.md:23` 的 `.1.win32` blob 残留 2 字符转写错误（`…b2697761…` vs 实际 `…b0967761…`；同行 SHA-256 与各处记录一致）——B2 同类文档勘误。
3. `W13/00-start.md`（未跟踪簿记）"CP-A5 16 文件"实为 14 文件——W13 侧转写笔误，已在 00-start 补记更正，提示词原文按哈希冻结不改。

## 证据链

- 提示词: `hard-review-round1-prompt.md`（SHA-256 `72a32c95…c9876fd`）
- 调用: `hard-review-round1-invocation.md`（argv/起止/exit/双流哈希/HEAD 起止）
- 原文: `hard-review-round1-stdout.txt`（逐字节 = raw `C:\dsh-b01-w13\review-raw\stdout.txt`）
- raw: `C:\dsh-b01-w13\`（wrapper `run-hard-review-round1.sh`、invocation-meta.txt、stdout.txt、stderr.txt）
