# W13 — 固定候选指定硬审（CP3）启动记录

运行: B01-20260919-01 / W13。日期: 2026-09-19T19:11Z。执行者: ZCode（W13 硬审操作者；只写本 W13/ 证据目录与仓库外 raw）。

## 1. 冻结状态确认

- 候选: `9fec63de9056c140c155ab51da52a41b2fcd6a72`（本地 HEAD，未推送；`git rev-parse HEAD` 实测）。
- 分支: `chore/latest-stable-upgrade-20260912`。基线: `7f63d03538759306f8363d5a912c1e99fbe015bf`。
- 层次: 89dce53b80（CP-A4，manifest 对象）→ e1e31b080b（CP-A5 lint 微修复，14 文件——本文件初写误记 16，评审者实测更正，见 review/hard-review-round1.md 非阻断备注 3）→ 9fec63de90（冻结层：W12 产物+三组 Note+簿记，18 文件，全证据/文档面）。全量 7f63d035..9fec63de90 = 363 文件。
- 工作树漂移: 仅 keep-local 面（RUN_CONTEXT `worktree_classification` 在案）+ 本 W13/ 目录。实施者写入已全部冻结。

## 2. 提示词组装

- 底稿: `W12/hard-review-prompt-draft.md`（§2 正文）。
- 唯一占位符（§2.1 第 6 项 CP-A4 CI）已按总控给定权威结论填充: run `35460812553` gate 表 — test:expected PASS 92.05s / test:snapshot PASS 142.24s 五项清单 / prepare 管线四连证 / 唯一 lint 失败已在 CP-A5 `e1e31b080b` 修复（本地双 lint 变体 0/0，3615 文件，`W02/logs/mf-run-01/02-*.exit/.out` 实测 exit=0 复核）；候选冻结 SHA 9fec63de90。
- 按底稿 §3 检查清单第 2 项: 候选 hash 已由 89dce53b80 更新为冻结候选 9fec63de90，两层增量在提示词中逐一申报供评审者 git 复核。
- 追加操作约束段（r44-B round4 先例: headless 权限请求自动拒权并中辍）: 仓库内只读、禁 Write/Edit、校验 bash 内联、禁读密钥/.env、禁调用其他代理、不请求权限。
- 产物: `W13/review/hard-review-round1-prompt.md`，8887 bytes，SHA-256 `72a32c95fb584e0d26f96a5da42a16eef2abd7282a2ac38846a6e6c60c9876fd`。

## 3. 调用计划

- 程序: `C:\Users\Joyce Gu\AppData\Roaming\npm\node_modules\opencode-ai\bin\opencode.exe`，opencode-ai@1.18.31，SHA-256 实测 `0242a0dc705af67c90882b456a36b619883c1c786aad8fe071a1bc64e5d1d440`（与 r44b5 就绪核验二进制逐字节一致，179998248 bytes）。
- argv（逐字）: `run --model zhipuai-coding-plan/glm-5.3 --variant max --title b01-w13-hard-review-round1 -`（stdin 注入提示词）。
- 后台启动 + stdout/stderr 落盘 + 轮询（每次 ≤60s）；真实 exit、双流哈希、last-message 哈希独立归档。
- 工具链 PATH 前缀: `C:\dsh-r24-upgrade-20260912-01\node-v26.8.2-win-x64` + `C:\dsh-r24-upgrade-20260912-01\pnpm-12.4.1`（RUN_CONTEXT toolchain 在案；供评审者 bash 内联校验用）。
- raw 仓外目录: `C:\dsh-b01-w13\`（wrapper/双流原样归档）。

## 4. 裁决规则

输出第一行须为明确 `PASS` / `FAIL` / `BLOCKED`；exit 0 而无明确裁决不算 PASS。FAIL→逐条意见报总控安排返工（W13 期间本执行者不整改）；无裁决/中辍→按 r44 先例修操作约束重试（不换模型/不加费用）。
