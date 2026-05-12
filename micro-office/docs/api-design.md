# micro-office 接口设计文档

## 1. 文档目标

定义当前后端 API 分组、响应规范与契约边界，指导前后端联调与回归测试。

## 2. 通用约定

- 接口前缀：`/api`
- 认证方式：`Authorization: Bearer <token>`
- 响应包裹：

```json
{
  "code": 0,
  "message": "success",
  "data": {}
}
```

## 3. 接口分组

### 3.1 认证

- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/logout`

### 3.2 主数据

- 组织：`/api/orgs`
- 岗位：`/api/positions`
- 人员：`/api/users`
- 外部对象：`/api/objects`
- 产品：`/api/products`

### 3.3 门户

- 聚合门户：
  - `GET /api/portal/objects/{id}`
  - `GET /api/portal/products/{id}`
- 运行时门户：
  - `POST /api/portal-runtime/resolve`
  - `POST /api/portal-runtime/open-workbench-session`
  - `GET /api/portal-runtime/capabilities`

### 3.4 管理接口

- 权限：`/api/admin/permissions*`
- 销售协同：`/api/admin/sales-collab/*`
- 门户模板：`/api/admin/portal-templates/*`
- 卡片块定义：`/api/admin/portal-block-templates/*`
- 日常条目管理：
  - `GET /api/admin/daily-entries`
  - `GET /api/admin/daily-entries/{id}`
  - `POST /api/admin/daily-entries`
  - `PUT /api/admin/daily-entries/{id}`
  - `PUT /api/admin/daily-entries/{id}/status`
  - `GET /api/admin/daily-entries/{id}/targets`
  - `PUT /api/admin/daily-entries/{id}/targets`
  - 兼容旧路径：
    - `GET /api/admin/daily-entries/{id}/chat-policy`
    - `PUT /api/admin/daily-entries/{id}/chat-policy`
    - `GET /api/admin/daily-entries/{id}/session-bindings`
    - `PUT /api/admin/daily-entries/{id}/session-bindings`
- 日常聊天配置：
  - `GET /api/admin/daily-entry-chat-policies`
  - `GET /api/admin/daily-entry-chat-policies/{dailyEntryId}`
  - `PUT /api/admin/daily-entry-chat-policies/{dailyEntryId}`
  - `GET /api/admin/daily-entry-chat-policies/{dailyEntryId}/session-bindings`
  - `PUT /api/admin/daily-entry-chat-policies/{dailyEntryId}/session-bindings`
- 工作流模板：
  - `GET /api/admin/workflow-templates/packages`
  - `GET /api/admin/workflow-templates/positions`（模板岗位选项）
  - `GET /api/admin/workflow-templates/packages/{id}`
  - `POST /api/admin/workflow-templates/packages`
  - `PUT /api/admin/workflow-templates/packages/{id}`（仅更新 package 基本信息）
  - `DELETE /api/admin/workflow-templates/packages/{id}`
  - `PUT /api/admin/workflow-templates/packages/{id}/status`（仅 `ACTIVE|DISABLED`）
  - `POST /api/admin/workflow-templates/packages/{id}/copy`
  - `GET /api/admin/workflow-templates/packages/{id}/node-graph`
  - `PUT /api/admin/workflow-templates/packages/{id}/node-graph`
 - 节点设计：
  - `GET /api/admin/workflow-node-designs`
  - `GET /api/admin/workflow-node-designs/{id}`
  - `POST /api/admin/workflow-node-designs`
  - `PUT /api/admin/workflow-node-designs/{id}`
  - `PUT /api/admin/workflow-node-designs/{id}/status`
  - `DELETE /api/admin/workflow-node-designs/{id}`
  - `GET /api/admin/workflow-node-designs/{id}/input-fields`
  - `PUT /api/admin/workflow-node-designs/{id}/input-fields`
  - `GET /api/admin/workflow-node-designs/{id}/output-fields`
  - `PUT /api/admin/workflow-node-designs/{id}/output-fields`
  - `GET /api/admin/workflow-node-designs/{id}/recommendations`
  - `PUT /api/admin/workflow-node-designs/{id}/recommendations`
- 模板预览：`GET /api/admin/portal-templates/templates/{id}/preview?entityType=&entityId=`
- 卡片块定义管理：
  - `GET /api/admin/portal-block-templates`
  - `GET /api/admin/portal-block-templates/{id}`
  - `POST /api/admin/portal-block-templates`
  - `PUT /api/admin/portal-block-templates/{id}`
  - `PUT /api/admin/portal-block-templates/{id}/status`
  - `POST /api/admin/portal-block-templates/{id}/copy`
  - `GET /api/admin/portal-block-templates/{id}/references`
  - `DELETE /api/admin/portal-block-templates/{id}`

### 3.5 运行时流程

- 可用模板查询：`GET /api/workflows/template-packages`（默认按当前用户岗位过滤，可额外传 `positionId`；模板支持绑定多个岗位）
- 模板实例化：`POST /api/workflows/from-template`

## 4. 契约边界

- 前端以控制器真实能力为准，不以历史封装命名推断能力。
- 历史下线接口（如 thread/node/workbench/clock/dashboard）不应再作为当前主契约。
- 门户字段详细定义参考 [portal-api-reference.md](/Users/kevin/workspace/micro-office/micro-office/docs/portal-api-reference.md)。

## 5. 错误处理建议

- 401：未认证或会话失效
- 403：权限不足
- 404：对象不存在
- 400：参数错误或状态非法
- 500：内部异常

补充：

- `/api/products` 读接口要求命中 `/products` 菜单权限。
- `/api/products` 写接口（POST/PUT/DELETE）除菜单权限外，`STAFF` 默认无权执行。
- `/api/objects/*` 与 `/api/portal/objects/{id}` 对非全局管理员严格校验对象类型权限；当对象类型权限为空时返回 `403`。
- `GET /api/admin/portal-templates/templates/{id}/preview`：`entityType/entityId` 可通过 query 传入；若 query 缺失则回退 `template.meta.previewEntity`；两者都缺失返回 `400`。
- 模板预览时 `entityType` 与 `templateType` 不一致返回 `400`，预览主体不存在返回 `404`。
- 预览响应补充兼容结构：`subject/template/data/breadcrumbs`，其中 `template.sections[].blocks[]` 与 `data.blocks` 可用于统一渲染解析。
- V1.1.7 起模板主模型收敛为 `sections[].blockRefs[]`；模板保存若提交旧 `items/actions` 返回 `400`，不再提供后端兼容兜底。
- V1.1.7 起运行时数据键仅从 `blockRefs.blockTemplate.dataKey` 解析，不再回退旧 `items` 结构与默认数据键 fallback。
- V1.1.8 起 `GET /api/admin/portal-block-templates` 列表响应仅返回卡片资产列表语义字段；`name` 直接取块资产名称，不再额外返回列表用 `code/updatedAt` 主展示字段，也不做 legacy 命名清洗 fallback。
- V1.1.9 起岗位模板关系仅认 `mo_portal_templates.position_id`；岗位模板查询、生成与运行时解析不再读取 `meta.positionId`，角色种子模板以 `position_id IS NULL` 识别。
- V1.1.10 起运行时数据集采用 `dataKey -> provider` 白名单注册；未注册 `dataKey` 返回 `400`，不再走默认 `switch/null` 降级。
- V1.1.10 起 `POST /api/portal-runtime/open-workbench-session` 成为 `open_workbench_session` 的统一后端入口；`sessionType=DAILY_ENTRY` 仅按 `mo_daily_entry_chat_policies` + `mo_daily_entry_session_bindings` 解析，不再回退其他事实源。
- V1.1.11 起“日常条目管理”主接口写入 `mo_daily_categories`；适用范围、聊天策略、会话绑定分别走 `mo_daily_entry_targets`、`mo_daily_entry_chat_policies`、`mo_daily_entry_session_bindings`，不再把 `mo_daily_entries` 作为新版主写入表。
- V1.1.11 起 `daily_list` 仅从新版条目管理数据装配：读取 ACTIVE 条目并按 ACTIVE 目标范围过滤；若条目无 ACTIVE 目标记录则视为全局可见，不回退旧销售卡片拼装。
- V1.1.11 日常条目状态最终枚举为 `ACTIVE|INACTIVE`；后端短期兼容 `DISABLED -> INACTIVE`，兼容计划保留到 `V1.1.12`。
- V1.1.11 `PUT /api/admin/daily-entries/{id}/targets` 与 `PUT /api/admin/daily-entry-chat-policies/{dailyEntryId}/session-bindings` 标准 body 为数组；后端短期兼容对象包装体 `{ "targets": [...] }` 与 `{ "bindings": [...] }`，兼容计划保留到 `V1.1.12`。
- V1.1.11 旧路径 `/api/admin/daily-entries/{id}/chat-policy` 与 `/api/admin/daily-entries/{id}/session-bindings` 为短期兼容入口，内部转发到新聊天配置服务，兼容计划保留到 `V1.1.12`。
- `data.blocks` 容器约定：
  - `LIST` 输出 `{ "items": [] }`
  - `CARD` 输出 `{ "entries": [] }` 或 `{ "blocks": [] }`
  - 空数据统一返回空数组容器，不返回 `null` 或裸数组
- 工作流模板包状态仅允许 `ACTIVE` 与 `DISABLED`；不支持 `DRAFT`。
- V1.1.12 起工作流模板主归类字段切换为岗位绑定：
  - 管理端创建/筛选岗位模板优先使用 `positionIds`（兼容旧的单值 `positionId`）
  - 多岗位绑定关系存于 `mo_workflow_recommendation_package_positions`
  - `mo_workflow_recommendation_packages.position_id` 保留为兼容字段，记录首个岗位
  - 运行时 `GET /api/workflows/template-packages` 默认只返回当前用户岗位可见模板（另保留未绑定岗位的通用模板）
  - `POST /api/workflows/from-template` 会校验模板岗位归属；用户岗位与模板绑定岗位无交集时返回 `403`
  - `sceneCategory/scene_category` 退化为可空的推荐作用域兼容字段，不再作为模板主分类字段
- `POST /api/workflows/from-template` 仅允许 `ACTIVE` 模板实例化；`DISABLED` 模板返回 `400` 明确拒绝。
- 当前后端已移除旧 `workflow-node-features` 管理接口，不再暴露旧节点能力、旧字段契约、旧行为配置入口，也不再把 `mo_module_definitions / mo_module_fields` 作为模板管理主路径。
- V1.1.13 起独立节点设计主模型固定为 `mo_workflow_recommendation_package_nodes` 中 `package_id IS NULL` 的记录。
- V1.1.13 起工作流模板编排主路径改为 `GET/PUT /api/admin/workflow-templates/packages/{id}/node-graph`，数据落在 `mo_workflow_recommendation_packages.meta.nodeGraph`。
- V1.1.13 起后端不再往 `mo_workflow_recommendation_package_nodes` 写工作流引用副本；工作流模板详情返回 `nodeGraph` 与装配后的 `nodeGraphDetail.nodeDefinitions`。

## 6. 工作流模板接口协议

### 6.1 模板包列表

- `GET /api/admin/workflow-templates/packages`

query：

- `positionId`：可选，按岗位过滤
- `status`：可选，仅支持 `ACTIVE | DISABLED`

返回列表项字段：

- `id`
- `name`
- `code`
- `positionId`
- `positionName`
- `positionIds`
- `positionNames`
- `description`
- `status`
- `sortOrder`
- `allowCreateAsNormal`
- `allowCreateAsSubflow`
- `version`
- `createdAt`
- `createdBy`
- `updatedAt`
- `updatedBy`

### 6.2 模板岗位选项

- `GET /api/admin/workflow-templates/positions`

返回字段：

- `id`
- `name`
- `code`

### 6.3 模板包详情

- `GET /api/admin/workflow-templates/packages/{id}`

返回字段与列表项一致：

- `id`
- `name`
- `code`
- `positionId`
- `positionName`
- `positionIds`
- `positionNames`
- `description`
- `status`
- `sortOrder`
- `allowCreateAsNormal`
- `allowCreateAsSubflow`
- `version`
- `createdAt`
- `createdBy`
- `updatedAt`
- `updatedBy`

### 6.4 新建模板包

- `POST /api/admin/workflow-templates/packages`

body：

```json
{
  "name": "销售标准流程",
  "code": "WF_20260511",
  "applicableSubjectType": null,
  "positionId": "optional-position-id",
  "positionIds": ["optional-position-id-1", "optional-position-id-2"],
  "description": "模板说明",
  "version": 1,
  "allowCreateAsNormal": true,
  "allowCreateAsSubflow": false,
  "sortOrder": 100
}
```

说明：

- `name` 必填
- `code` 传空时后端自动生成；传值时按大写模板编码校验
- `positionId` 与 `positionIds` 可同时传，后端会合并去重
- `positionIds` 中岗位必须真实存在，否则返回 `400 关联岗位不存在`
- 默认创建状态为 `DISABLED`

### 6.5 更新模板包

- `PUT /api/admin/workflow-templates/packages/{id}`

body 形状与新建一致。

说明：

- 仅更新 package 基本信息
- 不在这个接口里保存节点

### 6.6 更新模板包状态

- `PUT /api/admin/workflow-templates/packages/{id}/status`

body：

```json
{
  "status": "ACTIVE"
}
```

状态枚举：

- `ACTIVE`
- `DISABLED`

### 6.7 复制模板包

- `POST /api/admin/workflow-templates/packages/{id}/copy`

说明：

- 后端会复制 package、position 绑定、nodes、inputFields、outputFields、recommendedTemplates
- 新复制出的模板状态固定为 `DISABLED`

### 6.8 删除模板包

- `DELETE /api/admin/workflow-templates/packages/{id}`

返回字段：

- `id`
- `name`
- `deletedBy`

### 6.9 模板节点图

- `GET /api/admin/workflow-templates/packages/{id}/node-graph`

返回字段：

- `templateId`
- `nodeGraph`
- `nodeDefinitions`

其中：

- `nodeGraph`

```json
[
  ["node-id-1"],
  ["node-id-2", "node-id-3"],
  ["node-id-4"]
]
```

- `nodeDefinitions[]`
  - `id`
  - `moduleDefinitionId`
  - `name`
  - `code`
  - `nodeType`
  - `status`
  - `version`
  - `inputFields`
  - `outputFields`
  - `recommendedTemplates`

说明：

- 外层数组代表流程层级顺序。
- 内层数组代表同层节点；单元素为串行，多元素为并行。
- 后端会按 `nodeGraph` 装配出对应节点定义。

### 6.10 保存模板节点图

- `PUT /api/admin/workflow-templates/packages/{id}/node-graph`

body：

```json
{
  "nodeGraph": [
    ["node-id-1"],
    ["node-id-2", "node-id-3"],
    ["node-id-4"]
  ]
}
```

说明：

- 请求体只允许 `nodeGraph`
- `nodeGraph` 必须是二维数组
- 不允许空层
- 所有节点 id 必须命中独立节点设计资源 `/api/admin/workflow-node-designs/{id}`
- 同一节点在同一模板的 `nodeGraph` 中不能重复
- 不再支持 `PUT /packages/{id}/nodes` 旧工作流节点副本保存语义

### 6.11 推荐模板读取口径

- 节点推荐模板改由 `GET /api/admin/workflow-node-designs/{id}/recommendations` 读取
- `recommendedTemplates` 数据来源为 `mo_workflow_template_node_recommendations`
- 当前不再单独暴露 `GET /api/admin/workflow-templates/recommendations`
- 前端如需为“推荐工作流模板”提供候选下拉，可直接使用 `GET /api/admin/workflow-templates/packages` 作为候选模板来源

### 6.12 节点设计接口

- `GET /api/admin/workflow-node-designs`

query：

- `status`：可选，`ACTIVE | DISABLED`
- `keyword`：可选，按 `name/code` 模糊搜索

列表/详情返回字段：

- `id`
- `moduleDefinitionId`
- `name`
- `code`
- `nodeType`
- `status`
- `version`
- `createdAt`
- `createdBy`
- `updatedAt`
- `updatedBy`

- `POST /api/admin/workflow-node-designs`
- `PUT /api/admin/workflow-node-designs/{id}`

body：

```json
{
  "id": "optional-node-design-id",
  "moduleDefinitionId": null,
  "name": "发起申请",
  "code": "START_APPLY",
  "nodeType": "TASK",
  "version": 1
}
```

- `PUT /api/admin/workflow-node-designs/{id}/status`

body：

```json
{
  "status": "ACTIVE"
}
```

- `GET /api/admin/workflow-node-designs/{id}/input-fields`
- `PUT /api/admin/workflow-node-designs/{id}/input-fields`
- `GET /api/admin/workflow-node-designs/{id}/output-fields`
- `PUT /api/admin/workflow-node-designs/{id}/output-fields`

字段 body：

```json
{
  "fields": [
    {
      "fieldKey": "customer_name",
      "label": "客户名称",
      "required": true,
      "readOnly": false,
      "sortOrder": 100
    }
  ]
}
```

说明：

- 输入字段使用 `readOnly`
- 输出字段沿用同一 body 结构，后端会将 `readOnly` 映射为输出侧写回控制
- `fieldKey` 必须命中 `mo_workflow_template_field_definitions`

- `GET /api/admin/workflow-node-designs/{id}/recommendations`
- `PUT /api/admin/workflow-node-designs/{id}/recommendations`

推荐模板 body：

```json
{
  "recommendations": [
    {
      "recommendedWorkflowTemplateId": "template-id",
      "reason": "适用于大客户",
      "displayOrder": 100,
      "enabled": true
    }
  ]
}
```

### 6.13 字段字典接口

- `GET /api/admin/workflow-templates/field-definitions`
- `POST /api/admin/workflow-templates/field-definitions`
- `PUT /api/admin/workflow-templates/field-definitions/{fieldKey}`
- `DELETE /api/admin/workflow-templates/field-definitions/{fieldKey}`

字段定义 body：

```json
{
  "fieldKey": "customer_name",
  "name": "客户名称",
  "fieldType": "string",
  "description": "客户主名称",
  "enabled": true,
  "sensitive": false,
  "groupKey": "customer",
  "displayOrder": 100,
  "meta": {
    "listSubFields": []
  }
}
```

`fieldType` 枚举：

- `string`
- `text`
- `number`
- `boolean`
- `date`
- `datetime`
- `list`
- `json`

补充：

- V1.1.14 起字段定义正式支持 `meta.listSubFields`
- 当 `fieldType = list` 时，可提交：

```json
{
  "fieldKey": "expense_items",
  "name": "费用明细",
  "fieldType": "list",
  "description": "费用条目列表",
  "enabled": true,
  "sensitive": false,
  "groupKey": "expense",
  "displayOrder": 100,
  "meta": {
    "listSubFields": [
      {
        "fieldKey": "item_name",
        "name": "项目名称",
        "fieldType": "string",
        "required": true,
        "sortOrder": 100,
        "description": "条目名称"
      },
      {
        "fieldKey": "amount",
        "name": "金额",
        "fieldType": "number",
        "required": true,
        "sortOrder": 200,
        "description": "条目金额"
      }
    ]
  }
}
```

- 当 `fieldType != list` 时，`meta.listSubFields` 必须为空
- 同一字段定义下 `listSubFields[].fieldKey` 不允许重复
- 首版 `listSubFields[].fieldType` 不允许再次为 `list`

## 7. OpenAPI（V1.1.4）

- [openapi-v1.1.4.yaml](/Users/kevin/workspace/micro-office/micro-office/docs/openapi-v1.1.4.yaml)

## 6. 契约变更规则

- 任何外部可见字段变化需同步更新本文件与相关说明文档。
- 不允许“代码改了，文档不改”。
