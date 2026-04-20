# V1.1.5 概览（节点保存与模板包保存解耦）

## 1. 版本目标

- 将“工作流模板编辑页”的保存语义拆分为两条独立链路：
  1. 节点编排保存：只更新节点
  2. 模板包信息保存：只更新 package 基本信息
- 彻底消除“保存节点时误改 package 字段”的风险。

## 2. 问题背景

- 当前节点编排保存存在请求体职责不清问题。
- 目标是明确接口边界与前后端行为，避免联调时互相覆盖。

## 3. In / Out

### In
- 前端：节点保存 payload 白名单、UI 保存动作分离
- 后端：接口职责强约束、服务层写路径拆分
- 测试：解耦回归与误写防护验证

### Out
- 不改状态模型（继续 ACTIVE/DISABLED）
- 不新增模板管理域能力
- 不改节点编排模型本身（SEQUENCE/PARALLEL 等规则保持）

## 4. 接口职责（V1.1.5）

- `PUT /api/admin/workflow-templates/packages/{id}`
  - 仅更新 package 基本信息（name/scene_category/status/sort_order/description/meta 等）
- `PUT /api/admin/workflow-templates/packages/{id}/nodes`
  - 仅更新 nodes（拓扑与节点配置）
  - 请求体仅允许：`{ nodes: [...] }`

## 5. 核心约束

1. 节点保存接口不得更新 package 主表字段。
2. 节点保存请求中若夹带 package 字段：后端应拒绝（400）或至少忽略并告警。
3. 前端节点保存必须做白名单过滤，确保只发 nodes 数据。

## 6. 验收口径

- 修改节点并保存后：节点变化生效，package 信息不变。
- 修改 package 并保存后：package 生效，节点不变。
- 节点接口误传 package 字段时：出现可预期错误或忽略并记录。
