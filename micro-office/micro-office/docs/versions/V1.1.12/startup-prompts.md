# V1.1.12 启动词

## 前端线程

```text
你负责 Micro Office 的前端实现线程（V1.1.12）。

先明确边界：
- 你是执行线程，负责按版本拆解文档落地前端实现。
- 不要改后端业务逻辑和数据库迁移。
- 本版不是给“工作汇报会议”写死特殊逻辑，而是新增“前置弹窗参数动作”的通用前端能力。

先阅读：
1. /Users/kevin/workspace/micro-office/micro-office/docs/README.md
2. /Users/kevin/workspace/micro-office/micro-office/docs/ui-design.md
3. /Users/kevin/workspace/micro-office/micro-office/docs/api-design.md
4. /Users/kevin/workspace/micro-office/micro-office/docs/versions/V1.1.12/overview.md
5. /Users/kevin/workspace/micro-office/micro-office/docs/versions/V1.1.12/frontend.md

本线程目标（V1.1.12）：
- 为动作体系新增“前置弹窗参数收集”前端能力。
- 按动作配置决定是否弹窗，不按条目名称硬编码。
- 跑通首个场景：输入群聊主题后创建群聊并跳转。

实现要求：
- 提供可复用弹窗组件。
- 至少支持文本输入字段、必填校验、确认提交。
- 未配置该能力的动作继续按原逻辑执行。

交付输出：
1. 已改文件清单
2. 动作识别与弹窗交互说明
3. 与后端契约对齐情况
4. 未解决阻塞项（如有）
```

## 后端线程

```text
你负责 Micro Office 的后端实现线程（V1.1.12）。

先明确边界：
- 你是执行线程，负责按版本拆解文档落地后端实现。
- 不要改前端页面和数据库迁移脚本以外的职责边界。
- 本版目标是“带前置参数的通用动作执行能力”，不是给单个条目保留专属分支。

先阅读：
1. /Users/kevin/workspace/micro-office/micro-office/docs/README.md
2. /Users/kevin/workspace/micro-office/micro-office/docs/api-design.md
3. /Users/kevin/workspace/micro-office/micro-office/docs/base-data-integration.md
4. /Users/kevin/workspace/micro-office/micro-office/docs/versions/V1.1.12/overview.md
5. /Users/kevin/workspace/micro-office/micro-office/docs/versions/V1.1.12/backend.md

本线程目标（V1.1.12）：
- 提供“前置弹窗参数动作”的后端执行能力。
- 让动作配置能声明需要哪些参数。
- 跑通首个场景：输入群聊主题后创建群聊并返回新会话。

实现要求：
- 不依赖“工作汇报会议”等条目名称硬编码。
- 动作参数进入真实后端执行主链路。
- 保持原有直接动作链路继续可用。

交付输出：
1. 已改文件清单
2. 动作配置与执行接口说明
3. 首个场景执行说明
4. 与数据库迁移的依赖关系
5. 未解决阻塞项（如有）
```

## 数据库线程

```text
你负责 Micro Office 的数据库实现线程（V1.1.12）。

先明确边界：
- 你是执行线程，负责按版本拆解文档落地数据库迁移、数据修复和校验 SQL。
- 本版要解决的是“前置弹窗参数动作”的结构化存储，不是单一会议场景打补丁。

先阅读：
1. /Users/kevin/workspace/micro-office/micro-office/docs/README.md
2. /Users/kevin/workspace/micro-office/micro-office/docs/db-design.md
3. /Users/kevin/workspace/micro-office/micro-office/docs/base-data-integration.md
4. /Users/kevin/workspace/micro-office/micro-office/docs/versions/V1.1.12/overview.md
5. /Users/kevin/workspace/micro-office/micro-office/docs/versions/V1.1.12/database.md
6. /Users/kevin/workspace/micro-office/micro-office/backend/src/main/resources/db/migration

本线程目标（V1.1.12）：
- 给出前置弹窗参数动作的数据库口径。
- 评估动作配置应该落在现有动作表还是新增子表。
- 支撑首个“群聊主题创建群聊”场景。

实现要求：
- 配置结构要可扩展，不做条目名硬编码。
- 不长期依赖无边界 JSON 兜底。
- 给出最小 migration 方案。

交付输出：
1. 新增 migration 清单
2. 动作配置结构说明
3. 首个场景数据落位说明
4. 校验 SQL 与预期结果
5. 未解决阻塞项（如有）
```

## 测试线程

```text
你负责 Micro Office 的测试验证线程（V1.1.12）。

先明确边界：
- 你是执行线程，负责按版本拆解文档做验证、回归和关闭建议。
- 不要修改业务实现代码。
- 本版重点验证“前置弹窗参数动作”的通用能力，而不是单个条目特判。

先阅读：
1. /Users/kevin/workspace/micro-office/micro-office/docs/README.md
2. /Users/kevin/workspace/micro-office/micro-office/docs/api-design.md
3. /Users/kevin/workspace/micro-office/micro-office/docs/versions/V1.1.12/overview.md
4. /Users/kevin/workspace/micro-office/micro-office/docs/versions/V1.1.12/test.md

本线程目标（V1.1.12）：
- 验证系统支持“前置弹窗参数动作”。
- 验证首个场景“输入群聊主题后创建群聊并跳转”。
- 验证原有直接动作无回归。

执行要求：
- 覆盖配置识别、弹窗校验、提交成功、提交失败等情况。
- 覆盖群聊创建结果与旧动作回归。

交付输出：
1. 验证范围
2. 关键用例与结果
3. 问题清单
4. 是否建议关闭版本
5. 残余风险（如有）
```
