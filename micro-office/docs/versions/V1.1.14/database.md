# V1.1.14 数据库拆解

## 1. 目标

- 为 `list` 字段补齐可结构化存储的子字段模型。

## 2. 本线程要做的事

- 明确 list 子字段落库到 `mo_workflow_template_field_definitions.meta.listSubFields`。

## 3. 数据口径要求

- 字段主定义仍挂在字段定义主表。
- list 子字段必须结构化保存到 `meta.listSubFields`，不接受仅存描述性文本。
- 非 list 字段不得带子字段残留数据。
- `meta` 为对象，`listSubFields` 为数组。

## 4. 校验要求

- 若字段类型为 `list`，子字段结构必须满足数据库或后端约束。
- 若字段类型非 `list`，子字段结构必须为空。
- 首版子字段类型不得再次为 `LIST`。

## 5. 交付输出

1. 新增 migration 清单
2. list 子字段存储方案
3. 约束/索引说明
4. 校验 SQL 与预期结果
5. 未解决阻塞项
