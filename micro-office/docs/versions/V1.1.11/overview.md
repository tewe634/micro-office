# V1.1.11 概览（日常条目管理）

## 1. 版本目标

- 在 Micro Office 内新增“日常条目管理”能力。
- 让“请假 / 报销 / 会议”等日常条目由 Micro Office 负责创建与维护，而不是由 Micro Office Chat 创建。
- 明确区分：
  - 条目主数据
  - 条目适用范围
  - 条目聊天策略
  - 条目会话绑定
- 保持门户模板与 block 模型不变，继续通过 `daily_list` 统一消费条目集合。

## 2. 基线理解

- `mo_portal_block_templates` / `mo_portal_template_block_refs` 负责卡片块定义与模板引用，不负责单个日常条目主数据。
- `daily_list` 是集合型 block 数据键，适合展示“请假 / 报销 / 会议”等条目列表，不适合在 block 表里逐条配置业务条目。
- 现有日常相关表中：
  - `mo_daily_categories` 更像稳定的业务主题字典，适合承载“请假 / 报销 / 会议”这类条目主数据。
  - `mo_daily_entry_targets` 适合承载条目适用范围。
  - `mo_daily_entry_chat_policies` / `mo_daily_entry_session_bindings` 适合承载聊天解析规则。
- `mo_daily_entries` 带 `organization_id`，且在另一条产品线演进中已被标记为旧模型语义；本版不再把它作为新“日常条目管理”的主表。

## 3. 本版设计结论

### 3.1 条目主数据以 `mo_daily_categories` 为主

Micro Office 新版“日常条目管理”页面，条目主记录落在：

- `mo_daily_categories`

条目主数据承载：

- 条目编码
- 条目名称
- 排序
- 状态
- 展示元数据

本版将“请假 / 报销 / 会议”视为稳定业务条目，而不是旧式组织级 daily entry。

### 3.2 条目适用范围可选接入 `mo_daily_entry_targets`

如果需要控制“某条目仅对特定组织 / 特定用户可见”，使用：

- `mo_daily_entry_targets`

语义：

- `target_type = ORG`
- `target_type = USER`

如果当前版本先做“全局统一可见”，可暂不强制启用目标范围配置页面，但数据库与后端契约要预留。

### 3.3 条目聊天规则继续使用两张本地表

聊天相关配置继续使用：

- `mo_daily_entry_chat_policies`
- `mo_daily_entry_session_bindings`

语义：

- `chat_policies` 决定如何找会话
- `session_bindings` 决定最终绑定到哪个会话

### 3.4 block 继续消费 `daily_list`

条目设计完成后，block 侧不逐条绑定“请假 / 报销 / 会议”。

block 继续维持：

- `displayType = LIST`
- `dataKey = daily_list`

runtime/provider 在渲染 `daily_list` 时：

1. 读取日常条目管理数据
2. 输出统一 `items[]`
3. 用户点击后统一走 `open_workbench_session(sessionType=DAILY_ENTRY)`

### 3.5 Micro Office 与 Micro Office Chat 边界

Micro Office 负责：

- 条目创建与编辑
- 条目适用范围
- 条目聊天策略
- 条目会话绑定

Micro Office Chat 负责：

- 使用模板
- 渲染 `daily_list`
- 响应统一动作
- 调用统一会话打开入口

## 4. In / Out

### In Scope

- 新增“日常条目管理”产品入口与管理页面
- 以 `mo_daily_categories` 作为条目主数据表
- 对接 `mo_daily_entry_targets`
- 对接 `mo_daily_entry_chat_policies`
- 对接 `mo_daily_entry_session_bindings`
- 明确 `daily_list` 的数据装配口径

### Out of Scope

- 不把条目逐条塞进 `mo_portal_block_templates`
- 不让 Micro Office Chat 创建业务条目
- 不继续以 `mo_daily_entries` 作为新版本条目管理主模型
- 不在模板 schema 里增加“请假 / 报销 / 会议”专属字段

## 5. 关键表职责

### 5.1 `mo_daily_categories`

适合承载：

- 条目主数据
- 业务主题定义

不承载：

- 聊天策略
- 具体会话绑定

### 5.2 `mo_daily_entry_targets`

适合承载：

- 条目适用于哪些组织 / 用户

不承载：

- 条目主数据
- 聊天规则

### 5.3 `mo_daily_entry_chat_policies`

适合承载：

- `BY_ENTRY_ONLY`
- `BY_ENTRY_AND_USER`
- provider 归属

### 5.4 `mo_daily_entry_session_bindings`

适合承载：

- 共享群绑定
- 个人群绑定
- 最终 `session_id`

### 5.5 `mo_daily_entries`

本版口径：

- 不作为新“日常条目管理”的主表
- 不新增依赖
- 是否保留只作为历史旧模型，由数据库与后端线程评估

## 6. 页面与数据链路

### 6.1 后台管理页

建议新增入口：

- `日常条目管理`

页面职责：

- 管理条目主数据
- 管理适用范围
- 管理聊天策略
- 管理会话绑定

### 6.2 运行时渲染

`daily_list` 数据装配链路：

1. 读取 ACTIVE 条目主数据
2. 按当前用户 / 组织过滤适用范围
3. 组装 `items[]`
4. 输出 `daily_entry_id` 供动作使用

### 6.3 点击打开

点击条目后：

1. 前端只上传 `sessionType=DAILY_ENTRY` 与 `daily_entry_id`
2. 后端按策略表决定共享群还是个人群
3. 后端按绑定表返回最终会话

## 7. 依赖顺序

1. 数据库线程先确认主表与关系表口径，必要时补充约束或映射字段。
2. 后端线程提供“日常条目管理”管理接口与 `daily_list` 运行时装配。
3. 前端线程新增管理页并复用现有 block/template 模型。
4. 测试线程验证条目创建、显示、适用范围与聊天打开链路。

## 8. 关键风险

1. **旧表职责混用**
   - 如果继续把 `mo_daily_entries` 和 `mo_daily_categories` 混着当主表，后续会再次混乱。

2. **条目主数据和聊天策略混在一起**
   - 会导致后台配置页边界不清，后续难以扩展。

3. **block 被误用成条目表**
   - 如果让 block 逐条管理“请假 / 报销 / 会议”，会破坏块资产复用模型。

4. **Chat 平台反向承担业务管理**
   - 如果让 Micro Office Chat 创建业务条目，会导致系统职责倒挂。

## 9. 验收口径

- 可以在 Micro Office 后台创建、编辑、停用“请假 / 报销 / 会议”等条目。
- 条目主数据、适用范围、聊天策略、会话绑定四层职责清晰分离。
- `daily_list` block 无需改结构即可展示新条目。
- Micro Office Chat 不承担条目创建职责。
- 新版不再以 `mo_daily_entries` 作为条目管理主中心。
