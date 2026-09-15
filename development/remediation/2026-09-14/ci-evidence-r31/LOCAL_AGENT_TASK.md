# r31 本地任务：应用并验证三个定向候选

仅操作 `C:\Albert\project\dsh861`、`wmqfl861/dsh861`、`chore/latest-stable-upgrade-20260912`、草稿 PR #13。r30 最终基线为 `201206cb4c83581b3d44620831434fbf2e337df9`。远端本轮没有新提交或 PR 更新；不要寻找不存在的 r31 远端取件 SHA，也不要退回 ed277。先检查工作树及远端，只安全快进；发现后续工作必须保留、审阅，不 reset、强推、自动 stash。

## 取件及证据

本任务和实现候选位于用户提供的 `dsh861-r31-candidate-bundle.tar.xz`。在新建空目录安全解包，核对外层 SHA-256 和 SHA256SUMS.json 的所有成员；拒绝绝对路径、父目录跳转或符号链接，不覆盖用户文件。若包未提供，不请求 Token 或从不相干位置找同名文件；按本轮用户转达提示词中的三项精确修复实施，并把未导入的远端原始证据如实记为未本地核验。

阅读 READOUT.md 和适用 AGENTS。可运行 `python verify_artifacts.py` 重新核对原始三个 ZIP；它会把 consumers 的 aggregate 不匹配与字节完整性通过分开报告。不要把内层 node-compat 的 4/0/0 宣布为外层 consumers 成功。

完整证据可归档到 `development/remediation/2026-09-14/ci-evidence-r31/remote-intake/`，仅复制经检查的自有包成员，不覆盖旧轮任何记录。保留远端取件/实验与本机验证的来源区别，不把完整 ZIP 清单套在仅摘录的 evidence/ 上。注意容器实验使用的 native TS stripping 只属于隔离机制实验，产品/仓库 source 测试仍用既有 tsx/Vitest 入口。

## 已写好的候选

包内 prepare_candidate.py 只读取 Git，输出补丁，不改工作区。以仓库为 --root，以新建外部文件为 --output 运行；不要写入已存在的补丁文件。它要求 201206cb 为当前 HEAD 祖先，并核对四个目标文件的固定完整 blob。若源码已移动或脏文件导致拒绝，不绕过检查；将具体差异与候选合并，不覆盖新工作。

审阅输出，先 `git apply --check <patch>`，再 `git apply <patch>`。候选不是已通过全仓验收的源码；必要时在最小范围修正集成问题。四个目标及输入 blob：

| 文件 | 输入 Git blob |
|---|---|
| scripts/gate-evidence.ts | 7c18cedd65ab584918445af20a6bbf530ebfb9d8 |
| scripts/run-gates.ts | ac47eea702ddf81d6818af4c3a03c283c1d662c7 |
| scripts/gate-evidence.spec.ts | 7cf828510ed6750d5dba37a21d6a50e24343f938 |
| packages/typert/generator/tests/__snapshots__/type-model.spec.ts.snap | da7510736be4e53fd5696bc8662485015387ef11 |

F1：保留只读 gateEvidenceRequest，新增 claimGateEvidenceRequest；只在 main 中调用 claim，取得 request 后从当前 CLI 的环境删除 DSH_GATE_EVIDENCE_DIR。不要枚举/复制秘密环境，不改变其他身份字段。保留目录拒绝覆盖、安全导出和退出码行为，不用删目录或放宽 if/allowFailure 修补。不改 runGate 的子进程调度、输出归属、超时或测试选择。

F2：先对安装依赖解析与现有锁核实 Zod 4.6.2，并仅运行 type-model.spec.ts 中 `builds independent face models with an explicit cross-face type graph`，保留旧快照失配。应用候选后只允许一处完整 external symbol 路径中的 zod@4.4.3→zod@4.6.2；再运行同一用例，保存实际结果。不能 -u 全刷、不删除 symbol、不改 normalizer/分析器/模型 goldens/锁文件。若还有非版本差异，保留并另行定因，不机械接受。

F3：用 `git cat-file commit HEAD` 读取原始 commit 头，只解析第一个空行之前的 parent 行；保留 headParent，新增 headParents 保存全部父提交。用自建的本地 file:// depth=1 双父 fixture 验证，不为此重克隆用户项目、不抓取全仓历史。commit message 中假的 parent 行不能进入数组。新增 spec 也要在 Windows 实跑。

## 本机验收

运行受影响的 `scripts/gate-evidence.spec.ts`、`scripts/run-gates.spec.ts`、`scripts/ci-workflow.spec.ts` 和上述一个 Typert 目标用例；不运行全量 coverage。原 r30 WMI/PowerShell abort 用例抖动保持既有证据，不能把本轮的新失败直接归类为同一问题；必要时只做最小 A/B，不用 sleep 或调大 90000ms 等参数造绿。

候选包含五个新增用例，核对真实执行和实际项目数，不预填通过计数。重点证明：只读解析仍可用；claim 只消耗目录开关；未设/为空零行为；真实子进程在三种嵌套模式下不继承外层目录；外层错误码和失败日志仍存在；浅克隆两个父提交可读且不混入消息文本。还要检查 main 确实使用 claim，而非只测试一个未接线的 helper。需要真实 CLI 嵌套 fake-gate 证据时复用现有测试入口/脚手架，不为了验证一个目录变量而重跑完整 consumers 构建。

完成受影响类型/lint/docs和必要双语 Agent Note/配对，更新现行 handoff：r30 已接收，新 CI 已生成及下载核验，但 consumers 归档聚合不匹配、coverage 首失已定因，r31 源码等待独立复审及新 CI。修复证据添加到 r31/windows-execution/，按既有归档和脱敏规范；源代码和证据整理全部完成后，交全新上下文独立复审，整改到 PASS，正常 hooks 提交、非强推同分支。

PR_BODY.md 是准备好的正文更新材料，不是已发布正文。只能使用已有合法写能力更新；本机没有 gh 时不安装、不申请新 Token、不读全局认证，正文未更新须如实记录，不因此阻断源码验证和正常 Git 推送。回传真实 SHA，远端可用的读取/下载通道能核对后续 CI；不要替尚未发生的 CI 生成或下载阶段宣布通过。

## 不变边界

不改 CI needs/runner/权限/分支保护/覆盖率阈值/分区/并发预算/90000ms/continue-on-error/test selection。不机械重跑 Gateway212、Loader122、exe/wheel 矩阵、整轮升级或六个已知 Windows golden 失败，不改 r29 的 ACP/built-lib/1000ms-60ms/expect(2)。不读生产 Key、不调用真实模型、不改受保护配置/P0-B state/pkg 补丁/锁/旧回执，不改系统安全、不用 Remote Desktop Commander、不操作其他项目。PR #13 草稿和 base 不变，不合并、不验收 P0-B、不进 P0-C。普通独立复审不冒充指定规划或硬审核。
