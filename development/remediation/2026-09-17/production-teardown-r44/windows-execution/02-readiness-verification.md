# r44-B 就绪核验（一次性，2026-09-17）

按授权评论 D4 与 r44-B 任务第 1 步执行的一次性 provider/model 元数据核验。本核验不读取 auth.json、Key、环境变量或用户 .env；auth list 输出仅为 CLI 自身呈现的掩码状态行（无凭据值）。

## 运行环境
- CLI：本机既有 OpenCode（npm 全局 shim 路径），未重装、未升级、未切换 provider。
- 版本：1.18.31（CLI 自报；范围登记时历史记录为 1.18.26，本次以 CLI 实际输出为准）。
- 启用前提：所有者 2026-09-17 会话明确告知“认证已就绪”（r44-B 任务转达）。

## 命令、退出码与输出（ANSI 颜色序列省略；无其他改动）

1. opencode --version → exit 0

~~~
1.18.31
~~~

2. opencode auth list → exit 0

~~~
Credentials ~.localshareopencodeauth.json
●  Zhipu AI Coding Plan api
1 credentials
~~~

判定：非零凭据（1 credentials），provider 为 Zhipu AI Coding Plan（api 型）。

3. opencode models zhipuai-coding-plan → exit 0

~~~
zhipuai-coding-plan/glm-4.6v
zhipuai-coding-plan/glm-4.7
zhipuai-coding-plan/glm-5-turbo
zhipuai-coding-plan/glm-5.1
zhipuai-coding-plan/glm-5.2
zhipuai-coding-plan/glm-5.2-highspeed
zhipuai-coding-plan/glm-5.3
zhipuai-coding-plan/glm-5.3-flash
zhipuai-coding-plan/glm-5.3-highspeed
zhipuai-coding-plan/glm-5v-turbo
~~~

判定：exit 0，目标模型 zhipuai-coding-plan/glm-5.3 在列。

## 原始输出与哈希
- 原始输出（含 ANSI）保存在仓库外 C:dsh-r24-upgrade-20260912-0144b-scope-approvaleadiness-raw，不入库：
  - opencode-version.log 8 bytes SHA-256 ce93d3a23f487a3c7a9c41bcac7a01907e2d098e11d63d7d77187cb38add2af5
  - opencode-auth-list.log 175 bytes SHA-256 92e56805dddc398bcaaadc627db499cd798089bdc42136572cbacf13dfcaf4ff
  - opencode-models-zhipuai-coding-plan.log 326 bytes SHA-256 13f941653bcb081cb02a082d2a7f9bcd54f3c4c10ae7f91daf732bd0ab856117

## 边界（按 D4 明示）
- 模型列表可见不证明真实远程调用与 max 参数已被服务端接受；真实判据是硬审时的实际调用，将在 review/ 阶段以实际 OpenCode 硬审输出验证。
- 本核验仅为元数据核验，一次完成，不做重复探测。
