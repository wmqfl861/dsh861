# r29 本地执行：接收已提交修复，闭合剩余真实门禁

只操作 `C:\Albert\project\dsh861`、仓库 `wmqfl861/dsh861`、分支 `chore/latest-stable-upgrade-20260912` 和草稿 PR #13。这是 r29 接续，不是重复 r27/r28。先读适用 AGENTS 与唯一现行 handoff。

## 一、取件与完整性

r28 固定基线：`ccc5aa51d50fb4e51c3a89658db8d769811221d4`。
r29 源码修复提交：`321172e13c0962fdb3c745f2e3317015fc5802fb`，其后本任务所在提交只更新交接与证据。

先 `git status --short`、`git fetch origin chore/latest-stable-upgrade-20260912`，核对当前分支/历史，再安全 fast-forward 接收包含本任务的固定提交。不要 reset、强推、自动 stash、覆盖已有修改或重复 clone。后续新提交需保留并审阅整合；不要回退到 321。

完整性核对：

- `git merge-base --is-ancestor 321172e13c0962fdb3c745f2e3317015fc5802fb HEAD` 应成功。
- `git ls-files --stage -- apps/cli/tests/profiles/acp/cordis.yml` 应为 mode `100644`、blob `2a4483236bc2e2d05b4f6fc5f7192eeddf010cf9`。
- `git rev-parse HEAD:packages/api/remotes/tests/built-lib.e2e.ts` 应为 `c44e5339057d61c7fe9fb1d6476dec9c323016e5`。
- `git rev-parse HEAD:scripts/cordis-config-files.spec.ts` 应为 `ea6350ce943f94296903ac3f0f4b539e2f9e3450`。

以上源码哈希适用于本交接提交；如接收额外后续修改，逐项审阅差异，而不是覆盖恢复旧哈希。没有待应用的 patch，禁止重复应用 gateway-scope-r27/changes.patch。

## 二、已做完的内容与证据界限

ACP 文件原为 Git 120000，但内容是 YAML `- path: ...`；已改普通文件并保留 include 目标。新增索引模式回归，防止 Windows core.symlinks=false 把错误掩盖成可读普通文件。不改变本机 symlink 设置。

built-lib 只新增脚本内 Symbol，并将 identity 读取与 Context extend 改用该键，+3/-2；运行时、HTTP、业务参数与所有原断言保持不变。

远端执行了四组真实隔离 Git checkout，见 `git-mode-proof.json` 和 `probe-git-mode.py`；它们是 Linux 容器机制复现，不是 Windows 全仓测试，不要在本机提权以重复这些实验。

新 CI run `34768688465`（run 15）的 static job `103754182530` 已实绿：Node26.8.2/pnpm12.4.1，47 passed / 0 failed / 0 skipped。checkout 为 `7187c6f70dcea5df7917105a5857a944b38c6f79`，合并 321 到 PR base `5434305c5dcf7ddc3ebf939226647b7b608335e6`。摘要与明确摘录在 `ci-followup.json`，不是完整原始日志归档。

远端没有完整依赖环境，未执行本地 hooks、完整 Vitest 或独立硬审核。static 成功不能替代 built-lib 运行，也不能把其他尚未结束/失败作业标绿。

## 三、本地定向终验与独立复审

复用项目 Node26.8.2、pnpm12.4.1 和现有依赖，不降级或改全局工具。沿现有脚本/Vitest 项目入口运行：

1. `scripts/cordis-config-files.spec.ts`，应实际执行新增回归与原 glob 用例；运行 `scripts/verify-cordis-config.ts` 的既有入口。
2. 沿项目现有 build 入口准备真实生成产物，运行 `packages/api/remotes/tests/built-lib.e2e.ts`。必须实际启动 plain Node、加载生成 Host/Client bundle、走 loopback HTTP 并通过原断言。requiredArtifacts=false 或 Vitest skipped 不算通过。不要为验证此夹具再重做已经绿的双平台 exe/wheel 全管线。
3. 运行本轮受影响的 typecheck/lint/test:docs 与适用文档规则；正常 pre-commit/pre-push，不关 hooks。新增非平凡修复按原要求写双语 Agent Note并定向生成配对，不做无关全量格式改写。
4. 交给独立子代理复审实际 diff、执行证据与保护范围，不用作者自检冒充独立审核。候选此前尚未取得该审核。

## 四、consumers 的第三个请求：先留证再修复

基线 run `34765078459` job `103744493702`：
`apps/cli/tests/profiles/headless/tests/headless.expected.e2e.ts` 的 `keeps provider comments alive and sends DeepSeek defaults through the one-shot app` 预期 2 次请求却收到 3 次。远端已核对实际源码 blob `48ea951be09b747f888b0545f8e7af10d628212a`，测试用 loopback mock 和假凭据，不需要真实 Key。

先对新 run 15 consumers job `103754182474` 核对首失是否仍同一处，再定向复现。记录 mock-only 请求顺序、max_tokens/model/stream/消息数、主请求或标题请求分类，以及相应 session retry/title 调度事件。诊断写独立日志或 Vitest 断言说明，不污染被比较的 CLI stdout，不记录真实凭据或全局环境。

按真实证据区分主请求重试、标题重试、重复调度或其他来源；这些仅是排查方向，不是已确定根因。保留一次主请求+一次标题请求的契约，不能把 expect(2) 改成 3、>=2、只过滤后数数，不能加任意长 sleep、吞重试、刷新 golden 或关闭标题功能来造绿。先复现，后在真实拥有者处最小修复并补负向回归，再跑原测试与必要关联范围。后继 fail-fast 未执行的 consumers 门禁单列。

## 五、coverage 日志身份：不得重复错误诊断

远端拿到的基线 coverage 日志存在源码路径不匹配：

- Windows job `103744493830` 报 `packages/api/gateway/tests/gateway.spec.ts`，但基线 Git 树无该文件，实际为 gateway.client.spec.ts / gateway.host.spec.ts 等；r27 在 gateway.client.spec.ts 的 fixtureContextTag 修复及调用次数断言仍在。
- Linux job `103744493809` 报 `packages/fs/tool-present/tests/present-open.host.spec.ts`，但该包基线树实际测试为 present.spec.ts、built-errors.e2e.ts。

这些响应未被用作修改依据，不能据此宣称 Gateway 再退化或直接补猜测的 mkdir。见 ci-followup.json 的排除记录。

使用已有授权能力获取原始 run/job/attempt/checkout 匹配的日志；核对 merge commit、真实文件、用例名与必要的 source map。已有 gh 可用就用，不安装/索取新 Token，不读取全局凭据。不能取得时如实记录，并在本地只复现当前源码中实际存在的用例，不把不匹配日志改名成可信日志。

新 run 15 的 Linux coverage job `103754182349`、Windows coverage job `103754182491` 截止交接读取时仍执行中。接续时读取当时真实状态，只有来源匹配后才修复。Linux 专属能力交由可用 CI，Windows 结果不冒充 Linux。fail-fast 后 partial coverage 合并值不代表完整覆盖率，不能降阈值或减少分区/用例求绿。

## 六、记录、轻微发现与交付

追加证据至 `development/remediation/2026-09-13/ci-gates-r29/windows-execution/`：真实命令、SHA/工具版本、逐项结果、原日志和退出码、独立复审、未执行及原因。先检查并脱敏后入库；如制作归档，沿已确立的账号名扫描和归档头规范，不把摘录标作原始日志。

r28 F1/F2：核对本机两处陈旧日志文件名，更新当前引用/追加勘误而不覆盖封存日志。F3 已补记基线 static 红，并记录 r29 新 run 实绿。F4：有原始修复后本机47/47日志就归档；没有则明确缺失，不能把 r29 CI 摘录冒充 r28 本机日志。

同步唯一现行 handoff 的已完成/仍失败/未运行清单。PR 正文远端已经有写权限且已更新，不再要求用户粘贴旧 pr-body-r28.md；执行方有已有权限可更新新结果，无权限就入库待远端处理，开发不以获取新 Token 为前置。

正常提交并非强推同一分支，返回真实最终 SHA、固定证据路径、实际通过数、完整失败和未执行清单。远端证据伴随提交可能触发新的 CI；321 的 static 成功不得冒充后续提交所有检查成功。

不机械重跑 r27 Gateway212、r26 Loader122、全部升级调查或已绿打包矩阵，除非新改动影响到它们。Issue policy、Issue lifecycle、Build PR preview 的独立失败暂未归因，不通过修改权限、分支保护或移除检查掩盖。

## 七、硬边界

模型配置两文件、provider/endpoint/思考等级/credentialRef、P0-B state、pkg 补丁、依赖锁和历史证据保持不变。确实需要扩大此范围时先精确报告阻塞，不暗改。不得读生产 Key、登录或调用真实模型、发布生产包、修改全局工具/账户/ACL/注册表/防火墙/WFP/UAC、启用本机 Developer Mode、部署 runner、使用 Remote Desktop Commander或操作其他项目。已有 CI 临时机器的既有准备步骤不等于授权改用户本机。

Windows CSPRNG 同类子进程及 present-open.host 文件 symlink 的旧未证明边界仍保留，不用目录 junction 或不匹配日志替代。三个来源不可达 vendor 与指定规划/硬审核分别记录。P0-B 不验收、P0-C 不开启；PR #13保持草稿，不改 base、不合并 master 或其他目标分支。
