# V1.1.9 后端拆解

## 1. 线程目标

- 将岗位模板关系查询和写入统一切到 `mo_portal_templates.position_id`。
- 删除旧 `meta.positionId` 关系路径，不保留双读。

## 2. 必做项

### 2.1 切换岗位模板查询

重点改动 [PortalTemplateAdminController.java](/Users/kevin/workspace/micro-office/micro-office/backend/src/main/java/com/microoffice/controller/PortalTemplateAdminController.java) 中相关查询：

- 岗位列表上的当前模板查询
- 无岗位绑定模板查询
- 基于角色选择种子模板查询
- 模板列表排序中的岗位绑定优先级
- `loadPositionTemplateId()` 查询

统一改为使用：

- `position_id`

### 2.2 切换岗位模板写入

- `generateByPosition()` 创建岗位模板时：
  - 写入 `position_id`
- 模板保存链路若涉及岗位关系，也应写结构化列

### 2.3 删除旧关系事实读取

- 删掉以 `meta ->> 'positionId'` 为关系判断的代码
- 不保留：
  - `position_id` 为空时 fallback 到 `meta.positionId`

### 2.4 约束口径

- `position_id` 仅适用于 `PERSON_ROLE` 模板
- 非岗位模板不使用此字段

## 3. 后端验收标准

- 岗位模板所有主查询全部改读 `position_id`
- 岗位模板创建改写 `position_id`
- 不再存在 `meta.positionId` 关系查询逻辑

## 4. 重点改动文件

- `backend/src/main/java/com/microoffice/controller/PortalTemplateAdminController.java`

## 5. 非目标

- 不引入独立关系表
- 不保留旧版兼容读取
