# 新会话：继续 dsh861 B02 CP2 到产品交付

本文件是已有B02的收官指令。读取实际RESUME和现有正式计划后连续执行，不重做核心模块，不以阶段内检查点作为再次等用户派单的终点。

```text
继续 dsh861 B02 CP2，连续完成组合冻结、实际C12、指定C13和阶段交付。
不是再开发一套团队/流程，不重新规划C00，不只完成提交就停下来。
你是唯一总控、整合与Git写入者，使用原run记录组织自审、返工和交付。

【固定任务包】
文档分支：docs/b02-finalization-20260921
目录：development/delivery-plan/B02/finalization-v1/
固定本次文档commit以主会话回执为准。
先读本目录README、RUNBOOK、FINALIZATION.json，
再按需读本地RESUME/C00正式计划/CP2-prep/C12-prep/C13-prep和原B02 ACCEPTANCE。
已有原C00计划、接口、授权和有效修订继续适用；本包不是一次新Codex运行。

【准确恢复状态】
旧回执称14核心卡ACCEPTED，表中列的是C00—C11，
同一回执把CP2、C12三旅程、C13硬审列为下一步。
保留原文与accepted证据，不删改历史，但分清实现/CP1、prep、组合和最终产品验收。
不要只从RESUME的14/14数值推导C12/C13完成；有实际完成证据则复用，缺证据则真实待验。
C10四产品+跨harness keyless不自动等于原A22的真实产品验收。
本阶段2000+测试是本地报告，不能代替新Windows实际操作或指定硬审。

仅C:\Albert\project\dsh861，开发分支chore/latest-stable-upgrade-20260912，PR #13草稿、base不变。
主会话最后读到远端59579599fa34b6fff47b1c4d525459d2148eb1f8，只作核对，不据此回退本地合法进展。
核对branch/HEAD/status/origin/ls-remote及已有自有任务/push，接管单写者。
保留所有未提交/未跟踪实现、三个r44原件、r47s和keep-local，不要求工作树为空。
不reset/rebase/amend/stash/clean，不重克隆、不杀任意用户进程、不重发活跃push。

先用旧交接确切路径读RESUME；缺路径只在本项目B02运行目录与交接索引查找，
按run_id/candidate/指针确认，不扫HOME/全盘、不只看mtime、不创建空恢复记录。
追加简短状态对账，不把状态seed覆盖已有记录。
只读取当前相关计划片段和证据索引，不把所有2000项和历史完整日志装满上下文。

【CP2先完成真正组合审核】
复用Notes/类型债/锁/文档及全部prep，核对它们实际绑定的candidate，已做就引用。
冻结完整修改+新增文件，精确区分产品、生成/锁、证据和keep-local；manifest不循环自hash。
验证四入口→Remote→Host→双域存储/受管执行→调度/循环/恢复→运行中心真实接通。
重点是CAS/幂等拒绝、运行版本固定、9节点状态、审核身份、预算/取消、occurrence和恢复。
不能只把CP1相加或typecheck通过当组合验收，不能以测试里直接new服务证明最终profile已注册。
生成/锁仅原已批准的必要同步，不全仓升级或忽略未知变更。

运行受影响组合检查与必要build/typecheck/lint/docs，不机械重跑每条历史测试。
独立新上下文CP2审固定候选；发现普通问题由原责任者本地修复，补受影响测试再冻结。
不降低断言、skip、coverage、超时或把必需失败改成建议。

【中间提交与C13的区别】
如果本地C00及原提交授权明确允许CP2后的工程检查点，
在该检查点必需检查/适用审核通过后正常hooks、白名单、非强制提交推送，
明确标ENGINEERING_CHECKPOINT_NOT_FINAL_ACCEPTANCE，不宣称C12/C13或产品完成。
若原规则要求C13后才能推，则先本地完成C12/C13再统一提交，不新增豁免、不因此停工。
任何路径都直接继续C12，提交不是这条长任务终点。
已发生的合法检查点不重复执行；hooks改产品字节先补受影响验证，旧PASS不套新字节。

【C12：真正Windows产物上的三个旅程】
复用已有C12-prep和B01工具，构建本次B02新win-unpacked，
记录来源candidate/commit、实际Host/Client/runtime及exe/目录manifest哈希。
不能旧B01目录改名，不能只跑development server或隐藏fixture页。
未提交源码可绑定base+完整candidate，之后记录实际commit映射，不编造新SHA。

J1：从四个常驻入口创建团队、角色/profile、成员、任务/依赖，
实际派工、后续输入、停止目标、保存重开，核对真实Host/Session/产物和无关run不受影响。
J2：从图/表新建并保存流程，运行开发→并行测试/检查→独立审核→有限返工，
首轮真实受控失败后产物revision/hash改变，再审核；错hash不能走成功边。
J3：固定N次和间隔循环、限额、暂停/继续、取消、关闭Host后重开，
证明不N+1、不超发、不重叠、不重复occurrence，真实取消收敛，已做不重做、未知需核实。

截图/录像来自真实窗口，关联同一candidate、run/Session和产物，
不能后台预造completed或注入UI store冒充操作。
已有UI自动化能力复用；确有未能自动操作的人验子路径如实标明，不假记录点击。
权限、存储、预算、取消或恢复缺陷在既有B02范围内直接返工，
代码变化导致旧产物过期必须重建受影响部分并重验对应旅程。

【C10证据归类并行做，不重复开发adapter】
保留已经通过的keyless工程结果，逐产品读取原证据：
类型/协议fixture、实际程序启动、受管隔离/能力、实际推理请求/结果、桌面全链操作/取消分层。
keyless不是自动等于模拟或真实，按输出来源和实际调用证据判断；
真实CLI进程加载fixture也不能自动算真实服务推理。
至少一条真实受管执行，跨harness以原A22要求的不同实际产品证明。
同一backend两个别名或四个mock不算四产品完成；开发用审核CLI不充当产品运行证据。

已有有效授权和安全条件覆盖的必要真实验证直接补齐，不反复请示已批准事项。
没有新调用/费用/凭据授权时不擅自试问、不读Key/auth.json/全环境/用户.env，
不改变全局provider或借其他产品配置。
真实层缺件独立记REAL_PRODUCT_EVIDENCE_PENDING和最小缺件，
继续其他合法的C12任务与产物说明，不把全部开发停住，也不把A22改成通过。

【C13：最后完整候选正式硬审】
C12结果与产物、完整manifest、原计划/补订、各审核/返工、A01—A24、
真实与keyless边界、原失败和NOT_RUN一并提供，所有产品写者停止。
沿原有效授权真实调用OpenCode：
--model zhipuai-coding-plan/glm-5.3 --variant max
保存实际程序/版本/argv/start-end/exit/输入输出hash及明确PASS|FAIL|BLOCKED。
CP13-prep或C13-prep、CP1、CP2、退出0、prompt自称max都不是这次审核。
缺必需实际证据不得拿局部PASS当整阶段PASS；普通发现本地修复、受影响复验后重审。
原正式计划实质需改才Codex短补订，不重做72分钟全规划，不新增费用权限。

【产物、文档和收官】
复用一份START_HERE或README-product，写清exe准确路径、hash、来源、启动与私有数据位置，
四入口在哪里、如何组队/派工/操作Agent、图形流程和三种循环怎样使用、怎样停止/重开，
实际可用harness、测试模式/未配置限制、J1—J3证据和安全清理自己的数据。
使用现有工具产出可运行目录；NSIS缺失不阻止该产物，未经授权不安装/签名/运行系统安装器。
二进制不进源码Git，原授权渠道能上传才给真实链接，否则准确本机路径/hash，不能编造下载。

正常hooks、精确白名单、非强制快进最终交付，hooks改变产品字节先按影响补验。
同一manifest映射到真实提交和包，未发生的push/新SHA不预填。
新CI按run/attempt/head/base/checkout和artifact实读；未运行或读不到明确保留，
不以旧B01结果或中间检查点替代最终提交，不手动rerun/cancel，不为回执再造无必要commit。

最后一次报告CP2/检查点、C12三旅程、A01—A24、四产品证据层、C13裁决、
新Windows产物与START_HERE、commit/parent/两端SHA、push退出码、CI和keep-local及集中缺件。
状态仍按原FEATURE_ACCEPTED/FEATURE_PARTIAL/REWORK；
不能因为实现卡14/14或2000+测试就把未完成必需项写成接受。

【并行和恢复】
总控唯一写Git与共享文件；CP2/最终硬审冻结被审产品。
打包+实际GUI一次1路，独立harness/证据/说明可并行；
发现缺陷再有针对性委派原责任者，不为凑并行重做所有模块。
一页状态+索引，子代理回结论/差异/证据路径，不反复回灌所有日志。
CP2、检查点、每个旅程和最终候选切换时更新原run RESUME：
当前candidate、已确认副作用、活跃自有进程/CI、owner、真实剩余与next-ready。
上下文不足先保存完整恢复入口，不用14/14代替收尾，不承诺无执行器仍后台运行。

原范围内的问题自行处理，只有新的所有者级费用/凭据/系统权限/保护面/不可逆决定，
或已没有可安全推进工作时才提前集中报告。CP2、提交、一个旅程完成都不要再等派单。
不操作其他项目，不用Remote Desktop Commander，不改workflow/vendor/r43-r44核心/旧Session/模型配置，
保留历史证据及B01/P0-B未闭合项，不合并PR、不伪放行P0-C。
```
