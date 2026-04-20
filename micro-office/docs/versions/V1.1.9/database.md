# V1.1.9 数据库拆解

## 1. 线程目标

- 用 migration/backfill 将岗位模板关系从 `meta.positionId` 收敛到 `position_id` 列。

## 2. 必做项

### 2.1 增列

- 在 `mo_portal_templates` 增加：
  - `position_id`

建议：

- 外键关联 `position(id)`
- 允许为空（仅岗位模板使用）
- 本版 migration：
  - `backend/src/main/resources/db/migration/V47__converge_portal_template_position_binding.sql`

### 2.2 回填

- 将历史：
  - `meta ->> 'positionId'`
回填到：
  - `position_id`

### 2.3 索引

补齐岗位模板查询索引，至少覆盖：

- `template_type`
- `status`
- `position_id`
- `updated_at`
- `created_at`
- 本版索引：
  - `idx_mo_portal_templates_person_status_position_order`
  - `idx_mo_portal_templates_person_active_position_order`

### 2.4 清理口径

- `meta.positionId` 不再作为关系事实字段
- 本版不要求继续保留其兼容价值
- 若需要，可在迁移后清理冗余 meta 字段
- 本版处理：
  - 在回填完成后，统一移除 `meta.positionId`，避免 `position_id + meta.positionId` 双语义并存。

### 2.5 校验 SQL

- 输出 SQL 验证：
  - `PERSON_ROLE` 模板中 `position_id` 是否已回填
  - 是否仍有模板只在 meta 中有岗位关系而主列为空
- 校验脚本：
  - `docs/versions/V1.1.9/database-sql.sql`

### 2.6 无 Flyway 执行顺序（数据库线程手工执行）

1. 执行 `V47__converge_portal_template_position_binding.sql`
2. 执行 `docs/versions/V1.1.9/database-sql.sql` 做只读验收

## 3. 数据库验收标准

- `position_id` 已建好并回填成功
- 索引可支撑岗位模板主查询
- 后端切换后无需再读旧 JSON 关系

## 4. 非目标

- 不引入独立关系表
- 不长期保留双套关系事实
