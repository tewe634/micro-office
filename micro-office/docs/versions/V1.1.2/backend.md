# V1.1.2 后端拆解

## 1. 目标

- 保证预览响应可被前端“统一容器解析器”稳定消费。

## 2. 必做项

### 2.1 统一 blocks 容器输出

- `data.blocks[block_key]` 输出遵循以下之一：
  - `{ "items": [...] }`
  - `{ "entries": [...] }`
  - `{ "blocks": [...] }`
- 不返回不确定结构（如裸数组、字符串）作为主容器。

### 2.2 action 内联稳定

- 对可交互项，继续内联动作对象：
  - `switch_subject`
  - `open_workbench_session`
- 动作字段缺失时不应输出半结构对象。

### 2.3 空态一致

- 无数据时返回空容器（`items: []` / `entries: []` / `blocks: []`），不要返回 `null` 混杂格式。

### 2.4 协议兼容

- 保持现有主结构：`subject/template/data/breadcrumbs`。
- 不破坏 `entityType/entityId` 预览能力。

## 3. 验收

- 前端可仅靠容器规则完成渲染，不需要特判模板编码。
- 同一模板在不同主体下，空/非空容器行为一致。
