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
  - `GET /api/admin/daily-entries/{id}/behavior`
  - `PUT /api/admin/daily-entries/{id}/behavior`
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
- 人员外部账号绑定：
  - `GET /api/admin/user-external-accounts`
  - `GET /api/admin/users/{userId}/external-accounts`
  - `PUT /api/admin/users/{userId}/external-accounts`
  - `PUT /api/admin/users/{userId}/external-accounts/unbind`
- 工作流模板：
  - `GET /api/admin/workflow-templates/packages`
  - `GET /api/admin/workflow-templates/packages/{id}`
  - `POST /api/admin/workflow-templates/packages`
  - `PUT /api/admin/workflow-templates/packages/{id}`（仅更新 package 基本信息）
  - `PUT /api/admin/workflow-templates/packages/{id}/status`（仅 `ACTIVE|DISABLED`）
  - `POST /api/admin/workflow-templates/packages/{id}/copy`
  - `GET /api/admin/workflow-templates/packages/{id}/nodes`
  - `PUT /api/admin/workflow-templates/packages/{id}/nodes`（仅更新 nodes，且请求体仅允许 `{ "nodes": [...] }`）
  - `GET /api/admin/workflow-templates/module-definitions`
  - `GET /api/admin/workflow-templates/module-definitions/{id}/fields`
  - `GET /api/admin/workflow-templates/recommendations`
  - `PUT /api/admin/workflow-templates/packages/{id}/nodes`（保存前强校验绑定节点功能必须 `ACTIVE`）
  - 节点功能管理：
    - `GET /api/admin/workflow-node-features`
    - `GET /api/admin/workflow-node-features/{id}`
    - `POST /api/admin/workflow-node-features`
    - `PUT /api/admin/workflow-node-features/{id}`
    - `PUT /api/admin/workflow-node-features/{id}/status`（仅 `ACTIVE|DISABLED`）
    - `POST /api/admin/workflow-node-features/{id}/copy`
    - `GET /api/admin/workflow-node-features/{id}/fields`
    - `PUT /api/admin/workflow-node-features/{id}/fields`
    - `GET /api/admin/workflow-node-features/{id}/behaviors`
    - `PUT /api/admin/workflow-node-features/{id}/behaviors`
    - `GET /api/admin/workflow-node-features/{id}/references`
    - `POST /api/admin/workflow-node-features/validate-bindings`
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
- V1.1.12 起 `open_workbench_session` 动作可携带结构化前置弹窗配置：动作响应新增 `requiresPreActionForm`、`preActionFormTitle`、`preActionFormSubmitLabel`、`preActionFields[]` 与 `preActionForm`；其中 `preActionForm.fields` 为同源嵌套镜像，前端必须按动作配置决定是否先收集参数，不得按条目名称硬编码。
- V1.1.12 起 `POST /api/portal-runtime/open-workbench-session` 支持扩展请求体：
  - `actionId`：可选；传入后后端会按动作配置校验前置参数与执行模式。
  - `actionParams`：可选；结构化动作参数对象，当前首个场景至少支持 `session_title`。
  - `formData` / `params`：短期兼容别名，后端会归并为 `actionParams`。
- V1.1.12 起 `open_workbench_session(sessionType=DAILY_ENTRY)` 兼容两条链路：
  - 旧链路：无 `actionId` 时继续按聊天策略 + 会话绑定解析并打开既有会话。
  - 新链路：若动作配置 `meta.executionMode=CREATE_SESSION` 且声明前置字段，则按 `actionParams` 创建新会话并返回。
- V1.1.12 起统一执行结果增加：
  - `actionResultType`：`OPEN_EXISTING_SESSION | CREATED_SESSION`
  - `sessionId`
  - `sessionTitle`
  - `sessionStatus`
  - `sessionMeta`
  - `actionId`（若本次按动作配置执行）
- V1.1.11 起“日常条目管理”主接口写入 `mo_daily_categories`；适用范围、聊天策略、会话绑定分别走 `mo_daily_entry_targets`、`mo_daily_entry_chat_policies`、`mo_daily_entry_session_bindings`，不再把 `mo_daily_entries` 作为新版主写入表。
- V1.1.11 起 `daily_list` 仅从新版条目管理数据装配：读取 ACTIVE 条目并按 ACTIVE 目标范围过滤；若条目无 ACTIVE 目标记录则视为全局可见，不回退旧销售卡片拼装。
- V1.1.11 日常条目状态最终枚举为 `ACTIVE|INACTIVE`；后端短期兼容 `DISABLED -> INACTIVE`，兼容计划保留到 `V1.1.12`。
- V1.1.11 `PUT /api/admin/daily-entries/{id}/targets` 与 `PUT /api/admin/daily-entry-chat-policies/{dailyEntryId}/session-bindings` 标准 body 为数组；后端短期兼容对象包装体 `{ "targets": [...] }` 与 `{ "bindings": [...] }`，兼容计划保留到 `V1.1.12`。
- V1.1.11 旧路径 `/api/admin/daily-entries/{id}/chat-policy` 与 `/api/admin/daily-entries/{id}/session-bindings` 为短期兼容入口，内部转发到新聊天配置服务，兼容计划保留到 `V1.1.12`。
- V1.1.13 起日常条目行为配置正式归属 `daily-entries`：新增 `GET/PUT /api/admin/daily-entries/{id}/behavior`，配置结构以 `actionType/sessionType/executionMode/requiresPreActionForm/preActionFormTitle/preActionFormSubmitLabel/preActionFields[]` 为主，不再以 block 动作为日常条目行为主来源。
- V1.1.13 起 `daily_list` 运行时条目在存在 ACTIVE 行为配置时返回 `behavior` 摘要；前端应按条目行为决定是否先弹窗，不得按“会议”等名称硬编码。
- V1.1.13 起 `POST /api/portal-runtime/open-workbench-session` 在 `sessionType=DAILY_ENTRY` 时优先读取日常条目 ACTIVE 行为配置：
  - 若 `executionMode=CREATE_SESSION`，则按 `preActionFields[]` 校验 `actionParams` 后创建新会话并返回 `CREATED_SESSION`
  - 若无 ACTIVE 行为配置，或行为配置未声明创建新会话，则继续走既有聊天策略 + 会话绑定解析并返回 `OPEN_EXISTING_SESSION`
- V1.1.15 起人员外部账号绑定正式走 `mo_user_external_accounts`：
  - 管理主路径为 `GET /api/admin/user-external-accounts` 与 `GET/PUT /api/admin/users/{userId}/external-accounts`
  - 绑定关系正式挂在 `user_id`，不得引入 `position_id` 主路径
  - `PUT /api/admin/users/{userId}/external-accounts` 唯一约束冲突需返回明确错误：`该外部账号已绑定其他用户` 或 `当前用户在该平台企业下已存在绑定`
  - `PUT /api/admin/users/{userId}/external-accounts/unbind` 采用状态解绑，状态更新为 `UNBOUND`，不默认物理删除
- `data.blocks` 容器约定：
  - `LIST` 输出 `{ "items": [] }`
  - `CARD` 输出 `{ "entries": [] }` 或 `{ "blocks": [] }`
  - 空数据统一返回空数组容器，不返回 `null` 或裸数组
- 工作流模板包状态仅允许 `ACTIVE` 与 `DISABLED`；不支持 `DRAFT`。
- `POST /api/workflows/from-template` 仅允许 `ACTIVE` 模板实例化；`DISABLED` 模板返回 `400` 明确拒绝。
- 节点功能状态仅允许 `ACTIVE` 与 `DISABLED`；不支持 `DRAFT`。
- 模板节点绑定 `DISABLED` 节点功能会被明确拦截并返回可展示错误信息。
- 行为配置解析链路固定为：`POSITION -> ROLE -> DEFAULT`（岗位优先，角色兜底）。
- V1.1.5 起：`PUT /packages/{id}/nodes` 若携带 package 字段（如 `name/status/scene_category/sort_order`）返回 `400`。

## 7. OpenAPI（V1.1.4）

- [openapi-v1.1.4.yaml](/Users/kevin/workspace/micro-office/micro-office/docs/openapi-v1.1.4.yaml)

## 6. 契约变更规则

- 任何外部可见字段变化需同步更新本文件与相关说明文档。
- 不允许“代码改了，文档不改”。
