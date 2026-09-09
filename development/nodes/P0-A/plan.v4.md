**P0-A · plan.v4.md：根 AGENTS.md 文档预算的有限修订**

本修订仅解决节点规则入口引起的字数冲突，叠加于 v1、v2、v3；除下述精确编辑范围外，其余要求全部继承。`P0A-01` 至 `P0A-09`、真实 Codex `gpt-6-astra/max` 规划与修订、指定真实 OpenCode 硬审、原始计划及实际证据保留要求不变。

任务 B 和 build-tools 安装继续按 v3 执行，沿用用户已有安装授权，不重复请示。任务 C 沿用已完成产物。本修订不规划下一节点。

**1. 已核实事实与选择**

- HEAD 为 `d347e703908d0406b7a7ef80e3a0e594d86b2215`；历史 `AGENTS.md` 为 **1,950 词**，当前为 **2,026 词**。
- `verify-doc-budgets.ts` 使用 `text.split(/\s+/).filter(Boolean).length`；本次 Python whitespace 计数与其一致。manifest 中 `AGENTS.md` ceiling 为 **1,950**。
- `docs/AGENTS.md` 要求超出目标时冻结上限，先迁移或压缩；回到目标内须保留至少 **5%** 余量，因此本次完成值须 **≤1,852 词**。
- 选择仅收束根目录地图的包组导航：保留顶层目录，使用同节已有的 `packages/README.md` 索引，并在根文件继续明示 ACP 用途、实验原型发布限制及工具包依赖约束。新增节点规则段落完整保留。
- 对下述文字的内存替换预检结果为 **1,819 词**，余量 **131 词，约 6.72%**；小节外内容相同。此结果仅为预检，**正式文档门禁尚未运行**。

**2. 精确授权扩展与替换文字**

本 v4 将 v1 §3.2、任务 D 及 §5 中的 `AGENTS.md` 编辑范围，定点扩展到 **`## Repository layout` 整个小节**，由 ZCode 整合者单独修改。其他既有规则及 `## Project node development` 均保持原样。

不增加其他既有文件的修改权限：`scripts/doc-budgets.manifest.json`、`scripts/verify-doc-budgets.ts`、`docs/AGENTS.md`、`NODE_DEVELOPMENT_RULES.md` 均不修改；依赖声明、锁文件、产品源码、测试和无关文档不纳入本修订。新增 `development/nodes/P0-A/plan.v4.md` 及本次证据沿用既有节点产物范围，禁止覆盖 v1、v2、v3 原文。

将 `AGENTS.md` 从 `## Repository layout` 起、到 `## Commands` 前的内容完整替换为：

````markdown
## Repository layout

```
vendor/      Vendored Cordis source — manifest + sync procedure in vendor/README.md
packages/    @deepseek-ai/dsh-<pkg> workspaces at packages/<group>/<pkg>/
python/      Python SDK and bundled runtime (see python/README.md)
native/      @deepseek-ai/node-addon-landlock-run source of record (see native/README.md)
.agents/     Agent workflows and Agent Notes (`notes/`)
docs/        architecture, generated catalogs, postmortems, cookbook (see docs/AGENTS.md)
scripts/     repo gates and generators
website/     VitePress projection of selected bilingual docs/ sources
```

Package groups: [packages/README.md](packages/README.md). `packages/acp/` provides an automation-only Agent Client Protocol server; `packages/experimental/` contains private prototypes excluded from official releases; `packages/util/` contains zero-dependency utilities.

````

该替换符合根文档介绍直接子目录、下一级细节通过所属目录索引访问的层级要求。无需修改或重新调查包组文档，也不把目录说明转存进节点规则文件。

**3. 实施与验证增量**

1. 编辑前，在既有本轮 `preservation/` 目录新增 `AGENTS.before-v4.md`，保存当前文件的原始字节及 SHA-256；同名证据已存在时使用新的轮次，不能覆盖。
2. 仅实施上述替换，保留原编码和小节外字节。记录修改前后 diff、字数及 SHA-256；预算脚本、完整 manifest、文档政策和节点规则文件的哈希须与本次编辑前一致。
3. 在仓库根目录执行以下专项预检；`$P0ARun` 沿用实际执行轮次：

```powershell
@'
from pathlib import Path
import json
import sys

before = Path(sys.argv[1]).read_bytes()
after = Path("AGENTS.md").read_bytes()

def outside_layout(data):
    prefix, body = data.split(b"## Repository layout", 1)
    _, suffix = body.split(b"## Commands", 1)
    return prefix, suffix

ceiling = json.loads(
    Path("scripts/doc-budgets.manifest.json").read_text(encoding="utf-8")
)["AGENTS.md"]
words = len(after.decode("utf-8").split())
assert len(before.decode("utf-8").split()) == 2026
assert outside_layout(before) == outside_layout(after)
assert ceiling == 1950
assert words == 1819
assert words * 100 <= ceiling * 95
print(f"AGENTS.md: {words}/{ceiling}; spare={ceiling - words}")
'@ | & 'C:\Python312\python.exe' - "$P0ARun\preservation\AGENTS.before-v4.md"
```

4. **任务 B 完成、文档候选冻结后**，在任务 D 原有 `test:docs` 前增加 `pnpm.cmd run verify-doc-budgets`，要求实际退出零。不得使用 `--list` 代替验证：脚本在该模式下即使列出超限也会退出零。
5. 任务 D 原有 `test:docs`、`doc-sync`、`lint`、差异检查、双语配对及节点文档专项核对全部保留。逐条保存实际命令、输出、退出码和哈希；未执行时标为 `NOT_RUN`，不得以本次计数预检替代。
6. 内容与预检前提不符、出现范围外差异或必需门禁失败时，保留实际证据，当前节点不得判定通过；本修订不授权额外文件修改、提高预算或调整检查实现。

**4. 候选与硬审核增量**

将 v4 原文、本次真实 Codex 调用证据、修改前保护副本、专项预检和正式门禁结果纳入现有证据索引。固定候选必须包含修订后的 `AGENTS.md` 和全部计划版本；已经封存的候选有变化时，新增轮次并重新计算哈希。

真实 OpenCode 继续使用 `zhipuai-coding-plan/glm-5.3 --variant max`，在原九项验收中核对本次编辑范围、原有义务与节点规则保留、1,950 ceiling 和至少 5% 余量、实际门禁结果及候选绑定。仅在全部必需检查通过且审核明确返回当前候选的 `PASS` 后，才能按既有规则推进。
