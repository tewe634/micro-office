# V1.1.12 数据库拆解

## 1. 目标

- 在不新增表的前提下，支持：
  - 节点定义独立管理
  - 工作流模板只保存节点引用结构
- 放弃上一轮“节点表双语义”方向。

## 2. 本线程要做的事

### 2.1 现有表职责收口

- `mo_workflow_recommendation_package_nodes`
  - 只承载节点定义
- `mo_workflow_template_node_input_fields`
  - 节点定义输入字段
- `mo_workflow_template_node_output_fields`
  - 节点定义输出字段
- `mo_workflow_template_node_recommendations`
  - 节点定义推荐模板
- `mo_workflow_recommendation_packages`
  - 工作流模板主表
  - `meta.nodeGraph` 承载节点引用结构

### 2.2 需要评估和调整的点

1. `mo_workflow_recommendation_package_nodes.package_id`
   - 是否仍需要保持对 `mo_workflow_recommendation_packages.id` 的外键
   - 如果保留，新的节点定义记录如何合法落库

2. `mo_workflow_recommendation_package_nodes` 的唯一约束
   - 节点定义是否应以 `code` 全局唯一为主

3. `mo_workflow_recommendation_packages.meta`
   - 是否需要对 `meta.nodeGraph` 增加结构校验口径

### 2.3 推荐数据库方向

本版数据库推荐方向是：

- 节点表只为节点定义服务
- 工作流表 `meta` 中新增并固定 `nodeGraph` 口径

建议校验原则：

- `meta` 必须是 object
- `meta.nodeGraph` 若存在，必须是二维数组
- 二维数组内元素必须是节点 id 字符串数组

说明：

- PostgreSQL 若不方便对 `nodeGraph` 做强 CHECK，可退一步由后端做强校验
- 但数据库线程必须明确最终数据库口径，不允许继续让节点引用落回节点表

## 3. 数据迁移口径

如果当前库里已经有“工作流节点副本”数据：

- 需要评估是否将其回收为 `meta.nodeGraph`
- 或清空旧编排数据并按新版重新录入

本版原则：

- 不做长期双存储
- 不保留“节点表 + meta.nodeGraph”双事实源

## 4. 风险提示

1. **旧外键阻碍独立节点定义落库**
   - 当前后端报错已经说明这是现实问题，数据库线程必须正面处理。

2. **`meta.nodeGraph` 无结构化校验**
   - 需要至少给出清晰校验 SQL 或后端强校验口径。

3. **旧工作流节点副本数据遗留**
   - 必须明确清理或迁移策略。

## 5. 交付输出

1. 新增 migration 清单
2. 各表职责与字段口径说明
3. `meta.nodeGraph` 的数据库口径说明
4. 旧工作流节点副本数据如何处理
5. 校验 SQL 与预期结果
6. 未解决阻塞项
