# V1.1.8 启动词

## 前端线程

```text
你负责 Micro Office 的前端实现线程（V1.1.8）。

先明确边界：
- 你是执行线程，负责按版本拆解文档落地前端实现。
- 不要改后端业务逻辑和数据库迁移。
- 若发现契约缺口，先记录最小缺口并继续完成可做部分。
- 不做旧版兼容兜底，不做前端字符串清洗遮羞。

先阅读：
1. /Users/kevin/workspace/micro-office/micro-office/docs/README.md
2. /Users/kevin/workspace/micro-office/micro-office/docs/ui-design.md
3. /Users/kevin/workspace/micro-office/micro-office/docs/api-design.md
4. /Users/kevin/workspace/micro-office/micro-office/docs/versions/V1.1.8/overview.md
5. /Users/kevin/workspace/micro-office/micro-office/docs/versions/V1.1.8/frontend.md

本线程目标（V1.1.8）：
- 优化“门户卡片管理”列表页，只保留卡片资产视角信息。
- 删除“更新时间”列。
- 卡片块列只显示卡片资产名称，不显示第二行 code。
- 不通过前端截断 LEGACY_/UUID/模板名来兜底。

实现要求：
- 页面不显示更新时间。
- 页面不显示 `LEGACY_*`、UUID、模板来源等技术信息。
- 若后端 name 仍为脏数据，记录契约缺口，不在前端做长期遮羞处理。

交付输出：
1. 已改文件清单
2. 列表字段调整说明
3. 与后端契约对齐情况
4. 未解决阻塞项（如有）
```

## 后端线程

```text
你负责 Micro Office 的后端实现线程（V1.1.8）。

先明确边界：
- 你是执行线程，负责按版本拆解文档落地后端实现。
- 不要改前端页面和数据库迁移脚本以外的职责边界。
- 若历史数据不符合要求，应明确交给数据库线程修正，不要在后端做展示兜底。
- 不做旧版兼容命名 fallback。

先阅读：
1. /Users/kevin/workspace/micro-office/micro-office/docs/README.md
2. /Users/kevin/workspace/micro-office/micro-office/docs/api-design.md
3. /Users/kevin/workspace/micro-office/micro-office/docs/db-design.md
4. /Users/kevin/workspace/micro-office/micro-office/docs/versions/V1.1.8/overview.md
5. /Users/kevin/workspace/micro-office/micro-office/docs/versions/V1.1.8/backend.md

本线程目标（V1.1.8）：
- 让门户卡片管理列表接口只返回卡片资产语义。
- 不再把模板来源、legacy 命名、技术编码作为主名称返回。

实现要求：
- 列表接口主展示字段必须是卡片资产名称。
- 不增加新的字符串裁剪/拼接 fallback。
- 若历史数据是脏名，交由数据库线程修正。

交付输出：
1. 已改文件清单
2. 列表接口调整说明
3. 删除了哪些旧展示兜底逻辑
4. 未解决阻塞项（如有）
```

## 数据库线程

```text
你负责 Micro Office 的数据库实现线程（V1.1.8）。

先明确边界：
- 你是执行线程，负责按版本拆解文档落地数据库迁移、数据修复和校验 SQL。
- 不要通过应用层兜底思路解决名称脏数据问题。
- 旧名称是否清理、如何回填，由你主导明确。

先阅读：
1. /Users/kevin/workspace/micro-office/micro-office/docs/README.md
2. /Users/kevin/workspace/micro-office/micro-office/docs/db-design.md
3. /Users/kevin/workspace/micro-office/micro-office/backend/src/main/resources/db/migration
4. /Users/kevin/workspace/micro-office/micro-office/docs/versions/V1.1.8/overview.md
5. /Users/kevin/workspace/micro-office/micro-office/docs/versions/V1.1.8/database.md

本线程目标（V1.1.8）：
- 把门户卡片资产名称从 legacy/模板派生名修正成真正的卡片资产名称。

实现要求：
- 回填修正 `mo_portal_block_templates.name`。
- 清除 `LEGACY_*`、UUID 尾巴、模板名拼接风格名称。
- 输出校验 SQL，证明脏名称已清理。

交付输出：
1. 新增 migration / SQL 清单
2. 数据回填说明
3. 校验 SQL 与预期结果
4. 未解决阻塞项（如有）
```

## 测试线程

```text
你负责 Micro Office 的测试验证线程（V1.1.8）。

先明确边界：
- 你是执行线程，负责按版本拆解文档做验证、回归和关闭建议。
- 不要修改业务实现代码。
- 验证以最新数据和最新单一路径为准，不把前端遮羞式兼容当通过条件。

先阅读：
1. /Users/kevin/workspace/micro-office/micro-office/docs/README.md
2. /Users/kevin/workspace/micro-office/micro-office/docs/api-design.md
3. /Users/kevin/workspace/micro-office/micro-office/docs/versions/V1.1.8/overview.md
4. /Users/kevin/workspace/micro-office/micro-office/docs/versions/V1.1.8/test.md

本线程目标（V1.1.8）：
- 验证门户卡片管理页的信息语义已纠正为卡片资产视角。

执行要求：
- 确认页面不显示 `LEGACY_*`、UUID、模板名拼接信息。
- 确认页面不显示更新时间。
- 确认不是靠前端截断字符串伪装通过。

交付输出：
1. 验证范围
2. 关键用例与结果
3. 问题清单
4. 是否建议关闭版本
```
