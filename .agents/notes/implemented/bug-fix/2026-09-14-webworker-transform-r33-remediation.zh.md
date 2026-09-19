# Agent Note: worker transform 重复与两处降低语义缺陷

Status: implemented

[English](2026-09-14-webworker-transform-r33-remediation.md) | 中文

## Problem

r33 对 r32 transform（`packages/experimental/webworker-runtime/src/compile/transform.ts`，`acca50b6` 处 blob `48d4d6ec`）的评审指出三处缺陷，每处均对照留存的首失验证：

1. `pnpm run duplication` 失败于一个 clone：`blockScopeNames`（826–833 行）与 `switchScopeNames`（841–848 行）重复了同一段词法声明收集循环（`let`/`const`/`class`/`function` 名称）。
2. receiver 回归：具名导入的读取是成员表达式（`held["name"]`），导入标识符处于直接调用、可选调用或 tagged template 的被调方/标签位置时，降低结果成为方法调用，把 held 模块绑定为被调函数内的 `this`。原生 ESM 以无接收者方式调用导入函数；首失显示降低后的调用返回 held 模块而非 `undefined`。
3. 作用域回归：`SwitchStatement` 在遍历判别式之前压入共享 case 作用域，case 体内的声明因此遮蔽判别式处的导入。`switch (selected) { case 1: const selected = 2; … }` 的判别式降低为裸 `selected`，运行时抛出 `selected is not defined`。

## Decision

重复循环抽取为 `collectLexicalNames(statement, into)`，`blockScopeNames` 与 `switchScopeNames` 均改为调用它；var 与函数作用域的区分、switch 单一共享作用域保持不变。标识符改写识别处于被调方（直接或可选调用）或标签（tagged template）位置的具名导入，在该处发射 `(0,held["name"])` 使调用不带接收者；`new` 的被调方、值读取、命名空间成员调用、带括号的 default 访问器均不受影响。switch 遍历先在外围作用域求值判别式、再压入 case 作用域访问各 case（含 test 表达式），判别式只访问一次。因发射代码变化，`LOWERING_VERSION` 升至 `dsh-worker-transform/3`（镜像合同拒绝旧 transform 降低的镜像），包 README 双语补述 receiver 与判别式规则，并新增 15 条 spec 用例钉住行为：三条 receiver 负例（直接调用、可选调用、tagged template）、switch 判别式用例、fall-through 遮蔽，以及命名空间/别名/身份/object.method()/值读取控制组。项目计数 300→330。

## Alternatives considered

**退回急切导入快照或按导入缓存 bind 函数。** 两者都能恢复无接收者调用，但急切读取正是 r32 修复的循环模块暂时性死区缺陷，缓存的 `bind` 产物使每次读取得到不同的函数身份；逗号表达式保持每次读取都是新鲜的成员读取。

**把所有发射的成员调用改为无接收者。** 真正的 `object.method()`——包括命名空间成员调用——必须保持对象作为 `this`；只有导入被调方与标签使用逗号表达式。

**把 switch 判别式求值进临时变量或访问两次。** 语言规定判别式在外围作用域求值一次；在压入 case 作用域前访问一次即直接表达该事实。

## Consequences

`pnpm run duplication` 零 clone 通过，`.jscpd.json` 未改。transform 与 packer 套件 356/356 通过（两个 Vitest project 合计 transform 330、packer 26）；typecheck、lint、文档门禁通过；`apps/web` `build:preview` 以合同 `dsh-worker-transform/3` 重新打包镜像，浏览器 `preview-boot.e2e.ts` 对其 1/1 通过。回归证据与首失日志：`development/remediation/2026-09-14/web-transform-r33/`。
