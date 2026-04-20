# V1.1.8 数据库拆解

## 1. 线程目标

- 把门户卡片资产名称从“legacy/模板派生名”修正成真正的卡片资产名称。

## 2. 必做项

### 2.1 历史数据识别

- 识别以下脏名称来源：
  - `LEGACY_*`
  - 模板名 + 卡片标题拼接名
  - 带 UUID 尾巴的迁移派生名

### 2.2 数据修复策略

- 对 `mo_portal_block_templates.name` 做回填修正
- 命名原则：
  - 以卡片本身语义为准
  - 不保留模板来源
  - 不保留 legacy 前缀
  - 不保留 UUID
- 本版 migration：
  - `backend/src/main/resources/db/migration/V46__normalize_portal_block_template_names.sql`
- 修复规则：
  - 优先用 `label` 回填 `name`
  - 清理 `模板名 / 卡片名` 拼接样式
  - 清理 `LEGACY_*` 和 UUID 尾巴样式

### 2.2.1 无 Flyway 执行顺序（数据库线程手工执行）

1. 执行 `V46__normalize_portal_block_template_names.sql`
2. 执行 `docs/versions/V1.1.8/database-sql.sql` 做只读验收

### 2.3 审计 SQL

- 输出 SQL 校验：
  - 是否还存在 `LEGACY_%`
  - 是否还存在明显 UUID 尾巴
  - 是否还存在模板名拼接样式
- 校验脚本：
  - `docs/versions/V1.1.8/database-sql.sql`

## 3. 数据库验收标准

- 列表数据中的卡片资产名称已完成修正
- 前后端无需为旧名称做兼容显示

## 4. 非目标

- 不调整卡片块主键/code 规则
- 不做跨版本兼容保留
