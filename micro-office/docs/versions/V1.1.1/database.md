# V1.1.1 数据库拆解

## 1. 线程目标

- 在不新增表的前提下支持预览主体配置。
- 固化元数据规范，保障后续可维护。

## 2. 必做项

### 2.1 Schema 策略

- 不新增表，沿用：
  - `mo_portal_templates`
  - `mo_portal_template_sections`
  - `mo_portal_template_items`
  - `mo_portal_template_item_actions`

### 2.2 Meta 规范

- `mo_portal_templates.meta.previewEntity`：

```json
{
  "previewEntity": {
    "entityType": "PRODUCT",
    "entityId": "..."
  }
}
```

- 建议同时约定视觉 meta（可选）：
  - `layout_mode: cockpit_dark`

### 2.3 数据修复（可选）

- 对已有模板做一次扫描：
  - 缺 `previewEntity` 的模板记录清单。
  - 缺视觉 meta 的模板记录清单。

### 2.4 校验脚本

- 输出 SQL 校验：
  - `previewEntity` 是否完整（type/id 同时存在）。
  - type 枚举是否合法。

已提供脚本：

- `/Users/kevin/workspace/micro-office/micro-office/docs/versions/V1.1.1/database-sql.sql`

执行顺序建议：

1. 先执行 1-4 段检查 SQL（只读）。
2. 如需补视觉元数据，执行第 5 段 `layout_mode` 修复。
3. 如需补预览主体，先替换第 6 段 `fix_input` 占位值，再执行修复并留存 `RETURNING` 结果作为审计。

## 3. 验收标准

- 不改 schema 也能满足 V1.1.1 全部需求。
- 存量模板可识别哪些尚未配置预览主体。
- 不影响现有模板查询与编辑流程。

## 4. 非目标

- 不新增结构化预览配置表。
