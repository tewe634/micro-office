# V1.1.5 前端启动词

请按 V1.1.5 处理前端，先阅读：
- /Users/kevin/workspace/micro-office/micro-office/docs/versions/V1.1.5/overview.md
- /Users/kevin/workspace/micro-office/micro-office/docs/versions/V1.1.5/frontend.md
- /Users/kevin/workspace/micro-office/micro-office/docs/versions/V1.1.5/test.md

本次目标：
1. 节点保存请求仅发送 `{ nodes: [...] }`。
2. package 信息与节点保存动作分离（默认 package 区域只读）。
3. 节点保存前执行字段白名单过滤。

执行要求：
- 禁止把 name/scene_category/status/sort_order/description/meta 等 package 字段带入 nodes 请求。
- 保留现有节点编排交互，不破坏拓扑编辑。
- 节点保存成功/失败提示要清晰可见。

完成后反馈：
- 改动文件
- nodes 请求体前后对比
- package 区域处理方式
- 验证结果
- 剩余依赖
