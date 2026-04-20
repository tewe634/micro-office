# V1.1.2 数据库拆解

## 1. 目标

- 利用现有四表支撑本次预览改造，不新增 schema。

## 2. 必做项

### 2.1 保持四表模型

- `mo_portal_templates`
- `mo_portal_template_sections`
- `mo_portal_template_items`
- `mo_portal_template_item_actions`

### 2.2 配置完整性核查

- 检查每个 section 至少有一个 item。
- 检查 item 的 `data_key` 与后端 `data.blocks` 产出可对齐。
- 检查需要交互的 item 是否有对应 actions。

### 2.3 当前模板补齐建议

- 对 `customer_list`、`daily_list`、`relation_graph`、`aiwarn_list` 维护稳定 action 配置。
- `basic_info`、`todo_list` 可保留纯展示（无 action）。

## 3. 验收

- 不改表结构即可完成 V1.1.2。
- 模板配置足以驱动前端渲染，不依赖硬编码模板ID。
