# V1.1.1 概览

## 1. 版本目标

- 将“门户模板预览”改成设计图同款深色驾驶舱风格，按 **1:1 还原优先** 执行。
- 改造范围仅限管理端预览页，不改正式业务门户。
- 在现有 4 张模板表基础上完成非 `PERSON_ROLE` 预览扩展与配置链路。

## 2. 本版范围

### 2.1 In Scope

- 页面范围：`/admin/portal-templates/:id/preview`。
- 编辑页新增模板级“预览主体”配置（真实业务主体）。
- 预览接口支持 query 传参 `entityType/entityId`，用于非 `PERSON_ROLE` 精准预览。
- 前端深色驾驶舱布局改造（宽屏优先，保持多列骨架）。

### 2.2 Out of Scope

- 不改 `PortalPage` 正式门户。
- 不做自动轮播（本版静态，下一版再上）。
- 不新增模板结构表，不引入新 schema。

## 3. 已确认决策

1. 视觉验收：按截图 1:1 还原优先。
2. 改造范围：只改管理端预览页。
3. 调试信息：保留，默认折叠。
4. 预览类型：扩展到全部模板类型。
5. 预览主体来源：编辑页模板级配置，不在预览页二次选择。
6. 存储方式：`mo_portal_templates.meta.previewEntity`，字段为 `entityType/entityId`。
7. 数据库策略：沿用现有 4 表，不新增表。
8. 接口方式：`GET /preview` + query 参数。
9. 无法解析预览主体时：直接报错并中止渲染。
10. 自动保存：编辑页自动保存，1000ms 防抖。
11. 自动保存失败：toast 提示（不做字段级错误态）。
12. 预览跳转时若仍在保存：阻止跳转，提示“保存中”。
13. 枚举口径：`entityType` 与门户主体类型对齐。
14. 类型不一致校验：后端拒绝 + 前端预检拦截。
15. 响应式：宽屏骨架优先，保留横向滚动，不改成纯纵向流。

## 4. 前后端交互协议（V1.1.1）

## 4.1 编辑页自动保存模板（含预览主体）

- 接口：`PUT /api/admin/portal-templates/templates/{id}`
- 关键字段：

```json
{
  "meta": {
    "previewEntity": {
      "entityType": "PRODUCT",
      "entityId": "<真实主体ID>"
    }
  }
}
```

- 约束：
  - `previewEntity.entityType` 仅允许：`PERSON|PRODUCT|CUSTOMER_COMPANY|SUPPLIER|CARRIER|BANK|ORGANIZATION`
  - `previewEntity.entityType` 与 `templateType` 必须匹配；不匹配后端返回 400。

## 4.2 预览接口

- 方法：`GET`
- 路径：`/api/admin/portal-templates/templates/{id}/preview`
- Query（可选）：`entityType`、`entityId`
- 优先级：
  1. query 参数（若提供）
  2. `template.meta.previewEntity`
  3. 若都无，返回明确错误（不兜底自动猜）

## 4.3 预览响应

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "templateId": "...",
    "templateCode": "...",
    "templateName": "...",
    "templateVersion": "1",
    "entityType": "PRODUCT",
    "entityId": "...",
    "portalContext": {
      "previewMode": true,
      "previewPositionId": "...",
      "previewPositionName": "..."
    },
    "template": {
      "id": "...",
      "templateType": "PRODUCT",
      "meta": {
        "layout_mode": "cockpit_dark"
      },
      "sections": []
    },
    "datasets": {},
    "previewUser": {},
    "errors": []
  }
}
```

## 5. 依赖顺序

1. 后端先实现预览主体校验与预览接口 query 协议。
2. 前端编辑页实现预览主体配置 + 自动保存 + 保存中拦截。
3. 前端预览页实现深色驾驶舱 1:1 样式与模块映射。
4. 数据库线程补充 meta 规范和必要修复 SQL（不改 schema）。
5. 测试线程按协议、视觉、兼容回归执行验收。

## 6. 验收口径

- 预览页视觉达到截图级别 1:1 还原优先。
- 非 `PERSON_ROLE` 模板可通过配置主体后正常预览。
- `entityType/entityId` 缺失或不合法时返回明确错误。
- 模板保存中不允许跳预览，避免脏读。
- 旧模板可降级预览，不白屏。
