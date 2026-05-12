# V1.1.12 启动词

## 前端线程

```text
你负责 Micro Office 的前端实现线程（V1.1.12）。

先明确边界：
- 你是执行线程，负责按版本拆解文档落地前端实现。
- 不要改后端业务逻辑和数据库迁移。
- 本版主题是“节点定义独立化，工作流仅保存引用结构”。
- 不要继续沿用旧的“工作流节点副本列表”思路。

先阅读：
1. /Users/kevin/workspace/micro-office/micro-office/docs/README.md
2. /Users/kevin/workspace/micro-office/micro-office/docs/ui-design.md
3. /Users/kevin/workspace/micro-office/micro-office/docs/api-design.md
4. /Users/kevin/workspace/micro-office/micro-office/docs/versions/V1.1.12/overview.md
5. /Users/kevin/workspace/micro-office/micro-office/docs/versions/V1.1.12/frontend.md

本线程目标（V1.1.12）：
- 新增独立“节点设计”页面。
- 工作流设计页只编辑和保存 `nodeGraph`。
- 工作流页不再定义节点。

实现要求：
- 工作流页从节点库选择节点，形成 `[[node1],[node2],[node3,node4]]` 这类结构。
- 页面保存时只提交 `nodeGraph`，不提交节点定义字段。
- 串行/并行渲染按 `nodeGraph` 实现。
- 不兼容上一轮“节点表双语义”前端方案。

交付输出：
1. 已改文件清单
2. 节点设计页入口与关键交互说明
3. 工作流页如何编辑和保存 `nodeGraph`
4. 与后端契约对齐情况
5. 未解决阻塞项（如有）
```

## 后端线程

```text
你负责 Micro Office 的后端实现线程（V1.1.12）。

先明确边界：
- 你是执行线程，负责按版本拆解文档落地后端实现。
- 不要改前端页面和数据库迁移脚本以外的职责边界。
- 本版目标是：节点定义只进节点表，工作流只在 template.meta 里保存 nodeGraph。
- 不要继续往节点表里写工作流引用副本。

先阅读：
1. /Users/kevin/workspace/micro-office/micro-office/docs/README.md
2. /Users/kevin/workspace/micro-office/micro-office/docs/api-design.md
3. /Users/kevin/workspace/micro-office/micro-office/docs/versions/V1.1.12/overview.md
4. /Users/kevin/workspace/micro-office/micro-office/docs/versions/V1.1.12/backend.md
5. /Users/kevin/workspace/micro-office/micro-office/backend/src/main/java/com/microoffice/service/WorkflowTemplateService.java
6. /Users/kevin/workspace/micro-office/micro-office/backend/src/main/java/com/microoffice/controller/AdminWorkflowTemplateController.java

本线程目标（V1.1.12）：
- 收敛独立节点设计接口。
- 将工作流模板保存链路改为读写 `meta.nodeGraph`。
- 返回 `nodeGraph` 及对应节点定义装配结果。

实现要求：
- 节点设计接口只操作节点定义。
- 工作流模板接口不再保存节点定义字段。
- 工作流保存只认 `nodeGraph`。
- 明确校验 nodeGraph 为二维数组且节点 id 全部存在。
- 不兼容上一轮“package_id = id / designOnly”或“节点表双语义”主路径。

交付输出：
1. 已改文件清单
2. 节点设计接口与工作流模板接口调整清单
3. `nodeGraph` 读写与装配说明
4. 删除了哪些旧工作流节点副本逻辑
5. 与数据库变更的依赖关系
6. 未解决阻塞项（如有）
```

## 数据库线程

```text
你负责 Micro Office 的数据库实现线程（V1.1.12）。

先明确边界：
- 你是执行线程，负责按版本拆解文档落地数据库迁移、数据修复和校验 SQL。
- 本版目标是在不新增表的前提下，支持“节点定义只进节点表，工作流只存 meta.nodeGraph”。
- 不要新增任何新表。

先阅读：
1. /Users/kevin/workspace/micro-office/micro-office/docs/README.md
2. /Users/kevin/workspace/micro-office/micro-office/docs/db-design.md
3. /Users/kevin/workspace/micro-office/micro-office/docs/versions/V1.1.12/overview.md
4. /Users/kevin/workspace/micro-office/micro-office/docs/versions/V1.1.12/database.md
5. /Users/kevin/workspace/micro-office/micro-office/backend/src/main/resources/db/migration

本线程目标（V1.1.12）：
- 收紧节点表为“只存节点定义”。
- 处理独立节点创建被旧 package 外键阻塞的问题。
- 明确 template.meta.nodeGraph 的数据库口径。

实现要求：
- 不新增表。
- 不要再按“节点表双语义”设计 migration。
- 必须明确旧工作流节点副本数据如何处理。
- 必须说明 nodeGraph 结构由数据库强校验还是后端强校验。

交付输出：
1. 新增 migration 清单
2. 各表职责与字段口径说明
3. `meta.nodeGraph` 的数据库口径说明
4. 旧工作流节点副本数据如何处理
5. 校验 SQL 与预期结果
6. 未解决阻塞项（如有）
```

## 测试线程

```text
你负责 Micro Office 的测试验证线程（V1.1.12）。

先明确边界：
- 你是执行线程，负责按版本拆解文档做验证、回归和关闭建议。
- 不要修改业务实现代码。
- 本版重点是验证“节点定义独立化，工作流仅保存 nodeGraph”。

先阅读：
1. /Users/kevin/workspace/micro-office/micro-office/docs/README.md
2. /Users/kevin/workspace/micro-office/micro-office/docs/api-design.md
3. /Users/kevin/workspace/micro-office/micro-office/docs/versions/V1.1.12/overview.md
4. /Users/kevin/workspace/micro-office/micro-office/docs/versions/V1.1.12/test.md

本线程目标（V1.1.12）：
- 验证节点定义与工作流设计真正解耦。
- 验证工作流保存只依赖 nodeGraph。
- 验证系统不再向节点表写工作流引用副本。

执行要求：
- 覆盖独立节点创建与编辑。
- 覆盖串行/并行 nodeGraph 保存。
- 覆盖工作流详情装配。
- 覆盖旧 package 外键错误已消失。

交付输出：
1. 验证范围
2. 关键用例与结果
3. 问题清单
4. 是否建议关闭版本
5. 残余风险（如有）
```
