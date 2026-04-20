# V1.1.10 数据库拆解

## 1. 线程目标

- 建立 Micro Office 自己负责的“日常会话策略”和“日常会话绑定”本地结构。
- 不接管外部平台的 `mo_daily_entries` 主数据职责。

## 2. 必做项

### 2.1 新增策略表

新增：

- `mo_daily_entry_chat_policies`
- migration：
  - `backend/src/main/resources/db/migration/V48__daily_entry_chat_policy_and_session_binding.sql`

最小字段建议：

- `id`
- `external_daily_entry_id`
- `entry_code`
- `entry_name`
- `session_resolve_strategy`
- `provider_key`
- `status`
- `meta`
- `created_at / created_by / updated_at / updated_by`

约束建议：

- `session_resolve_strategy` 枚举：
  - `BY_ENTRY_ONLY`
  - `BY_ENTRY_AND_USER`

### 2.2 新增会话绑定表

新增：

- `mo_daily_entry_session_bindings`

最小字段建议：

- `id`
- `external_daily_entry_id`
- `user_id`
- `session_id`
- `binding_scope`
- `status`
- `meta`
- `created_at / created_by / updated_at / updated_by`

约束建议：

- `binding_scope` 枚举：
  - `SHARED`
  - `PERSONAL`

索引建议：

- `external_daily_entry_id`
- `external_daily_entry_id + user_id`
- `session_id`

### 2.3 不改外部平台表

- 不修改：
  - `mo_daily_entries`
  - `mo_daily_categories`
  - `mo_daily_entry_targets`
- 这些表不作为本版 migration 的主目标

## 3. 数据库验收标准

- 两张本地表可支持 DAILY_ENTRY 会话策略与绑定
- 不依赖修改外部平台表才能完成本版能力
- 校验脚本：
  - `docs/versions/V1.1.10/database-sql.sql`

## 4. 非目标

- 不迁移外部平台日常主数据
- 不让 `mo_daily_entries` 成为 Micro Office 自己维护的事实表
