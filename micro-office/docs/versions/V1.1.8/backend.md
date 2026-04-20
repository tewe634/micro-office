# V1.1.8 后端拆解

## 1. 线程目标

- 让门户卡片管理列表接口只返回“卡片资产语义”，不返回模板耦合展示语义。

## 2. 必做项

### 2.1 列表输出收敛

- 修改 [PortalBlockTemplateAdminController.java](/Users/kevin/workspace/micro-office/micro-office/backend/src/main/java/com/microoffice/controller/PortalBlockTemplateAdminController.java)
- 列表接口输出的 `name` 必须是卡片资产名称
- 不再依赖 legacy code 作为展示名

### 2.2 去除无用展示字段

- 列表接口不再为该页面提供 `updatedAt` 作为必需展示字段
- 保留后端内部字段并不重要，关键是前端主列表不再依赖它

### 2.3 不做后端展示兜底

- 不在后端临时拼接：
  - 模板名 + 卡片名
  - 截断 legacy code 得出名字
- 若历史数据不符合要求，交由数据库线程修正

## 3. 后端验收标准

- 列表接口主展示字段与卡片资产语义一致
- 不再输出模板来源拼装名作为主名称
- 不增加新的 fallback 命名逻辑

## 4. 重点改动文件

- `backend/src/main/java/com/microoffice/controller/PortalBlockTemplateAdminController.java`

## 5. 非目标

- 不做编辑页 API 重构
- 不做引用页 API 重构
