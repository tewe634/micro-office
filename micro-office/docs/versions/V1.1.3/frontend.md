# V1.1.3 前端拆解（工作流模板）

## 1. 目标

- 提供“模板包列表 + 模板编排编辑器 + 校验发布”的管理界面。

## 2. 必做项

### 2.1 模板包管理页
- 列表字段：name / scene_category / status / sort_order / version / updated_at。
- 操作：新建、编辑、复制、启用、停用。
- 状态筛选仅 `ACTIVE|DISABLED`。

### 2.2 模板编排页
- 左侧：可选模块定义（module definitions）。
- 中间：节点编排画布（顺序、并行分支、父子结构）。
- 右侧：节点配置（display_name、relation_type、branch_group_key、branch_order、meta）。
- 保存方式：整包 nodes 覆盖提交。

### 2.3 字段契约面板
- 节点绑定模块后展示该模块 `INPUT/OUTPUT` 字段。
- 必填字段高亮，发布前校验可见。

### 2.4 推荐节点提示
- 在当前节点旁展示推荐列表（来源 rule 接口）。
- 一键加入画布（可编辑后保存）。

### 2.5 发布与启停
- 无独立发布态，直接切状态：
  - 启用 => `ACTIVE`
  - 停用 => `DISABLED`

## 3. 验收

- 模板包与节点可视化编辑可用。
- 并行分支配置（group/order）可保存并回显。
- 启停动作受控且状态一致。
