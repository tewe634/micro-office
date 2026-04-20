# V1.1.11 启动词

## 前端线程

```text
你负责 Micro Office 的前端实现线程（V1.1.11）。

先明确边界：
- 你是执行线程，负责按版本拆解文档落地前端实现。
- 不要改后端业务逻辑和数据库迁移。
- 本版主题是“日常条目管理”，不是门户模板设计改造。
- 不把条目管理塞进 block 管理页或模板设计页里做。

先阅读：
1. /Users/kevin/workspace/micro-office/micro-office/docs/README.md
2. /Users/kevin/workspace/micro-office/micro-office/docs/ui-design.md
3. /Users/kevin/workspace/micro-office/micro-office/docs/api-design.md
4. /Users/kevin/workspace/micro-office/micro-office/docs/versions/V1.1.11/overview.md
5. /Users/kevin/workspace/micro-office/micro-office/docs/versions/V1.1.11/frontend.md

本线程目标（V1.1.11）：
- 新增“日常条目管理”页面。
- 支持条目基础信息、适用范围、聊天配置的管理交互。
- 保持 block/template 模型不变，继续由 `daily_list` 使用条目集合。

实现要求：
- 独立管理入口，不内嵌到 block 页或模板页。
- 不新增模板 schema 来管理“请假 / 报销 / 会议”。
- 页面职责清楚表达“条目管理”和“block 管理”的区别。

交付输出：
1. 已改文件清单
2. 页面入口与关键交互说明
3. 与后端契约对齐情况
4. 未解决阻塞项（如有）
```

## 后端线程

```text
你负责 Micro Office 的后端实现线程（V1.1.11）。

先明确边界：
- 你是执行线程，负责按版本拆解文档落地后端实现。
- 不要改前端页面和数据库迁移脚本以外的职责边界。
- 本版要把“日常条目管理”落在 Micro Office，不让 Micro Office Chat 承担条目创建。
- block 继续只认 `daily_list`，不要把条目逐条塞进 block/template 结构。

先阅读：
1. /Users/kevin/workspace/micro-office/micro-office/docs/README.md
2. /Users/kevin/workspace/micro-office/micro-office/docs/api-design.md
3. /Users/kevin/workspace/micro-office/micro-office/docs/base-data-integration.md
4. /Users/kevin/workspace/micro-office/micro-office/docs/versions/V1.1.11/overview.md
5. /Users/kevin/workspace/micro-office/micro-office/docs/versions/V1.1.11/backend.md

本线程目标（V1.1.11）：
- 提供“日常条目管理”后台接口。
- 让 `daily_list` 从新版条目管理数据装配条目。
- 明确 `mo_daily_categories / mo_daily_entry_targets / mo_daily_entry_chat_policies / mo_daily_entry_session_bindings` 的接口分层。

实现要求：
- 条目主接口与聊天配置接口分开。
- 不把聊天策略塞进 block/template 元数据。
- 不继续把 `mo_daily_entries` 当作新版主写入表。
- 不保留长期双读 / 双写兜底。

交付输出：
1. 已改文件清单
2. 条目管理接口与 `daily_list` 装配说明
3. 删除了哪些旧主路径或兼容逻辑
4. 与数据库迁移的依赖关系
5. 未解决阻塞项（如有）
```

## 数据库线程

```text
你负责 Micro Office 的数据库实现线程（V1.1.11）。

先明确边界：
- 你是执行线程，负责按版本拆解文档落地数据库迁移、数据修复和校验 SQL。
- 本版目标是收敛“日常条目管理”的主表与关系表职责。
- 不要继续让多张表长期承担同一个“条目主数据”语义。

先阅读：
1. /Users/kevin/workspace/micro-office/micro-office/docs/README.md
2. /Users/kevin/workspace/micro-office/micro-office/docs/db-design.md
3. /Users/kevin/workspace/micro-office/micro-office/docs/base-data-integration.md
4. /Users/kevin/workspace/micro-office/micro-office/docs/versions/V1.1.11/overview.md
5. /Users/kevin/workspace/micro-office/micro-office/docs/versions/V1.1.11/database.md
6. /Users/kevin/workspace/micro-office/micro-office/backend/src/main/resources/db/migration

本线程目标（V1.1.11）：
- 确认并落地“日常条目管理”的主表、范围表、聊天策略表、会话绑定表口径。

实现要求：
- 给出 `mo_daily_categories` 是否作为新版主表的最终数据库口径。
- 给出 `mo_daily_entry_targets` 与条目主表的关系口径。
- 必要时新增 migration 做字段、约束、回填或废弃收敛。
- 不做长期兼容泥潭。

交付输出：
1. 新增 migration 清单
2. 各表职责与字段口径说明
3. 约束/索引说明
4. 校验 SQL 与预期结果
5. 未解决阻塞项（如有）
```

## 测试线程

```text
你负责 Micro Office 的测试验证线程（V1.1.11）。

先明确边界：
- 你是执行线程，负责按版本拆解文档做验证、回归和关闭建议。
- 不要修改业务实现代码。
- 本版重点验证“条目管理”和“block/template 管理”职责分离。

先阅读：
1. /Users/kevin/workspace/micro-office/micro-office/docs/README.md
2. /Users/kevin/workspace/micro-office/micro-office/docs/api-design.md
3. /Users/kevin/workspace/micro-office/micro-office/docs/versions/V1.1.11/overview.md
4. /Users/kevin/workspace/micro-office/micro-office/docs/versions/V1.1.11/test.md

本线程目标（V1.1.11）：
- 验证日常条目可在 Micro Office 管理。
- 验证 `daily_list` block 可消费新条目。
- 验证适用范围、聊天策略、会话绑定链路。

执行要求：
- 覆盖请假 / 报销 / 会议等条目创建与编辑。
- 覆盖共享群 / 个人群两类打开链路。
- 覆盖 block 不逐条配置业务条目的边界。

交付输出：
1. 验证范围
2. 关键用例与结果
3. 问题清单
4. 是否建议关闭版本
5. 残余风险（如有）
```
