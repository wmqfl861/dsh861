# B01 W00 指定规划者调用证据（真实 Codex CLI）

记录性质：本文件是 2026-09-19 B01-20260919-01 W00 正式执行计划调用的一次性证据登记，只记录实际发生的事实。规划文本本身见同目录 [formal-plan.v1.md](formal-plan.v1.md)；本文件不以提示词或模型自述替代调用证据。

## 1. 调用身份与工具

| 项目 | 事实 |
|---|---|
| 工具 | Codex CLI（npm 全局 shim） |
| 解析路径 | `command -v codex` → `C:\Users\Joyce Gu\AppData\Roaming\npm\codex` |
| 版本输出（逐字） | `codex-cli 0.155.0` |
| 模型 | `gpt-6-astra`（stderr 横幅 `model: gpt-6-astra`） |
| 思考等级 | max（stderr 横幅 `reasoning effort: max`；argv `-c model_reasoning_effort="max"`） |
| 沙箱 | read-only（stderr 横幅 `sandbox: read-only`） |
| 批准模式 | never（stderr 横幅 `approval: never`） |
| Provider 显示名 | stderr 横幅 `provider: my gpt` |
| 会话 ID | `01a0b94f-56e0-7730-a410-8613eb9ae84f` |
| 工作目录 | `C:\Albert\project\dsh861`（`-C` 参数） |
| 宿主 shell | Git Bash（win32 10.0.26200 x64） |
| 子进程 PATH 前缀 | `C:\dsh-r24-upgrade-20260912-01\node-v26.8.2-win-x64` + `C:\dsh-r24-upgrade-20260912-01\pnpm-12.4.1`（仅环境前缀；codex 自身经系统 PATH 解析） |

## 2. 完整 argv（逐字）

```text
codex exec --model gpt-6-astra -c model_reasoning_effort="max" --sandbox read-only -C "C:/Albert/project/dsh861" -o "C:/dsh-b01-w00-codex/last-message.txt" - < C:/dsh-b01-w00-codex/b01-w00-codex-prompt.txt > C:/dsh-b01-w00-codex/codex-stdout.log 2> C:/dsh-b01-w00-codex/codex-stderr.log
```

- 提示词经 stdin（`-`）送入，来源文件 `C:\dsh-b01-w00-codex\b01-w00-codex-prompt.txt`（7,469 字节，SHA-256 `062125095a2acbb4a27fdeff470b52b10823305b6a3f5617dc5b33680174f7ff`）。
- `-o/--output-last-message` 把最终消息写入 `last-message.txt`；该文件已逐字节复制为 formal-plan.v1.md（见 §5）。
- 调用方式：后台启动，stdout/stderr 落盘，轮询推进（每次等待 ≤60 秒），全程未同步阻塞。

## 3. 运行时间与退出码

| 项目 | 值 |
|---|---|
| 开始（UTC，落盘） | `2026-09-19T10:56:18Z`（本机 +08:00 18:56，与进程 StartTime 18:56:19 一致） |
| 结束（UTC，落盘） | `2026-09-19T11:26:31Z`（本机 +08:00 19:26） |
| 时长 | 30 分 13 秒 |
| Codex 真实退出码 | `0`（`C:\dsh-b01-w00-codex\exit-code.txt`，由包装 shell 在 codex 退出后立即写入） |
| tokens used | `251,364`（stderr 结尾逐字） |

后台包装 shell 自身的退出码不作为 Codex 退出码；本表退出码取自 exit-code.txt 的真实捕获。

## 4. 输出证据（仓库外 raw 目录 `C:\dsh-b01-w00-codex\`）

| 文件 | 字节 | SHA-256 |
|---|---:|---|
| `b01-w00-codex-prompt.txt` | 7,469 | `062125095a2acbb4a27fdeff470b52b10823305b6a3f5617dc5b33680174f7ff` |
| `codex-stdout.log` | 64,103 | `061c4065596ef2e773e9876ccc2fb743f4b25b04a16c534fc1a24875ed4c5d11` |
| `codex-stderr.log` | 1,023,439 | `cb5f5ff3bc37afe85c6c6a499b2e93be253fe30b4351fbe0cb288afcd3db7267` |
| `last-message.txt` | 64,102 | `70d56121797715ae85742822735993da16b7b44eb45dc385908a3141df3a4fc9` |
| `start-time.txt` / `end-time.txt` / `exit-code.txt` | 21 / 21 / 2 | （时间与退出码原文见 §3） |

stderr 头部逐字含横幅各身份行（§1）；提示词全文逐字节嵌入 stderr 的 user 回合，可由哈希与字节比对复核。stdout 为 64,103 字节（= last-message 64,102 + 尾部换行），与最终消息一致。

## 5. 计划落盘

- `development/delivery-runs/B01/B01-20260919-01/plan/formal-plan.v1.md`：64,102 字节，SHA-256 `70d56121797715ae85742822735993da16b7b44eb45dc385908a3141df3a4fc9`，由 `last-message.txt` 经 `cp` 复制，`cmp` 字节等同（BYTE-IDENTICAL）。
- 计划文首自述"不以模型自述证明调用身份"，身份以本文件为准。

## 6. 输入计划包身份（规划所依据的版本）

HEAD `f5ab2fed621988c559b1c7299a60562bba558e96`（采纳提交）下 `development/delivery-plan/` 14 份文件与两份运行记录的 SHA-256：

| 文件 | SHA-256 |
|---|---|
| 00-README.md | `64f222313374d46de1463b9c3bf555a8051022083e358d3a1aeb87777c07bd87` |
| BASELINE.md | `27446c27cd3a8893e023d4b10429a33d911712273861b79939d7c6e0a77fb5b6` |
| SCOPE_AND_AUTHORITY.md | `5090f6f64b6fe0de293886f8714f777a0a49051ed2c0dc76e1dcd766e79987d3` |
| EXECUTION_PROTOCOL.md | `ebd6f455cabe6605c0b7fef4906ee86d91ff2e889e872b296db3bf04dae190c1` |
| PHASE_B01.md | `ef33401cc0ee0c67ea1a40235215b93385c709c2b0195e646579911a09473f75` |
| WORK_PACKAGES.md | `833c75badb6a30bf871ec49f3cc2e12aa3d378a10d34a47218f79b9eb2ed61f0` |
| PRODUCT_BLUEPRINT.md | `9095ecfcdf701b27fdd57b7a71234538e9ac433fbf623d3d45f23f8b77d33c6a` |
| REQUIREMENTS_MATRIX.md | `dc8df12b13fbea4e2e96bcc155f191f3d3e2938745eda74879433c42b855fe79` |
| REVIEW_AND_TESTS.md | `7bea0bc3b394e9fe38e510078b19f6b413d288c6047146e427e57267beb444f0` |
| RESUME.md | `d8bcf539fc33f1e813375f0bb50eded3e31d941e6ac1134005fade30e36ec025` |
| DISPATCH_TEMPLATE.md | `94fd90d5f8810ddb7f7a005f4d78cb3f917f7f121bd8de0b5d7dd3782ac8a5f6` |
| LOCAL_AGENT_PROMPT.md | `d45a4c4136b4e9ec2b58dbdb171dbbedf4cba11cc618204739fb84b6289a7958` |
| REPORT_TEMPLATE.md | `b5f08d471b569fbc8011eaa3e89aeb2a5576bcf0d7fd546303caf922919998b4` |
| DEPENDENCIES.json | `da351d63dc33b5042cc50f5b2f1487289d88a3548de2c04f20d88bdf457e94b0` |
| STATUS.json | `813b5e520911bdbc1b2182430be3f6b322a7f7b1f5eeaf99c076ec2c0e778c32` |
| ../delivery-runs/B01/B01-20260919-01/RUN_CONTEXT.json | `7b4298396ae68991d9da9b148ef90d80bd8b8ee1e7cad1a1e26cb1e85ae7d113` |
| ../delivery-runs/B01/B01-20260919-01/STATUS.run.json | `91c411e5e6c58c7da96cd7e9780a463d365ac63b54993c91e81cd1cdbc0a4d21` |

## 7. 调用过程遵守的边界

- 只读沙箱：Codex 未修改仓库任何文件；本侧未提交、未推送、未运行测试或构建。
- 未读取任何密钥、凭据、`.env`、`auth.json` 或用户全局配置；未调用 `git credential fill`。
- 授权来源：节点开发规则与所有者既有授权（沿用，不新增费用权限）。
- raw 证据目录在仓库外（`C:\dsh-b01-w00-codex\`），仓库内仅保存 formal-plan.v1.md 与本文件两个新增交付文件。
