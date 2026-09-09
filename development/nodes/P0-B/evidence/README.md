# P0-B 受控验证基础设施

`validate-harness.ts` 仍是 adapterless B2 foundation，不是真实 adapter runner。合法调用只生成 `BLOCKED`，不启动产品、不读取凭据值、不证明 allow/deny、取消、交接或隔离。旧证据、`schema.v1.json` 和历史验证回执保持原样。

## 当前命令合同

```sh
node --import tsx/esm scripts/p0-b/validate-harness.ts --harness codex --case allow --source --root <absolute-owned-root> --require-real-product
```

四种 harness 名称为 `codex`、`claude-code`、`opencode`、`grok`。case 为 `allow` 或 `deny`；`--source` 和 `--artifact` 必须且只能选择一个。`--expect-denied` 仅适用于 deny。普通值选项支持 `--name value` 和 `--name=value`；布尔标记不接受 `=true`，未知和重复参数均拒绝。

Windows 未提供 root 时保留 `D:/Temp_projects/dsh861-p0-b-harness-validation` 默认值；其他系统必须显式指定绝对路径。每次创建独立子目录。root 下的 bait 只是旧结构的占位目录，不是已经验证的外部全局诱饵。

CLI 退出码：0 表示 PASS，1 表示 FAIL/输入错误，2 表示 BLOCKED，3 表示 NOT_RUN。当前 foundation 不会产生 PASS。测试应断言 BLOCKED 和退出码 2，而不是把 shell 命令成功当作产品验收。

`result.json` 和 `manifest.json` 保留在生成的运行根目录。CLI 不再自动删除它们，因此 `cleanup.rootRemoved=false` 与事实一致。操作者在归档和引用检查后，才可清理本次自有目录；清理应另存回执，不改写旧结果。证据中的环境变量名称不是秘密值扫描通过证明。

## 严格旧格式校验

`schema.foundation.v2.json` 通过 `$ref` 组合 `schema.v1.json`，增加 foundation 只能 BLOCKED、无真实过程或产物等限制。它不是拟议的原生 `p0-b-evidence.v2`，也不将旧记录冒充新 runner 产物。JSON Schema 校验器应从本地目录解析引用；之后仍需要业务语义检查。

```sh
node scripts/p0-b/audit-controls.mjs foundation --evidence <result.json>
```

该命令只做旧 foundation 的语义校验，不是通用 JSON Schema 引擎。有效 BLOCKED 返回 2，不正确或伪造的记录返回 1；绝不据此批准产品。真实 adapter successor 尚未实现。

## 候选字节和需求映射

```sh
node scripts/p0-b/audit-controls.mjs candidate --manifest <candidate.json> --root <repo-root> --commit <exact-40-character-commit>
node scripts/p0-b/audit-controls.mjs mapping --map development/nodes/P0-B/acceptance-map.r01.json --spec MULTI_AGENT_REQUIREMENTS.md
```

候选校验有两种口径：提供 commit 时读取固定 Git blob；不提供时检查保留目录里的原始字节。必须有非空清单；未知类型、重复路径、越界路径或不可读文件均不能跳过。当前只支持清单中的常规文件，其他类型需要显式扩展，不能假装完整支持。换行差异只显示诊断，仍返回失败。验证内容摘要不验证原始运行或日志作者的真实性。

映射命令从主规格读取全部 32 项 AC 的标题与版本，拒绝错号、改名、空清单和局部规格输入。它检测结构与标题漂移，不替代审核者对测试语义的判断。

## 回归

```sh
node --test scripts/p0-b/audit-controls.test.mjs
node scripts/p0-b/sync-node-status.mjs --check
```

正常仓库测试需要已安装的 `tsx` 和 Git。测试只创建自有临时目录和合成数据，不调用真实产品或网络。离线审查可通过 `P0B_AUDIT_RUNNER_MODULE` 显式指定单独编译的 runner JS；这只验证该文件的逻辑，不等同于仓库 source/artifact composition、整体构建或受支持 Windows 实机验证。

产品接入、实际文件/网络隔离、原生过程、中央能力桥、凭据安全和完整验收仍以真实证据和指定硬审核为准。后继计划请求见 `../plan-revision-request.r01.md`。
