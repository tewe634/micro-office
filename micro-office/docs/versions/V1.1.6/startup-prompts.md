# V1.1.6 启动词

## 前端线程
请按 V1.1.6 处理前端，先阅读：
- /Users/kevin/workspace/micro-office/micro-office/docs/versions/V1.1.6/overview.md
- /Users/kevin/workspace/micro-office/micro-office/docs/versions/V1.1.6/frontend.md
目标：把门户模板从“每页手工配块”升级成“引用块模板装配页面”，先落消息中心块复用。

## 后端线程
请按 V1.1.6 处理后端，先阅读：
- /Users/kevin/workspace/micro-office/micro-office/docs/versions/V1.1.6/overview.md
- /Users/kevin/workspace/micro-office/micro-office/docs/versions/V1.1.6/backend.md
目标：新增块模板管理 API，并让门户模板/预览/运行时支持引用块模板，兼容旧内嵌块。

## 数据库线程
请按 V1.1.6 处理数据库，先阅读：
- /Users/kevin/workspace/micro-office/micro-office/docs/versions/V1.1.6/overview.md
- /Users/kevin/workspace/micro-office/micro-office/docs/versions/V1.1.6/database.md
目标：补齐块模板主表、动作表、模板块引用表，并保证新旧结构可并存。

## 测试线程
请按 V1.1.6 处理测试，先阅读：
- /Users/kevin/workspace/micro-office/micro-office/docs/versions/V1.1.6/overview.md
- /Users/kevin/workspace/micro-office/micro-office/docs/versions/V1.1.6/test.md
目标：验证消息中心块可被多个岗位模板复用，且存量旧模板兼容不回退。
