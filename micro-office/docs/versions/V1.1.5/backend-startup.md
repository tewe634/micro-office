# V1.1.5 后端启动词

请按 V1.1.5 处理后端，先阅读：
- /Users/kevin/workspace/micro-office/micro-office/docs/versions/V1.1.5/overview.md
- /Users/kevin/workspace/micro-office/micro-office/docs/versions/V1.1.5/backend.md
- /Users/kevin/workspace/micro-office/micro-office/docs/versions/V1.1.5/test.md

本次目标：
1. `/packages/{id}/nodes` 只处理 nodes。
2. `/packages/{id}` 只处理 package 基本信息。
3. 两条写路径彻底解耦。

执行要求：
- service 层拆分 updatePackageInfo/saveNodes。
- 节点接口收到 package 字段返回 400，并给出可读错误文案。
- 保留现有节点拓扑校验逻辑。

完成后反馈：
- 改动文件
- 最终接口契约
- 如何保证无交叉写入
- 验证结果（含异常请求）
- 剩余依赖
