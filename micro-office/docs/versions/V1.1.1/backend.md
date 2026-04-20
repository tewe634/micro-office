# V1.1.1 后端拆解

## 1. 线程目标

- 支持全部模板类型的预览主体指定。
- 保证预览主体与模板类型一致性校验。

## 2. 必做项

### 2.1 更新模板接口校验

- 接口：`PUT /api/admin/portal-templates/templates/{id}`。
- 解析 `meta.previewEntity`：`entityType/entityId`。
- 校验规则：
  - 两字段必须同时存在。
  - `entityType` 必须在允许枚举中。
  - `entityType` 必须与 `templateType` 匹配；不匹配返回 400。

### 2.2 扩展预览接口

- 接口：`GET /api/admin/portal-templates/templates/{id}/preview`。
- 新增 query 支持：`entityType/entityId`。
- 解析优先级：
  1. query
  2. `meta.previewEntity`
  3. 缺失则返回明确错误（不自动选样本）

### 2.3 非 PERSON_ROLE 预览支持

- 预览逻辑从“仅 PERSON_ROLE”扩展到：
  - `PRODUCT`
  - `CUSTOMER_COMPANY`
  - `SUPPLIER`
  - `CARRIER`
  - `BANK`
  - `ORGANIZATION`
  - `PERSON_ROLE`
- 各类型按主体 ID 装配 `datasets`；装配失败写入错误并可控返回。

### 2.4 错误语义

- 主体缺失：`400` + 明确 message（例如“未配置预览主体”）。
- 主体类型不匹配：`400` + 明确 message。
- 主体不存在：`404` + 明确 message。

## 3. 后端验收标准

- 保存接口能正确持久化 `meta.previewEntity`。
- 预览接口可按 query 或模板配置解析主体。
- 全模板类型可预览。
- 错误码和错误信息稳定可识别。

## 4. 重点改动文件

- `backend/src/main/java/com/microoffice/controller/PortalTemplateAdminController.java`
- 可能涉及：`PortalRuntimeController`（按主体类型取数据时）

## 5. 非目标

- 不改权限体系。
- 不改正式 runtime 主链路协议。
