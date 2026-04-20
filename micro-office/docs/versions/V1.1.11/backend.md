# V1.1.11 后端拆解

## 1. 线程目标

- 为“日常条目管理”提供后台管理接口。
- 明确以 `mo_daily_categories` 为条目主数据中心。
- 让 `daily_list` 的运行时数据装配从条目管理数据中读取。

## 2. 必做项

### 2.1 条目管理接口

新增或补齐后台管理接口：

- 条目列表
- 条目详情
- 新建条目
- 更新条目
- 状态切换

条目主写入表：

- `mo_daily_categories`

### 2.2 适用范围接口

若本版纳入范围控制，则补齐：

- 条目目标列表读取
- 条目目标保存

目标表：

- `mo_daily_entry_targets`

### 2.3 聊天配置接口

补齐：

- 读取 / 保存 `mo_daily_entry_chat_policies`
- 读取 / 保存 `mo_daily_entry_session_bindings`

要求：

- 不把聊天策略塞回条目主表 JSON
- 不把会话绑定塞进 block/template 元数据

### 2.4 `daily_list` 运行时装配

provider 需要改为：

1. 读取 ACTIVE 条目
2. 按目标范围过滤
3. 输出统一 `items[]`
4. 保证每项包含 `daily_entry_id`

### 2.5 与 block 的契约

运行时继续只认：

- `dataKey = daily_list`

不要新增：

- `leave_list`
- `expense_list`
- `meeting_list`

除非版本后续明确要求拆独立 block。

### 2.6 明确旧表口径

本版需要明确：

- `mo_daily_entries` 不再作为新条目管理写入主表
- 是否保留只读查询或历史数据迁移，由后端与数据库线程协同给出口径
- 不保留长期双写 / 双读兜底

## 3. 后端验收标准

- 日常条目主接口可用
- `daily_list` 能消费新条目管理数据
- 条目、范围、聊天策略、会话绑定分层清楚
- 不把业务条目再次塞回 block/template 层

## 4. 最终 API 契约

### 4.1 条目主数据

- `GET /api/admin/daily-entries`
  - query：
    - `status=ACTIVE|INACTIVE`
    - `keyword`
  - 返回：
    - `id`
    - `code`
    - `name`
    - `sortOrder`
    - `status`
    - `meta`
    - `version`
    - `activeTargetCount`
    - `hasChatPolicy`
    - `createdAt/createdBy/updatedAt/updatedBy`

- `GET /api/admin/daily-entries/{id}`
  - 返回：
    - `id`
    - `code`
    - `name`
    - `sortOrder`
    - `status`
    - `meta`
    - `version`
    - `createdAt/createdBy/updatedAt/updatedBy`

- `POST /api/admin/daily-entries`
- `PUT /api/admin/daily-entries/{id}`
  - body：

```json
{
  "id": "leave",
  "code": "LEAVE",
  "name": "请假",
  "sortOrder": 10,
  "status": "ACTIVE",
  "version": 1,
  "meta": {
    "icon": "calendar",
    "description": "请假申请"
  }
}
```

- `PUT /api/admin/daily-entries/{id}/status`
  - body：

```json
{
  "status": "ACTIVE"
}
```

状态枚举最终口径：

- `ACTIVE`
- `INACTIVE`

兼容别名：

- `DISABLED` 在后端会被短期映射为 `INACTIVE`
- 废弃计划：兼容到 `V1.1.12`

### 4.2 目标范围

- `GET /api/admin/daily-entries/{id}/targets`
- `PUT /api/admin/daily-entries/{id}/targets`

标准 body：

```json
[
  {
    "id": "target-1",
    "targetType": "ORG",
    "targetId": "90f8e26c-cf34-4e9b-a4c8-ea18353879bb",
    "status": "ACTIVE",
    "sortOrder": 10,
    "version": 1
  }
]
```

短期兼容 body：

```json
{
  "targets": [
    {
      "targetType": "ORG",
      "targetId": "90f8e26c-cf34-4e9b-a4c8-ea18353879bb",
      "status": "ACTIVE"
    }
  ]
}
```

返回字段：

- `id`
- `dailyEntryId`
- `targetType`
- `targetId`
- `status`
- `sortOrder`
- `version`
- `createdAt/createdBy/updatedAt/updatedBy`

目标范围状态枚举：

- `ACTIVE`
- `INACTIVE`

### 4.3 聊天策略

- `GET /api/admin/daily-entry-chat-policies`
- `GET /api/admin/daily-entry-chat-policies/{dailyEntryId}`
- `PUT /api/admin/daily-entry-chat-policies/{dailyEntryId}`

保存 body：

```json
{
  "entryCode": "LEAVE",
  "entryName": "请假",
  "sessionResolveStrategy": "BY_ENTRY_ONLY",
  "providerKey": "daily_list",
  "status": "ACTIVE",
  "version": 1,
  "meta": {}
}
```

详情返回：

```json
{
  "dailyEntry": {
    "id": "leave",
    "code": "LEAVE",
    "name": "请假",
    "status": "ACTIVE"
  },
  "policy": {
    "id": "policy-id",
    "dailyEntryId": "leave",
    "entryCode": "LEAVE",
    "entryName": "请假",
    "sessionResolveStrategy": "BY_ENTRY_ONLY",
    "providerKey": "daily_list",
    "status": "ACTIVE",
    "meta": {},
    "version": 1
  }
}
```

策略状态枚举：

- `ACTIVE`
- `INACTIVE`

策略错误语义：

- 条目不存在：`404 日常条目不存在`
- 策略不存在：详情返回 `policy=null`
- 策略保存参数错误：`400`

### 4.4 会话绑定

- `GET /api/admin/daily-entry-chat-policies/{dailyEntryId}/session-bindings`
- `PUT /api/admin/daily-entry-chat-policies/{dailyEntryId}/session-bindings`

标准 body：

```json
[
  {
    "id": "binding-1",
    "sessionId": "conversation-1",
    "bindingScope": "SHARED",
    "status": "ACTIVE",
    "version": 1,
    "meta": {}
  }
]
```

短期兼容 body：

```json
{
  "bindings": [
    {
      "sessionId": "conversation-1",
      "bindingScope": "SHARED",
      "status": "ACTIVE"
    }
  ]
}
```

返回字段：

- `id`
- `dailyEntryId`
- `userId`
- `sessionId`
- `bindingScope`
- `status`
- `meta`
- `version`
- `createdAt/createdBy/updatedAt/updatedBy`

绑定错误语义：

- 聊天策略不存在：`404 聊天策略不存在，请先保存聊天策略`
- `SHARED` 带 `userId`：`400 SHARED 绑定不允许携带 userId`
- `PERSONAL` 缺 `userId`：`400 PERSONAL 绑定必须提供 userId`
- 重复共享绑定：`400 SHARED 绑定只允许一条`
- 重复个人绑定：`400 会话绑定重复: PERSONAL#<userId>`

### 4.5 旧路径兼容

后端本版选择：

- `B. 增加短期兼容路由`

支持的旧路径：

- `GET /api/admin/daily-entries/{id}/chat-policy`
- `PUT /api/admin/daily-entries/{id}/chat-policy`
- `GET /api/admin/daily-entries/{id}/session-bindings`
- `PUT /api/admin/daily-entries/{id}/session-bindings`

兼容说明：

- 旧路径内部转发到新的聊天策略 / 会话绑定服务
- 兼容截止版本：`V1.1.12`
- `V1.1.13` 起计划移除，前端应切到正式路径
## 5. 重点改动文件

可能涉及：

- 新增 admin controller / service
- `PortalRuntimeProviderRegistry.java`
- `PortalRuntimeSessionService.java`
- `api-design.md`

## 6. 非目标

- 不让 Micro Office Chat 承担条目管理
- 不继续强化 `mo_daily_entries` 的旧模型主路径
- 不把条目管理做成 block 管理的子功能
