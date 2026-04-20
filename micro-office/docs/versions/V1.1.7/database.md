# V1.1.7 数据库拆解

## 1. 线程目标

- 用数据库迁移和数据修复把门户模板结构收敛到最新版模型。
- 明确执行“数据问题由数据库处理，不让前后端兜底”。

## 2. 必做项

### 2.1 结构收敛

- 确认最新版门户模板主结构为：
  - `mo_portal_block_templates`（块模板主表）
  - `mo_portal_block_template_actions`（块模板动作表）
  - `mo_portal_template_block_refs`（模板块引用表）
- 结构迁移与收敛迁移分工：
  - `backend/src/main/resources/db/migration/V42__portal_block_template_library.sql`：建新结构与约束/索引
  - `backend/src/main/resources/db/migration/V44__converge_portal_templates_to_block_refs.sql`：旧数据回填 + 旧表退休

### 2.1.1 无 Flyway 执行顺序（数据库线程手工执行）

1. 执行 `V42__portal_block_template_library.sql`
2. 执行 `V44__converge_portal_templates_to_block_refs.sql`
3. 执行 `docs/versions/V1.1.7/database-sql.sql` 做只读验收

说明：
- `V44` 会物理删除旧表 `mo_portal_template_items`、`mo_portal_template_item_actions`，请确保前后端已经切换到新模型后再执行。
- 该顺序用于已有历史数据环境；全新环境按完整建库脚本初始化后，也应保证最终状态满足同一验收 SQL。

### 2.2 旧数据迁移

- 将历史模板中的旧内嵌块数据迁移到最新结构
- migration / backfill 后，前后端可直接按新结构运行
- 回填规则：
  - 每条 `mo_portal_template_items` 迁移为一条 `mo_portal_block_templates`
  - 每条 `mo_portal_template_item_actions` 迁移为一条或多条 `mo_portal_block_template_actions`
  - 每条旧 item 同步生成一条 `mo_portal_template_block_refs`
  - 回填后的块模板在 `meta.legacySource` 记录来源，便于审计
- 迁移完成后，旧 `items/actions` 表直接退休，不保留长期双轨制

### 2.3 旧结构退休计划

- 明确哪些旧表/旧字段/旧数据路径已经不再作为主路径
- 该删的删，该停用的停用，不长期保留
- 本版退休口径：
  - 物理退休：`mo_portal_template_items`、`mo_portal_template_item_actions`
  - 逻辑退休：模板设计页内嵌 `section/items/actions` 编辑路径
  - 数据键退休：运行时不再从 legacy `items.data_key` 解析

### 2.4 审计与校验 SQL

- 输出 SQL 用于校验：
  - 模板是否仍残留旧结构
  - 块引用是否完整
  - 卡片块是否有孤儿引用
- 校验脚本：
  - `docs/versions/V1.1.7/database-sql.sql`

## 3. 数据库验收标准

- 数据迁移后，系统按最新结构可直接运行
- 不需要前端或后端额外兼容旧数据
- 旧结构退休口径明确

## 4. 非目标

- 不依赖应用层 fallback 掩盖旧数据
- 不长期保留双套结构并行
