# V1.1.9 启动词

## 前端线程

```text
你负责 Micro Office 的前端实现线程（V1.1.9）。

先明确边界：
- 你是执行线程，负责按版本拆解文档落地前端实现。
- 不要改后端业务逻辑和数据库迁移。
- 若发现契约缺口，先记录最小缺口并继续完成可做部分。
- 不做旧版兼容兜底；不要在前端回退读 meta.positionId。

先阅读：
1. /Users/kevin/workspace/micro-office/micro-office/docs/README.md
2. /Users/kevin/workspace/micro-office/micro-office/docs/ui-design.md
3. /Users/kevin/workspace/micro-office/micro-office/docs/api-design.md
4. /Users/kevin/workspace/micro-office/micro-office/docs/versions/V1.1.9/overview.md
5. /Users/kevin/workspace/micro-office/micro-office/docs/versions/V1.1.9/frontend.md

本线程目标（V1.1.9）：
- 跟随岗位模板关系结构化改造，确认前端不再依赖旧 `meta.positionId`。
- 不在前端做任何兼容或推断。

实现要求：
- 若页面仍直接依赖 `meta.positionId` 展示或判断，移除该依赖。
- 不新增 `position_id` 缺失时回退读 `meta.positionId` 的逻辑。

交付输出：
1. 已改文件清单
2. 前端契约调整说明
3. 删除了哪些旧兼容逻辑
4. 未解决阻塞项（如有）
```

## 后端线程

```text
你负责 Micro Office 的后端实现线程（V1.1.9）。

先明确边界：
- 你是执行线程，负责按版本拆解文档落地后端实现。
- 不要改前端页面和数据库迁移脚本以外的职责边界。
- 若数据问题需要处理，应明确交给数据库线程，不要在后端做旧版兼容兜底。
- 该删的旧兼容分支要直接删，不保留 `meta.positionId` fallback。

先阅读：
1. /Users/kevin/workspace/micro-office/micro-office/docs/README.md
2. /Users/kevin/workspace/micro-office/micro-office/docs/api-design.md
3. /Users/kevin/workspace/micro-office/micro-office/docs/db-design.md
4. /Users/kevin/workspace/micro-office/micro-office/docs/base-data-integration.md
5. /Users/kevin/workspace/micro-office/micro-office/docs/versions/V1.1.9/overview.md
6. /Users/kevin/workspace/micro-office/micro-office/docs/versions/V1.1.9/backend.md

本线程目标（V1.1.9）：
- 将岗位模板关系查询和写入统一切到 `mo_portal_templates.position_id`。
- 删除旧 `meta.positionId` 关系路径，不保留双读。

实现要求：
- 重点改造 `PortalTemplateAdminController.java`。
- 岗位模板相关查询统一改读 `position_id`。
- `generateByPosition()` 等写入链路改写 `position_id`。
- 不保留 `position_id` 为空时回退读 `meta.positionId` 的逻辑。

交付输出：
1. 已改文件清单
2. 关键查询/写入改造说明
3. 删除了哪些旧兼容逻辑
4. 与数据库迁移的依赖关系
5. 未解决阻塞项（如有）
```

## 数据库线程

```text
你负责 Micro Office 的数据库实现线程（V1.1.9）。

先明确边界：
- 你是执行线程，负责按版本拆解文档落地数据库迁移、数据修复和校验 SQL。
- 不要通过应用层兜底思路解决关系字段问题。
- 本版目标不是独立关系表，而是把岗位模板关系收敛到 `position_id` 列。

先阅读：
1. /Users/kevin/workspace/micro-office/micro-office/docs/README.md
2. /Users/kevin/workspace/micro-office/micro-office/docs/db-design.md
3. /Users/kevin/workspace/micro-office/micro-office/docs/base-data-integration.md
4. /Users/kevin/workspace/micro-office/micro-office/backend/src/main/resources/db/migration
5. /Users/kevin/workspace/micro-office/micro-office/docs/versions/V1.1.9/overview.md
6. /Users/kevin/workspace/micro-office/micro-office/docs/versions/V1.1.9/database.md

本线程目标（V1.1.9）：
- 用 migration/backfill 将岗位模板关系从 `meta.positionId` 收敛到 `position_id` 列。

实现要求：
- 在 `mo_portal_templates` 增加 `position_id`。
- 把历史 `meta.positionId` 回填到 `position_id`。
- 补齐岗位模板查询索引。
- 输出校验 SQL，确认 `PERSON_ROLE` 模板关系已完成迁移。

交付输出：
1. 新增 migration 清单
2. 回填说明
3. 校验 SQL 与预期结果
4. 是否清理 meta.positionId 的处理口径
5. 未解决阻塞项（如有）
```

## 测试线程

```text
你负责 Micro Office 的测试验证线程（V1.1.9）。

先明确边界：
- 你是执行线程，负责按版本拆解文档做验证、回归和关闭建议。
- 不要修改业务实现代码。
- 验证以最新数据结构和最新单一路径为准，不把旧版兼容当通过条件。

先阅读：
1. /Users/kevin/workspace/micro-office/micro-office/docs/README.md
2. /Users/kevin/workspace/micro-office/micro-office/docs/api-design.md
3. /Users/kevin/workspace/micro-office/micro-office/docs/versions/V1.1.9/overview.md
4. /Users/kevin/workspace/micro-office/micro-office/docs/versions/V1.1.9/test.md

本线程目标（V1.1.9）：
- 验证岗位模板关系已从 `meta.positionId` 成功收敛到 `position_id`。

执行要求：
- 验证岗位模板生成、岗位模板查询、非岗位模板不误用 `position_id`。
- 确认不存在 `meta.positionId` fallback 才能通过的场景。

交付输出：
1. 验证范围
2. 关键用例与结果
3. 问题清单
4. 是否建议关闭版本
5. 残余风险（如有）
```
