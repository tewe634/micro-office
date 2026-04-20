# V1.1.5 联调检查清单

## 前端自查

- [ ] 节点保存请求只有 `{ nodes: [...] }`
- [ ] package 区域不会在节点保存时提交
- [ ] 节点保存失败时可看到后端 400 文案

## 后端自查

- [ ] `/packages/{id}/nodes` 不执行 package update
- [ ] `/packages/{id}` 不执行 node update
- [ ] 误传 package 字段时返回 400

## 联调对照

- [ ] 改节点保存后，刷新页面 package 信息不变
- [ ] 改 package 保存后，刷新页面节点不变
- [ ] SQL 日志确认写路径隔离
