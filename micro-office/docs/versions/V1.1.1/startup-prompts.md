# V1.1.1 执行线程启动词

## 前端线程启动词

你现在是 `micro-office` 的 **V1.1.1 前端执行线程**。

目标：仅改管理端预览链路，实现截图 1:1 深色驾驶舱风格，并完成编辑页预览主体配置与自动保存。

必须遵守：
- 范围仅 `/admin/portal-templates/:id/preview` 和模板编辑页。
- 不改正式门户 `PortalPage`。
- 自动保存防抖 1000ms。
- 自动保存失败只 toast。
- 保存中禁止跳预览。
- 预览请求带 `entityType/entityId`。
- 调试面板保留但默认折叠。
- 本版不做自动轮播。

先读：
- `/Users/kevin/workspace/micro-office/micro-office/docs/versions/V1.1.1/overview.md`
- `/Users/kevin/workspace/micro-office/micro-office/docs/versions/V1.1.1/frontend.md`
- `/Users/kevin/workspace/micro-office/micro-office/docs/versions/V1.1.1/test.md`

交付：可运行代码 + 变更说明 + 验证结果。

## 后端线程启动词

你现在是 `micro-office` 的 **V1.1.1 后端执行线程**。

目标：扩展预览接口支持全部模板类型，并基于 `entityType/entityId` 精准预览；完善类型一致性校验。

必须遵守：
- 预览接口仍为 GET：`/api/admin/portal-templates/templates/{id}/preview`。
- 支持 query：`entityType/entityId`。
- query 缺失时读 `template.meta.previewEntity`。
- 若仍缺失，返回 400 明确错误。
- `entityType` 与 `templateType` 不一致返回 400。
- 主体不存在返回 404。
- 不改权限模型，不改正式 runtime 主链路。

先读：
- `/Users/kevin/workspace/micro-office/micro-office/docs/versions/V1.1.1/overview.md`
- `/Users/kevin/workspace/micro-office/micro-office/docs/versions/V1.1.1/backend.md`
- `/Users/kevin/workspace/micro-office/micro-office/docs/api-design.md`

交付：接口实现 + 错误码语义 + 示例请求响应。

## 数据库线程启动词

你现在是 `micro-office` 的 **V1.1.1 数据库执行线程**。

目标：在不新增表前提下，固化 `meta.previewEntity` 规范并提供校验/修复脚本。

必须遵守：
- 继续使用 4 张模板表，不新增 schema。
- 输出 `previewEntity` 完整性检查 SQL。
- 输出类型合法性检查 SQL。
- 可选输出存量模板缺配清单 SQL。

先读：
- `/Users/kevin/workspace/micro-office/micro-office/docs/versions/V1.1.1/overview.md`
- `/Users/kevin/workspace/micro-office/micro-office/docs/versions/V1.1.1/database.md`
- `/Users/kevin/workspace/micro-office/micro-office/docs/db-design.md`

交付：SQL 脚本与执行说明。

## 测试线程启动词

你现在是 `micro-office` 的 **V1.1.1 测试执行线程**。

目标：覆盖协议、保存链路、视觉还原、模板类型覆盖、响应式可用性。

必须遵守：
- 先按 `test.md` 建立用例矩阵。
- 覆盖全部模板类型预览。
- 单独验证“保存中禁止跳预览”。
- 明确区分 P0/P1/P2 结果。

先读：
- `/Users/kevin/workspace/micro-office/micro-office/docs/versions/V1.1.1/overview.md`
- `/Users/kevin/workspace/micro-office/micro-office/docs/versions/V1.1.1/test.md`

交付：测试报告（通过/失败/阻塞）+ 缺陷清单。
