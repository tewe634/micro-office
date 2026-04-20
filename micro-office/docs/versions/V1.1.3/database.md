# V1.1.3 数据库拆解（工作流模板）

## 1. 目标

- 在现有表基础上支撑模板管理与实例化，不新增状态枚举。

## 2. 必做项

### 2.1 使用现有核心表
- `mo_workflow_recommendation_packages`
- `mo_workflow_recommendation_package_nodes`
- `mo_workflow_node_recommendation_rules`
- `mo_module_definitions`
- `mo_module_fields`

### 2.2 数据约束落实
- packages.status 仅 `ACTIVE|DISABLED`。
- nodes 并行约束依赖现有 check：`branch_group_key/branch_order/relation_type`。
- 保持外键完整性：package -> nodes，module_definition -> nodes/rules。

### 2.3 建议补充（若当前库未有）
- 运行时节点表增加模板追溯字段（或写入 runtime meta）：
  - `template_package_id`
  - `template_package_node_id`

### 2.4 预置数据
- 准备至少 2 个 scene 的模板包与节点示例。
- 准备推荐规则样例（module -> recommended module）。

## 3. 验收

- 模板数据可被完整维护与查询。
- 实例化后可追溯来源模板。
