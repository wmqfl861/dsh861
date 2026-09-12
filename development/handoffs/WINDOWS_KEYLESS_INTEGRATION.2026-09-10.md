# Windows 验证、凭据接入与 P0-B 规划交接

仅处理 `wmqfl861/dsh861`，项目目录为 `C:\Albert\project\dsh861`。PR #10 已以 `03494c4e21cc5daddb16b8dfa7c2d9ac95ac7cc7` 合入开发分支，接收 `b60c5e65daf409b46dafd42e4d6d1735d5a3eba9` 的诊断和证据。此合并不代表原生隔离通过：P0-B 仍 blocked，master 未合并，不进入 P0-C，不生成指定计划或硬审核。

## r21 已结束，不重复修绿

[Windows 执行回执](../remediation/2026-09-12/native-sandbox-r21-win/verification.json)记录18项观察器通过、原生1项实际执行后被unelevated后端拒绝，原生继续BLOCKED。类型/lint/test:docs15/doc-sync33是本地已执行的对应候选检查。本次接收读取实际差异和结构化回执，未在远端重跑Windows或独立解包13份日志；对应Actions查询为0次运行。原始失败和所有保护文件保持原样。

scripts 下非 README 参考文档不在现行双语语料范围；没有给 sandbox-qualification.md 生成sidecar并非缺漏，不再重复执行已明确退出2的配对写入。Agent Note的有效配对记录保留。已关闭的PR #7/#8/#9/#10不继续追加旧任务。

## r22：部署影响审查，不新增运行器

后继[源码复核](../remediation/2026-09-12/native-sandbox-r21-win/setup-impact-review.r22.json)对照钉版完整初始化路径，更正了未来操作范围：除账号和ACL，初始化还包含账号专用Firewall/WFP配置；setup helper有独立runas提权路径，不能推断整个agent必须长期管理员运行。原回执保持不变，关于本轮未改系统状态的事实仍成立。

[未批准的初始化影响清单](../nodes/P0-B/windows-elevated-setup-request.r01.md)是本轮唯一新增部署申请，明确 `approved=false`、`systemChangesAuthorized=false`、`executionAuthorized=false`。它不是模型启动批准，也不要求用户再提供Key或手工维护签名/哈希。

## 本地下一项仅为只读清点

安全同步开发分支，沿用现有环境，不重装、不强制覆盖、不自动stash。先读上述清单及其已固定上游依据；复用r21已有能力与help证据，不重跑已知BLOCKED用例，不再写同类观察器测试。

本轮只允许核对本机相关程序元数据、两个精确沙箱账号和上游精确组的存在、拟用稳定目录及其ACL元数据、匹配该沙箱的网络策略元数据。禁止读取密码/账号凭据文件、全局agent认证或无关用户数据。权限不足如实UNKNOWN，不触发UAC或以管理员重试，不调用带初始化/修复副作用的工具入口。

输出一份脱敏本机清点结果，区分已有共享对象、拟新增对象和未知项；给出精确最小系统变更、所需提权点、执行前元数据保存范围及未证明的恢复限制。绑定本轮输入，不复制生成另一份相同申请。远端不知道本机已有状态，因此这部分必须由本地执行；之后再由用户决定是否授权实际系统变更。

若清点结果需要入库，从开发分支建一个明确用途的本地任务分支，正常提交推送，只保存必要脱敏状态。纯清点文档按实际影响做文档检查，不机械重跑产品测试或全库类型。没有新文件就不造空提交，不因无法创建PR而丢掉推送SHA。

## 不变的约束

未批准前，不更改账号、ACL、Firewall/WFP、注册表，不提权、不初始化、不把sandbox切成elevated再试。原生完整配置和精确初始化入口尚需结合本机对象确认；本次没有交付自动化安装器或宣称可完整一键回滚。

模型清单、模型锁、pnpm-lock、state.json、原计划/申请/回执均不改。仍不读生产Key、不探中转、不调用收费模型、不安装CA、不登记生产签署身份、不使用Remote Desktop Commander、不操作其他项目。服务商撤销、真实路由/费用决定与生产技术控制仍分别保留；[网页后台及团队需求](../requirements/WEB_CONTROL_CONSOLE_SUPPLEMENT.v1.md)没有被替换或追加无限前置。
