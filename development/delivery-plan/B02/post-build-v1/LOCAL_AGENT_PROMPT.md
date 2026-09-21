# B02 C12-build之后的连续收官指令

```text
继续 dsh861 B02，从已经完成的C12生产构建接续，不重新构建核心、不重跑C00。
本次目标：保留在跑T6和三旅程，确认同一候选，完成C10证据输入、C13及最终Windows交付。
不是再启动一套任务，也不是在T6/提交通过后回来等待派单。

固定补充目录：development/delivery-plan/B02/post-build-v1/
文档分支：docs/b02-post-build-20260921
固定commit以主会话本次回执为准；先读RUNBOOK.md和CHECKPOINTS.json。
原B02正式计划、A01—A24/J1—J3与finalization-v1继续适用，本包不是新Codex运行。

【不要打断已有任务】
原总控仍在运行时，只由它在安全同步点采用本补充，不启动第二个总控。
仅C:\Albert\project\dsh861，开发分支chore/latest-stable-upgrade-20260912。
按真实RESUME核对当前HEAD/status/候选/ls-remote及已记录T6/J自有进程和日志。
远端上次读到59579599fa34b6fff47b1c4d525459d2148eb1f8只是观察，不据此回退后续合法工作。
不重启仍活跃的T6、J1—J3、build或push，不终止任意用户进程。
已结束的线读取真实exit和输入身份，不用进程消失推断成功。
保留所有未提交B02、三个r44原件、r47s和keep-local，不reset/rebase/amend/stash/clean。

【先保证源、包、测试一致，不无理由重建】
本地报告的产物是C:\dsh-b02-c12\product\win-unpacked\，11886文件/983MB，
exe hash目前只是缩写a4172ddc…c2ebe96，读取已有完整记录，不补造。
复用build manifest/打包日志，确认controlStorageRoot修复在相关pack和打包前进入产物。
建立source candidate→build→四包/资源/产物manifest→T6→J1/J2/J3→C10→C13→commit映射。
exe hash只覆盖exe，不替代应用资源、runtime四包、依赖与配置的身份。
优先复用原清单；必要时一次只读核验，不反复遍历大包，也不跟随未知junction扫外部目录。

包内代码正确且输入未变就沿用重型构建和正在执行的旅程；
只有影响产品的实际字节变化或无法证明对应时才按原流程重建受影响产物。
不手工patch已冻结安装目录替代正式构建，不用mtime判断新旧。
T6与J只有共享输入不变时才可并行；生成器/自动修复等写操作由总控锁定，
若已发生变化保留事实，标记影响，修后只重验受影响项目。

【controlStorageRoot修复】
读实际diff、原失败及真实组合consumer，不猜文件或算法。
验证生产Desktop组合的根值传递、按设计的项目/profile隔离、真实保存后重开，
无效/不可写位置或持久失败明确拒绝，不静默回退cwd或全局共享位置伪成功。
不新增存储设计；现有同候选测试能覆盖则引用，补必要真实组合回归。
独立子代理核对修复、包中对应代码和实际行为，纳入CP2及C13，不等审后再补。

【沿用两线，同时准备证据】
T6：收真实typecheck/lint/docs/注册测试/组合结果，原命令原exit原输入；
已在跑不再开另一套全部门禁，不机械重复2000+历史测试。
J：在新win-unpacked顺序完成J1/J2/J3，独占GUI/profile，自有日志放包外。
J1真实页面组队/派工/后续输入/停止/重开；J2图表流程/并行/独立审核/有限返工；
J3固定及间隔循环/限额/暂停取消/恢复，证明不超发、不重复、未知动作需核实。
保留实际Run/Session/持久事件/产物和截图录像，Host启动服务前端的smoke不能替代这些动作。

轻量E线现在就做C10证据归类和START_HERE实质正文，必须在C13之前就绪，
不能先审PASS再判断实际harness是否可用。这是原finalization依赖，不是新增范围。
逐产品区分fixture、真实程序、实际推理、受管操作和桌面链路；keyless不自动等于真或假。
原证据够则引用，原有效授权覆盖的必需缺口才做最小真实验证。
不新增费用，不读取Key/auth.json/用户.env/全环境，不借开发审核CLI冒充A22。
缺真实层如实REAL_PRODUCT_EVIDENCE_PENDING，继续其他合法收官，不能伪给A22通过。

【汇合→实际C13】
两线与C10/说明结果均有状态、源包身份正确、修复受验证、所有必需项可定位后冻结候选。
普通问题本地派原责任者修复、受影响复验/产物重建和独立复核，继续执行，不逐条问用户。
需要真正新权限/保护面/范围才集中报告，不能借收官降低原验收。

读取已备好的C13提示词10个占位符，按真实字段逐项填值/路径；
检查无未替换token，缺证据写未运行/阻塞，不造commit/hash/PASS。
审核输入必须含storage修复、T6、实际产物三旅程、C10/A22状态和START_HERE功能/限制。

正式计划和既有授权允许的工程检查点才可先正常提交推送，明确不是最终接受。
若须硬审后再推，可用base+完整工作树manifest审核，之后核对提交树；
不要为了一个commit占位符越过审核或造成停工，也不把manifest伪写成Git SHA。

真实OpenCode沿用已授权配置：
--model zhipuai-coding-plan/glm-5.3 --variant max
记录实际程序/version/argv/start-end/exit/输入输出hash/完整manifest与PASS|FAIL|BLOCKED。
所有被审产品写者停止，CP1/CP2/prep不能替代C13。
缺必需真实证据不得给整阶段无条件PASS；不相同信息反复收费调用。

【最终交付】
保留原可用目录，依实际最后产物给准确exe、完整hash/包manifest、源码和审核对应关系。
复用一个START_HERE，正文在审核前写好四入口、组队/控制Agent、图形流程、
三种循环/限额/暂停取消/重开、数据位置、实际可用harness和测试模式/缺件。
审后只回填可核对commit/链接，不改变功能承诺。
二进制不进源码Git，已有授权渠道可用才上传，否则给准确本机路径/hash，不编造下载地址。
不因NSIS缺失暂停普通可运行目录交付，未经授权不安装软件/签名/运行系统安装器。

正常hooks、白名单、非强制快进，hooks改变产品字节按影响补验，不套旧PASS。
不为每条日志或回执额外造提交。新CI只用真实run/attempt/head/checkout和阶段结果，
未完成/未读如实保留，不以旧CI代替、不手动rerun/cancel、不无限轮询。
最终一次给阶段报告、A01—A24/J1—J3、C10分层、C13、START_HERE、产物、
完整commit/parent/两端SHA/push exit、CI、keep-local和集中缺件。
状态按原FEATURE_ACCEPTED/FEATURE_PARTIAL/REWORK，不以出包或测试数代替产品验收。

【会话与边界】
原run一页状态+证据索引，子代理回结论/差异/路径，不灌所有旧日志。
每条线结束/候选变化及时更新RESUME；换会话先确认哪些仍活跃，不重复外部动作。
没有执行器时不承诺后台自动继续；T6或一次旅程结束不再等待新提示词。
保护workflow/vendor、r43/r44核心、旧Session/历史证据/全局模型及B01/P0-B未闭合项。
不用Remote Desktop Commander，不操作其他项目，不合并PR、不进入P0-C。
```
