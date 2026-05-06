# V1.1.13 启动词

## 前端线程

```text
你负责 Micro Office 的前端实现线程（V1.1.13）。

先明确边界：
- 你是执行线程，负责按版本拆解文档落地前端实现。
- 不要改后端业务逻辑和数据库迁移。
- 本版目标是“日常条目行为支持前置弹窗”，不是继续扩展门户卡片管理页。

先阅读：
1. /Users/kevin/workspace/micro-office/micro-office/docs/README.md
2. /Users/kevin/workspace/micro-office/micro-office/docs/ui-design.md
3. /Users/kevin/workspace/micro-office/micro-office/docs/api-design.md
4. /Users/kevin/workspace/micro-office/micro-office/docs/versions/V1.1.13/overview.md
5. /Users/kevin/workspace/micro-office/micro-office/docs/versions/V1.1.13/frontend.md

本线程目标（V1.1.13）：
- 在日常条目编辑页新增“行为配置”区块。
- 让运行时按条目行为配置决定是否先弹窗。
- 跑通会议条目“输入群聊主题后创建群聊并跳转”。

实现要求：
- 前置弹窗行为配置挂在日常条目上，不挂在 block 上。
- 支持文本字段配置、必填校验、确认提交。
- block 页不是本版主配置入口。

交付输出：
1. 已改文件清单
2. 条目行为配置与运行时交互说明
3. 与后端契约对齐情况
4. 未解决阻塞项（如有）
```

## 后端线程

```text
你负责 Micro Office 的后端实现线程（V1.1.13）。

先明确边界：
- 你是执行线程，负责按版本拆解文档落地后端实现。
- 不要改前端页面和数据库迁移脚本以外的职责边界。
- 本版目标是“日常条目行为配置 + 运行时执行”，不是 block 动作增强。

先阅读：
1. /Users/kevin/workspace/micro-office/micro-office/docs/README.md
2. /Users/kevin/workspace/micro-office/micro-office/docs/api-design.md
3. /Users/kevin/workspace/micro-office/micro-office/docs/base-data-integration.md
4. /Users/kevin/workspace/micro-office/micro-office/docs/versions/V1.1.13/overview.md
5. /Users/kevin/workspace/micro-office/micro-office/docs/versions/V1.1.13/backend.md

本线程目标（V1.1.13）：
- 提供日常条目行为配置的保存与读取能力。
- 让运行时根据条目行为配置执行动作。
- 跑通会议条目“输入群聊主题后创建群聊”首个场景。

实现要求：
- 行为归属日常条目，不依赖 block 动作配置。
- 不依赖“会议”名称硬编码。
- 原有未配置弹窗的条目继续可用。

交付输出：
1. 已改文件清单
2. 条目行为配置接口与运行时执行说明
3. 首个场景执行说明
4. 与数据库迁移的依赖关系
5. 未解决阻塞项（如有）
```

## 数据库线程

```text
你负责 Micro Office 的数据库实现线程（V1.1.13）。

先明确边界：
- 你是执行线程，负责按版本拆解文档落地数据库迁移、数据修复和校验 SQL。
- 本版目标是给“日常条目行为配置”提供数据库口径，不再把行为挂在 block 动作上。

先阅读：
1. /Users/kevin/workspace/micro-office/micro-office/docs/README.md
2. /Users/kevin/workspace/micro-office/micro-office/docs/db-design.md
3. /Users/kevin/workspace/micro-office/micro-office/docs/base-data-integration.md
4. /Users/kevin/workspace/micro-office/micro-office/docs/versions/V1.1.13/overview.md
5. /Users/kevin/workspace/micro-office/micro-office/docs/versions/V1.1.13/database.md
6. /Users/kevin/workspace/micro-office/micro-office/backend/src/main/resources/db/migration

本线程目标（V1.1.13）：
- 给出日常条目行为配置的结构化存储方案。
- 支撑前置弹窗字段配置与首个创建群聊场景。

实现要求：
- 行为配置挂在日常条目侧。
- 配置结构化，不做无边界 JSON 兜底。
- 给出最小 migration 方案。

交付输出：
1. 新增 migration 清单
2. 行为配置结构说明
3. 首个场景数据落位说明
4. 校验 SQL 与预期结果
5. 未解决阻塞项（如有）
```

## 测试线程

```text
你负责 Micro Office 的测试验证线程（V1.1.13）。

先明确边界：
- 你是执行线程，负责按版本拆解文档做验证、回归和关闭建议。
- 不要修改业务实现代码。
- 本版重点验证“日常条目行为配置”与运行时链路，而不是 block 页动作配置。

先阅读：
1. /Users/kevin/workspace/micro-office/micro-office/docs/README.md
2. /Users/kevin/workspace/micro-office/micro-office/docs/api-design.md
3. /Users/kevin/workspace/micro-office/micro-office/docs/versions/V1.1.13/overview.md
4. /Users/kevin/workspace/micro-office/micro-office/docs/versions/V1.1.13/test.md

本线程目标（V1.1.13）：
- 验证条目页可配置行为。
- 验证会议条目点击后先弹窗，再创建群聊并跳转。
- 验证 block 页不是本版主配置入口且无回归。

执行要求：
- 覆盖配置保存、回显、弹窗校验、创建成功、创建失败、旧条目回归。

交付输出：
1. 验证范围
2. 关键用例与结果
3. 问题清单
4. 是否建议关闭版本
5. 残余风险（如有）
```
