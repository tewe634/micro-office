# V1.1.14 启动词

## 前端线程

```text
你负责 Micro Office 的前端实现线程（V1.1.14）。

先明确边界：
- 你是执行线程，负责按版本拆解文档落地前端实现。
- 不要改后端业务逻辑和数据库迁移。
- 本版主题是“list 字段必须可配置列表项子字段结构”。

先阅读：
1. /Users/kevin/workspace/micro-office/micro-office/docs/README.md
2. /Users/kevin/workspace/micro-office/micro-office/docs/ui-design.md
3. /Users/kevin/workspace/micro-office/micro-office/docs/api-design.md
4. /Users/kevin/workspace/micro-office/micro-office/docs/versions/V1.1.14/overview.md
5. /Users/kevin/workspace/micro-office/micro-office/docs/versions/V1.1.14/frontend.md

本线程目标（V1.1.14）：
- 在字段定义弹窗中补齐 list 子字段管理区。

实现要求：
- 仅当 fieldType=list 时显示子字段管理区域。
- 支持子字段新增、编辑、删除、排序。
- 首版不允许子字段再次选择 list。
- 与后端契约对齐到 `meta.listSubFields`。

交付输出：
1. 已改文件清单
2. list 字段交互说明
3. 与后端契约对齐情况
4. 未解决阻塞项（如有）
```

## 后端线程

```text
你负责 Micro Office 的后端实现线程（V1.1.14）。

先明确边界：
- 你是执行线程，负责按版本拆解文档落地后端实现。
- 不要改前端页面和数据库迁移脚本以外的职责边界。
- 本版目标是让字段定义接口正式支持 list 子字段结构。

先阅读：
1. /Users/kevin/workspace/micro-office/micro-office/docs/README.md
2. /Users/kevin/workspace/micro-office/micro-office/docs/api-design.md
3. /Users/kevin/workspace/micro-office/micro-office/docs/versions/V1.1.14/overview.md
4. /Users/kevin/workspace/micro-office/micro-office/docs/versions/V1.1.14/backend.md

本线程目标（V1.1.14）：
- 扩展字段定义接口，支持 list 子字段读写。

实现要求：
- fieldType=list 时支持子字段结构。
- fieldType!=list 时不得保存子字段。
- 子字段 key 不能重复。
- 首版不允许子字段类型再次为 list。
- 存储位置固定为 `meta.listSubFields`。

交付输出：
1. 已改文件清单
2. 字段定义接口变更说明
3. list 子字段校验说明
4. 与数据库变更依赖关系
5. 未解决阻塞项（如有）
```

## 数据库线程

```text
你负责 Micro Office 的数据库实现线程（V1.1.14）。

先明确边界：
- 你是执行线程，负责按版本拆解文档落地数据库迁移、数据修复和校验 SQL。
- 本版目标是为 list 字段补齐结构化子字段存储。

先阅读：
1. /Users/kevin/workspace/micro-office/micro-office/docs/README.md
2. /Users/kevin/workspace/micro-office/micro-office/docs/db-design.md
3. /Users/kevin/workspace/micro-office/micro-office/docs/versions/V1.1.14/overview.md
4. /Users/kevin/workspace/micro-office/micro-office/docs/versions/V1.1.14/database.md

本线程目标（V1.1.14）：
- 明确 list 子字段如何结构化落库。

实现要求：
- 不接受只靠 description 文本表达子结构。
- 必须明确非 list 字段如何保证没有残留子结构。
- 存储位置固定为 `mo_workflow_template_field_definitions.meta.listSubFields`。

交付输出：
1. 新增 migration 清单
2. list 子字段存储方案
3. 约束/索引说明
4. 校验 SQL 与预期结果
5. 未解决阻塞项（如有）
```

## 测试线程

```text
你负责 Micro Office 的测试验证线程（V1.1.14）。

先明确边界：
- 你是执行线程，负责按版本拆解文档做验证、回归和关闭建议。
- 不要修改业务实现代码。

先阅读：
1. /Users/kevin/workspace/micro-office/micro-office/docs/README.md
2. /Users/kevin/workspace/micro-office/micro-office/docs/api-design.md
3. /Users/kevin/workspace/micro-office/micro-office/docs/versions/V1.1.14/overview.md
4. /Users/kevin/workspace/micro-office/micro-office/docs/versions/V1.1.14/test.md

本线程目标（V1.1.14）：
- 验证 list 字段子结构定义的完整链路。

执行要求：
- 覆盖 list 字段新建、编辑、删除子字段。
- 覆盖非 list 字段不展示子字段区。
- 覆盖字段定义回显和节点消费。

交付输出：
1. 验证范围
2. 关键用例与结果
3. 问题清单
4. 是否建议关闭版本
5. 残余风险（如有）
```
