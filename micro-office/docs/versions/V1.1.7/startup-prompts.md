# V1.1.7 启动词

## 前端线程

你负责 Micro Office 的前端实现线程（V1.1.7）。

先明确边界：
- 你是执行线程，负责按版本拆解文档落地前端实现。
- 不要改后端业务逻辑和数据库迁移。
- 若发现契约缺口，先记录最小缺口并继续完成可做部分。
- 不做旧版兼容兜底；该删的旧前端代码、旧入口、旧交互要直接删。

先阅读：
1. /Users/kevin/workspace/micro-office/micro-office/docs/README.md
2. /Users/kevin/workspace/micro-office/micro-office/docs/ui-design.md
3. /Users/kevin/workspace/micro-office/micro-office/docs/screen-contracts.md
4. /Users/kevin/workspace/micro-office/micro-office/docs/api-design.md
5. /Users/kevin/workspace/micro-office/micro-office/docs/versions/V1.1.7/overview.md
6. /Users/kevin/workspace/micro-office/micro-office/docs/versions/V1.1.7/frontend.md

本线程目标（V1.1.7）：
- 重构“门户模板”首页的信息架构，明确拆成：
  - 按岗位生成模板
  - 对象模板新建
  - 模板列表
  - 卡片块定义入口
- 补齐“卡片块定义”模块的菜单入口、页面标题、选中态。
- 把模板设计页主交互改成“引用卡片块进行装配”，不再以 `section/items/actions` 直接编辑为主路径。
- 删除不符合最新产品定义的旧入口和旧编辑心智。

实现要求：
- 首页必须能直观看到“卡片块定义”入口。
- 首页必须能直观看到对象模板业务化新建按钮，不再只保留“新建空模板”单一表达。
- 模板设计页默认行为是选块、排序、启停、分区装配。
- 不做前端 fallback 去兼容旧数据。

交付输出：
1. 已改文件清单
2. 首页入口改造说明
3. 模板设计页交互改造说明
4. 与后端契约对齐情况
5. 未解决阻塞项（如有）

## 后端线程

你负责 Micro Office 的后端实现线程（V1.1.7）。

先明确边界：
- 你是执行线程，负责按版本拆解文档落地后端实现。
- 不要改前端页面和数据库迁移脚本以外的职责边界。
- 若发现数据问题，应把修复需求明确交给数据库线程，不要在后端做旧版兼容兜底。
- 该删的旧兼容分支、旧 fallback 逻辑要直接删。

先阅读：
1. /Users/kevin/workspace/micro-office/micro-office/docs/README.md
2. /Users/kevin/workspace/micro-office/micro-office/docs/api-design.md
3. /Users/kevin/workspace/micro-office/micro-office/docs/db-design.md
4. /Users/kevin/workspace/micro-office/micro-office/docs/base-data-integration.md
5. /Users/kevin/workspace/micro-office/micro-office/docs/versions/V1.1.7/overview.md
6. /Users/kevin/workspace/micro-office/micro-office/docs/versions/V1.1.7/backend.md

本线程目标（V1.1.7）：
- 让后端契约只服务最新产品模型：
  - 卡片块定义
  - 模板装配引用
- 删除旧版兼容逻辑与 fallback 解析。
- 让模板接口以块引用为主模型。
- 补齐“卡片块定义”模块所需的权限/菜单链路。

实现要求：
- `/api/admin/portal-block-templates/*` 成为正式可用的管理接口。
- 模板详情与保存围绕“块引用”收敛，不继续扩展旧 `items/actions` 主模型。
- 不在后端保留长期双轨制兼容逻辑。

交付输出：
1. 已改文件清单
2. 关键接口/服务改造说明
3. 删除了哪些旧兼容逻辑
4. 与数据库迁移的依赖关系
5. 未解决阻塞项（如有）

## 数据库线程

你负责 Micro Office 的数据库实现线程（V1.1.7）。

先明确边界：
- 你是执行线程，负责按版本拆解文档落地数据库迁移、数据修复和校验 SQL。
- 不要通过应用层兜底思路解决数据问题。
- 旧数据是否迁移、旧结构是否退休，由你主导明确。

先阅读：
1. /Users/kevin/workspace/micro-office/micro-office/docs/README.md
2. /Users/kevin/workspace/micro-office/micro-office/docs/db-design.md
3. /Users/kevin/workspace/micro-office/micro-office/docs/base-data-integration.md
4. /Users/kevin/workspace/micro-office/micro-office/backend/src/main/resources/db/migration
5. /Users/kevin/workspace/micro-office/micro-office/docs/versions/V1.1.7/overview.md
6. /Users/kevin/workspace/micro-office/micro-office/docs/versions/V1.1.7/database.md

本线程目标（V1.1.7）：
- 用数据库迁移和 backfill 把门户模板结构收敛到最新模型。
- 旧数据问题由数据库修，不让前后端做兼容兜底。
- 明确旧结构退休计划。

实现要求：
- 补齐最新结构所需 migration。
- 给出旧数据迁移方案与校验 SQL。
- 明确哪些旧表/旧字段/旧数据路径应该退休。

交付输出：
1. 新增 migration 清单
2. 数据迁移/回填说明
3. 校验 SQL 与预期结果
4. 旧结构退休口径
5. 未解决阻塞项（如有）

## 测试线程

你负责 Micro Office 的测试验证线程（V1.1.7）。

先明确边界：
- 你是执行线程，负责按版本拆解文档做验证、回归和关闭建议。
- 不要修改业务实现代码。
- 验证以最新版单一路径为准，不把旧版兼容当成默认通过条件。

先阅读：
1. /Users/kevin/workspace/micro-office/micro-office/docs/README.md
2. /Users/kevin/workspace/micro-office/micro-office/docs/current-system-business-logic-summary.md
3. /Users/kevin/workspace/micro-office/micro-office/docs/api-design.md
4. /Users/kevin/workspace/micro-office/micro-office/docs/versions/V1.1.7/overview.md
5. /Users/kevin/workspace/micro-office/micro-office/docs/versions/V1.1.7/test.md

本线程目标（V1.1.7）：
- 验证产品入口、模块职责、模板装配链路都已切到最新版本定义。
- 验证系统不再依赖旧版兼容逻辑。

执行要求：
- 重点验证首页入口、卡片块定义模块、模板设计页、对象模板新建入口。
- 若发现旧路径仍可用且与新版并行存在，按问题记录，不视为“兼容通过”。

交付输出：
1. 验证范围
2. 关键用例与结果
3. 发现的问题清单
4. 是否建议关闭版本
5. 残余风险（如有）
