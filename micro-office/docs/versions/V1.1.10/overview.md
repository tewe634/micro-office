# V1.1.10 概览（日常特殊域下沉到 runtime/provider 层）

## 1. 版本目标

- 明确“模板系统是编排层，不是业务实现层”。
- 将“日常”这类特殊业务域的复杂性从模板层移出，下沉到 runtime/provider 层处理。
- 不把外部平台表 `mo_daily_entries` 作为 Micro Office 自己维护的主事实表。
- 为“日常入口点击后进入个人群 / 统一群”的差异化行为建立**显式策略模型**，而不是散落在 if/else 中。

## 2. 问题背景

- 当前模板层已经有：
  - `block`
  - `dataKey`
  - `displayType`
  - `action`
- 但“日常”目前是特殊域：
  - `DAILY_ENTRY`
  - `DAILY_CATEGORY`
  - 特殊的打开链路
- 如果把这些领域特殊性直接塞进模板 schema，会导致：
  - 模板模型被日常、消息、会议等特殊域逐个污染
  - 后续每来一个特殊域，都要在模板层开新口子

## 3. 本版设计结论

### 3.1 模板层保持纯编排

模板层只认：

- `block`
- `dataKey`
- `displayType`
- `action`

模板层不认：

- `mo_daily_entries`
- 外部平台表结构
- 请假 / 会议 / 个人群 / 统一群的业务实现细节

### 3.2 日常特殊性下沉到 runtime/provider 层

后端 runtime/provider 层负责：

- 根据 `dataKey` 找到已注册 provider
- 由 provider 去适配特殊域数据
- 输出统一的标准 shape 给前端

例如：

- `daily_list` -> Daily Provider
- `message_center` -> Message Provider
- `todo_list` -> Todo Provider

### 3.3 provider 必须注册化

- `dataKey -> provider` 采用白名单注册
- 不允许模板随意拼 provider 名
- 未注册 `dataKey` 直接报错，不做隐式降级

### 3.4 输出契约必须统一

即使 provider 内部实现特殊，输出仍要统一：

- `LIST` -> `{ items: [] }`
- `CARD` -> `{ entries: [] }`

前端与模板层不因为日常特殊性而改模型。

### 3.5 “个人群 / 统一群”做成显式策略

不靠后端硬编码猜测：

- 请假 -> 每人一个群
- 会议 -> 全员统一群

本版以显式策略字段承载，例如：

- `session_resolve_strategy`
  - `BY_ENTRY_ONLY`
  - `BY_ENTRY_AND_USER`

语义：

- `BY_ENTRY_ONLY`
  - 只用 `daily_entry_id` 定位统一会话
- `BY_ENTRY_AND_USER`
  - 用 `daily_entry_id + user_id` 定位个人会话

## 4. In / Out

### In Scope

- 保持模板 schema 不变
- 新增 runtime/provider 注册机制
- 新增“日常会话解析策略”与“日常会话绑定”本地表
- 让 `open_workbench_session(session_type=DAILY_ENTRY)` 走统一入口、策略分发

### Out of Scope

- 不改 `mo_daily_entries` 表结构
- 不接管外部平台对 `mo_daily_entries` 的维护职责
- 不把日常特殊字段写进模板 schema
- 不做模板层对特殊域的兼容开洞

## 5. 新增表设计（Micro Office 自有）

### 5.1 `mo_daily_entry_chat_policies`

用途：

- 存储外部日常条目的“会话解析策略”

建议字段：

- `id`
- `external_daily_entry_id`
- `entry_code`
- `entry_name`
- `session_resolve_strategy`
- `provider_key`
- `status`
- `meta`
- `created_at / created_by / updated_at / updated_by`

说明：

- 不存外部条目完整事实，只存我们自己打开会话所需的策略信息。

### 5.2 `mo_daily_entry_session_bindings`

用途：

- 存储“外部日常条目”到“本地会话”的绑定结果

建议字段：

- `id`
- `external_daily_entry_id`
- `user_id`（可空）
- `session_id`
- `binding_scope`
- `status`
- `meta`
- `created_at / created_by / updated_at / updated_by`

语义：

- `binding_scope = SHARED`
  - 统一群
- `binding_scope = PERSONAL`
  - 个人群

## 6. 功能关系口径

### 6.1 模板定义

- 模板继续只引用：
  - `daily_list`
  - `message_center`
  - `todo_list`

### 6.2 runtime provider

- 根据 `dataKey` 进入 provider
- `daily_list` 由日常 provider 负责
- provider 内部读取：
  - `mo_daily_entry_chat_policies`
  - `mo_daily_entry_session_bindings`
  - 外部平台回传/同步的日常条目数据

### 6.3 点击动作

- 前端只传 `daily_entry_id`
- 后端统一走 `open_workbench_session(session_type=DAILY_ENTRY)`
- 后端根据策略表决定：
  - `BY_ENTRY_ONLY`
  - `BY_ENTRY_AND_USER`
- 返回统一会话打开结果给前端

## 7. 依赖顺序

1. 数据库先补齐策略表与绑定表。
2. 后端建立 provider 注册与 DAILY_ENTRY 会话解析逻辑。
3. 前端保持模板与卡片消费协议稳定，只跟随最小动作契约调整。
4. 测试验证个人群 / 统一群两条链路。

## 8. 关键风险

1. **模板层被污染**
   - 如果把 chat_scope / personal/shared 等字段直接塞进模板定义，后续会快速失控。

2. **provider 未注册化**
   - 如果 `dataKey` 不做白名单注册，模板层会变相绑定后端实现名。

3. **会话策略不显式**
   - 如果仍靠后端 if/else 猜测，请假/会议的分流逻辑会越来越脆。

## 9. 验收口径

- 模板 schema 不因日常特殊域而增加专属字段。
- `dataKey -> provider` 采用显式注册白名单。
- `DAILY_ENTRY` 打开链路按策略表分流，不靠硬编码猜测。
- 前端继续消费统一 shape，不因日常特殊性重做模板和渲染模型。
