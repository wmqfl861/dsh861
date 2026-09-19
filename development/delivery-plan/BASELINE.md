# B01 基线与来源

类型：固定时点证据参考。记录日期：2026-09-19。此页是阶段输入，后续运行结果写到新的执行记录，不覆盖本页历史。

## 1. Git 与正式节点

仓库 `wmqfl861/dsh861`；开发分支 `chore/latest-stable-upgrade-20260912`；PR #13 仍为 draft，base 为 `feat/multi-agent-company-nodes`。本包读取的源码 HEAD 是 `7f63d03538759306f8363d5a912c1e99fbe015bf`，parent 为 `73263dfe7593fa9f1bdc7617472a0be3eac7364d`，源码 tree 为 `266c4fbd4862c080fd43660d2b61d1f2cc5c4e1f`。本轮不更改开发分支、不合并 PR。

[正式节点状态](../NODE_STATUS.md) 仍记录 P0-B blocked，下一节点未放行；状态中部分认证原因是较早时点，不能因为它仍存在就断言今天同一认证失效，也不能因为 r44 的开发工具可调用就自动认定四种产品隔离接入通过。B01 不伪填 P0 状态。

本地回执称 r48 已完成36项替身回归、负控、独立复审和正常hooks；实际Linux构建未在本机执行。这些是已报告的本地证据，不是本包作者在Windows复跑所得。保留本地 r47s 材料、三个 r44 原件及交付评论稿；以实际状态和原索引逐项识别，不按“工作树不空”清扫。

## 2. 新 CI 实际观察

主 [run35436610274](https://github.com/wmqfl861/dsh861/actions/runs/35436610274)，attempt1、run number39，关联上述HEAD；作业表为13 success / 4 failure。失败是Linux coverage `105880239998`、Linux consumers `105880240119`、Windows coverage `105880240137` 和汇总 `105881091691`。static、Windows build/native/observational及兼容性等为作业级成功，不能扩大为整个产品通过。

两个Linux作业的准备步骤失败，后续coverage/expected/snapshot/Web及gate证据导出跳过。[Linux coverage 原日志](https://github.com/wmqfl861/dsh861/actions/runs/35436610274/job/105880239998) 记录：Ubuntu24.04.5、Python3.12.3、cc13.3.0、Ninja1.13.2、pkg-config1.8.1，Node26.9.0、pnpm12.4.1；pnpm install完成，而脚本报 `libcap-dev control Package is 'Package: libcap-dev'`，步骤exit1。不是源码下载404，也不是新bubblewrap已编译失败的证明：脚本在包control校验处先停止。

[prepare脚本](../../scripts/prepare-ci-bubblewrap.sh) 以 `dpkg-deb --field archive Package Version Architecture` 读取三字段，然后比较裸值。官方 [dpkg-deb 手册](https://manpages.debian.org/trixie/dpkg/dpkg-deb.1.en.html) 指明多字段模式带字段名，输出顺序按control内容，字段不存在也不一定报错。W01因此必须修真实命令契约和错误传播，不只是改预期字符串。

Windows失败包 [artifact10582621667](https://github.com/wmqfl861/dsh861/actions/runs/35436610274/artifacts/10582621667) 已由主会话实际下载：167466 bytes，SHA-256 `17673dca691f53a0b385a98351771898e3f781bbad08f3fdbd7cd215219c49f8`。CRC、安全相对路径、无重复/symlink及manifest四文件bytes/hash均通过。五成员为identity、gate-results、manifest、aggregate-stdout、aggregate-stderr；stdout有56548 bytes截断，不能称完整输出。

Windows四分区汇总：22110 passed / 27 failed / 58 skipped / 1 expected fail。27失败都在 `scripts/prepare-ci-bubblewrap.spec.ts`，该文件36项中9通过、27失败。多条收到 `supports only Linux x86_64 hosted runners`，没有进入预期的替身行为；另有空输出必须分别解释，不能全部简单归因。`env.PATH`写入与Windows的Path大小写重复、Git Bash转换及实际uname来源是待验证假设，不是已证根因。W02负责在同一脚本工作包中解决。

## 3. 当前来源身份

| 来源 | 已核对身份/用途 |
|---|---|
| 根需求 | `MULTI_AGENT_REQUIREMENTS.md` blob `3c1b02299c412311fbc0f333a94f5b7a155cb8a1`；需求而非实现声明 |
| 路线 | `MULTI_AGENT_DEVELOPMENT_ROADMAP.md` blob `a2e61dc136826d03641d509846b26052caeea90f` |
| 节点规则 | `NODE_DEVELOPMENT_RULES.md` blob `995d1d6bbd58b6d42f333ce886fc515135c67c4a` |
| 当前prepare测试 | blob `91bcd7fa4833b8687ebf66e8a136a65fe0c78e66` |
| package命令 | [package.json](../../package.json)，pnpm12.4.1；实际本地版本必须另记 |
| Desktop说明 | [Desktop README](../../apps/desktop/README.md)；Windows x64、unsigned打包、独立开发home及所需工具 |
| 现成桌面测试 | [tests](../../apps/desktop/tests)，含backend-controller、host-process、host-protocol、runtime-file-policy等 |

所有固定源码链接可从 `https://github.com/wmqfl861/dsh861/blob/7f63d03538759306f8363d5a912c1e99fbe015bf/` 加相对路径读取。查阅上游文档只用于命令契约，不替代本地/CI真实执行。

## 4. 继承的未闭合事项

- r46自动Team完整golden及subagent teardown的pwsh/bash完整schema差异：新Linux通道未到该处，保持待验收，不从专用手动adapter通过推导共享场景通过。
- r45 Windows cwd水合与pnpm-exec/profile等待：保留原始诊断，不再把偶然顺序正确或直接入口执行说成根因已解决。
- 五处中文事件表source行号差异：既有记录待内容级核对，不能用sidecar哈希通过代替两种语言表达一致。
- coverage历史67文件及间歇失败：作为分类输入，不把历史数量标成新run。Windows本次新增集中失败须优先修，阈值保持不变。
- `sandbox.yml`独立apt安装入口未迁移；源码版本正确也不等于全仓CVE关闭。该workflow仍受保护，不能在此批次偷偷扩大。
- Desktop有源码和打包命令，不等于本分支已经取得Windows预览/安装验收。真实模型产品、数据库/GBrain与后续节点也不能以已有包数量计完成。

## 5. 证据层级

本包作者完成了远端读取、一个Windows artifact字节检查和静态命令契约核对；没有执行仓库Vitest、Windows桌面、真正bubblewrap构建或指定Codex/OpenCode。计划本身未获得这些工具的PASS。旧S3附件属于r44b4历史材料，不是r48或本阶段最新授权/审核，不重新开启已完成的追认。
