# Roadmap

本文按依赖顺序列出接下来的实现。稳定产品规则见 [design.md](design.md)，已实现结构见 [architecture.md](architecture.md)。

## 当前基线

已经完成：

- Global/Workspace Markdown Store；
- Workspace key、frontmatter 校验、派生 `MEMORY.md`；
- revision/CAS、scope lock 和原子提交；
- Global 与当前 Workspace index 的动态 Prompt context；
- Host-owned revision observation 与原子 batch `memory_update`；
- Connection RPC 的 `status`、`global/read`、`global/replace`；
- Settings 中的 Status 与 Global 编辑；
- Host Workspace catalog、`workspaces/list`、`workspace/read` 与只读 Workspaces UI；
- `workspace/commit`、Browser 批量编辑和保留草稿的 CAS 冲突体验；
- SessionPersistence 驱动的 `sessions/list`、live/stability/Workspace 资格判断和只读 Sessions UI；
- DSH 活跃文本模型目录联动、整理设置 CAS 配置与 Settings UI；
- 用户按需开启的本地脱敏 JSONL debug 日志；
- Host、Browser、协议和 Store 的基础测试；
- 本地 Bundle 安装、Web boot、Client bundle 与代表性 RPC 冒烟。

## M1：Workspace 管理

维护优先级：已修复 `memory` 保留名称冲突；双进程诊断已确认共享目录写入可能丢更新。下一步可靠性修复需覆盖跨进程写锁、读取一致性、receipt/settings 并发与崩溃恢复，不能只扩大实例内锁的声明范围。

状态：实现完成并通过真实 Web 编辑/冲突验证，发布前 GIF 待补。它把已有 Store 能力完整暴露给用户，也为 Session 整理提供可观察、可修正的目标数据。

实现：

1. [完成] Host Workspace catalog：从 memory root 枚举 Workspace，并返回 opaque `workspaceId`、显示名、revision 和统计；
2. [完成] `workspaces/list`：不暴露绝对路径或内部 key；
3. [完成] `workspace/read`：返回派生索引和结构化记录；
4. [完成] `workspace/commit`：一次 CAS 批量执行 put/delete，并只发布一个新 generation；
5. [完成] Workspaces UI：选择、刷新、查看、创建、编辑、删除；
6. [完成] 冲突体验：旧 revision 保存时展示冲突并保留用户未提交内容；
7. [部分完成] Store/RPC/UI 单元测试和真实 Web 编辑/冲突验证已完成；发布前 GIF 待补。

完成标准：Browser 不直接写文件；任意非法 Workspace id、记录或 response 都被拒绝；一次批量提交不会产生部分写入；刷新后 UI 与 Markdown 一致。

## M2：Session 浏览与资格判定

状态：实现完成并通过真实 Web 列表验证。该切片只读取轻量持久化元数据，不调用模型：

1. [完成] 可选注入 `sessionPersistence` 与 live Agent registry；
2. [完成] 通过后端无关 `listSnapshots()` 连续观察两次 snapshot；
3. [完成] 排除 live、无 cwd、不属于可解析 Workspace 或 revision 不稳定的 Session；
4. [完成] `sessions/list` 返回可整理状态、原因、最新 receipt、opaque Workspace 归属和 DSH 标题投影，并整体排除已归档 Session 与内部整理 Workspace；
5. [完成] Sessions UI 先选择 Workspace，再按标题展示列表、归属与禁用原因，并已通过真实 Web 使用验证；
6. [完成] 单元、组合测试与真实 Web 列表、Workspace 导航、标题展示验证已完成。

完成标准：不扫描 `.dsh` JSONL；重启后结果仍来自持久化 API；当前正在运行的 Session 永远不可整理。

## M3：手动 Session Consolidator

状态：实现完成，发布前验证收尾中。Global/Workspace 整理已通过真实 Web 使用验证，非法 proposal 失败链路已通过；自动组装回放和发布 GIF 尚待补充。

详细流程、数据契约、状态机和实施切片见 [session-consolidation.md](session-consolidation.md)。

1. [完成] 冻结 source Session revision、完整逻辑事件、Global 与当前 Workspace generation；
2. [实现完成，自动组装验证待补] 创建受限的多轮 worker Agent/Session，使用专属运行 cwd，并在 Web Host 中挂到独立的 `Memory Consolidation` Workspace；
3. [实现完成，自动组装验证待补] 将 turn evidence、Global 正文与现有 Workspace 记忆通过可回放的 user-role 消息提供；
4. [完成] 接收并校验 Global `replace-global`、Workspace `put | delete` 与 `no-change` proposal，计算与 commit 一致的双作用域 preview；
5. [完成] 二次检查 source 与 Global/Workspace target revision；
6. [完成] 通过 durable intent 与 `MemoryStore` CAS 提交双作用域变化，并收敛 crash-recovery 分支；
7. [完成] 写入稳定 Markdown receipt，保留 attempt 历史、覆盖失败状态，并在 source revision 已增长时优先恢复旧 `committing` review；
8. [完成] 接通 `sessions/consolidate` 与 Sessions UI，并通过真实 Web 成功整理验证；
9. [完成] 接入 DSH 活跃文本模型目录，保存独立整理 route，真实 worker 已使用所选 route；输出预算通过统一模型能力解析适配每个 route；
10. [完成] 区分 Provider 与内部运行错误，并在用户开启 Debug 后为新 attempt 写入脱敏 JSONL 日志；真实非法 proposal 已验证错误分类、stack 与确定性日志路径。
11. [完成] 排除事件噪声、插件 runtime context 和工具正文，保留真实用户文本、最终回复、工具状态与 compaction summary；真实长 Session 已从约 2.06 MB 压缩为约 9 KB，筛选后仍超限时显式失败。

完成标准：无部分写入；重复成功 review 不再次调用模型；取消、冲突、非法输出和 Provider 失败都有 receipt；整理过程可从 worker Session 回放。

## M4：真实使用后的评估

LoCoMo 与 LongMemEval 的数据特点、初步适配流程、指标和实施顺序见 [evaluation-benchmarks.md](evaluation-benchmarks.md)。

状态：已开始。当前已实现与插件代码隔离的 [LoCoMo-10 评测](../benchmark/locomo/README.md)，固定比较无记忆 baseline、在线 Auto Memory 和 Auto Memory + Session Consolidation，并提供 `conv-26` 与全部 10 个 sample 的批量入口。评测使用仓库外隔离沙箱、真实 Agent Session 导入、独立 QA DSH Home、受限完整 Python SDK profile 的逐题新 Session，以及与 OpenViking 一致的 category 5 过滤、独立 LLM Judge 和分类 Accuracy 汇总。Ingestion 只暴露 memory-root 受限的 `read` 与 `memory_update`；记忆 QA 只暴露 memory-root 受限的 `read`，baseline 明确没有历史、记忆或工具；各阶段都禁用仓库指令发现并设 step 上限。QA 可在一个 SDK runtime 内以独立 Session 有界并发，不同 sample 也可在独立沙箱中有界并发；记忆模式共享冻结的只读快照，并单列墙钟耗时。Consolidator 明确因 `max-tokens` 未提交 proposal 时，该 attempt 的耗时与 Token 仍被记录，但不会中止后续 Session；其他整理错误保持失败。Ingestion、QA、Consolidation、Judge 分阶段记录耗时、调用和 Token，并支持由显式费率计算阶段与全流程成本。三种模式的完整 LoCoMo-10 运行已经完成；自包含 HTML 报告汇总总体、sample、分类、成本、Prompt 与逐题结果，不包含 Agent trace。

第一版闭环运行后再设计：

- 提取与合并 Prompt 的版本化；
- 固定 Session 数据集和 replay eval；
- 访问证据与 recall usefulness；
- 合并、归档和淘汰策略；
- 自动 idle/周期调度；
- 远程执行环境的只读 memory mount。

不要在 M1–M3 期间预先加入向量库、多 Provider、知识图谱、跨 Workspace recall、importance/tag 字段或策略自修改。
