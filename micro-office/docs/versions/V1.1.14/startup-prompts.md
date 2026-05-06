# V1.1.14 启动词

## 前端线程

```text
你负责 Micro Office 的前端实现线程（V1.1.14）。

先明确边界：
- 你是执行线程，负责按版本拆解文档落地前端实现。
- 不要改后端业务逻辑和数据库迁移。
- 本版目标是补齐日常条目行为配置中的 executionMode，可编辑、可保存、可回显。

先阅读：
1. /Users/kevin/workspace/micro-office/docs/README.md
2. /Users/kevin/workspace/micro-office/docs/ui-design.md
3. /Users/kevin/workspace/micro-office/docs/api-design.md
4. /Users/kevin/workspace/micro-office/docs/versions/V1.1.14/overview.md
5. /Users/kevin/workspace/micro-office/docs/versions/V1.1.14/frontend.md

本线程目标（V1.1.14）：
- 在日常条目行为配置页新增 executionMode 控件。
- 保存和回显 executionMode。
- 让 CREATE_SESSION 场景不再依赖数据库回填才能配置。

实现要求：
- 至少支持 OPEN_EXISTING / CREATE_SESSION 两种模式。
- 提交 behaviorConfig 时显式传 executionMode。
- 页面回显与保存保持一致。

交付输出：
1. 已改文件清单
2. executionMode 控件与保存链路说明
3. 与后端契约对齐情况
4. 未解决阻塞项（如有）
```

## 后端线程

```text
你负责 Micro Office 的后端实现线程（V1.1.14）。

先明确边界：
- 你是执行线程，负责按版本拆解文档落地后端实现。
- 不要改前端页面和数据库迁移脚本以外的职责边界。
- 本版重点是确认 executionMode 读写契约完整稳定。

先阅读：
1. /Users/kevin/workspace/micro-office/docs/README.md
2. /Users/kevin/workspace/micro-office/docs/api-design.md
3. /Users/kevin/workspace/micro-office/docs/base-data-integration.md
4. /Users/kevin/workspace/micro-office/docs/versions/V1.1.14/overview.md
5. /Users/kevin/workspace/micro-office/docs/versions/V1.1.14/backend.md

本线程目标（V1.1.14）：
- 确认 daily entry behavior 接口正式支持 executionMode。
- 保证 CREATE_SESSION / OPEN_EXISTING 两条链路稳定。

实现要求：
- 条目行为接口读写 executionMode。
- 不再把 CREATE_SESSION 主要依赖于 migration 修正。
- 同步更新接口文档。

交付输出：
1. 已改文件清单
2. executionMode 接口契约说明
3. 与运行时链路的关系说明
4. 与数据库迁移的依赖关系
5. 未解决阻塞项（如有）
```

## 数据库线程

```text
你负责 Micro Office 的数据库实现线程（V1.1.14）。

先明确边界：
- 你是执行线程，负责按版本拆解文档落地数据库迁移、数据修复和校验 SQL。
- 本版主要是确认 execution_mode 结构已满足产品接入要求。

先阅读：
1. /Users/kevin/workspace/micro-office/docs/README.md
2. /Users/kevin/workspace/micro-office/docs/db-design.md
3. /Users/kevin/workspace/micro-office/docs/base-data-integration.md
4. /Users/kevin/workspace/micro-office/docs/versions/V1.1.14/overview.md
5. /Users/kevin/workspace/micro-office/docs/versions/V1.1.14/database.md
6. /Users/kevin/workspace/micro-office/backend/src/main/resources/db/migration

本线程目标（V1.1.14）：
- 确认 execution_mode 字段、约束和校验 SQL。

实现要求：
- 验证 execution_mode 已存在且枚举正确。
- 输出校验 SQL 和结果。
- 同步数据库口径文档。

交付输出：
1. 新增 migration / 校验清单
2. execution_mode 结构说明
3. 校验 SQL 与预期结果
4. 未解决阻塞项（如有）
```

## 测试线程

```text
你负责 Micro Office 的测试验证线程（V1.1.14）。

先明确边界：
- 你是执行线程，负责按版本拆解文档做验证、回归和关闭建议。
- 不要修改业务实现代码。
- 本版重点验证 executionMode 从配置页到运行时是否打通。

先阅读：
1. /Users/kevin/workspace/micro-office/docs/README.md
2. /Users/kevin/workspace/micro-office/docs/api-design.md
3. /Users/kevin/workspace/micro-office/docs/versions/V1.1.14/overview.md
4. /Users/kevin/workspace/micro-office/docs/versions/V1.1.14/test.md

本线程目标（V1.1.14）：
- 验证 executionMode 可配置、可保存、可回显、可执行。

执行要求：
- 覆盖 OPEN_EXISTING / CREATE_SESSION 两类模式。
- 覆盖会议首个场景。

交付输出：
1. 验证范围
2. 关键用例与结果
3. 问题清单
4. 是否建议关闭版本
5. 残余风险（如有）
```
