## 当前接收状态

PR #13 保持草稿，base 为 feat/multi-agent-company-nodes，不合并，P0-B 未验收，不进入 P0-C。

r30 源码固定于 `201206cb4c83581b3d44620831434fbf2e337df9`，用户转达整改复审 PASS。当前正文为待发布草稿，不表示 r31 候选已提交或已通过。

## 真实 CI artifact 核验

CI run `34799140559`，attempt 1，整体 failure。三个诊断 ZIP 已生成并被远端实际下载；下载 SHA-256、ZIP CRC、精确 manifest 文件集、14 个文件的 SHA-256/长度全部通过。PR head、base、run、attempt、job、checkout 和平台已核对。

实际 checkout `d1ee13a76acd0cbee2f135fd546dab336e77ab72` 的 Git tree 与 r30 source head 相同，均为 `f5ad1b2da2bd2cfd002b59e71df5a13e6d4a660f`。Git Data API 另外证实合并提交的两个父提交；三个原始 ZIP 的 headParent 实际均为 null，不能说包内已包含完整父链。

## 已定因与候选

consumers 的字节完整性通过不等于归档内容符合外层任务：其 aggregate 实为 node-compat，只有内层 4/0/0。现有目录开关被嵌套进程继承，内层先写后外层拒绝非空目录。候选让 main 消耗当前进程的开关，保留只读解析器、目录保护、调度器和退出码；三种嵌套模式的隔离前后对照已完成，真实项目集成验证仍待本地。

两平台 coverage-exempt-heavy 的实际首失相同：Typert 的一个 external symbol 快照仍带 zod@4.4.3，而包依赖/CI 解析为 4.6.2。候选仅替换这一处完整路径，不 -u 全刷新，不改 normalizer、分析器或依赖锁。coverage aggregate 均为1/1/1，主 coverage 被 fail-fast 标为 skipped，不是完整阈值评估。

浅克隆取证使用 %P 时父链为空；隔离 file:// depth=1 双父实验已复现并证实原始 commit 头仍保留两个父提交。候选保留 headParent 并补 headParents，从头部取值、不解析消息中的假 parent，不拉全历史或改 CI 权限。

## 尚未完成

r31 四文件候选尚未通过完整项目/Windows/独立复审，也尚未提交；没有新 CI 成功声明。consumers 的外层业务首失还不能从该内层归档判定，需要正确归档后继续。其他独立工作流首失未在本轮归因，不以权限变更绕过。

r30 对前一份远端 r29 日志 blob、33/27/6 计数及额外路径分类的勘误已接收。原始封存记录不改写，13/7/6 的本机记录不被远端旧摘要覆盖，不要求重跑六个既有失败。

## 保持边界

不重复升级/Gateway212/Loader122/打包矩阵；保留 r29 ACP、built-lib、1000ms/60ms和expect(2)。受保护配置、P0-B state、pkg补丁、锁和历史证据不变。不读Key、不调用真实模型、不改系统安全、不用Remote Desktop Commander、不操作其他项目。
