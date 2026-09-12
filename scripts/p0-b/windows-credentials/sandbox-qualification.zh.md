# 原生 Codex 文件范围验证

[English](sandbox-qualification.md) | 中文

本参考描述无模型诊断，不是生产沙箱或批准机制。[codex-sandbox-qualification.mjs](codex-sandbox-qualification.mjs)只创建合成文件；[原生测试](codex-sandbox-qualification-native.test.mjs)通过既有 Windows 作业属主运行仓库钉版 Codex 的沙箱命令。不使用模型、API Key、提供商路由、签署身份或证书。

## 测量内容

未受限正控必须先读到两个测试文件、创建两个写入标记，并启动能够读取目录外测试文件的子进程。之后按精确路径删除这些标记。受限命令仍须读取获准字节，而父子进程的目录外读取以及输入目录内外的写入都须返回拒绝访问。宿主独立检查输入字节、策略字节和写入标记确实不存在。初始文件正常可读写，不能用文件缺失或只读属性制造拒绝证明。

超时、信号、启动失败、缺失输出、错误随机标识、获准输入也不可读、子进程未启动或 ENOENT 均不能算成功拒绝。协议测试中有明确模拟的成功观察，它们只验证观察器；实际未受限 Node 正控必须被拒绝为隔离证据。

## 原生策略与命令

方案使用钉版源码中的宿主 `sandbox` 命令、`--permission-profile` 和 `--include-managed-config`，不猜测 `sandbox windows` 子命令，也不忽略受管要求。自定义配置默认拒绝文件系统访问，仅允许输入、探针、明确的 Node 运行目录及 Codex 最小系统路径，拒绝私有测试目录，并关闭探针网络。生成环境不继承凭据。原生测试选择 unelevated 沙箱，不授权创建账号、修改系统范围 ACL、防火墙、触发 UAC 提权或安装。

必须对照实际钉版程序检查命令和策略。不支持配置、缺少初始化、策略冲突或原生限制均属于验证阻塞，不能据此删除拒绝规则、关闭受管要求、升级 Codex 或使用无限制执行。需要更高权限的初始化时，应另行取得具体所有者决定。不得把诊断指向真实私有数据，目标文件只在本次自有目录中。

## 运行与解释

```sh
node --test scripts/p0-b/windows-credentials/codex-sandbox-qualification.test.mjs
node --import tsx/esm --test scripts/p0-b/windows-credentials/codex-sandbox-qualification-native.test.mjs
```

第一组通过真实 Node／文件操作和明确模拟的结果验证材料准备及判定规则。第二组要求 Windows、钉版二进制及其原生沙箱；非 Windows 跳过不算 Windows 成功。它保留既有作业的指派、终止、活动计数归零和销毁要求。通过回执仅表示所列合成命令及其子进程呈现了测试中的限制，不证明主 CLI、配置发现、任意插件、全部文件对象或后续模型调用均已隔离。生产准入层不会接收此回执作为放行依据。

测试不修改模型投影或生产执行路径。验证成功后仍需明确接入获准调用；验证失败或阻塞时，生产隔离要求仍未满足。已执行检查见[r21 记录](../../../development/remediation/2026-09-12/native-sandbox-r21/verification.json)，当前本地工作见[交接](../../../development/handoffs/WINDOWS_KEYLESS_INTEGRATION.2026-09-10.md)。
