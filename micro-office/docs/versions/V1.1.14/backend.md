# V1.1.14 后端拆解

## 1. 线程目标

- 确认 `executionMode` 在条目行为接口中的读写契约完整稳定。
- 配合前端补齐完整可运营配置链路。

## 2. 必做项

### 2.1 行为接口契约确认

确认 `GET/PUT /api/admin/daily-entries/{id}/behavior` 正式支持：

- `executionMode`

并且返回口径稳定为：

- `OPEN_EXISTING`
- `CREATE_SESSION`

补充约束：

- `PUT /api/admin/daily-entries/{id}/behavior` 必须显式提交 `executionMode`
- 后端不再在缺参时默认回填 `OPEN_EXISTING`
- 若已存行为配置缺失或写入了非法 `execution_mode`，`GET` 与运行时链路返回明确错误，交由数据库线程修复

### 2.2 保存链路确认

后端在保存行为配置时：

- 读取 `body.executionMode`
- 落库到 `execution_mode`
- 不再依赖 migration 才把 MEETING 修正成 `CREATE_SESSION`

### 2.3 运行时链路确认

运行时在 `CREATE_SESSION` 场景下：

- 按 `preActionFields[]` 校验参数
- 创建新会话
- 返回 `CREATED_SESSION`

运行时在 `OPEN_EXISTING` 场景下：

- 继续按聊天策略 + 会话绑定解析已有会话
- 返回 `OPEN_EXISTING_SESSION`

### 2.4 文档同步

更新：

- `docs/api-design.md`

明确 `executionMode` 是后台可配置正式字段。

## 3. 后端验收标准

- 条目行为读写接口稳定支持 `executionMode`
- 不再存在“前端不传则只能默认 OPEN_EXISTING”的隐形产品缺口
- 运行时 `CREATE_SESSION` 链路保持可用

## 4. 重点改动文件

- `backend/src/main/java/com/microoffice/service/DailyEntryBehaviorService.java`
- 相关 controller / runtime service
- `docs/api-design.md`

## 5. 非目标

- 不改数据库主结构
- 不新增新动作类型
