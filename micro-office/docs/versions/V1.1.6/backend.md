# V1.1.6 后端拆解

## 1. 线程目标

- 新增“块模板管理”后端能力。
- 让门户模板从“保存内嵌块定义”扩展为“引用块模板并在运行时解析”。
- 保持预览接口与运行时输出协议稳定，避免前端渲染链路被迫重构。

## 2. 必做项

### 2.1 新增块模板管理 API

建议新增接口组：

- `GET /api/admin/portal-block-templates`
- `GET /api/admin/portal-block-templates/{id}`
- `POST /api/admin/portal-block-templates`
- `PUT /api/admin/portal-block-templates/{id}`
- `PUT /api/admin/portal-block-templates/{id}/status`
- `POST /api/admin/portal-block-templates/{id}/copy`
- `GET /api/admin/portal-block-templates/{id}/references`

管理字段最小集合：

- `code`
- `name`
- `status`
- `displayType`
- `dataKey`
- `label`
- `meta`
- `actions`

### 2.2 门户模板编辑接口扩展

- 现有模板详情/保存接口需扩展支持“块引用”关系。
- 建议模板 detail 响应中，在 section 下补充结构化 `blockRefs`：

```json
{
  "sections": [
    {
      "id": "...",
      "code": "...",
      "name": "...",
      "blockRefs": [
        {
          "id": "...",
          "blockTemplateId": "...",
          "sortOrder": 10,
          "enabled": true,
          "blockTemplate": {
            "id": "...",
            "code": "MESSAGE_CENTER",
            "name": "消息中心",
            "status": "ACTIVE",
            "displayType": "LIST",
            "dataKey": "message_center"
          }
        }
      ]
    }
  ]
}
```

保存口径：

- section 保存时允许提交 `blockRefs`
- 存量 `items/actions` 仍允许提交
- 后端保存逻辑要区分：
  - 内嵌块
  - 引用块

### 2.3 运行时解析兼容

- 在模板预览与门户运行时装配时：
  - 若 section 使用块引用，则解析块模板定义
  - 若 section 使用旧内嵌 item，则继续按原逻辑解析
- 最终统一输出前端现有结构：
  - `template.sections[].blocks[]`
  - `data.blocks`

### 2.4 引用约束

本版建议明确后端约束：

1. 页面模板引用时，块模板必须存在。
2. 默认只允许引用 `ACTIVE` 块模板；若为 `INACTIVE`，保存时明确拦截或预警。
3. 引用侧不允许覆盖 `displayType/dataKey/actions`。
4. 删除块模板前若存在引用，后端必须拒绝，并通过 `references` 接口返回影响范围。

### 2.5 试点块落地

- 以“消息中心”块模板作为首个标准块落地。
- 后端需要保证它的 `dataKey` 和预览/运行时数据装配链路可稳定输出。

## 3. 后端验收标准

- 块模板可独立 CRUD、启停、复制。
- 页面模板可保存块引用关系。
- 块模板被多个页面模板引用时，运行时可统一解析。
- 存量旧模板不迁移也能正常预览与运行。
- 删除被引用块模板时会被拦截，并能返回引用列表。

## 4. 重点改动文件

- `backend/src/main/java/com/microoffice/controller/PortalTemplateAdminController.java`
- 新增块模板管理 controller/service
- 可能涉及：门户 runtime / preview 组装逻辑

## 5. 非目标

- 不在本版做块模板版本树。
- 不做块模板跨系统分发协议。
- 不做复杂引用覆盖合并策略。
