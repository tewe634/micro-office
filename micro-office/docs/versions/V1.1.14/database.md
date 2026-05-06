# V1.1.14 数据库拆解

## 1. 线程目标

- 确认 `execution_mode` 结构已满足产品要求。
- 本版数据库重点是校验和口径确认，而不是再造新结构。

## 2. 必做项

### 2.1 结构确认

确认以下字段和约束已满足：

- `mo_daily_entry_behaviors.execution_mode`
- 枚举：
  - `OPEN_EXISTING`
  - `CREATE_SESSION`

### 2.2 校验 SQL

新增或更新校验 SQL，至少覆盖：

- `execution_mode` 列存在
- 枚举约束存在
- MEETING 条目行为能读到 `CREATE_SESSION`

### 2.3 文档同步

更新数据库口径文档，明确：

- `execution_mode` 已是正式产品字段
- 不再只是修复 migration 的内部实现细节

## 3. 数据库验收标准

- `execution_mode` 结构稳定
- 校验 SQL 可证明当前环境满足前端接入要求

## 4. 非目标

- 不新增表
- 不改日常条目行为主模型
