# V1.1.13 后端契约

## 1. 目标

- 日常条目支持独立行为配置读写
- `daily_list` 运行时可输出条目行为摘要
- `open-workbench-session(sessionType=DAILY_ENTRY)` 按条目行为配置执行

## 2. 管理接口

### 2.1 获取条目行为配置

- `GET /api/admin/daily-entries/{id}/behavior`

返回：

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "dailyEntry": {
      "id": "meeting",
      "code": "MEETING",
      "name": "会议"
    },
    "behavior": {
      "id": "xxx",
      "dailyEntryId": "meeting",
      "actionType": "OPEN_WORKBENCH_SESSION",
      "sessionType": "DAILY_ENTRY",
      "executionMode": "CREATE_SESSION",
      "status": "ACTIVE",
      "requiresPreActionForm": true,
      "preActionFormTitle": "填写群聊主题",
      "preActionFormSubmitLabel": "创建群聊",
      "preActionFields": [
        {
          "fieldKey": "session_title",
          "label": "群聊主题",
          "inputType": "TEXT",
          "required": true,
          "placeholder": "请输入群聊主题",
          "maxLength": 64,
          "sortOrder": 10,
          "status": "ACTIVE",
          "meta": {}
        }
      ],
      "preActionForm": {
        "title": "填写群聊主题",
        "submitLabel": "创建群聊",
        "fields": []
      },
      "meta": {}
    }
  }
}
```

### 2.2 保存条目行为配置

- `PUT /api/admin/daily-entries/{id}/behavior`

请求体主字段：

- `actionType`: 当前固定为 `OPEN_WORKBENCH_SESSION`
- `sessionType`: 当前固定为 `DAILY_ENTRY`
- `executionMode`: `OPEN_EXISTING | CREATE_SESSION`
- `status`: `ACTIVE | INACTIVE`
- `requiresPreActionForm`: `true | false`
- `preActionFormTitle`
- `preActionFormSubmitLabel`
- `preActionFields[]`

字段模型：

- `fieldKey`
- `label`
- `inputType`: `TEXT | TEXTAREA | NUMBER | SELECT`
- `required`
- `placeholder`
- `defaultValue`
- `maxLength`
- `sortOrder`
- `status`
- `meta`

## 3. 运行时执行

### 3.1 `daily_list`

- 运行时条目在存在 ACTIVE 行为配置时返回 `behavior`
- block 不再作为条目行为主配置入口

### 3.2 `open-workbench-session`

- `POST /api/portal-runtime/open-workbench-session`
- `sessionType=DAILY_ENTRY`
- 仍接受 `targetId | dailyEntryId | externalDailyEntryId`
- 仍接受 `actionParams`
- 短期兼容 `formData | params` 并归并为 `actionParams`

执行优先级：

1. 先读条目 ACTIVE 行为配置
2. 若 `executionMode=CREATE_SESSION`，按 `preActionFields[]` 校验 `actionParams`
3. 创建会话并返回 `actionResultType=CREATED_SESSION`
4. 若无 ACTIVE 行为配置，或行为未声明创建会话，则继续走聊天策略 + 会话绑定链路

## 4. 首个场景

- 条目：会议
- 行为配置：`OPEN_WORKBENCH_SESSION + CREATE_SESSION`
- 前置字段：`session_title`
- 结果：创建新群聊并返回新 `sessionId`

## 5. 依赖

- 依赖数据库线程提供：
  - `mo_daily_entry_behaviors`
  - `mo_daily_entry_behavior_fields`
- 当前后端不再把 block action 作为日常条目行为主存储
