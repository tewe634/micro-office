# V1.1.4 后端拆解（历史版本说明）

## 1. 目标

- 本文档记录 V1.1.4 历史目标。
- 当前主线后端代码已移除旧 `workflow-node-features` 管理接口，不再将其作为有效契约。

## 2. 已下线路径

- `GET /api/admin/workflow-node-features`
- `POST /api/admin/workflow-node-features`
- `PUT /api/admin/workflow-node-features/{id}`
- `PUT /api/admin/workflow-node-features/{id}/status`
- `POST /api/admin/workflow-node-features/{id}/copy`
- `GET /api/admin/workflow-node-features/{id}/fields`
- `PUT /api/admin/workflow-node-features/{id}/fields`
- `GET /api/admin/workflow-node-features/{id}/behaviors`
- `PUT /api/admin/workflow-node-features/{id}/behaviors`
- `GET /api/admin/workflow-node-features/{id}/references`
- `POST /api/admin/workflow-node-features/validate-bindings`

## 3. 当前口径

- 当前模板管理只认：
  - `mo_workflow_recommendation_packages`
  - `mo_workflow_recommendation_package_positions`
  - `mo_workflow_recommendation_package_nodes`
  - `mo_workflow_template_field_definitions`
  - `mo_workflow_template_node_input_fields`
  - `mo_workflow_template_node_output_fields`
  - `mo_workflow_template_node_recommendations`
- 不再走旧节点能力表查询，不再保留旧接口兜底。
