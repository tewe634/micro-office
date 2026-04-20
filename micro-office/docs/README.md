# micro-office 文档索引

## 核心文档

- [需求文档](/Users/kevin/workspace/micro-office/micro-office/docs/requirements.md)
- [UI 设计文档](/Users/kevin/workspace/micro-office/micro-office/docs/ui-design.md)
- [接口设计文档](/Users/kevin/workspace/micro-office/micro-office/docs/api-design.md)
- [数据库设计文档](/Users/kevin/workspace/micro-office/micro-office/docs/db-design.md)
- [基础数据接入边界](/Users/kevin/workspace/micro-office/micro-office/docs/base-data-integration.md)
- [权限矩阵文档](/Users/kevin/workspace/micro-office/micro-office/docs/permission-matrix.md)
- [页面数据编排文档](/Users/kevin/workspace/micro-office/micro-office/docs/screen-contracts.md)
- [状态机文档](/Users/kevin/workspace/micro-office/micro-office/docs/workflow-state-machine.md)
- [联调种子数据文档](/Users/kevin/workspace/micro-office/micro-office/docs/seed-data.md)
- [线程启动说明](/Users/kevin/workspace/micro-office/micro-office/docs/thread-briefs.md)
- [版本文档规范](/Users/kevin/workspace/micro-office/micro-office/docs/versions/README.md)

## 当前事实文档（已存在）

- [当前系统业务逻辑总结](/Users/kevin/workspace/micro-office/micro-office/docs/current-system-business-logic-summary.md)
- [门户 API 参考](/Users/kevin/workspace/micro-office/micro-office/docs/portal-api-reference.md)
- [多岗位/门户/scope 测试方案](/Users/kevin/workspace/micro-office/micro-office/docs/multi-position-portal-test-plan.md)
- [门户模板跨平台对接方案](/Users/kevin/workspace/micro-office/micro-office/docs/portal-template-cross-platform-integration-guide.md)
- [个人首页元数据 v1](/Users/kevin/workspace/micro-office/micro-office/docs/personal-home-meta-v1.md)
- [后端管理表 SQL 参考](/Users/kevin/workspace/micro-office/micro-office/docs/backend-management-tables.sql)

## 推荐阅读顺序

### 前端线程

1. [当前系统业务逻辑总结](/Users/kevin/workspace/micro-office/micro-office/docs/current-system-business-logic-summary.md)
2. [页面数据编排文档](/Users/kevin/workspace/micro-office/micro-office/docs/screen-contracts.md)
3. [门户 API 参考](/Users/kevin/workspace/micro-office/micro-office/docs/portal-api-reference.md)
4. [接口设计文档](/Users/kevin/workspace/micro-office/micro-office/docs/api-design.md)
5. [多岗位/门户/scope 测试方案](/Users/kevin/workspace/micro-office/micro-office/docs/multi-position-portal-test-plan.md)

### 后端线程

1. [需求文档](/Users/kevin/workspace/micro-office/micro-office/docs/requirements.md)
2. [当前系统业务逻辑总结](/Users/kevin/workspace/micro-office/micro-office/docs/current-system-business-logic-summary.md)
3. [接口设计文档](/Users/kevin/workspace/micro-office/micro-office/docs/api-design.md)
4. [基础数据接入边界](/Users/kevin/workspace/micro-office/micro-office/docs/base-data-integration.md)
5. [数据库设计文档](/Users/kevin/workspace/micro-office/micro-office/docs/db-design.md)

### 数据库线程

1. [数据库设计文档](/Users/kevin/workspace/micro-office/micro-office/docs/db-design.md)
2. [基础数据接入边界](/Users/kevin/workspace/micro-office/micro-office/docs/base-data-integration.md)
3. [后端管理表 SQL 参考](/Users/kevin/workspace/micro-office/micro-office/docs/backend-management-tables.sql)
4. [接口设计文档](/Users/kevin/workspace/micro-office/micro-office/docs/api-design.md)

## 当前建议

- 本阶段以“主数据 + 权限 + 门户聚合”为主线，不再按旧工作流 runtime 设计前后端主链路。
- 门户模板化走渐进式迁移：保留 `/api/portal/*`，并持续补强 `/api/portal-runtime/*`。
- 新需求先写版本拆解文档，再并行下发前后端/数据库/测试线程。
