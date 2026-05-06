# V1.1.14 前端拆解

## 1. 线程目标

- 补齐日常条目行为配置中的 `executionMode` 可编辑能力。
- 让前端保存和回显链路完整覆盖 `executionMode`。

## 2. 必做项

### 2.1 API 类型补齐

在前端 API 类型中新增：

- `executionMode?: 'OPEN_EXISTING' | 'CREATE_SESSION'`

至少补到：

- `DailyEntryBehaviorPayload`
- 相关运行时行为类型

### 2.2 编辑页控件补齐

在 `AdminDailyEntryPage` 的“行为配置”区块新增：

- 执行模式控件

建议使用下拉框，至少两项：

- 打开已有会话
- 创建新会话

### 2.3 保存请求补齐

前端构建 `behaviorConfig` 保存请求时，显式提交：

- `executionMode`

### 2.4 详情回显补齐

详情接口返回行为配置时，前端能正确解析：

- `executionMode`

并在页面上回显当前值。

### 2.5 联动提示

建议增加最小交互提示：

- 当选择 `CREATE_SESSION` 时，若未启用前置弹窗或未配置字段，给出明确引导

## 3. 前端验收标准

- 页面可选 `executionMode`
- 保存后刷新仍能正确显示
- 会议条目完整配置后，可支撑创建新会话场景

## 4. 重点改动文件

- `frontend/src/api/index.ts`
- `frontend/src/pages/admin/AdminDailyEntryPage.tsx`
- 可能涉及运行时辅助类型文件

## 5. 非目标

- 不改日常条目行为主结构
- 不扩展复杂动作编排器
