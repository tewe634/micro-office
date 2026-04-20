# V1.1.10 前端拆解

## 1. 线程目标

- 保持前端模板与门户卡片渲染模型稳定。
- 不让“日常”特殊性渗入前端模板层。

## 2. 必做项

### 2.1 保持模板消费协议稳定

- 前端继续只认：
  - `block`
  - `dataKey`
  - `displayType`
  - `action`
- 不新增日常专属模板字段

### 2.2 点击日常入口统一调用

- 点击 `daily_list` / 日常相关卡片项时：
  - 继续走统一动作
  - `open_workbench_session(session_type=DAILY_ENTRY)`
- 前端不分支猜测：
  - 个人群
  - 统一群

### 2.3 不在前端做特殊域判断

- 不新增：
  - `if 请假 -> 打个人群`
  - `if 会议 -> 打统一群`
- 这类逻辑应由后端基于策略表处理

## 3. 前端验收标准

- 前端模板层不新增日常特殊 schema
- 点击链路统一走 DAILY_ENTRY 打开动作
- 前端无特殊 if/else 分流逻辑

## 4. 重点改动文件

- 视现有 DAILY_ENTRY 打开链路而定
- 可能涉及：
  - `frontend/src/pages/portal/PortalPage.tsx`
  - `frontend/src/api/index.ts`

## 5. 非目标

- 不改模板定义模型
- 不接管日常业务分流规则
