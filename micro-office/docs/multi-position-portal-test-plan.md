# micro-office 多岗位 / 门户 / scope 测试方案

## 1. 代码现状结论

本方案基于当前仓库代码，不假设额外未提交能力。

| 主题 | 当前代码现状 | 对测试的影响 |
| --- | --- | --- |
| 多岗位建人 | `POST /api/users`、`PUT /api/users/{id}` 已支持 `primaryPositionId` + `extraPositionIds` | 可以直接创建多岗位测试人 |
| 角色来源 | `role` 不传时，仅根据主岗位 / 组织推导；辅助岗位不参与角色推导 | 同一测试人无法靠切换辅助岗位改变门户角色 |
| 对象类型权限 | `users/me.objectTypes` 来自主岗位 + 辅助岗位的 `position_object_type` 并集；若配置了 `user_object_type`，则以用户级覆盖为准 | 可以验证“多岗位带来对象类型并集” |
| 组织数据范围 | `DataScopeService` 只看 `sys_user.org_id`，不看辅助岗位 | 多岗位不会扩大 department / business / system 范围 |
| 人员门户 | `PortalController` 只按 `user.role` 决定 `USER_SALES` 或 `USER_WORK` | 当前没有“多岗位门户切换”能力 |
| 客户 / 产品 scope | 前端存在 `dashboardApi.scopes()` / `dashboardApi.org()`，后端无 `/api/dashboard/*` 实现 | personal / department / business / system 汇总验收当前被阻塞 |
| 门户数据口径 | 当前用户 / 客户 / 产品门户均为门户展示聚合数据，其中产品/客户门户未接入 scope 参数 | 只能做“页面可访问 / 数据结构正确”级别冒烟，不能做正式 scope 聚合验收 |

## 2. 建议测试账号

优先准备 3 个账号，不要只靠 1 个账号覆盖所有需求。

| 账号 | 建议组织 | 主岗位 | 辅助岗位 | 角色建议 | 主要用途 |
| --- | --- | --- | --- | --- | --- |
| `qa.mp.sales.biz@local.test` / `19900010001` | 销售体系 / 业务一部 | 销售代表 / 销售经理 | 商务专员 | `SALES` | 验证主岗门户仍走销售门户，辅助岗补充 `SUPPLIER` 能见范围 |
| `qa.mp.sales.finance@local.test` / `19900010002` | 销售体系 / 业务一部 | 销售代表 / 销售经理 | 会计 | `SALES` | 验证主岗门户仍走销售门户，辅助岗补充 `BANK` / `THIRD_PARTY_PAY` |
| `qa.mp.leader@local.test` / `19900010003` | 销售体系 / 业务一部 | 部门经理 / 业务经理 | 商务专员 | `SALES` 或显式指定 | 验证 leader 口径下的对象可见范围 |

补充建议：

- 如果要验证“普通员工只能看 personal”，单独再建 1 个非 leader 账号。
- 如果要验证“system”，不要依赖多岗位，直接准备 `ADMIN` / `SYS_ADMIN` 账号。
- 如果当前环境岗位 `code` 不稳定，优先按岗位名称或直接按岗位 ID 创建。

## 3. 多岗位测试用户如何创建

### 3.1 前置检查

1. 用管理员或 HR 登录。
2. 先确认目标组织和岗位已存在。
3. 不要先配 `user_object_type`，否则会覆盖岗位并集，影响多岗位验证。

建议先确认：

- 目标组织 ID
- 主岗位 ID
- 辅助岗位 ID 列表
- 该主岗位对应的目标门户类型

### 3.2 推荐创建原则

- 主岗位决定目标门户。
- 辅助岗位只用于补充对象类型或联调权限，不要指望它改变当前门户形态。
- 若要验证销售门户，主岗位必须是会推导成 `SALES` 的岗位。
- 若要验证普通工作门户，主岗位应选择 `STAFF` / 非销售类岗位。
- 若要验证 department / business / system，可见范围应主要通过 `orgId + leader/admin 身份` 组合来测，不靠辅助岗位。

### 3.3 API 创建样例

```bash
curl -X POST http://127.0.0.1:8080/api/users \
  -H "Authorization: Bearer <admin-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "联调-多岗位测试-销售商务",
    "email": "qa.mp.sales.biz@local.test",
    "phone": "19900010001",
    "password": "MpTest123!",
    "orgId": "<业务一部ID>",
    "primaryPositionId": "<销售代表ID>",
    "extraPositionIds": ["<商务专员ID>"],
    "role": "SALES"
  }'
```

创建后检查：

1. `GET /api/users?orgId=<orgId>` 中该用户的 `extraPositionIds` 是否正确。
2. 用该账号登录后，`GET /api/users/me` 中：
   - `role` 是否为预期主岗角色
   - `objectTypes` 是否包含辅助岗位带来的对象类型并集

## 4. 验收步骤

### 4.1 多岗位创建验收

通过标准：

1. 用户成功创建。
2. 用户列表能看到主岗位和辅助岗位。
3. `users/me.objectTypes` 能体现岗位并集。
4. 未配置 `user_object_type` 时，岗位调整后重新登录可看到并集变化。

建议步骤：

1. 管理员创建测试用户。
2. 查询 `/api/users?orgId=<orgId>` 确认 `extraPositionIds`。
3. 用测试账号登录。
4. 查询 `/api/users/me`，记录 `role`、`objectTypes`、`menus`。
5. 如需二次验证，给同一用户追加或移除一个辅助岗位，再重复步骤 2-4。

### 4.2 用户门户多岗位切换验收

当前结论：正式验收阻塞。

原因：

1. 现有页面没有岗位切换 UI。
2. 现有接口没有 `activePositionId`、`portalKey`、`scope` 一类参数。
3. 当前用户门户只按 `role` 分成 `USER_SALES` 和 `USER_WORK` 两类。

当前可做的最小验收：

1. 用管理员或 HR 打开 `/users/{id}/portal`。
2. 记录返回 `variant`。
3. 修改辅助岗位后再次访问门户。
4. 预期：`variant` 不会变化；这证明当前没有多岗位门户切换，只是多岗位权限并集。

正式通过标准建议补齐后再验：

1. 页面能展示当前可切换岗位列表。
2. 切换岗位后门户内容和统计维度发生变化。
3. 接口层能明确传入当前岗位或当前门户上下文。

### 4.3 客户门户 / 产品门户不同 scope 验收

当前结论：正式验收阻塞，先做临时替代检查。

阻塞原因：

1. 前端调用了 `/api/dashboard/scopes`、`/api/dashboard/org`，但后端不存在对应接口。
2. 客户门户 / 产品门户接口没有 `scope` 参数。
3. 当前产品门户没有按用户数据范围做汇总区分。

当前可执行的替代检查：

1. 用管理员创建若干测试对象，`ownerId` 绑定到测试用户。
2. 对象类型至少准备：`CUSTOMER`、`SUPPLIER`、`BANK`。
3. 用测试用户登录，确认 `/api/objects/page?type=<TYPE>` 是否只返回该用户有权限的类型。
4. 访问 `/api/portal/objects/{id}`，确认对象门户可打开。
5. 访问 `/api/portal/products/{id}`，确认产品门户可打开。

临时替代检查的通过标准：

1. 多岗位用户能看到辅助岗位新增的对象类型。
2. 无权限对象类型不会出现在对象列表中。
3. 对象门户能打开且无 403。
4. 产品门户能打开。

不能据此判定通过的内容：

- personal / department / business / system 汇总是否正确
- 切换 scope 后统计口径是否变化
- 产品门户是否真正按 scope 做权限收敛

## 5. 哪些用户应该只能看 personal，哪些能看到 department / business / system

这里分成“需求建议口径”和“当前代码可验证口径”。

### 5.1 需求建议口径

| 用户类型 | 建议看到的 scope |
| --- | --- |
| 普通销售、采购、财务、商务、支持专员 | `personal` |
| 部门负责人、组长、主管、经理、部长、主任 | `department` |
| 销售体系下业务一部 / 二部 / 三部负责人 | `business` |
| `ADMIN` / `SYS_ADMIN` | `system` |

### 5.2 当前代码可验证口径

| 用户类型 | 当前可验证能力 | 备注 |
| --- | --- | --- |
| 非 leader 普通人员 | 最稳妥只测 `personal` | 测试数据应强制带 `ownerId`，否则可能因 org 归属带来额外可见性 |
| 名称包含经理 / 主管 / 总监 / 负责人等 leader 关键词的岗位用户 | 可部分模拟 `department` | 仅对象访问规则会识别 leader 候选 |
| 业务部负责人 | 可部分模拟 `business` | 依赖用户 org 落在对应业务部，且主要体现在对象访问，不是 dashboard 汇总 |
| `ADMIN` / `SYS_ADMIN` | 可视为 `system` | 管理员基本可看全局；但当前产品门户本身也缺少 scope 约束 |

实际执行建议：

1. `personal`、`department`、`business`、`system` 不要共用一个测试账号。
2. 每种 scope 各准备一个账号，结果更清晰。
3. 若一定要验证“同一人多岗位切换 scope”，当前版本应判定为未实现，不建议强行验。

## 6. 已发现阻塞点

1. 后端缺少 `/api/dashboard/scopes`、`/api/dashboard/org`，前端 dashboard scope 验收无法进行。
2. 用户门户无岗位切换能力，辅助岗位不会改变门户 variant。
3. 数据范围只由 `sys_user.org_id` 决定，辅助岗位不参与可见范围计算。
4. `ExternalObjectAccessService.canAccess(...)` 入参里虽然有 `scopeOrgIds`，但当前实现未使用。
5. 产品门户当前没有基于 scope 的聚合和权限收敛能力。
6. 仓库里没有稳定的组织 / 岗位 seed 数据；若当前环境未导入实际组织岗位，需要先准备基础数据。

## 7. 轻量 smoke 脚本

仓库已补充：

`scripts/multi-position-smoke.sh`

用途：

1. 登录管理员。
2. 按组织 + 主岗位 + 辅助岗位创建测试用户。
3. 用测试用户登录并读取 `users/me`，确认 `objectTypes` 并集。
4. 自动创建该用户有权限看到的测试对象并回查对象列表 / 对象门户。
5. 创建一个测试产品并验证产品门户可打开。
6. 额外探测 `/api/dashboard/scopes` 是否存在，并打印阻塞提示。

推荐用法：

```bash
MICRO_OFFICE_TEST_ORG_NAME='业务一部' \
MICRO_OFFICE_TEST_PRIMARY_POSITION_NAME='销售代表' \
MICRO_OFFICE_TEST_EXTRA_POSITION_NAMES='商务专员,会计' \
MICRO_OFFICE_TEST_ROLE='SALES' \
bash scripts/multi-position-smoke.sh
```

如果当前环境名称不稳定，改用 ID：

```bash
MICRO_OFFICE_TEST_ORG_ID='<org-id>' \
MICRO_OFFICE_TEST_PRIMARY_POSITION_ID='<primary-position-id>' \
MICRO_OFFICE_TEST_EXTRA_POSITION_IDS='<position-id-1>,<position-id-2>' \
bash scripts/multi-position-smoke.sh
```

## 8. 建议主控创建“多岗位测试人员”的方式

建议采用“主岗定门户，辅岗补权限，scope 另配账号”的策略：

1. 先用主岗位决定这个人应该进哪个门户。
2. 再加 1 到 2 个辅助岗位，用来补客户 / 供应商 / 银行等对象权限。
3. 如果要测 department / business / system，不要只靠辅助岗位，直接分别建 leader / admin 账号。
4. 不要给这批测试人配 `user_object_type`，否则会遮蔽多岗位并集效果。
