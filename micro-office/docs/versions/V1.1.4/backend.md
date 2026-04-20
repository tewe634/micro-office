# V1.1.4 后端拆解（节点功能管理）

## 1. 目标

- 提供节点功能管理、字段契约管理、行为配置与模板联动校验 API。

## 2. 必做项

### 2.1 节点功能 API
- `GET /api/admin/workflow-node-features`
- `POST /api/admin/workflow-node-features`
- `PUT /api/admin/workflow-node-features/{id}`
- `PUT /api/admin/workflow-node-features/{id}/status`
- `POST /api/admin/workflow-node-features/{id}/copy`

### 2.2 字段契约 API
- `GET /api/admin/workflow-node-features/{id}/fields`
- `PUT /api/admin/workflow-node-features/{id}/fields`
- 保存时做字段唯一性、必填规则、类型合法性校验

### 2.3 行为配置 API
- `GET /api/admin/workflow-node-features/{id}/behaviors`
- `PUT /api/admin/workflow-node-features/{id}/behaviors`
- 指派规则：岗位优先解析，角色兜底

### 2.4 模板联动校验
- 模板保存前校验绑定节点功能是否 ACTIVE
- 返回引用关系：某节点功能被哪些模板节点引用
- 对停用中的节点能力返回明确阻断错误

### 2.5 文档同步
- 更新接口注释与 OpenAPI
- 同步 V1.1.4 文档字段定义

## 3. 验收

- API 可支持前端页面全部能力。
- 岗位优先指派链路可运行，角色兜底可回退。
- DISABLED 节点能力无法被新模板绑定。
