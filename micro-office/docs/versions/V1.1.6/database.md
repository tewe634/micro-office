# V1.1.6 数据库拆解

## 1. 线程目标

- 为“块模板独立资产 + 页面模板块引用”提供最小可维护结构。
- 保持存量门户模板表可继续使用，不强制一次性迁移历史数据。

## 2. 必做项

### 2.1 新增块模板主表

建议新增表：

- `mo_portal_block_templates`

最小字段建议：

- `id`
- `code`
- `name`
- `status`
- `display_type`
- `data_key`
- `label`
- `meta` `jsonb`
- `version`
- `created_at / created_by`
- `updated_at / updated_by`

### 2.2 新增块模板动作表

建议新增表：

- `mo_portal_block_template_actions`

用途：

- 存储块模板级动作定义
- 避免把动作列表混在块模板主表 JSON 里失去结构化边界

最小字段建议：

- `id`
- `block_template_id`
- `action_type`
- `target_subject_type`
- `target_id_path`
- `session_type`
- `sort_order`
- `meta` `jsonb`

### 2.3 新增页面模板块引用关系表

建议新增表：

- `mo_portal_template_block_refs`

最小字段建议：

- `id`
- `template_id`
- `section_id`
- `block_template_id`
- `sort_order`
- `enabled`
- `override_meta` `jsonb`
- `created_at / created_by`
- `updated_at / updated_by`

### 2.4 索引与约束

至少补齐：

- `mo_portal_block_templates(code)` 唯一约束
- `mo_portal_template_block_refs(template_id, section_id, sort_order)` 索引
- `mo_portal_template_block_refs(block_template_id)` 索引
- `mo_portal_block_template_actions(block_template_id, sort_order)` 索引

约束要求：

- `block_template_id` 外键有效
- `template_id / section_id` 外键有效
- `enabled` 默认 `true`

### 2.5 兼容策略

- 保留现有：
  - `mo_portal_templates`
  - `mo_portal_template_sections`
  - `mo_portal_template_items`
  - `mo_portal_template_item_actions`
- 本版不删除旧表，不直接迁移全量历史数据。
- 允许新旧两套结构并存，由后端运行时优先级控制解析。

### 2.6 种子与修复

- 补一条试点块模板种子：
  - `MESSAGE_CENTER`
- 输出只读检查 SQL：
  - 哪些模板仍全是旧内嵌块
  - 哪些模板已开始引用块模板
  - 某块模板被哪些模板引用

已提供检查脚本：

- `/Users/kevin/workspace/micro-office/micro-office/docs/versions/V1.1.6/database-sql.sql`

## 3. 验收标准

- migration 可在全新库顺序执行。
- migration 可在已有环境增量执行。
- 不迁移旧模板数据也不影响现有模板读取。
- 块模板引用查询性能可支撑模板详情页和预览页读取。

## 4. 非目标

- 不在本版清理旧 item/action 表。
- 不在本版做块模板历史版本表。
