# V1.1.11 数据库拆解

## 1. 线程目标

- 确认“日常条目管理”的主表与关系表职责。
- 以当前结构化表职责为基础，收敛最终数据库口径。
- 必要时补 migration，让新版本只走最新表设计，不做长期兼容泥潭。

## 2. 主表与关系表口径

### 2.1 条目主数据

主表建议：

- `mo_daily_categories`

最终口径（本版）：

- `mo_daily_categories` 是新版“日常条目管理”唯一主表语义。
- `mo_daily_entries` 仅保留历史旧模型，不再作为新版主路径的关系锚点。

用于承载：

- `id`
- `code`
- `name`
- `sort_order`
- `status`
- `meta`

### 2.2 条目适用范围

关系表：

- `mo_daily_entry_targets`

用于承载：

- `daily_entry_id`
- `target_type`
- `target_id`
- `status`
- `sort_order`

本版最终口径：

- `daily_entry_id` 收敛为 `mo_daily_categories.id` 语义（不再指向 `mo_daily_entries.id`）。
- 保持字段名 `daily_entry_id`，不再引入双字段兼容。

### 2.3 条目聊天策略

主表：

- `mo_daily_entry_chat_policies`

用于承载：

- `daily_entry_id`
- `entry_code`
- `entry_name`
- `session_resolve_strategy`
- `provider_key`
- `status`

本版最终口径：

- 字段由 `external_daily_entry_id` 收敛为 `daily_entry_id`。
- `daily_entry_id` 关联 `mo_daily_categories.id`。

### 2.4 条目会话绑定

关系表：

- `mo_daily_entry_session_bindings`

用于承载：

- `daily_entry_id`
- `user_id`
- `session_id`
- `binding_scope`
- `status`

本版最终口径：

- 字段由 `external_daily_entry_id` 收敛为 `daily_entry_id`。
- `daily_entry_id` 关联策略表 `mo_daily_entry_chat_policies.daily_entry_id`。

### 2.5 旧表

- `mo_daily_entries`

数据库线程需要明确：

- 是否保留但不再写入
- 是否需要迁移 / 回填到新主表语义
- 是否需要补充只读说明

本版原则：

- 不让它继续成为新主路径
- 不做长期双事实并存
- `targets/policies/bindings` 不再依赖该表

## 3. 必做项

### 3.1 结构口径确认

输出最终表职责说明：

- 哪张表是条目主表
- 哪张表是范围表
- 哪张表是聊天策略表
- 哪张表是绑定表

### 3.2 迁移与数据修复

如果发现当前字段语义与新版产品口径冲突，数据库线程需给出 migration：

- 必要的字段补充 / 约束补充
- 必要的数据回填或状态收敛
- 不需要兼容的旧路径直接废弃

本版 migration：

- `backend/src/main/resources/db/migration/V49__converge_daily_entry_domain_to_categories.sql`

本版回填：

- 将 `mo_daily_entry_targets.daily_entry_id` 从旧 `mo_daily_entries.id` 回填到 `mo_daily_categories.id`（按 code/name/显式别名规则）。
- 显式别名规则包含：`REIMBURSE -> expense`。

### 3.3 约束与索引

至少确认：

- `mo_daily_categories.code` 唯一
- `mo_daily_entry_targets` 的范围唯一约束有效
- `mo_daily_entry_chat_policies.external_daily_entry_id` 唯一
- `mo_daily_entry_session_bindings` 的共享 / 个人唯一性有效

### 3.4 校验 SQL

输出只读校验 SQL，至少覆盖：

- 条目主表重复 code
- 范围表悬挂引用
- 聊天策略悬挂引用
- 会话绑定形状错误
- 旧表是否还有新写入口依赖

校验脚本：

- `docs/versions/V1.1.11/database-sql.sql`

## 4. 数据库验收标准

- 新版“日常条目管理”表职责清晰
- 无长期双主表并行语义
- 约束、索引与查询路径一致
- 可支持后台管理页和运行时 provider 使用

## 5. 非目标

- 不把 block/template 表和日常条目表混在一起
- 不让 `mo_daily_entries` 再承担新版产品主表职责而不做口径说明
