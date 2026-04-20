# V1.1.3 概览（工作流模板）

## 1. 版本目标

- 基于现有表结构落地“工作流模板”能力：模板管理、节点编排、模板发布启停、模板实例化。
- 复用已有元数据体系（module definitions + fields）作为模板节点能力来源。
- 明确状态流：仅 `ACTIVE / DISABLED`，不新增 `DRAFT`。

## 2. 基线（来自 meta.md）

- 模板主表：`mo_workflow_recommendation_packages`
- 模板节点表：`mo_workflow_recommendation_package_nodes`
- 节点推荐规则：`mo_workflow_node_recommendation_rules`
- 节点定义与字段：`mo_module_definitions`、`mo_module_fields`

## 3. In / Out

### In
- 模板包管理（新增、编辑、启停、复制）
- 节点编排（顺序 / 并行 / 分支组）
- 模板校验与实例化（创建真实流程）
- 推荐规则在编辑器中作为“下一节点建议”

### Out
- 不新增模板状态 `DRAFT`
- 不做复杂条件表达式编排引擎（if/else DSL）
- 不做跨模板版本审批流

## 4. 状态与发布口径

- `ACTIVE`：可被业务创建流程实例。
- `DISABLED`：不可新建实例，但历史实例不受影响。
- 发布动作本质：保存模板后切换状态为 `ACTIVE`。
- 下线动作：切换为 `DISABLED`。

## 5. 核心流程

1. 选择场景（scene_category）与模板包。
2. 维护节点树（parent + sort_order + relation_type）。
3. 每个节点绑定 `module_definition_id` 并补充 `meta`。
4. 运行校验（结构 + 字段 + 推荐规则可选性）。
5. 模板置为 `ACTIVE`。
6. 业务侧按模板创建流程实例。

## 6. 前后端协议（V1.1.3）

### 6.1 模板包
- `GET /api/admin/workflow-templates/packages?sceneCategory=&status=`
- `POST /api/admin/workflow-templates/packages`
- `PUT /api/admin/workflow-templates/packages/{id}`
- `PUT /api/admin/workflow-templates/packages/{id}/status` (`ACTIVE|DISABLED`)
- `POST /api/admin/workflow-templates/packages/{id}/copy`

### 6.2 模板节点
- `GET /api/admin/workflow-templates/packages/{id}/nodes`
- `PUT /api/admin/workflow-templates/packages/{id}/nodes`（整包覆盖保存）

### 6.3 元数据与推荐
- `GET /api/admin/workflow-templates/module-definitions?nodeType=&roleKey=&positionKey=`
- `GET /api/admin/workflow-templates/module-definitions/{id}/fields`
- `GET /api/admin/workflow-templates/recommendations?sceneCategory=&currentModuleDefinitionId=&currentNodeType=`

### 6.4 实例化
- `POST /api/workflows/from-template`
```json
{
  "templatePackageId": "...",
  "bizContext": {"objectType": "CUSTOMER_COMPANY", "objectId": "..."}
}
```

## 7. 验收口径

- 可创建并维护模板包与节点拓扑。
- `ACTIVE` 模板可成功实例化出运行时流程。
- `DISABLED` 模板不能再用于新建流程。
- 节点字段契约校验有效（module fields 约束生效）。
