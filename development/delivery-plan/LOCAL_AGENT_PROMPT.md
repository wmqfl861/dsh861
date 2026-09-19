# 给本地总控的一条启动指令

下面整段可作为本次B01总任务执行，不需要用户为每个W任务再转发提示词。

```text
接手 dsh861 的阶段式交付 B01：可信基线与 Windows 桌面预览。
本次目标是连续完成一个完整批次，不是又做一项修复就等下一条聊天。
你是唯一总控、整合者和Git写入者；可委派互斥实施任务和独立审核。

先取得主会话交付的固定计划版本。
文档分支：docs/delivery-blueprint-20260919
目录：development/delivery-plan/
源码基线：7f63d03538759306f8363d5a912c1e99fbe015bf
实际计划commit以主会话最终回执的完整SHA为准，不盲信移动分支。

读取顺序：README、BASELINE、SCOPE_AND_AUTHORITY、EXECUTION_PROTOCOL、
PHASE_B01、WORK_PACKAGES、DEPENDENCIES、REVIEW_AND_TESTS。
再用DISPATCH_TEMPLATE派发，STATUS种子另存执行版，RESUME保障换会话接续。

【现场与计划采用】
仅操作 C:\Albert\project\dsh861，分支 chore/latest-stable-upgrade-20260912，
PR #13保持草稿，base feat/multi-agent-company-nodes不变。
核对branch、HEAD、status、远端ls-remote，保留三个r44原件、r47s和已声明材料。
不要求工作树为空，不reset/rebase/amend/stash/clean或覆盖未知工作。
确认只有你这个总控拥有当前工作树写入和push权。

计划在独立文档分支，不需要切换正在开发的分支。
可通过现有Git连接取固定commit，再用git show只读查看入口。
正式纳入时只提取development/delivery-plan目录，先检查目标不存在或无冲突，
经本地正常文档检查与hooks采用；不要直接merge/cherry-pick来绕过检查，
不要从main下载文件覆盖现有源码，不另装gh或读取token。

【规划与组织】
本包是主会话规划输入，不冒充真实Codex计划。
沿用现有明确授权，由指定Codex gpt-6-astra / max核对当前阶段并形成正式计划，
重点补精确文件归属、任务前置、环境和验收，不从零重做全产品研究。
ZCode执行与返工；最终完整固定候选由真实OpenCode
zhipuai-coding-plan/glm-5.3 --variant max硬审核。
实际参数与输出分别留证，不用prompt自述替代。
不新增收费额度，不改变模型/认证，不把开发CLI调用当四种产品已接入。

开始2个实施流和1个独立审核流；资源与授权允许时最多3个实施流。
重型build/打包/全量文档检查最多1个，轻量测试最多2个。
W01与W02共享prepare spec必须串行；W04/W05共享快照也需互斥。
Linux准备、Desktop、只读产品盘点可以并行，不让一个等待CI阻塞所有工作。
共享类型、根生成器、构建产物和Git由你统一整合，不能多agent同时覆盖。

【任务】
按WORK_PACKAGES中的14张任务卡执行W00—W13。
先处理已定位的真实dpkg控制输出和Windows替身来源问题；
同时进行可独立的Desktop启动/预览以及32项AC盘点。
随后验证实际Linux构建、shared快照、Windows路径/预期、双语事实，
产出Windows可运行预览、实际证据、产品缺口和P0-B准入清单。
不实施P0-C/P1、不创建数据库、不写一套假公司控制台来充交付。

每个小包完成先自检，再交未参与实现的全新上下文子代理CP1。
每波整合做CP2，关键接口/权限/持久化/生命周期变化立即检查。
普通问题自行修复、复审、继续下一ready任务；不用向用户索要每个小任务指令。
阶段最终冻结全部文件后做规定的真实硬审，内部审核不能冒充指定产品。

一个包缺环境或权限，只暂停依赖它的任务，继续其余独立任务。
只有新增费用/凭据/机器或系统权限、受保护源码范围、不可逆动作、
发布目标变化，或有限诊断仍无新证据时，才集中向用户报告最小决定。
相同阻断没有新事实就不重复探测、审计、规划或提交。

【验证与安全】
不要从Windows mock通过推导Linux实际编译成功。
不跳过原测试、不降低coverage、不扩大timeout或exclude、不吞错误造绿。
所有实际操作使用项目自有临时home/profile/端口和keyless/replay；
不读生产Key、全局auth.json、用户.env或使用git credential fill。
不安装WSL/VM/Docker/系统工具，不改UAC/注册表/ACL/全局PATH，
不裸跑sudo/sysctl脚本，不用Remote Desktop Commander，不操作其他项目。

保留workflow/no-apt、锁/vendor、r43 observer、r44生产修复、
scope/inbox/projection/持久化、模型配置/P0-B状态和历史证据。
确需清单外变更先向总控归类，真正越过保护面才请求所有者。
所有必需生成输出/配对/快照登记在修改前进入精确清单，避免事后S3循环。

Desktop先实际启动隔离预览，再验证产物模式。
已有工具足够可构建unsigned测试安装包，但不签名/上传/自动更新，
未经既有安装权限不运行会改系统的安装器；构建/运行/安装状态分别报告。
缺依赖不私自安装，交可运行目录或明确部分交付，不能伪称发布成功。

【提交、恢复与最终回传】
使用现有工具链和正确PATH，正常hooks不绕过。
只有总控按精确白名单提交，必要CI检查点非强制快进推送原分支，
不为每条日志或回执另造commit，不手动重跑/取消CI。
hooks改了产品字节须按影响补验，旧PASS不能套新candidate。
等待原CI时继续独立任务；不会读取CI时留统一索引交主会话，不取token。

每次物理运行只有一份原始记录和真实exit，保留首失、负控恢复与截断。
计划/审核/日志不可回写伪造，复制日志不算独立运行。
上下文或额度不足时先保存RESUME所需状态，再明确停止点；
不承诺后台运行，也不让新代理重复启动仍活跃的任务。

最后只交一份REPORT_TEMPLATE格式的阶段报告：
W00—W13和A1—A9、真实Windows产物/截图/启动说明、Linux及CI证据、
32项AC盘点、独立与指定审核、完整commit/parent与两端SHA、
工作树余项、真正需要所有者决定的事项及后继准入。
未完成必需项报PARTIAL_WITH_BLOCKERS或REWORK，不报READY。
本阶段预览不是完整软件公司发布；不合并PR、不进入P0-C。
```
