# B02 范围、产品准入与受保护事项

类型：当前需求的实施边界。目的在于一次给出完整功能范围及配套，避免先写完再因生成目录/消费者缺项重复追认；不代替所有者对费用、密钥、外部环境和正式节点顺序的决定。

## 1. 当前需求与节点关系

用户本次明确要求新增桌面团队、Agent控制、工作流与循环，故本包不再沿用B01“只做预览、不做功能”的实施范围。新的功能需要实际Host服务与客户端组合，不能再把所有生产packages一概冻结后只许写测试。

同时B01的PARTIAL_WITH_BLOCKERS不是P0-B正式通过，B02命名不授予绕过NODE_DEVELOPMENT_RULES的权利。C00应让既定真实Codex将本需求映射到当前节点的计划修订/受限子任务，区分可独立的桌面本地控制、确实依赖受管产品验收的调用、以及依赖P0-C的公司数据库部署。当前节点能合法承载的部分按计划直接推进；若既有顺序明确不允许某生产子任务，记录一次精确的范围/节点调整请求，而非伪造前置PASS或每天重复BLOCKED。

不得修改P0-B state为approved、不得启动P0-C的数据库部署；原公司PostgreSQL/GBrain要求保留。桌面本地模式明确标为项目/Session控制，不冒充完整公司控制面。业务模型/数据库缺件应挂到相关任务，不把未依赖它们的页面、定义校验、调度与keyless真实Host集成全部停摆。

## 2. 一次登记的功能修改面

候选模块位置由C00核实是否已存在，优先复用同职责模块；下列是精确责任范围，不是全仓重构许可：

| 范围 | 允许的产品职责 |
|---|---|
| `packages/experimental/desktop-control/`（建议新增） | 人类控制facade、capabilities、team/member/task命令、profile引用、鉴权与typed Remote |
| `packages/workflow/workflow-control/`（建议新增） | 流程定义、图校验、有限循环、journal/checkpoint、调度和取消/恢复 |
| `packages/client/ui-control-center/`（建议新增） | 四个主页面、图/表编辑、运行中心、locale、能力/权限错误展示 |
| `packages/experimental/agent-team/` | 必要的安全管理API或新consumer接线；现有journal/权限/生命周期不随意重写 |
| `packages/client/ui-subagent/`、`ui-workflow-run/`、`ui-schedule/` | 与新入口的链接/复用和必要局部呈现，不破坏原会话能力 |
| `apps/web/`、`apps/desktop/`、`apps/desktop-host/`、`packages/bundle/web-app/` | 实际入口、菜单/路由、组合与Desktop包内资源，保持原传输/隔离 |
| 新模块所属tests、README、Agent Note、生成类型及双语配对 | 对同一功能的必要支撑，不留到最终提交前补申报 |

共享types/Remote/profile组合由总控指定唯一责任者。C00必须产生可计算的逐文件清单，新增相邻局部测试由总控在同职责内登记即可，不需要所有者逐次批准。

若新增workspace包需要根路径映射、workspace importers、package.json依赖、类型/目录生成或快照注册，把准确生成器和输出路径在C00列清。只允许机械纳入这些新workspace引用；不随意升级现有第三方依赖/锁定版本，不执行整仓重解依赖。图编辑器优先使用现有组件和依赖；新第三方包必须按现行供应链规则先核查，不能因为本包列了canvas就默认允许安装任意依赖。

## 3. 执行配置和外部Agent

已有Codex/Claude产品适配及通用ACP优先复用。OpenCode/Grok的真实受管能力按已有程序、有效授权与实际接口决定；不把开发用CLI调用记录当产品接入，也不安装或借用全局CLI/凭据规避隔离。能力缺失时UI显示具体原因，模型不可用不自动换其他提供商。

可以开发配置引用选择、状态展示、权限表单和受管命令consumer；这不授权修改现有模型/provider/endpoint/credentialRef的实际值，更不授权从用户.env/auth.json读Key。用户输入的新产品配置应由既有安全入口处理并保留来源，开发者不在日志/PR中转发秘密。

阶段正式规划和硬审沿用已经有效的开发授权、真实Codex `gpt-6-astra / max` 与OpenCode `zhipuai-coding-plan/glm-5.3 --variant max`。没有覆盖的新收费/业务模型调用不执行；只阻塞相应真实验收，不伪造或重复试问。角色在交付产品中可配置，开发阶段固定审核者不等于产品成员永久绑定。

## 4. 本批次不做的事

B01 U1安全测试集、U2原生对话框人验、U3 NSIS安装器、独立sandbox.yml迁移和P0-B账号/传输前置继续单独保留。它们只有直接阻止本阶段必要动作时才回到关键路径；不能用已经存在的UI缺口为由再把全部工作变成底层修复。

不修改vendor、既有依赖版本、workflow YAML、CI阈值/排除/超时、r43 observer、r44核心关闭算法、已提交Session代次和历史证据。确需改变这些受保护面，要给最小必要性和新测试，由有权者决定；不得重新命名目录规避约束。

不安装系统服务/WSL/VM/数据库/NSIS，不更改UAC、注册表、ACL、全局PATH、认证或任意用户进程。Desktop退出后不宣称后台永远运行；普通用户应用的私有文件/进程使用与系统安装、云发布/签名是不同权限。

## 5. 本地执行与Git

总控是唯一整合/Git写者。每条流明确文件与临时工作区，shared repo多个成员写入默认串行或使用已验证隔离；不把Team writeScope警告当写锁。

继承B01有效的正常hooks、白名单、同分支非强制快进交付安排。中间只在完整切片已通过适用自审/独立审核、确需真实CI时推送；它仍可能是阶段PARTIAL，不自动节点PASS。未知远端变化、其他写者或活动push必须保留现场核对，不reset/rebase/amend/stash/clean或并发再推。

本包只发布到独立文档分支，本地只取这一目录并正常检查采用。不得为了取件读取Git凭据、安装gh、切换并覆盖当前工作区；已有对象用git show即可。最终发布是新的实际Windows产物与功能演示，不签名、不外部上传到未经授权的目标。
