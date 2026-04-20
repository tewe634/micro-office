# V1.1.9 前端拆解

## 1. 线程目标

- 跟随岗位模板关系结构化改造，确认前端不再依赖旧 `meta.positionId` 语义。
- 不在前端做任何兼容或推断。

## 2. 必做项

### 2.1 契约核对

- 核对门户模板列表、岗位模板生成、模板详情页所消费的字段。
- 若前端仍直接依赖 `meta.positionId` 展示或判断，移除该依赖。

### 2.2 不做兼容兜底

- 不新增：
  - `position_id` 缺失时回退读 `meta.positionId`
  - 前端推断岗位绑定关系

### 2.3 仅做必要展示适配

- 若后端详情/列表响应字段有必要同步调整，前端做最小适配。
- 保持岗位模板页面行为稳定。

## 3. 前端验收标准

- 前端不再依赖 `meta.positionId` 作为岗位绑定事实
- 不存在前端 fallback 逻辑

## 4. 重点改动文件

- `frontend/src/pages/admin/AdminPortalTemplatePage.tsx`
- `frontend/src/pages/admin/AdminPortalTemplateEditorPage.tsx`
- 若需要：`frontend/src/api/index.ts`

## 5. 非目标

- 不改后端业务逻辑
- 不做数据库迁移
