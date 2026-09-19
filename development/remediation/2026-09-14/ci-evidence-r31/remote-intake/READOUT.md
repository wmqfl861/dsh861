# r31：真实 CI artifact 核验与定向修复候选

接收仓库 `wmqfl861/dsh861`、分支 `chore/latest-stable-upgrade-20260912`、草稿 PR #13，源码基线 `201206cb4c83581b3d44620831434fbf2e337df9`。用户转达 r30 整改复审 PASS，按用户转达接收；本报告不是远端 Windows 复跑或指定 P0-B 硬审核。

## 已执行与未执行

远端已实际下载三个诊断 ZIP，检查 ZIP 摘要、长度、CRC、安全成员名、无重复成员、manifest 文件集合以及清单内 14 个文件的 SHA-256/字节数，全部匹配。身份核验覆盖 repository、PR、run、attempt、job、PR head/base、实际 checkout 和平台。见 [可重算回执](artifact-audit.json)、[便携核验程序](verify_artifacts.py)和 [便携程序实跑](evidence/portable-artifact-verification.json)。原始 ZIP 保存在 [artifacts](artifacts/)；evidence/ 中前缀命名的 manifest 是原 ZIP 的清单，不是该 evidence/ 目录的清单。

CI run `34799140559`，attempt 1，最新元数据的 run number 为 19，结论 failure，head 为接收 SHA，checkout 为 `d1ee13a76acd0cbee2f135fd546dab336e77ab72`。Git Data API 独立读回两个提交的 tree 均为 `f5ad1b2da2bd2cfd002b59e71df5a13e6d4a660f`，所以此次合并 checkout 与接收源码文件树一致。合并提交两个真实父提交是 `5434305c5dcf7ddc3ebf939226647b7b608335e6` 和接收 SHA；这是 API 补充证据，不是包内原本已经记录完整父链。

本轮没有新增远端提交、没有更新 PR 正文、没有重跑 CI。本会话实际暴露的 GitHub 工具只支持读取/下载；搜索现有插件也未取得写入动作。容器没有 gh/pnpm 或完整工作区，原始源码直连下载失败。未读凭据、未申请新 Token、未借用 Remote Desktop Commander。材料保存在交付包内，由本地通过正常验证、独立复审和 Git hooks 入库，不伪造新的取件提交 SHA。

## F1：consumers 归档被嵌套 aggregate 抢先写入

consumers ZIP 的文件哈希正确，但 identity.aggregate 和 gate-results.aggregate 都是 `node-compat`，summary 是 4 passed / 0 failed / 0 skipped。这不是外层 `ci-consumers` 的失败证据，不能据此宣布 consumers 成功。外层原始 job 日志的两种读取尝试分别得到空文本和 404；没有取得可用于修复外层业务首失的完整日志。

固定源码中 main 调用只读的 gateEvidenceRequest，runGate 用 `{ ...process.env, ...gate.env }` 启动子进程，而 ci-consumers 会启动 check:node-compat 等嵌套 aggregate。它们继承同一 DSH_GATE_EVIDENCE_DIR；内层先导出后，外层遇到保留的“拒绝非空目录”检查。源码机制与包内聚合名称一致。

[隔离实验](probe_nested_owner.mjs)实际启动 Node 子进程，使用固定源码的解析函数片段及候选 claim helper，并以小型文件写入器模拟非空目录前置条件：三种内层模式（node-compat、ci-lint-contracts-ready、同名 ci-consumers）在旧行为下均抢先写入，在候选行为下均不启用导出，外层能保留失败记录。另核对开关未设/为空不变，以及不枚举其他环境变量。见 [结果](evidence/nested-owner-proof.json)。这是机制实验，不是完整仓库 main/exporter/调度器集成测试。

候选新增 claimGateEvidenceRequest：调用原只读解析器取得 request，只删除当前 CLI 进程环境中的目录开关；request.directory 和白名单身份元数据仍可使用。main 改用 claim，子进程自然不再继承目录开关。不删除非空目录保护，不修改 runGate、调度、GateResult、退出码、工作流上传条件或测试选择。

## F2：coverage-exempt-heavy 的版本化外部路径快照失配

两平台真实失败日志都指向 `packages/typert/generator/tests/type-model.spec.ts:195` 的 WorkspaceAnalyzer 用例，差异仅为 ReexportedZodType 的外部 symbol 路径由 `zod@4.4.3` 变成 `zod@4.6.2`。固定快照中旧完整字符串只有一处；该包 devDependency 为 `zod: ^4.6.2`，CI 实际输出对应 4.6.2。测试文件在接收 SHA 和 checkout merge SHA 的 blob 同为 `9208fc02e48c6b739ffc103c6c12f7978b0838d8`。见两份 [Linux](evidence/linux-coverage-failure-excerpt.log)和 [Windows](evidence/windows-coverage-failure-excerpt.log)摘录及其 origin.json；摘录不是完整原始日志，原始字节仍在 ZIP 中。

Linux exempt-heavy 报告 2452 passed / 2 failed / 78 skipped，Windows 报告 1642 passed / 2 failed / 96 skipped。每个平台的两次失败来自两个 Vitest project；不是两个独立 Zod 根因。两个 aggregate 都为 1 passed / 1 failed / 1 skipped；coverage 被 fail-fast 标为 skipped，原记录 aborted=false、exitCode/signalCode=null、error 明写 aborted by fail-fast。按实际字段保留，不把它改写成 SIGTERM 或完整覆盖率阈值不达标。

候选只替换快照中那一个完整版本化路径字符串，不使用 -u、不改 normalizer、不删除 external symbol、不改 WorkspaceAnalyzer、版本锁或模型 goldens。实际 WorkspaceAnalyzer 测试、安装解析值与完整差异仍须本地验证；远端没有执行该测试。

## F3：浅克隆父提交读取缺失

三个 ZIP 原始 identity.git.headParent 都是 null。现有代码通过 `git show --format=%P` 读取父提交；已有证据 spec 却依赖当前检出一定能返回非空父提交。远端 [隔离 Git 实验](probe_shallow_parents.py)在自建本地仓库产生双父合并提交，再经 file:// depth=1 检出，实测 %P 为空，而 `git cat-file commit HEAD` 的存储头仍含两个父提交。不访问网络或用户工作区。见 [结果](evidence/shallow-parent-proof.json)。

候选改为只解析原始 commit 的头部，遇到头部/消息的空行即停止；保留兼容字段 headParent，同时新增 headParents 数组保留全部父提交。新回归用浅克隆双父 fixture，并在 commit message 中放一个假 parent 行，证明不会把消息当成父链。无需 fetch-depth=0、下载历史、修改 runner 或更改权限。

## 候选交付

[candidate-replacements.json](candidate-replacements.json)已写好四个文件的具体替换与五个新增 spec 用例：gate-evidence.ts、run-gates.ts、gate-evidence.spec.ts、type-model.spec.ts.snap。固定输入 blob 来自 GitHub 文件读取元数据；[prepare_candidate.py](prepare_candidate.py)在本地重新计算完整 Git blob、拒绝源码移动/脏文件/缺失或重复锚点后，输出普通 unified patch，不修改工作区。程序的 [合成 Git 仓库自测](evidence/candidate-generator-proof.json)证明只读生成、补丁可应用及拒绝路径/脏文件/重复锚点；它不能替代真实仓库应用检查。新增 TypeScript 测试块仅作过语法解析，尚未在 Vitest 执行。

执行入口为 [LOCAL_AGENT_TASK.md](LOCAL_AGENT_TASK.md)。已有实现不是待重复建设的框架；本地只需审阅候选、作必要集成修正、定向验证、独立复审和正常提交。原始日志、回执以及 r30 本地 PASS 均不改写。新 CI 尚未发生，不将候选视为已通过。

## r30 勘误接收与边界

r30 本地指出前一份远端记录中的 r29 日志 blob、33/27/6 计数，以及两个额外路径差异分类不匹配本机归档。撤回这些未经正确字节核验的远端断言；本地记录是 13 tests / 7 passed / 6 failed，并确认 shell/命令/换行差异。此处接收勘误，不要求重跑六例，不扩大 normalizer，不补造历史材料。

本轮有限签名扫描覆盖三个 ZIP 的全部 17 个 UTF-8 成员，识别的 token 形态、未遮罩认证行及个人目录形态均零命中，见 [扫描范围与结果](evidence/artifact-pattern-scan.json)。这不是所有可能秘密均不存在的证明。外层交付 tar 的 uid/gid/mtime 为 0、uname/gname 为空；嵌套原始 GitHub ZIP 保持原字节，不重写其时间或内容。

P0-B 仍未验收，PR #13 保持草稿和既有 base，不合并、不进入 P0-C。不读生产 Key、不调用真实模型、不动受保护模型配置/P0-B state/pkg 补丁/锁/封存证据，不改系统安全设置，不使用 Remote Desktop Commander，不重跑 Gateway212、Loader122、exe/wheel 矩阵。其他工作流首失未在本轮定因，不据此修改权限或分支保护。
