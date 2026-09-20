# 新会话完整启动提示词

类型：恢复及连续执行指令。固定补充commit见主会话回执，下面没有声称本机已执行或已验收。读取本文件后应接续原现场，不重启整个B02。

```text
继续 dsh861 B02，从Wave 1恢复，完成CP-A1及原C06—C13。
这是一条完整长任务：CP-A1不是终点，普通问题本地闭环，直到产品阶段交付或真正所有者级阻断才回传。

【已报告状态，先实读恢复记录】
旧会话报告C00—C05六卡已CP1接受；B02-control-v1已冻结，
18错误码、11+8状态机、9节点类型；双域持久化、Host facade和团队/Agent/编辑器已实现；约700+测试绿。
这些是旧回执，不要从数字推导组合已通过。不要重写已完成模块或重跑C00全量规划。
下一步准确内容在本地RESUME.json：10项中央接线及C03审核观察，接着lockfile/typecheck/整合。
主会话没有该原文，不提供猜测的十项列表；你必须读实际记录。

【固定文档】
原B02计划commit：5d00b635ab9d38bd8a3e99b6fe3cc10d0239fa69
新续接分支：docs/b02-wave1-continuation-20260920
新目录：development/delivery-plan/B02/continuation-wave1-v1/
固定新commit以主会话本次回执为准。
先读此目录README、RESTORE_AND_CP_A1、REMAINING_WORK、PRODUCT_GATES与CONTINUATION_GRAPH。
原B02 TASKS/ACCEPTANCE及本地C00正式计划/有效修订继续适用；本补充不覆盖冻结接口或旧证据。

【现场恢复】
仅C:\Albert\project\dsh861，开发分支chore/latest-stable-upgrade-20260912，PR #13保持草稿和原base。
主会话最后观察的远端HEAD为59579599fa34b6fff47b1c4d525459d2148eb1f8；只作身份检查，不据此回退合法进展。
核对branch、HEAD、status、origin、ls-remote及已记录活动任务/push，接管单一写入权。
保留未跟踪新包、实际Wave 1修改、三个r44原件、r47s与已有keep-local；不要求工作树干净。
不reset/rebase/amend/stash/clean，不重克隆、不盲fetch/覆盖，不杀任意用户进程。

先用旧交接确切路径找RESUME.json；路径未提供时只在本项目B02运行目录按文件名定位，
依据run_id/candidate/指针确认正确记录，不只按mtime挑最新，不扫HOME/全盘。
读完整RESUME、C00正式计划/补订、STATUS、FILE_OWNERSHIP、C01契约、C02—C05 CP1及C03观察。
只读保存恢复前身份，再在原run下追加此次续接代次；不要拿状态seed覆盖已接受卡。
原件缺失/候选漂移就明确缺什么，不补造hash/exit，不把旧会话退出当作工作没发生。

【先完成CP-A1】
逐项执行RESUME中的原10项中央接线，保留原编号/文件/来源，另记必要配套增量，不凑十条。
实际Host/Client入口、workspace/exports、Remote、导航/locale、资源与生成输出的消费者都要可达。
锁仅做C00已批准的workspace引用及必要闭包，不升级无关第三方版本、不全仓重解依赖。
核对全部锁diff与生成物，意外漂移停下诊断，不能全仓git add接受。
本轮机械锁改动原已批准就执行，不因为历史保护字样重复询问；新增范围仍按规则处理。

使用原项目实际命令和工具链，完成受影响typecheck/Host与Client build/lint/生成与文档检查。
读取真实测试注册和路径，不猜命令或修改include让测试消失。
对受接线影响的C01—C05做一次组合验证，不让每个子代理各重跑全部约700项。
从真实Desktop入口打开团队/Agent/编辑器，经Remote保存并读回，验证权限/CAS/幂等/不可用provider拒绝。
测试模式明确标示，不将keyless或mock输出冒充实际模型；未实现的运行按钮不得假成功。
C03观察按原文逐项闭环，不重新猜根因。

CP2独立复核接线/锁/真实链路，保留正式计划要求的其他审核。
必需检查通过后正常hooks、白名单、同分支非强制提交推送，记录真实SHA/exit；
hooks改产品字节按影响补验；CP-A1完成后立即继续，不在此处回来等提示词。

【后续并行与顺序】
A流：C06→C07→C08，调度器核心同一写者串行。
B流：C09运行中心，按A流真实能力逐段接入，不用新假数据接口。
C流：C10受管harness验证与C11独立故障测试，互斥资源下按就绪任务轮转。
总实施默认2、资源及原授权允许最多3；新上下文独立审核1；重型build/打包最多1。
共享types/Remote/exports/locale/生成器和Git只有总控改；同文件不同agent不能同时写。
C10某产品缺权限只阻塞该产品验收，继续不依赖它的调度/UI/keyless真实Host验证。

C06沿C01真实协议和C02/C03实现顺序/并行join/条件/独立审核/人工确认，
意图与结果真实持久，A失败不能漏掉仍运行B；错误审核hash和未知输出不能当成功。
C07实现固定次数、有限审核返工、原子调用/并发/时间限制以及暂停/取消，
N轮不得N+1，暂停关闭新派发，取消必须收敛自己的真实handles且不影响其他run。
C08实现原计划的间隔/次数/结束、去重/不重叠/错过策略和保守恢复，
已完成不重做，结果未知的外部动作需核实，不假装恢复JS堆栈或关机后台运行。
C09实时显示run/节点/轮数/额度/日志/产物/错误与人工节点，刷新不触发新动作，
从原C04/C05页面能启动并进入同一真实run，Stop不是仅清前端timer。
C10逐产品显示实际能力/授权状态；内部开发CLI记录不是产品验收，不接管任意终端。
C11穿过真实Remote/Host做权限、版本、持久、预算、取消、未知副作用和重复调度拒绝测试。

【自审与返工】
每个固定包CP1由非实现者新上下文审核，V1/V2/V3做CP2实际桌面组合检查；
权限/持久化/中央协议/取消变化立即检查，不等最后才第一次开程序。
普通失败直接交责任者返工并继续ready任务，无需用户逐个批准。
旧C00计划、能力/认证和已通过且字节未变的证据复用，只对真实变化短补订和受影响复验。
指定工具按原有效授权与实际参数执行，不新增费用权限、不换模型。
最终C13必须真实OpenCode --model zhipuai-coding-plan/glm-5.3 --variant max，
完整候选冻结，不以CP1之和、退出0或提示词写max替代正式裁决。

【Windows产品与最终报告】
C12在新的win-unpacked走原J1组队与控制、J2编辑/并行/审核返工、J3循环/限额/取消/重开。
录像/截图来自真实窗口并能追到run/Session/产物，不能后台预填成功再截图。
复用B01工具构建新产物，不把旧目录改名交付；无需为NSIS缺失停止可运行目录交付。
A22真实产品条件不够就如实FEATURE_PARTIAL，不能用mock假称跨harness完成。

按原A01—A24交一份集中报告：恢复来源、CP-A1原10项与C03观察、C06—C13、
三旅程、新产物路径/hash/启动说明、真实/模拟验证区别、硬审、CI、完整commit/两端SHA及keep-local。
CI按真实run/attempt/checkout，不拿旧B01结果或未执行步骤当新结果。
只有真正新增权限/费用/凭据/保护面/不可逆发布决定或无新证据的阻断才集中回用户。

上下文紧张先保存原run中的RESUME/candidate/owner/活动任务/最后确认动作与next-ready，
新代理据此续接，不重复可能已发生的push或外部动作，不承诺无执行器还会后台运行。
保护模型配置、凭据、vendor、workflow、原Session代次、r43/r44核心和历史证据；
不读用户.env/auth.json，不git credential fill，不装系统服务/数据库/WSL/NSIS，不改全局环境。
不用Remote Desktop Commander，不操作其他项目，不合并PR，不伪更新P0-B或进入P0-C。
```
