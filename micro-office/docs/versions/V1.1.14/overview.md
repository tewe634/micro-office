# V1.1.14 概览（日常条目行为补齐 executionMode）

## 1. 版本目标

- 补齐日常条目行为配置中的 `executionMode` 前后端能力。
- 让条目编辑页可以显式配置：
  - `OPEN_EXISTING`
  - `CREATE_SESSION`
- 消除“前端只能配动作类型，但不能决定执行模式”的契约缺口。
- 让“会议条目输入群聊主题后创建群聊”不再依赖数据库回填或手工 API 调用。

## 2. 问题背景

- 数据库与后端已经支持 `execution_mode`。
- 当前前端条目编辑页已有：
  - `actionType`
  - `sessionType`
  - `requiresPreActionForm`
  - `preActionFormTitle`
  - `preActionFormSubmitLabel`
  - `preActionFields`
- 但没有 `executionMode` 可编辑控件，也没有随保存请求提交。

结果就是：

- 页面上虽然能配置前置弹窗
- 但保存时后端默认把 `executionMode` 置为 `OPEN_EXISTING`
- 想实现“输入群聊主题后创建群聊”，只能依赖数据库 migration 回填或外部 API 直传

这不符合后台管理页应该完整可运营配置的目标。

## 3. 本版设计结论

### 3.1 executionMode 是条目行为的一级配置项

本版明确 `executionMode` 与以下字段同级：

- `actionType`
- `sessionType`
- `executionMode`
- `requiresPreActionForm`

它不是隐藏字段，不应只由数据库修复脚本暗中决定。

### 3.2 executionMode 语义

- `OPEN_EXISTING`
  - 按既有逻辑打开已有会话
- `CREATE_SESSION`
  - 结合前置参数创建新会话，再返回跳转

### 3.3 首个场景配置要求

若要实现“会议条目输入群聊主题后创建群聊并跳转”，至少要求：

- `actionType = OPEN_WORKBENCH_SESSION`
- `sessionType = DAILY_ENTRY`
- `executionMode = CREATE_SESSION`
- `requiresPreActionForm = true`
- 至少一条 ACTIVE 字段，包含 `fieldKey = session_title`

### 3.4 页面交互要求

在日常条目编辑页的“行为配置”区块中，新增“执行模式”控件。

建议文案：

- 打开已有会话
- 创建新会话

### 3.5 契约要求

前端保存条目行为时，必须显式提交 `executionMode`。  
前端回显条目行为时，也必须显示当前 `executionMode`。

## 4. In / Out

### In Scope

- 前端新增 `executionMode` 控件与回显
- API 类型新增 `executionMode`
- 行为保存请求补传 `executionMode`
- 运行时链路验证 `CREATE_SESSION` 真正可用

### Out of Scope

- 不重做条目行为配置整体结构
- 不新增新的动作类型
- 不改 block/template 模型

## 5. 依赖顺序

1. 前端补齐 `executionMode` 控件、类型和提交。
2. 后端确认 `daily-entries/{id}/behavior` 读写链路稳定返回 `executionMode`。
3. 测试验证“保存后回显”和“运行时创建新会话”。

## 6. 关键风险

1. **UI 有弹窗字段但无执行模式**
   - 会造成配置假完整，实际保存后仍走打开已有会话。

2. **前后端枚举不一致**
   - 会出现前端能选、后端拒绝，或保存后回显异常。

3. **继续依赖 migration 修正业务配置**
   - 会导致运营层无法自主配置行为。

## 7. 验收口径

- 条目行为配置页存在 `executionMode` 可编辑控件。
- 保存条目行为后，`executionMode` 能正确回显。
- `CREATE_SESSION` 场景不再依赖数据库回填才能生效。
- 会议条目可通过后台完整配置实现“输入主题后创建群聊并跳转”。
