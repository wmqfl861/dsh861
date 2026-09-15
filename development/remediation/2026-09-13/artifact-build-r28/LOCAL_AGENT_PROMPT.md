# r28：修复 Linux 制品构建，不重复已完成的 Gateway 验证

项目为 `C:\Albert\project\dsh861`，仓库为 `wmqfl861/dsh861`，继续 `chore/latest-stable-upgrade-20260912` 和草稿 PR #13。接收基线为 `fa1a3751720558a0040633b322ee73cb1c5f3c54`。本目录只有诊断及执行说明，没有待应用的源码补丁；不要再应用 r27 changes.patch。

## 从 GitHub 取得固定输入

最终交接消息提供本轮完整交付 SHA。先检查 origin、当前分支与工作区，执行 `git fetch origin chore/latest-stable-upgrade-20260912`，确认该交付 SHA 是所取远端分支的祖先，再在无重叠未提交工作时正常快进。已有后续提交时审阅整合，不回退、不强推、不自动 stash、不重新 clone 或安装 gh。

读取本文件、同目录 [verification.json](verification.json) 和[现行交接](../../../handoffs/WINDOWS_KEYLESS_INTEGRATION.2026-09-10.md)。文件均在 `development/remediation/2026-09-13/artifact-build-r28/`，以固定提交里的 Git 对象为准；不要只追随滚动分支链接。模型配置两文件、P0-B state 与历史证据保持原字节。

## 已证实的新失败

CI run `34754759281`、job `103717195665` 的原始日志显示：checkout 为 PR 合并测试提交 `41c81747f67bff78d7eb4fd7c740f9c180a4a0a`，运行 `pnpm run build:lib`。host 的 `tsc -b tsconfig.host.json` 完成后，`tsdown --env.DSH_BUILD_FACE host` 在解析 `@tailwindcss/vite@4.3.1` 的 `dist/index.mjs` 时失败：`[UNRESOLVED_IMPORT] Could not resolve "@tailwindcss/cli/package.json"`，退出 1。frozen 安装已成功。这不是仅排队、Cloudflare 上传失败或 Windows CSPRNG 问题。

日志入口为 `https://github.com/wmqfl861/dsh861/actions/runs/34754759281/job/103717195665`。可用现有授权连接读取 job 日志，REST 路径为 `/repos/wmqfl861/dsh861/actions/jobs/103717195665/logs`，该接口有临时重定向。无需新 Token 或 gh 安装。这里只转述已读到的具体片段，不提供冒充完整原始日志的文件。

远端对同一固定提交取得的部分配置文本、树内 blob 和后继 blob 读取结果未能交叉闭合，所以本轮没有据片段修改源码。请以本地实际 Git 对象、安装包和日志中的合并测试提交为准，不复用远端猜测的目录。错误点已确定，但应补依赖、调整外部依赖配置还是修复包解析上下文，尚未证明。

## 先定位拥有者与实际解析链

复用现有 Node 26.8.2、pnpm 12.4.1、TS7 和依赖，不扫描新版本、不重装整套工具链。核对 head 与上述 CI 合并提交的相关差异；取不到该合并对象时明确记录，不把两棵树默认为相同。

通过跟踪的 package.json 定位日志里的 `@deepseek-ai/dsh-css-compile-tailwind`、`@deepseek-ai/dsh-vite-client-build` 及真正导入 Tailwind 的包，再读实际 `tsdown.config.ts` 和其引用配置。按包名定位，不照抄未经确认的目录。检查声明、锁、包管理器实际解析路径、工作区链接与打包 external/noExternal 策略。

从真实安装的 `@tailwindcss/vite@4.3.1` 读取 package.json、dist/index.mjs，定位 `createRequire(...).resolve("@tailwindcss/cli/package.json")` 的实际调用者。查 CLI 包是否由正确拥有者声明，解析是否因打包改变模块位置，必要时对官方 registry 的该精确版本元数据和锁内完整性进行无凭据核对。发布源码与安装产物不一致先记录证据，不直接判定入侵，也不手改 node_modules 或清空缓存掩盖来源问题。

先保存实际失败日志，按需运行一次 `pnpm run build:lib:host` 复现。若 Windows 不复现，保留平台区别，仍分析 CI 的 Linux 解析路径；不得把 Windows 成功写成 Linux 修复成立。

## 最小修复与完整产物证明

若证实为真实运行依赖缺失，在正确的包中声明匹配版本，并由 pnpm 生成实际锁；不要无依据地只向根 devDependencies 或全局补 CLI。若证实为打包闭包或模块位置错误，在该拥有者中修正外部依赖或包上下文解析，并检查最终发行闭包包含所需文件。不能使用全局忽略 UNRESOLVED_IMPORT、任意 external-all、跳过打包或修改预期结果求绿。

用户的必要依赖和锁兼容性迁移授权持续有效，仅在实际修复需要时更改相应清单和锁，不再次索要许可，不重做无关主版本升级。pkg 补丁不剥空白；确有必要调整补丁时通过原流程重建其摘要与锁，不能留下不一致。

给实际拥有者补回归，覆盖产物路径的包解析；静态字符串匹配不能替代已构建文件的运行。用正常脚本完成 `pnpm run build:lib`，按受影响范围验证 CSS/Vite/Web 构建及发布包运行时闭包，不依赖根目录偶然 hoist 的包来证明独立产物可用。若依赖锁改变，执行最终 frozen 安装验证；锁未变且安装输入未变则复用已有对应证据。

执行受影响类型、lint、文档检查；非机械修改按仓库规则同步拥有者 README/JSDoc 与双语 Agent Note，侧车只点名重录。不要修改模型路由、模型名、思考等级或凭据引用。

## Linux CI 与本地结果分开

正常推送后检查匹配新候选的 Linux 制品 job。可使用已有可用的 Linux 执行环境或仓库 CI，但不安装虚拟机、不改变 runner 权限或跳过失败步骤。CI 排队记排队，未运行记 NOT_RUN；不能把主工作流整体状态、其他平台构建或旧候选成功当本次 Linux 通过。公开 runner 调度或外部部署真正需要所有者设置时单列具体事项，其余独立修复先完成。

r27 Gateway 212/212 与 r26 Loader 122/122 已接收。除非修改确实影响其依赖或实现，不重复这些套件、全部 Web 文件、旧工具包、账号清点、CSPRNG 矩阵或文件 symlink 探针。Windows 两项未证明范围仍单列，不用新构建成功代替。

## 日志、复审和交付

本轮首失、最终命令日志、退出码、输入提交与文件摘要保存在此目录的新 `local-execution/` 子目录；真实 Linux 结果注明环境及 CI run/job/测试提交。能够取回原 job 日志则保存脱敏副本；取不到明确记缺失，不重造历史日志。优先明文日志，归档时 uid/gid/mtime 归零、uname/gname 为空，核验成员路径、内容、头及压缩前后秘密/账号名，不重复旧归档整改。

按已授权流程由独立上下文复审固定候选，修复后再复核；作者检查和用户报告不是本轮独立审核，不为满足名称调用未授权收费模型。执行正常钩子，正常提交推送同一分支，PR #13 保持草稿，不合并 master、不开放 P0-C。最终返回实际 SHA、根因证据、最小改动、首失/修复后命令、产物回归、Linux CI 状态与可取回日志，以及尚未完成的精确事项。

不读生产 Key 或全局认证、不登录、不请求模型，不改全局工具、其他项目或共享账号/ACL/注册表/Firewall/WFP/UAC，不使用 Remote Desktop Commander。后续所有交付文件先入 GitHub，提示词给出固定完整 SHA、路径、完整性核对及使用方法；本轮不用聊天附件。
