# V1.1.10 后端拆解

## 1. 线程目标

- 建立 runtime/provider 白名单注册机制。
- 把 DAILY_ENTRY 特殊会话解析逻辑收敛到统一入口。
- 让“日常”特殊性由 provider 和策略表承担，而不是模板层承担。

## 2. 必做项

### 2.1 建立 provider 注册机制

- 后端对 `dataKey -> provider` 做白名单注册。
- 未注册 `dataKey`：
  - 明确报错
  - 不做默认降级

### 2.2 Daily Provider

- 新增或重构 Daily Provider，负责：
  - 读取日常相关输入
  - 组装标准 `LIST/CARD` 输出
  - 不把特殊域细节泄漏给模板层

### 2.3 DAILY_ENTRY 打开链路统一入口

- 对 `open_workbench_session(session_type=DAILY_ENTRY)` 统一处理。
- 后端根据 `mo_daily_entry_chat_policies` 中的 `session_resolve_strategy` 决定：
  - `BY_ENTRY_ONLY`
  - `BY_ENTRY_AND_USER`

### 2.4 会话绑定解析

- 使用 `mo_daily_entry_session_bindings` 查找本地会话绑定。
- 不直接依赖外部平台表作为本地打开会话事实源。

### 2.5 不污染模板层

- 不把 `chat_scope`、`personal/shared` 等特殊域字段加进模板 schema。

## 3. 后端验收标准

- provider 注册存在且强约束
- DAILY_ENTRY 打开链路统一收口
- 日常分流逻辑来自策略表，而不是散落硬编码
- 输出 shape 对前端保持统一

## 4. 重点改动文件

- `backend/src/main/java/com/microoffice/controller/PortalRuntimeController.java`
- 可能新增 runtime/provider/service
- 可能涉及动作解析相关 controller/service

## 5. 非目标

- 不接管 `mo_daily_entries`
- 不在模板接口层加日常特殊字段
