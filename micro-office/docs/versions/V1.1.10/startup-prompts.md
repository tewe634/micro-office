# V1.1.10 启动词

## 前端线程

```text
你负责 Micro Office 的前端实现线程（V1.1.10）。

先明确边界：
- 你是执行线程，负责按版本拆解文档落地前端实现。
- 不要改后端业务逻辑和数据库迁移。
- 若发现契约缺口，先记录最小缺口并继续完成可做部分。
- 不把“日常”的特殊性写进前端模板层或卡片层。

先阅读：
1. /Users/kevin/workspace/micro-office/micro-office/docs/README.md
2. /Users/kevin/workspace/micro-office/micro-office/docs/ui-design.md
3. /Users/kevin/workspace/micro-office/micro-office/docs/api-design.md
4. /Users/kevin/workspace/micro-office/micro-office/docs/versions/V1.1.10/overview.md
5. /Users/kevin/workspace/micro-office/micro-office/docs/versions/V1.1.10/frontend.md

本线程目标（V1.1.10）：
- 保持前端模板与门户卡片渲染模型稳定。
- 点击日常入口统一走 `open_workbench_session(session_type=DAILY_ENTRY)`。
- 不在前端做“请假进个人群 / 会议进统一群”的分支判断。

实现要求：
- 前端继续只认 block/dataKey/displayType/action。
- 不新增日常专属模板字段。
- DAILY_ENTRY 打开链路统一调用，由后端决定会话解析。

交付输出：
1. 已改文件清单
2. DAILY_ENTRY 点击链路说明
3. 与后端契约对齐情况
4. 未解决阻塞项（如有）
```

## 后端线程

```text
你负责 Micro Office 的后端实现线程（V1.1.10）。

先明确边界：
- 你是执行线程，负责按版本拆解文档落地后端实现。
- 不要改前端页面和数据库迁移脚本以外的职责边界。
- `mo_daily_entries` 不归 Micro Office 维护，不要把它重新变成我们的主事实表。
- 模板层保持纯编排，不要把日常特殊字段塞回模板 schema。

先阅读：
1. /Users/kevin/workspace/micro-office/micro-office/docs/README.md
2. /Users/kevin/workspace/micro-office/micro-office/docs/api-design.md
3. /Users/kevin/workspace/micro-office/micro-office/docs/base-data-integration.md
4. /Users/kevin/workspace/micro-office/micro-office/docs/portal-template-cross-platform-integration-guide.md
5. /Users/kevin/workspace/micro-office/micro-office/docs/versions/V1.1.10/overview.md
6. /Users/kevin/workspace/micro-office/micro-office/docs/versions/V1.1.10/backend.md

本线程目标（V1.1.10）：
- 建立 runtime/provider 白名单注册机制。
- 把 DAILY_ENTRY 特殊会话解析逻辑收敛到统一入口。
- 让日常特殊性由 provider 和策略表承担，而不是模板层承担。

实现要求：
- 建立 `dataKey -> provider` 注册白名单。
- 未注册 dataKey 明确报错，不做降级。
- `open_workbench_session(session_type=DAILY_ENTRY)` 统一收口。
- 依据策略表决定 `BY_ENTRY_ONLY` 或 `BY_ENTRY_AND_USER`。

交付输出：
1. 已改文件清单
2. provider 注册与 DAILY_ENTRY 分流说明
3. 删除了哪些模板层特殊化逻辑
4. 与数据库迁移的依赖关系
5. 未解决阻塞项（如有）
```

## 数据库线程

```text
你负责 Micro Office 的数据库实现线程（V1.1.10）。

先明确边界：
- 你是执行线程，负责按版本拆解文档落地数据库迁移、数据修复和校验 SQL。
- 不要把 `mo_daily_entries` 当作本版要维护的主表。
- 本版要新增的是 Micro Office 自己负责的策略表和会话绑定表。

先阅读：
1. /Users/kevin/workspace/micro-office/micro-office/docs/README.md
2. /Users/kevin/workspace/micro-office/micro-office/docs/db-design.md
3. /Users/kevin/workspace/micro-office/micro-office/docs/base-data-integration.md
4. /Users/kevin/workspace/micro-office/micro-office/backend/src/main/resources/db/migration
5. /Users/kevin/workspace/micro-office/micro-office/docs/versions/V1.1.10/overview.md
6. /Users/kevin/workspace/micro-office/micro-office/docs/versions/V1.1.10/database.md

本线程目标（V1.1.10）：
- 建立 Micro Office 自己负责的“日常会话策略”和“日常会话绑定”本地结构。

实现要求：
- 新增 `mo_daily_entry_chat_policies`
- 新增 `mo_daily_entry_session_bindings`
- 补齐必要约束与索引
- 不修改 `mo_daily_entries / mo_daily_categories / mo_daily_entry_targets`

交付输出：
1. 新增 migration 清单
2. 新表结构说明
3. 约束/索引说明
4. 校验 SQL 与预期结果
5. 未解决阻塞项（如有）
```

## 测试线程

```text
你负责 Micro Office 的测试验证线程（V1.1.10）。

先明确边界：
- 你是执行线程，负责按版本拆解文档做验证、回归和关闭建议。
- 不要修改业务实现代码。
- 验证重点是“模板层纯编排 + runtime/provider 层吸收日常特殊性”。

先阅读：
1. /Users/kevin/workspace/micro-office/micro-office/docs/README.md
2. /Users/kevin/workspace/micro-office/micro-office/docs/api-design.md
3. /Users/kevin/workspace/micro-office/micro-office/docs/versions/V1.1.10/overview.md
4. /Users/kevin/workspace/micro-office/micro-office/docs/versions/V1.1.10/test.md

本线程目标（V1.1.10）：
- 验证模板层保持纯编排。
- 验证 DAILY_ENTRY 打开链路按策略表正确分流。

执行要求：
- 验证已注册/未注册 dataKey 行为。
- 验证 `BY_ENTRY_ONLY` 和 `BY_ENTRY_AND_USER` 两条链路。
- 验证前端不需要写特殊分支即可跑通。

交付输出：
1. 验证范围
2. 关键用例与结果
3. 问题清单
4. 是否建议关闭版本
5. 残余风险（如有）
```
