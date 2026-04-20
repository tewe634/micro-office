# V1.1.3 后端拆解（工作流模板）

## 1. 目标

- 提供模板包、模板节点、模块定义、推荐规则、模板实例化的完整接口。

## 2. 必做项

### 2.1 包管理 API
- CRUD + copy + status update。
- status 强校验：仅 `ACTIVE|DISABLED`。

### 2.2 节点保存 API
- 支持整包节点覆盖保存（事务）。
- 校验：
  - parent 节点必须同 package
  - `PARALLEL` 时必须有 `branch_group_key + branch_order`
  - `SEQUENCE` 时不得带 branch 信息

### 2.3 模块与字段 API
- 查询可用模块定义（按 node_type/role/position 可筛选）。
- 查询字段定义（INPUT/OUTPUT）。

### 2.4 推荐规则 API
- 按 scene + current module/type 返回推荐模块清单。
- 仅返回 `is_active=true` 规则。

### 2.5 模板实例化
- 入参模板包 ID + 业务上下文。
- 读取 package + nodes，展开成运行时流程节点。
- 记录模板来源映射（template package/node id）到运行时节点扩展字段或 meta。

## 3. 验收

- API 满足前端编排器全流程。
- 非 `ACTIVE` 模板实例化被拒绝。
- 节点拓扑非法时返回明确错误信息。
