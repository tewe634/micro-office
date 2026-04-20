# micro-office 线程启动说明

## 使用说明

- 本文档用于快速创建并重开项目线程。
- 线程应继承方法能力，但默认遗忘旧聊天上下文。
- 所有线程先读本仓库文档，再开始执行。

## 1. 前端线程

优先 skill：

- `/Users/kevin/workspace/micro-office/skills/micro-office-frontend/SKILL.md`

职责：

- 负责前端页面、路由、交互、状态与契约落地

不负责：

- 后端接口实现
- 数据库迁移

## 2. 后端线程

优先 skill：

- `/Users/kevin/workspace/micro-office/skills/micro-office-java-backend/SKILL.md`

职责：

- 负责接口、服务、权限、状态流转、契约实现

不负责：

- 前端实现
- 数据库结构主导设计（需与数据库线程协作）

## 3. 数据库线程

优先 skill：

- `/Users/kevin/workspace/micro-office/skills/micro-office-database/SKILL.md`

职责：

- 负责 schema、迁移、索引、约束、数据修复

不负责：

- 前端页面
- API 业务决策

## 4. 测试线程

优先 skill：

- `/Users/kevin/workspace/micro-office/skills/micro-office-test-engineer/SKILL.md`

职责：

- 负责 bug 分析、回归计划、修复验证、关闭建议

不负责：

- 新版本需求拆解

## 5. 版本需求分析线程

优先 skill：

- `/Users/kevin/workspace/micro-office/skills/micro-office-version-analyst/SKILL.md`

职责：

- 负责版本需求拆解、任务分发、依赖顺序

不负责：

- bug 修复回归裁决

## 6. 重开线程口径

重开时默认：

- 继承能力、风格、拆解方式
- 遗忘旧聊天结论和假设
- 重新从当前代码与文档建立认知

## 7. 推荐推进顺序

1. 版本需求分析线程先产出分解文档
2. 前端/后端/数据库并行执行
3. 测试线程全程跟进，最后给关闭建议
