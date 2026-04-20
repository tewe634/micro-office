# 版本文档规范

版本与缺陷文档默认放在：

- `docs/versions/<version-id>/overview.md`
- `docs/versions/<version-id>/frontend.md`
- `docs/versions/<version-id>/backend.md`
- `docs/versions/<version-id>/database.md`
- `docs/versions/<version-id>/test.md`

缺陷建议使用：

- `docs/versions/<fix-id>/overview.md`
- `docs/versions/<fix-id>/frontend.md`
- `docs/versions/<fix-id>/backend.md`
- `docs/versions/<fix-id>/database.md`
- `docs/versions/<fix-id>/regression.md`

建议规则：

- 先写 `overview.md` 收敛范围和依赖
- 各执行文档只写对应线程要做的事
- 若涉及接口或数据库契约变更，必须在 `overview.md` 明确
- 没有版本号时可临时用 `vYYYYMMDD-change-01`
