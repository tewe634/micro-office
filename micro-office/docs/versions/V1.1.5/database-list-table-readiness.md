# 节点输入字段 LIST/TABLE 数据库就绪度确认（基于本地 Docker 数据库）

更新时间：2026-05-12

## 1. 结论摘要

- 当前数据库 **仅部分支持** 节点输入字段的列表型能力。
- 三层判断：
  - 字段定义层：**支持**
  - 子列定义层：**不支持（缺结构化子列定义）**
  - 运行时值层：**支持（JSONB 可存数组）**

最终结论：**需要补最小结构后再做**。

## 2. 事实来源（本地 Docker 实库）

本次确认使用本地容器 `micro-office-chat-postgres-1` 的 `micro_office` 数据库，仅做只读核查。

已核对表：

- `mo_workflow_template_field_definitions`
- `mo_workflow_template_node_input_fields`
- `mo_workflow_template_node_output_fields`
- `mo_workflow_node_form_data`
- `mo_workflow_runtime_caches`
- `mo_workflow_recommendation_package_nodes`

## 3. 三层能力确认

### 3.1 字段定义主表（是否可声明 LIST/TABLE）

当前表：`mo_workflow_template_field_definitions`

已具备：

- `field_key`（唯一）
- `name`
- `field_type`（text）
- `enabled/sensitive/group_key/display_order`

约束现状：

- 仅有 `field_type` 非空约束（`btrim(field_type) <> ''`）
- **没有** `field_type` 枚举约束

结论：

- 可以写入 `list` / `table` 作为字段类型值（从存储角度可表达）。
- 但数据库层不限制合法值集合，依赖应用层校验。

### 3.2 子列定义层（列表每行子字段）

当前相关表：

- `mo_workflow_template_node_input_fields`：仅把节点与 `field_key` 关联（required/read_only/display_order）
- `mo_workflow_template_node_output_fields`：输出字段映射

缺失：

- 没有“列表字段子列定义表”（例如 parent list field -> child columns 的结构化定义）
- 无法在数据库里声明：
  - 列表每行有哪些子列
  - 子列类型/必填/顺序

结论：

- **这一层是当前核心缺口**。

### 3.3 运行时值层（是否能存 JSON 数组）

当前运行时值表：

- `mo_workflow_node_form_data.input_data jsonb`
- `mo_workflow_node_form_data.output_data jsonb`
- `mo_workflow_runtime_caches.cache_data jsonb`

结论：

- JSONB 天然可存数组（`[]`）与对象，运行时值承载列表数据没有物理限制。
- 但若缺少子列定义层，运行时数组结构会缺少数据库可验证的列级约束。

## 4. 最小改造方案（仅数据库）

为补齐“子列定义层”，建议新增 1 张最小结构表：

- 建议表名：`mo_workflow_template_list_field_items`

建议字段（最小）：

- `id`（PK）
- `node_template_id`（FK -> `mo_workflow_recommendation_package_nodes.id`）
- `parent_field_key`（FK -> `mo_workflow_template_field_definitions.field_key`）
- `item_field_key`（子列 key）
- `item_field_name`
- `item_field_type`
- `required`（bool）
- `display_order`（int）
- `meta`（jsonb，默认 `{}`）
- `created_at/created_by/updated_at/updated_by`

建议约束/索引（最小）：

- `UNIQUE (node_template_id, parent_field_key, item_field_key)`
- `CHECK (btrim(item_field_key) <> '')`
- `CHECK (btrim(item_field_type) <> '')`
- `CHECK (display_order >= 0)`
- 索引：`(node_template_id, parent_field_key, display_order)`

## 5. 建议 migration 清单（如采纳）

- `V56__workflow_node_list_field_items.sql`
  - 创建 `mo_workflow_template_list_field_items`
  - 增加约束与索引
  - （可选）给 `mo_workflow_template_field_definitions.field_type` 增加枚举约束（至少包含 `list/table`）

## 6. 不建议方案

- 不建议仅把列表结构继续塞到 `input_data` / `meta` 里而没有子列定义表。
- 不建议在无结构化子列定义的前提下把 LIST/TABLE 当“已支持完成”。

## 7. 一句话结论

**需要补最小结构后再做**。
