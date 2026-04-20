# V1.1.4 前端拆解（节点功能管理）

## 1. 目标

- 交付节点功能管理界面，并在模板编排页接入节点能力展示与校验提示。

## 2. 必做项

### 2.1 节点功能列表页
- 列表：code/name/nodeType/sourceSystem/status/version/updatedAt
- 操作：新建、编辑、复制、启停
- 筛选：nodeType/status/roleKey/positionKey

### 2.2 节点功能编辑页
- 基本信息：code/name/nodeType/sourceSystem/sortOrder
- 适用范围：positionKey（优先）+ roleKey（兼容）
- 状态切换：ACTIVE/DISABLED

### 2.3 字段契约面板
- INPUT/OUTPUT 字段配置（复用 module fields 语义）
- 字段规则：required/dataType/defaultValue/validators
- 字段排序与分组

### 2.4 行为配置面板
- 指派规则（岗位映射优先）
- SLA 配置（时限、提醒阈值）
- 可执行动作白名单
- 触发配置（进入/完成事件）

### 2.5 模板联动展示
- 在模板编辑器中显示“节点功能状态与约束”
- 引用 DISABLED 节点能力时给出阻断或警告
- 展示引用关系入口（跳转到使用该节点功能的模板列表）

## 3. 验收

- 节点功能全链路可视化管理可用。
- 模板页能消费节点能力并实时反馈。
- 启停状态与后端一致，无脏状态。
