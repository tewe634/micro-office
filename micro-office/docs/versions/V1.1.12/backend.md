# V1.1.12 后端拆解

## 1. 目标

- 让节点定义与工作流编排彻底分开。
- 节点定义继续由节点表承载。
- 工作流编排改为只读写 `mo_workflow_recommendation_packages.meta.nodeGraph`。

## 2. 本线程要做的事

### 2.1 节点设计接口

保留并收敛独立节点设计接口：

- `GET /api/admin/workflow-node-designs`
- `GET /api/admin/workflow-node-designs/{id}`
- `POST /api/admin/workflow-node-designs`
- `PUT /api/admin/workflow-node-designs/{id}`
- `PUT /api/admin/workflow-node-designs/{id}/status`
- `DELETE /api/admin/workflow-node-designs/{id}`
- 输入/输出字段配置接口
- 推荐模板配置接口

要求：

- 节点设计接口只操作节点定义
- 不再通过“伪造 package 关系”来创建独立节点

### 2.2 工作流模板接口

工作流模板接口职责改为：

- 保存模板基础信息
- 保存 `meta.nodeGraph`
- 返回 `nodeGraph`
- 根据 `nodeGraph` 装配节点定义详情供前端画布使用

工作流接口禁止：

- 再写 `mo_workflow_recommendation_package_nodes` 的工作流引用副本
- 再把节点定义字段混进工作流保存请求

### 2.3 `nodeGraph` 契约

工作流模板详情至少要能稳定返回：

```json
{
  "id": "template-id",
  "name": "销售经理流程",
  "meta": {
    "nodeGraph": [
      ["nodeid1"],
      ["nodeid2"],
      ["nodeid3", "nodeid4"]
    ]
  }
}
```

建议同时返回装配结果：

```json
{
  "nodeGraph": [
    ["nodeid1"],
    ["nodeid2"],
    ["nodeid3", "nodeid4"]
  ],
  "nodeDefinitions": [
    {
      "id": "nodeid1",
      "name": "发起申请",
      "code": "START_APPLY",
      "nodeType": "TASK"
    }
  ]
}
```

### 2.4 查询与校验

后端在保存 `nodeGraph` 时必须校验：

- `nodeGraph` 必须是二维数组
- 所有节点 id 必须命中节点定义表
- 不允许空层
- 不允许引用不存在的节点
- 若本版要求节点在图中唯一出现，则需校验不重复

## 3. 数据口径

- `mo_workflow_recommendation_package_nodes`
  - 只承载节点定义
- `mo_workflow_template_node_input_fields`
  - 节点定义输入字段
- `mo_workflow_template_node_output_fields`
  - 节点定义输出字段
- `mo_workflow_template_node_recommendations`
  - 节点定义推荐模板
- `mo_workflow_recommendation_packages.meta.nodeGraph`
  - 工作流节点引用结构

## 4. 禁止事项

- 不要继续使用“`package_id = id` + `meta.designOnly = true`”作为本版主方案
- 不要继续使用“`package_id IS NULL / IS NOT NULL` 双语义节点表”作为本版主方案
- 不要继续保留 `PUT /packages/{id}/nodes` 作为主要保存接口语义
- 不要写长期兼容分支

## 5. 契约缺口处理

如果共享 `api-design.md` 还保留旧口径：

- 先按 V1.1.12 版本文档落实实现
- 同步把共享文档更新为 `nodeGraph` 主路径

## 6. 交付输出

1. 已改文件清单
2. 节点设计接口与工作流模板接口调整清单
3. `nodeGraph` 读写与装配说明
4. 删除了哪些旧工作流节点副本逻辑
5. 与数据库变更的依赖关系
6. 未解决阻塞项
