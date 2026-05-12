# V1.1.14 后端拆解

## 1. 目标

- 让字段定义接口正式支持 `list` 子字段结构。

## 2. 本线程要做的事

- 扩展字段定义读写接口，支持 list 子字段。
- 当字段类型为 `list` 时：
  - 允许提交 `meta.listSubFields`
  - 返回 `meta.listSubFields`
- 当字段类型不是 `list` 时：
  - 子字段必须为空或忽略

## 3. 校验要求

- `list` 字段至少允许 0..n 个子字段，但建议首版要求至少 1 个子字段
- 同一 list 字段下子字段 `fieldKey` 不可重复
- 子字段类型首版不允许 `list`
- 非 `list` 字段不得保存子字段结构
- 存储位置固定为 `mo_workflow_template_field_definitions.meta.listSubFields`

## 4. 交付输出

1. 已改文件清单
2. 字段定义接口变更说明
3. list 子字段校验说明
4. 与数据库变更依赖关系
5. 未解决阻塞项
