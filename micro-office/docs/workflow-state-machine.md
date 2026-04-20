# micro-office 状态机文档

## 1. 文档目标

统一当前系统中的状态语义和状态流转口径，尤其是门户展示状态、业务对象状态与协同配置状态。

## 2. 重要说明

- 历史工作流 runtime（threads/nodes/comments/workbench/clock）已下线。
- 本文档不再定义旧 runtime 节点流转，只定义当前在用状态语义。

## 3. 通用状态色语义

- 蓝：进行中 / 当前关注
- 灰：待处理 / 未开始
- 绿：已完成
- 橙：风险 / 待确认
- 红：异常 / 错误

## 4. 门户工作项状态（当前）

门户工作项使用：

- `TODO`
- `IN_PROGRESS`
- `COMPLETED`
- `CANCELLED`

映射：

- `TODO` -> 灰
- `IN_PROGRESS` -> 蓝
- `COMPLETED` -> 绿
- `CANCELLED` -> 红/灰（按页面语义）

## 5. 门户 scope 语义（当前）

- `personal`
- `department`
- `business`
- `system`

说明：

- scope 切换能力在不同门户类型上存在差异，需以实际接口实现为准。

## 6. 角色与可见范围语义

- 普通用户默认 personal
- leader/管理角色可扩展到 department/business（受组织与规则约束）
- admin 具备系统级能力

## 7. 演进约束

- 若未来恢复或新增 runtime 状态机，需单独新增章节，不可混入当前口径。
