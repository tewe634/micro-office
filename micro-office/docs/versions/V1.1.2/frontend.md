# V1.1.2 前端拆解

## 1. 目标

- 在预览页实现“结构固定 + 数据驱动小框”的渲染。
- 视觉按第三图还原：深色驾驶舱、横向并排、多面板。

## 2. 必做项

### 2.1 重构预览渲染引擎

- 输入：`template.sections` + `data.blocks`
- 输出：
  - section 外壳（大框）
  - block 小框集合（有值才显示）

### 2.2 数据容器解析器

为每个 `block` 实现统一解析：
- `LIST`：`payload.items`
- `CARD`：`payload.entries` 或 `payload.blocks`
- 为空则返回空数组

### 2.3 小框组件规则

- `customer_list.items[]`：
  - 标题：`customer_name/company_name`
  - 副文案：`owner_name/customer_status`
  - 右侧按钮：会话气泡（有 `open_workbench_session` 才显示）
- `daily_list.items[]`：渲染快捷入口按钮
- `relation_graph.blocks[]`：分组渲染，组内按 `label/value` 行展示
- `aiwarn_list.items[]`：渲染提醒卡片（message + time）
- `basic_info.entries`/`todo_list.items` 为空时：只保留大框，不出小框

### 2.4 视觉与布局

- 多列驾驶舱主布局
- 大框统一边框/圆角/暗色渐变
- 小框统一尺寸体系和文本层级
- 主视图去掉 `dataKey` 文本

### 2.5 调试信息

- 以折叠面板保留 template/dataset 信息
- 默认关闭

## 3. 验收

- 样例数据下渲染结果与第三图结构一致。
- 空数据 section 仅显示大框。
- 有 action 的项显示按钮；无 action 不显示。
- 无白屏、无 console error。
