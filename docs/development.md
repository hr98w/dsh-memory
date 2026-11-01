# Development

仓库开发约束见根目录 [AGENTS.md](../AGENTS.md)。本文只维护命令、验证矩阵和发布步骤。

## 环境

- Node.js `^22.19.0 || >=24.0.0`；
- pnpm；
- 一份可运行的 DeepSeek Harness，用于最终 Bundle 安装冒烟。

## 命令

```sh
pnpm run typecheck
pnpm run test
pnpm run build
```

`pnpm run check` 按上述顺序运行当前代码门禁。

## 验证矩阵

| 改动 | 最小证据 |
|---|---|
| 纯文档 | 检查相对链接、文件名和当前状态描述 |
| MemoryStore | 相关 Store 测试 + typecheck |
| RPC protocol | protocol 测试中的合法与非法 wire value + typecheck |
| Host wiring | plugin 测试；涉及模型可见内容时补 assembled replay/snapshot |
| Browser UI | client build + 真实安装页面；发布前提供截图或 GIF |
| package/Bundle | `pnpm run check` + `npm pack --dry-run` + 隔离 profile 安装冒烟 |

迭代时运行最窄证据；交付代码前运行一次 `pnpm run check`。只报告实际执行过的命令。

## 本地安装冒烟

### 多进程写入诊断

使用 Node.js 24，在仓库根目录执行：

```sh
node --experimental-transform-types scripts/check-memory-concurrency.mjs
```

脚本创建临时记忆目录和两个独立子进程，在真实文件读取之后插入测试屏障，让两个写入者都拿到同一旧版本，再按顺序放行提交。当前 Global、Workspace 都会输出 `lostUpdate: true`。这是已知缺陷的诊断，不是安全性测试通过；退出码 0 只代表诊断正常执行。脚本退出时清理临时目录，不读取用户 DSH 配置、不调用模型。

后续修复需证明旧版本最多一个提交成功，并覆盖读取与目录交换并发、锁持有进程异常退出、receipt/settings 协调；目前应使用单写入进程。

### Web 安装

验证 Connection 兼容补丁（需要已安装依赖的 DSH 源码仓库；不读取用户 profile、不调用模型）：

```sh
pnpm run build
node scripts/check-memory-rpc.mjs /absolute/path/to/deepseek-harness
```

脚本使用真实补丁算法和 Connection，检查当前 web-app `connection` row 的 `webStartup` 配置依赖、`webServer` 注册、未打补丁时的子 fiber 失败、路由卸载，以及缺少 Connection 的 Headless 组合。它只创建临时记忆目录并在退出时清理，不启动 HTTP 服务或验证浏览器认证。真实页面仍需按下面步骤人工验证。标准 Headless 没有 `connection` row 时会提示跳过该补丁，不影响启动。

```sh
pnpm run build
dsh plugin --profile web add /absolute/path/to/dsh-memory
dsh --profile web --dump-config
dsh web --no-open
```

确认：

1. dump config 包含 `id: dsh-memory`，且 `connection` row 的 `inject` 同时包含 `webStartup` 与 `webServer`；
2. Web boot 打印访问 URL，且没有 `startup failed`、`plugin tree failed to load` 或 missing-service 列表；
3. `__DSH_BOOT__` 包含 `@hr98w/dsh-memory` Client；
4. 启动页插件清单中的 `/plugins/@hr98w/dsh-memory/client.js?rev=...` 返回 Browser bundle，而不是 SPA fallback；
5. Settings 导航出现 Memory，页面显示“已启用”和根目录，而不是 `transport failure ... HTTP 405`；
6. Global 保存后 revision 变化，旧页面保存得到 conflict；
7. Headless 不包含 `connection` 时仍能加载 Prompt 和 Tool。

### 手工验证 Session 整理与模型设置

1. 在 DSH Models 页面配置并激活至少一个文本模型，然后重启 Web；
2. 打开 Settings → Memory → 设置，确认列表与 DSH Models 页面一致，保存一个 route 后刷新仍保持选择；
3. 确认“记录详细调试日志”默认关闭；关闭时触发一次整理不会创建新的 debug 文件，开启并保存后新 attempt 会写入日志；
4. 在“会话整理”左栏切换两个 Workspace，确认右侧只显示所选 Workspace 的 Session；同名 Workspace 不合并，无归属 Session 仍可从“未归属”查看；
5. 确认已有 DSH 标题作为主标题显示，无标题 Session 显示本地化占位，Session id 仍作为次要信息；
6. 选择“可以整理”的 Session 并触发整理；当前 revision 成功返回“已更新记忆”或“没有发现新的长期记忆”后，确认徽标变为“已整理”且按钮禁用；失败结果仍可重试，Session 新增对话后仍可再次整理；
7. 开启 Debug 后若整理失败，复制页面显示的 `$DSH_HOME/memory/debug/<review-id>/attempt-<n>.jsonl` 路径，按 `stage` 从后往前查看错误的 `name`、`message`、`code`、`cause` 和 `stack`；
8. 对长 Session，确认 debug 的 `sourceEventBytes`、`evidenceBytes` 和 `workerInputBytes` 明显反映筛选效果；超过 `maxInputBytes` 时显示 `evidence-too-large`，且不会创建 worker Agent；
9. 确认 `provider-failed` 对应 `agent-error`，而装配、flush 或 dispose 问题显示为 `internal-error`；
10. 确认 debug 文件没有 source event、memory/proposal 正文或 API key。
11. 触发新的整理 attempt 后，确认 DSH 原生 Session 页创建或复用 `Memory Consolidation` Workspace，worker 出现在其中而不是 source Workspace 或“未分组”；其物理日志使用 `$DSH_HOME/memory/consolidator-workspace` 派生的 Session 目录。打开该 worker 确认历史可读，再返回 Memory 会话整理页面确认整个 `Memory Consolidation` Workspace 不显示，其中任意 Session 都不能通过直接 RPC 整理。既有 worker Session 不自动迁移。
12. 选择一个 DSH 声明较低 `defaultMaxTokens` 的模型和一个较高或未知上限的模型分别整理；开启 Debug 时确认 `worker-model-budget-resolved` 的 `effectiveMaxTokens` 前者不超过模型上限，后者不超过插件的 8192 ceiling。
13. 在 DSH 原生 Session 页面归档一个普通 Session，刷新 Memory 的“会话整理”，确认该 Session 完全消失；直接调用其 `sessions/consolidate` 也应在创建 worker 或调用模型前被拒绝。未归档 Session 仍正常显示。
14. 选择一段同时包含跨项目偏好和当前项目事实的 Session，整理后分别检查“全局记忆”和“工作区记忆”及其 Markdown 文件；项目事实不应进入 Global，两个页面的结果应与 receipt 变化数一致。
15. 如需确认多轮修正链路，开启 Debug 后使用会先产生非法 draft 的测试模型；确认同一 attempt 的 `proposalCalls` 增加、非法 draft 得到 rejected 结果，随后合法的 `final=true` proposal 才结束 worker。正常模型可以在一轮内直接完成，不强制产生多轮调用。

Host entry 受 Node ESM module cache 影响，修改后必须重启 Web。Client bundle 变更需要重建、重新安装并刷新页面。

## 发布

`.github/workflows/ci.yml` 会在 pull request 和 `main` 更新时运行 `pnpm run check`。npm 发布由 `.github/workflows/publish.yml` 负责，只在推送与 `package.json#version` 完全一致的 `v*` tag 时触发；tag 所指提交还必须属于 `main`。

### 首次配置 Trusted Publishing

在 npm 的 `@hr98w/dsh-memory` Package Settings → Trusted Publisher 中选择 GitHub Actions，并填写：

- Organization or user：`hr98w`；
- Repository：`dsh-memory`；
- Workflow filename：`publish.yml`；
- Allowed action：`npm publish`；
- Environment：留空。

工作流使用 OIDC 短期凭据，不需要配置 `NPM_TOKEN`。确认首次自动发布成功后，可在 npm Publishing access 中禁止传统 token 发布，并撤销不再使用的 automation token。

### 发布新版本

发布前更新 `package.json#version`，并在本地运行：

```sh
npm pack --dry-run
pnpm run check
```

检查 tarball 只包含 `package.json#files` 声明的构建产物、Bundle patch、公开文档和图片，且没有 `.env`、测试 fixture、Session 或实际 memory 数据。随后提交版本变化并创建完全匹配的 tag，例如：

```sh
git add package.json
git commit -m "chore: release v0.1.2"
git tag v0.1.2
git push origin main
git push origin v0.1.2
```

最后一次 push 会触发自动发布。`npm publish` 会执行仓库现有的 `prepack`，因此远端会再次运行 `pnpm run check`；npm Trusted Publishing 会自动为公开仓库中的公开包生成 provenance。

未被明确要求时，不执行 publish、push 或创建远程仓库。

## 变更纪律

- 非平凡行为变化增加 `docs/decisions/implemented/<kind>/` 记录；
- 生成的 `lib/` 只由构建产生，不手工编辑；
- 新模型可见内容必须能从 Session 日志重建；
- 新 RPC endpoint 同时验证 request 和 response；
- 新 mutation 必须通过 `MemoryStore`，不得直接写 `$DSH_HOME/memory`。
