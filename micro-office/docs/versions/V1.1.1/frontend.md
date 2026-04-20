# V1.1.1 前端拆解

## 1. 线程目标

- 管理端预览页 1:1 视觉还原为深色驾驶舱。
- 编辑页支持模板级预览主体配置，并自动保存。

## 2. 必做项

### 2.1 编辑页：预览主体配置

- 页面：`AdminPortalTemplateEditorPage`。
- 新增字段（模板级）：
  - `previewEntity.entityType`
  - `previewEntity.entityId`
- 数据来源：真实业务主体（非 mock）。
- 校验：
  - 前端预检 `templateType` 与 `previewEntity.entityType` 一致，否则禁止提交。

### 2.2 编辑页：自动保存机制

- 触发：预览主体变更后 1000ms 防抖自动保存。
- 失败反馈：仅 toast（不做字段旁错误态）。
- 保存中状态：
  - 点击“预览门户”时若正在保存，阻止跳转并提示“保存中”。

### 2.3 预览页：深色驾驶舱重构

- 页面：`AdminPortalTemplatePreviewPage` + `PortalTemplatePreviewRenderer`。
- 布局：宽屏多列骨架优先，保留横向滚动能力。
- 风格：深色底 + 发光层 + 半透明卡片 + 模块色调分区。
- 模块映射：`处理中/客户列表/日常/关系图/AI提醒`。
- 本版不做自动轮播。

### 2.4 调试面板

- 保留模板/数据集调试信息。
- 默认折叠，避免影响主视觉。

### 2.5 预览请求协议适配

- 预览请求带 query：`entityType/entityId`。
- 来源优先使用编辑页已保存配置。

## 3. 前端验收标准

- 视觉达到截图 1:1 还原优先。
- 保存中禁止跳预览。
- 自动保存 1000ms 防抖生效。
- 非 `PERSON_ROLE` 模板配置主体后可打开预览。
- 调试信息默认折叠且可查看。

## 4. 重点改动文件

- `frontend/src/pages/admin/AdminPortalTemplateEditorPage.tsx`
- `frontend/src/pages/admin/AdminPortalTemplatePreviewPage.tsx`
- `frontend/src/components/portal/PortalTemplatePreviewRenderer.tsx`
- `frontend/src/api/index.ts`
- `frontend/src/global.css`（或新增预览专属样式文件）

## 5. 非目标

- 不改正式门户页。
- 不上自动轮播。
