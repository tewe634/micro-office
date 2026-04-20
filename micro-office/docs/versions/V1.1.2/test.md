# V1.1.2 测试拆解

## 1. 目标

- 验证“固定大框 + JSON 驱动小框”规则正确。

## 2. 用例

### 2.1 结构渲染

- sections 全显示（6 个大框）
- `basic_info.entries=[]` -> 无小框
- `todo_list.items=[]` -> 无小框
- `customer_list.items` 非空 -> 小框数量与 items 一致
- `daily_list.items` 非空 -> 小框数量与 items 一致
- `relation_graph.blocks` 非空 -> 分组与行数一致
- `aiwarn_list.items` 非空 -> 小框数量一致

### 2.2 交互渲染

- 有 `open_workbench_session` -> 显示气泡/动作入口
- 有 `switch_subject` -> 显示主体切换入口
- 无 action -> 不可点击

### 2.3 视觉验收

- 对比第三图：布局、层级、风格一致
- 主视图无 `dataKey` 文案

### 2.4 回归

- 预览加载、刷新、返回编辑页正常
- 空数据场景无错误

## 3. 通过标准

- P0：规则正确、无白屏
- P1：视觉达标
- P2：交互入口与 action 对齐
