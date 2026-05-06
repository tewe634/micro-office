# V1.1.14 测试拆解

## 1. 测试目标

- 验证 `executionMode` 可在条目页配置、保存、回显。
- 验证 `CREATE_SESSION` 不再依赖数据库回填才能生效。

## 2. 核心用例

### 2.1 配置保存

- 条目行为选择 `OPEN_EXISTING` 保存成功并正确回显
- 条目行为选择 `CREATE_SESSION` 保存成功并正确回显

### 2.2 运行时行为

- `OPEN_EXISTING` 继续按既有会话链路执行
- `CREATE_SESSION` 在参数满足时创建新会话并返回

### 2.3 首个会议场景

- 配置 `CREATE_SESSION + session_title` 后
- 点击会议条目先弹窗
- 输入标题后创建新群并进入

## 3. 验收标准

- `executionMode` 从配置页到运行时全链路生效
- 不再依赖 migration 修正才能跑通会议场景

## 4. 残余风险

- 真实门户页和预览页链路差异仍需持续关注
