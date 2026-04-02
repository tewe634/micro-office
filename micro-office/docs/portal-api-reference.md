# Micro Office 门户 API 参考文档

> 基于当前项目代码实际返回结构整理。
> 适用于接口联调、字段核对、跨平台门户对接说明。

---

## 目录

- [1. 文档说明](#1-文档说明)
- [2. 通用响应结构](#2-通用响应结构)
- [3. 公共字段说明](#3-公共字段说明)
- [4. 用户门户 API](#4-用户门户-api)
- [5. 对象门户 API](#5-对象门户-api)
- [6. 产品门户 API](#6-产品门户-api)
- [7. 枚举值汇总](#7-枚举值汇总)
- [8. 补充说明](#8-补充说明)

---

## 1. 文档说明

### 接口前缀

```http
/api/portal
```

### 鉴权方式

```http
Authorization: Bearer <token>
```

### 说明

这 3 个接口属于**门户聚合读接口**，返回的是门户展示层需要的聚合数据，而不是数据库原始表结构的直接映射。

核心接口：

- `GET /api/portal/users/{id}`
- `GET /api/portal/objects/{id}`
- `GET /api/portal/products/{id}`

---

## 2. 通用响应结构

### 成功响应

```json
{
  "code": 0,
  "message": "success",
  "data": {}
}
```

### 失败响应

```json
{
  "code": 400,
  "message": "错误信息",
  "data": null
}
```

### 字段说明

| 字段 | 类型 | 说明 |
|---|---|---|
| `code` | number | 业务状态码，成功固定为 `0` |
| `message` | string | 响应说明，成功固定为 `success` |
| `data` | object/null | 门户主体数据 |

---

## 3. 公共字段说明

以下字段会在多个门户接口中重复出现。

### 3.1 `summaryCards[]`

门户顶部统计卡片。

#### 单项结构

| 字段 | 类型 | 说明 |
|---|---|---|
| `key` | string | 卡片键名 |
| `label` | string | 卡片标题 |
| `value` | number/string | 卡片值 |
| `suffix` | string | 单位，如 `元`、`项`、`人`、`家` |

#### 扩展动作卡片字段

部分销售门户卡片还会返回以下字段：

| 字段 | 类型 | 说明 |
|---|---|---|
| `description` | string | 卡片说明 |
| `targetSection` | string | 点击后目标区块，如 `workflow`、`performance` |
| `filterKey` | string/null | 默认筛选值 |

---

### 3.2 `workSummary`

工作汇总对象。

| 字段 | 类型 | 说明 |
|---|---|---|
| `total` | number | 工作总数 |
| `todo` | number | 待办数 |
| `inProgress` | number | 进行中数 |
| `completed` | number | 已完成数 |
| `cancelled` | number | 已取消数 |

---

### 3.3 `workItems[]`

工作事项列表。

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | string | 工作项 ID |
| `title` | string | 工作标题 |
| `status` | string | 状态：`TODO` / `IN_PROGRESS` / `COMPLETED` / `CANCELLED` |
| `stage` | string | 工作阶段/主题 |
| `ownerId` | string | 负责人用户 ID |
| `ownerName` | string | 负责人姓名 |
| `objectId` | string/null | 关联对象 ID |
| `objectName` | string/null | 关联对象名称 |
| `productId` | string/null | 关联产品 ID |
| `productName` | string/null | 关联产品名称 |
| `updatedAt` | string | 最近更新时间，格式 `YYYY-MM-DD` |

---

### 3.4 `portalOptions[]` / `activePortal`

用户门户的岗位/门户切换项。

| 字段 | 类型 | 说明 |
|---|---|---|
| `positionId` | string/null | 岗位 ID |
| `positionName` | string | 岗位名称 |
| `positionCode` | string/null | 岗位编码 |
| `code` | string/null | 同 `positionCode` |
| `primary` | boolean | 是否主岗位 |
| `defaultRole` | string/null | 岗位默认角色 |
| `role` | string | 生效角色 |
| `level` | number/null | 岗位层级 |
| `variant` | string | 门户变体 |
| `portalType` | string | 同 `variant` |
| `label` | string | 展示名称 |
| `title` | string | 完整标题 |

---

### 3.5 `scopeOptions[]` / `activeScope`

产品门户的统计口径切换项。

| 字段 | 类型 | 说明 |
|---|---|---|
| `key` | string | 范围键：`personal` / `department` / `business` / `system` |
| `label` | string | 范围中文名 |
| `orgId` | string/null | 当前范围对应组织 ID |
| `orgName` | string/null | 当前范围对应组织名称 |
| `description` | string | 范围说明 |

---

## 4. 用户门户 API

## 接口

```http
GET /api/portal/users/{id}
```

### Query 参数

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `positionId` | string | 否 | 指定岗位视角打开用户门户 |

### 请求示例

```http
GET /api/portal/users/u123?positionId=p001
Authorization: Bearer <token>
```

---

### 返回顶层字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `portalType` | string | 固定为 `USER` |
| `variant` | string | 门户变体，如 `USER_SALES`、`USER_WORK_HR` |
| `portalOptions` | array | 可切换岗位/门户列表 |
| `activePortal` | object | 当前激活岗位/门户 |
| `header` | object | 头部信息 |
| `summaryCards` | array | 顶部统计卡片 |
| `workflowStatusCards` | array | 工作状态卡片 |
| `workBuckets` | array | 工作维度分桶 |
| `workSummary` | object | 工作汇总 |
| `workItems` | array | 工作列表 |

销售门户额外字段：

- `salesActionCards`
- `salesRanking`
- `customerPerformance`
- `performanceItems`
- `relatedCustomers`
- `relatedProducts`

---

### `header`

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | string | 用户 ID |
| `name` | string | 用户姓名 |
| `email` | string | 邮箱 |
| `phone` | string | 手机号 |
| `role` | string | 当前门户生效角色 |
| `storedRole` | string | 用户原始角色 |
| `empNo` | string | 工号 |
| `orgName` | string | 所属组织名称 |
| `positionName` | string | 当前岗位名称 |
| `positionCode` | string/null | 当前岗位编码 |
| `primaryPositionId` | string/null | 主岗位 ID |
| `primaryPositionName` | string/null | 主岗位名称 |
| `activePosition` | object | 当前激活岗位 |
| `allPositions` | array | 全部岗位 |
| `hiredAt` | string/null | 入职日期 |
| `year` | number | 当前年份 |

---

### `workflowStatusCards[]`

| 字段 | 类型 | 说明 |
|---|---|---|
| `key` | string | `TODO` / `IN_PROGRESS` / `COMPLETED` / `CANCELLED` |
| `label` | string | 中文标题 |
| `count` | number | 数量 |
| `description` | string | 状态说明 |
| `targetSection` | string | 固定为 `workflow` |
| `filterKey` | string | 默认筛选值 |

---

### `workBuckets[]`

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | string | 分桶 ID |
| `label` | string | 分桶名称 |
| `count` | number | 数量 |
| `filterValue` | string | 筛选值 |
| `description` | string | 提示说明 |

---

### 销售门户专属字段

#### `salesRanking[]`

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | string | 销售人员 ID |
| `rank` | number | 排名 |
| `salespersonId` | string | 销售人员 ID |
| `salespersonName` | string | 销售人员姓名 |
| `salesAmount` | number | 销售额 |
| `completionRate` | number | 达成率（百分比数值） |
| `focusProduct` | string | 主推产品名称 |
| `currentUser` | boolean | 是否当前用户本人 |

#### `customerPerformance[]`

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | string | 客户 ID |
| `name` | string | 客户名称 |
| `amount` | number | 关联金额 |
| `productCount` | number | 关联产品数 |
| `workItemCount` | number | 关联工作项数量 |
| `lastActiveAt` | string | 最近跟进日期 |

#### `performanceItems[]`

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | string | 明细 ID |
| `customerId` | string | 客户 ID |
| `customerName` | string | 客户名称 |
| `productId` | string | 产品 ID |
| `productName` | string | 产品名称 |
| `productCode` | string | 产品编码 |
| `amount` | number | 金额 |
| `stage` | string | 阶段 |
| `achievedAt` | string | 日期 |
| `note` | string | 说明 |

#### `relatedProducts[]`

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | string | 产品 ID |
| `name` | string | 产品名称 |
| `code` | string | 产品编码 |
| `amount` | number | 对应金额 |

> `relatedCustomers` 当前实现与 `customerPerformance` 语义一致，可视为别名字段。

---

### 用户门户返回示例（简化）

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "portalType": "USER",
    "variant": "USER_SALES",
    "portalOptions": [],
    "activePortal": {},
    "header": {},
    "summaryCards": [],
    "salesActionCards": [],
    "workflowStatusCards": [],
    "salesRanking": [],
    "customerPerformance": [],
    "performanceItems": [],
    "relatedCustomers": [],
    "relatedProducts": [],
    "workBuckets": [],
    "workSummary": {},
    "workItems": []
  }
}
```

---

## 5. 对象门户 API

## 接口

```http
GET /api/portal/objects/{id}
```

### Query 参数

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `scope` | string | 否 | 当前接口签名保留，但对象门户当前实现未真正按此切换 |

---

### 返回顶层字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `portalType` | string | 固定为 `OBJECT` |
| `variant` | string | `OBJECT_CUSTOMER` 或 `OBJECT_WORK` |
| `header` | object | 对象头部信息 |
| `summaryCards` | array | 顶部统计卡片 |
| `workSummary` | object | 工作汇总 |
| `workItems` | array | 工作列表 |

客户门户额外字段：

- `perspectiveMode`
- `perspectiveLabel`
- `perspectiveHint`
- `salesSummary`
- `performanceItems`
- `relatedProducts`

工作门户额外字段：

- `workOwnerSummary`

---

### `header`

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | string | 对象 ID |
| `name` | string | 对象名称 |
| `type` | string/null | 对象类型 |
| `contact` | string/null | 联系人 |
| `phone` | string/null | 电话 |
| `address` | string/null | 地址 |
| `remark` | string/null | 备注 |
| `industry` | string/null | 行业 |
| `customerRole` | string/null | 客户角色 |
| `customerScale` | string/null | 客户规模 |
| `ownerId` | string/null | 负责人 ID |
| `orgName` | string/null | 所属组织名 |
| `deptName` | string/null | 所属部门名 |
| `ownerName` | string/null | 负责人姓名 |
| `year` | number | 当前年份 |

---

### 客户门户专属字段（`variant = OBJECT_CUSTOMER`）

#### `perspectiveMode`

| 值 | 说明 |
|---|---|
| `OWNER` | 负责人个人视角 |
| `ORG_FALLBACK` | 组织回退视角 |
| `VIEWER_FALLBACK` | 访问人回退视角 |
| `EMPTY` | 无可用视角 |

#### `perspectiveLabel`
当前视角中文名称。

#### `perspectiveHint`
当前视角说明文案。

#### `salesSummary[]`

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | string | 汇总行 ID |
| `salespersonId` | string | 参与人 ID |
| `salespersonName` | string | 参与人姓名 |
| `amount` | number | 金额 |
| `productCount` | number | 涉及产品数 |
| `performanceItemCount` | number | 绩效明细条数 |
| `lastActiveAt` | string | 最近活跃日期 |

#### `performanceItems[]`

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | string | 明细 ID |
| `salespersonId` | string | 参与人 ID |
| `salespersonName` | string | 参与人姓名 |
| `productId` | string | 产品 ID |
| `productName` | string | 产品名称 |
| `productCode` | string | 产品编码 |
| `amount` | number | 金额 |
| `achievementType` | string | 绩效类型，如签约/复购/验收/回款 |
| `achievedAt` | string | 日期 |
| `note` | string | 说明 |

#### `relatedProducts[]`

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | string | 产品 ID |
| `name` | string | 产品名称 |
| `code` | string | 产品编码 |
| `amount` | number | 金额 |

---

### 工作门户专属字段（`variant = OBJECT_WORK`）

#### `workOwnerSummary[]`

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | string | 汇总行 ID |
| `ownerId` | string | 负责人 ID |
| `ownerName` | string | 负责人姓名 |
| `totalCount` | number | 工作总数 |
| `activeCount` | number | 活跃工作数（待办 + 进行中） |
| `completedCount` | number | 已完成数 |

---

### 对象门户返回示例（简化）

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "portalType": "OBJECT",
    "variant": "OBJECT_CUSTOMER",
    "header": {},
    "perspectiveMode": "OWNER",
    "perspectiveLabel": "负责人个人视角",
    "perspectiveHint": "",
    "summaryCards": [],
    "salesSummary": [],
    "performanceItems": [],
    "relatedProducts": [],
    "workSummary": {},
    "workItems": []
  }
}
```

---

## 6. 产品门户 API

## 接口

```http
GET /api/portal/products/{id}
```

### Query 参数

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `scope` | string | 否 | 统计口径：`personal` / `department` / `business` / `system` |

### 请求示例

```http
GET /api/portal/products/p001?scope=department
Authorization: Bearer <token>
```

---

### 返回顶层字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `portalType` | string | 固定为 `PRODUCT` |
| `variant` | string | 固定为 `PRODUCT` |
| `header` | object | 产品头部信息 |
| `scopeOptions` | array | 可切换统计口径 |
| `activeScope` | object | 当前统计口径 |
| `summaryCards` | array | 统计卡片 |
| `salesSummary` | array | 产品销售汇总明细 |
| `productHierarchy` | object | 销售分层汇总 |
| `performanceItems` | array | 产品绩效明细 |
| `workSummary` | object | 工作汇总 |
| `workItems` | array | 工作列表 |

---

### `header`

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | string | 产品 ID |
| `name` | string | 产品名称 |
| `code` | string | 产品编码/物料号 |
| `spec` | string/null | 规格 |
| `productLine` | string/null | 产品线 |
| `categoryCode` | string/null | 类别编码 |
| `categoryLevel1` | string/null | 一级类别 |
| `categoryLevel2` | string/null | 二级类别 |
| `categoryLevel3` | string/null | 三级类别 |
| `year` | number | 当前年份 |

---

### `salesSummary[]`

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | string | 明细 ID |
| `salespersonId` | string | 销售人员 ID |
| `salespersonName` | string | 销售人员姓名 |
| `customerId` | string | 客户 ID |
| `customerName` | string | 客户名称 |
| `amount` | number | 金额 |
| `orderCount` | number | 成交次数 |
| `lastSoldAt` | string | 最近成交日期 |

---

### `productHierarchy`

包含 3 组汇总数据：

- `businessRows`
- `departmentRows`
- `personRows`

#### `businessRows[]`

| 字段 | 类型 | 说明 |
|---|---|---|
| `businessOrgId` | string | 业务部组织 ID |
| `businessName` | string | 业务部名称 |
| `departmentCount` | number | 覆盖部门数 |
| `salespersonCount` | number | 销售人数 |
| `customerCount` | number | 客户数 |
| `orderCount` | number | 成交次数 |
| `amount` | number | 销售额 |
| `lastSoldAt` | string | 最近成交日期 |

#### `departmentRows[]`

| 字段 | 类型 | 说明 |
|---|---|---|
| `departmentOrgId` | string | 部门组织 ID |
| `departmentName` | string | 部门名称 |
| `businessOrgId` | string | 所属业务部 ID |
| `businessName` | string | 所属业务部名称 |
| `salespersonCount` | number | 销售人数 |
| `customerCount` | number | 客户数 |
| `orderCount` | number | 成交次数 |
| `amount` | number | 销售额 |
| `lastSoldAt` | string | 最近成交日期 |

#### `personRows[]`

| 字段 | 类型 | 说明 |
|---|---|---|
| `salespersonId` | string | 销售人员 ID |
| `salespersonName` | string | 销售人员姓名 |
| `departmentOrgId` | string | 所属部门 ID |
| `departmentName` | string | 所属部门名称 |
| `businessOrgId` | string | 所属业务部 ID |
| `businessName` | string | 所属业务部名称 |
| `customerCount` | number | 客户数 |
| `orderCount` | number | 成交次数 |
| `amount` | number | 销售额 |
| `lastSoldAt` | string | 最近成交日期 |

---

### `performanceItems[]`

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | string | 明细 ID |
| `salespersonId` | string | 销售 ID |
| `salespersonName` | string | 销售姓名 |
| `customerId` | string | 客户 ID |
| `customerName` | string | 客户名称 |
| `productId` | string | 产品 ID |
| `productName` | string | 产品名称 |
| `amount` | number | 金额 |
| `stage` | string | 阶段，如年度签约/重点项目/复购扩单/交付验收 |
| `happenedAt` | string | 发生日期 |
| `note` | string | 说明 |

---

### 产品门户返回示例（简化）

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "portalType": "PRODUCT",
    "variant": "PRODUCT",
    "header": {},
    "scopeOptions": [],
    "activeScope": {},
    "summaryCards": [],
    "salesSummary": [],
    "productHierarchy": {
      "businessRows": [],
      "departmentRows": [],
      "personRows": []
    },
    "performanceItems": [],
    "workSummary": {},
    "workItems": []
  }
}
```

---

## 7. 枚举值汇总

### `portalType`

- `USER`
- `OBJECT`
- `PRODUCT`

### 用户门户 `variant`

- `USER_SALES`
- `USER_WORK_<ROLE>`

### 对象门户 `variant`

- `OBJECT_CUSTOMER`
- `OBJECT_WORK`

### 产品门户 `variant`

- `PRODUCT`

### 工作状态 `workItems[].status`

- `TODO`
- `IN_PROGRESS`
- `COMPLETED`
- `CANCELLED`

### 产品门户统计口径 `scope`

- `personal`
- `department`
- `business`
- `system`

---

## 8. 补充说明

### 8.1 这些接口是门户读模型接口

返回值偏向前端展示与联动使用，包含很多聚合字段，例如：

- `summaryCards`
- `workflowStatusCards`
- `workBuckets`
- `productHierarchy`

### 8.2 对象门户当前不建议依赖 `scope`

虽然接口签名里带了 `scope` 参数，但当前对象门户实现并未真正按该参数切换视角。

### 8.3 当前部分金额/日期/状态为门户聚合口径数据

当前代码里存在按门户逻辑生成的聚合展示数据，这些值更适合门户展示，不等于底层明细表逐字段原样透出。

---

## 附：核心接口清单

```http
GET /api/portal/users/{id}
GET /api/portal/objects/{id}
GET /api/portal/products/{id}
```

---

如果后续需要，可继续补充：

- OpenAPI YAML 版本
- 对接方精简版字段清单
- PDF/HTML 导出版
