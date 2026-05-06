# V1.1.15 启动词

## 前端线程

```text
你负责 Micro Office 的前端实现线程（V1.1.15）。

先明确边界：
- 你是执行线程，负责按版本拆解文档落地前端实现。
- 不要改后端业务逻辑和数据库迁移。
- 本版是“人员外部账号绑定”，不是岗位绑定；只是入口位置放在岗位 tab 边上。

先阅读：
1. /Users/kevin/workspace/micro-office/docs/README.md
2. /Users/kevin/workspace/micro-office/docs/ui-design.md
3. /Users/kevin/workspace/micro-office/docs/api-design.md
4. /Users/kevin/workspace/micro-office/docs/versions/V1.1.15/overview.md
5. /Users/kevin/workspace/micro-office/docs/versions/V1.1.15/frontend.md

本线程目标（V1.1.15）：
- 在人员&组织区域新增“外部账号绑定”入口。
- 入口位置靠近岗位 tab。
- 界面明确表达这是人员绑定，不是岗位绑定。

实现要求：
- 列表展示用户、组织、岗位与绑定状态。
- 支持查看、编辑、解绑。
- 页面文案不要误导成岗位绑定。

交付输出：
1. 已改文件清单
2. 页面入口与交互说明
3. 与后端契约对齐情况
4. 未解决阻塞项（如有）
```

## 后端线程

```text
你负责 Micro Office 的后端实现线程（V1.1.15）。

先明确边界：
- 你是执行线程，负责按版本拆解文档落地后端实现。
- 不要改前端页面和数据库迁移脚本以外的职责边界。
- 本版主语义是用户外部账号绑定，不是岗位绑定。

先阅读：
1. /Users/kevin/workspace/micro-office/docs/README.md
2. /Users/kevin/workspace/micro-office/docs/api-design.md
3. /Users/kevin/workspace/micro-office/docs/base-data-integration.md
4. /Users/kevin/workspace/micro-office/docs/versions/V1.1.15/overview.md
5. /Users/kevin/workspace/micro-office/docs/versions/V1.1.15/backend.md

本线程目标（V1.1.15）：
- 基于 mo_user_external_accounts 提供人员外部账号绑定管理接口。
- 列表、详情、保存、解绑完整可用。

实现要求：
- 绑定关系挂在 user_id，不得引入 position_id 主路径。
- 唯一约束冲突返回明确错误。
- 同步更新接口文档。

交付输出：
1. 已改文件清单
2. 接口说明与错误语义
3. 与数据库结构的对齐情况
4. 未解决阻塞项（如有）
```

## 数据库线程

```text
你负责 Micro Office 的数据库实现线程（V1.1.15）。

先明确边界：
- 你是执行线程，负责按版本拆解文档落地数据库迁移、数据修复和校验 SQL。
- 本版重点是基于 mo_user_external_accounts 收敛数据库口径，不做岗位绑定模型。

先阅读：
1. /Users/kevin/workspace/micro-office/docs/README.md
2. /Users/kevin/workspace/micro-office/docs/db-design.md
3. /Users/kevin/workspace/micro-office/docs/base-data-integration.md
4. /Users/kevin/workspace/micro-office/docs/versions/V1.1.15/overview.md
5. /Users/kevin/workspace/micro-office/docs/versions/V1.1.15/database.md

本线程目标（V1.1.15）：
- 确认 mo_user_external_accounts 是否足够支撑后台管理。
- 输出结构、约束与校验 SQL 口径。

实现要求：
- 明确这是用户绑定表。
- 不新增岗位绑定表。
- 必要时提出最小补字段建议，否则保持现状。

交付输出：
1. 新增 migration / 校验清单
2. 表结构与约束说明
3. 校验 SQL 与预期结果
4. 未解决阻塞项（如有）
```

## 测试线程

```text
你负责 Micro Office 的测试验证线程（V1.1.15）。

先明确边界：
- 你是执行线程，负责按版本拆解文档做验证、回归和关闭建议。
- 不要修改业务实现代码。
- 本版重点验证“人员外部账号绑定”，并防止实现被误做成岗位绑定。

先阅读：
1. /Users/kevin/workspace/micro-office/docs/README.md
2. /Users/kevin/workspace/micro-office/docs/api-design.md
3. /Users/kevin/workspace/micro-office/docs/versions/V1.1.15/overview.md
4. /Users/kevin/workspace/micro-office/docs/versions/V1.1.15/test.md

本线程目标（V1.1.15）：
- 验证绑定、回显、解绑、冲突场景。
- 验证页面和接口语义始终是用户绑定。

执行要求：
- 覆盖新增绑定、重复绑定、解绑、列表回显等场景。

交付输出：
1. 验证范围
2. 关键用例与结果
3. 问题清单
4. 是否建议关闭版本
5. 残余风险（如有）
```
