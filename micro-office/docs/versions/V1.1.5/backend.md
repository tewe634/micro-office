# V1.1.5 后端拆解

## 1. 目标

- 后端强制落实“节点保存只改节点、模板保存只改模板包”。

## 2. 必做项

### 2.1 接口职责强约束
- `PUT /packages/{id}`：仅处理 package 字段
- `PUT /packages/{id}/nodes`：仅处理 nodes 字段

### 2.2 Service 层拆分
- `updatePackageInfo()`：只写 package 表
- `saveNodes()`：只写 node 表（含拓扑校验）

### 2.3 防误写策略
- 节点保存接口遇到 package 字段：返回 400（推荐）
- 若暂不报错，至少忽略并记录 warning 日志

### 2.4 保留原有节点校验
- parent 存在性
- 循环依赖
- SEQUENCE/PARALLEL 与 branch 参数一致性

## 3. 验收

- 节点保存不触发 package update SQL
- package 保存不触发 node update SQL
- 非法请求体行为可预期
