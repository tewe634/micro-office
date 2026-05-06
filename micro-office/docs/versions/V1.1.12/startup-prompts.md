# V1.1.12 启动词

## 前端线程

```text
你负责 Micro Office 的前端实现线程（V1.1.12）。

先明确边界：
- 你是执行线程，负责按版本拆解文档落地前端实现。
- 不要改后端业务逻辑和数据库迁移。
- 本版只改“工作汇报会议”条目的点击行为，不重做整个日常条目系统。

先阅读：
1. /Users/kevin/workspace/micro-office/micro-office/docs/README.md
2. /Users/kevin/workspace/micro-office/micro-office/docs/ui-design.md
3. /Users/kevin/workspace/micro-office/micro-office/docs/api-design.md
4. /Users/kevin/workspace/micro-office/micro-office/docs/versions/V1.1.12/overview.md
5. /Users/kevin/workspace/micro-office/micro-office/docs/versions/V1.1.12/frontend.md

本线程目标（V1.1.12）：
- 点击“工作汇报会议”后先弹窗输入会议名称。
- 用户确认后调用后端创建接口，并自动进入新群。
- 不影响其他日常条目。

实现要求：
- 弹窗至少支持会议名称输入、校验、取消、确认。
- 不能继续点击后直接跳群。
- 其他 `daily_list` 条目继续保持现有行为。

交付输出：
1. 已改文件清单
2. 弹窗与跳转交互说明
3. 与后端契约对齐情况
4. 未解决阻塞项（如有）
```

## 后端线程

```text
你负责 Micro Office 的后端实现线程（V1.1.12）。

先明确边界：
- 你是执行线程，负责按版本拆解文档落地后端实现。
- 不要改前端页面和数据库迁移脚本以外的职责边界。
- 本版只处理“工作汇报会议”点击后先命名再建群，不改其他日常条目。

先阅读：
1. /Users/kevin/workspace/micro-office/micro-office/docs/README.md
2. /Users/kevin/workspace/micro-office/micro-office/docs/api-design.md
3. /Users/kevin/workspace/micro-office/micro-office/docs/base-data-integration.md
4. /Users/kevin/workspace/micro-office/micro-office/docs/versions/V1.1.12/overview.md
5. /Users/kevin/workspace/micro-office/micro-office/docs/versions/V1.1.12/backend.md

本线程目标（V1.1.12）：
- 提供“会议名输入后创建会议群”的后端接口。
- 创建成功后返回会话信息，供前端直接跳转。
- 与现有 `open-workbench-session` 打开链路清晰分离。

实现要求：
- 会议名称作为创建参数进入主链路。
- 创建出的群标题与会议名称一致。
- 不误改其他 DAILY_ENTRY 打开链路。

交付输出：
1. 已改文件清单
2. 创建接口与创建规则说明
3. 与旧打开链路的边界说明
4. 与数据库迁移的依赖关系
5. 未解决阻塞项（如有）
```

## 数据库线程

```text
你负责 Micro Office 的数据库实现线程（V1.1.12）。

先明确边界：
- 你是执行线程，负责按版本拆解文档落地数据库迁移、数据修复和校验 SQL。
- 本版目标是最小支撑“会议名创建群”，不是重构整套日常模型。

先阅读：
1. /Users/kevin/workspace/micro-office/micro-office/docs/README.md
2. /Users/kevin/workspace/micro-office/micro-office/docs/db-design.md
3. /Users/kevin/workspace/micro-office/micro-office/docs/base-data-integration.md
4. /Users/kevin/workspace/micro-office/micro-office/docs/versions/V1.1.12/overview.md
5. /Users/kevin/workspace/micro-office/micro-office/docs/versions/V1.1.12/database.md
6. /Users/kevin/workspace/micro-office/micro-office/backend/src/main/resources/db/migration

本线程目标（V1.1.12）：
- 评估并落地“会议名创建群”所需的最小数据库支持。

实现要求：
- 先确认现有会话表是否足够承载会议名称和来源标记。
- 若需迁移，走最小字段/关系改造。
- 不为了单一需求引入过重新表。

交付输出：
1. 新增 migration 清单
2. 数据结构口径说明
3. 校验 SQL 与预期结果
4. 未解决阻塞项（如有）
```

## 测试线程

```text
你负责 Micro Office 的测试验证线程（V1.1.12）。

先明确边界：
- 你是执行线程，负责按版本拆解文档做验证、回归和关闭建议。
- 不要修改业务实现代码。
- 本版重点验证“工作汇报会议”从直接跳转改为先命名后创建。

先阅读：
1. /Users/kevin/workspace/micro-office/micro-office/docs/README.md
2. /Users/kevin/workspace/micro-office/micro-office/docs/api-design.md
3. /Users/kevin/workspace/micro-office/micro-office/docs/versions/V1.1.12/overview.md
4. /Users/kevin/workspace/micro-office/micro-office/docs/versions/V1.1.12/test.md

本线程目标（V1.1.12）：
- 验证点击“工作汇报会议”后先弹窗输入会议名。
- 验证创建成功后进入新群。
- 验证其他日常条目无回归。

执行要求：
- 覆盖空输入、合法输入、创建失败、创建成功等情况。
- 覆盖群标题正确性与群内工作流后续能力。

交付输出：
1. 验证范围
2. 关键用例与结果
3. 问题清单
4. 是否建议关闭版本
5. 残余风险（如有）
```
