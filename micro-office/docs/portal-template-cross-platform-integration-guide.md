# micro-office 门户模板跨平台对接方案

## 1. 文档目的

本文面向当前 `micro-office` 场景，整理“元数据系统”与“对接系统”如何围绕**人 / 客户 / 产品门户模板**进行跨平台对接。

本文重点回答四个问题：

- 当前系统处于什么阶段
- 元数据系统应该负责什么
- 对接系统应该负责什么
- 双方如何通过模板协议、数据契约、动作协议完成门户跨平台对接

本文适用于：

- 架构设计评审
- 元数据平台模板中心设计
- 对接系统前后端联调
- 门户模板跨系统复用落地

---

## 2. 当前情况判断（基于现有代码）

当前 `micro-office` 已经具备门户能力雏形：

- 后端已有统一门户接口：
  - `GET /api/portal/users/{id}`
  - `GET /api/portal/objects/{id}`
  - `GET /api/portal/products/{id}`
- 前端已有统一门户页面承接：
  - `/users/:id/portal`
  - `/users/:id/portal/details/:detailSection`
  - `/objects/:id/portal`
  - `/products/:id/portal`
- 后端已能按用户岗位、对象类型、产品维度组装结构化门户数据
- 前端已能根据结构化数据渲染头部、列表、工作流、详情区块

但当前系统仍然属于：

**“页面驱动的数据门户”**，还不是严格意义上的：

**“模板驱动的跨平台门户运行时”**。

### 2.1 当前主要问题

1. 门户结构仍然耦合在前端代码里
2. 前端动作仍然偏向本地路由跳转
3. 后端输出的是当前页面所需数据，不是标准化模板运行时数据集
4. 模板、数据、动作、权限尚未形成稳定跨平台契约

### 2.2 本次跨平台对接的关键前提

根据当前业务约束：

- **元数据系统负责传“门户模板”**
- **业务数据保留在对接系统**
- **对接系统负责运行时取数与渲染**

因此，本次建设目标不是传页面实现，也不是传完整业务数据，而是建立：

- 模板协议
- 数据契约
- 动作协议
- 渲染运行时

---

## 3. 总体设计原则

### 3.1 传模板，不传页面

元数据系统不传：

- React / Vue 组件
- HTML 片段
- 页面 CSS
- 本地路由配置

元数据系统只传：

- 门户模板定义
- 页面区块结构
- 字段绑定规则
- 数据契约声明
- 动作语义定义

### 3.2 数据归属在对接系统

元数据系统不直接承载对接系统的业务明细数据。

对接系统负责：

- 用户、客户、产品主数据
- 绩效、工作流、关联信息
- 权限校验
- 数据域过滤
- 运行时聚合

### 3.3 动作必须语义化

模板不能写死：

- `/users/123/portal`
- `/objects/456/detail`

模板应表达为：

- `openPortal`
- `openDetail`
- `openList`
- `emitEvent`
- `customAction`

由对接系统解释动作并决定最终跳转方式。

### 3.4 先做白名单协议，不做无限制低代码

V1 阶段建议只支持：

- 固定 block 类型白名单
- 固定 format 白名单
- 固定 action 白名单
- 固定 dataset 白名单

不建议 V1 直接支持：

- 任意脚本
- 任意 SQL
- 动态 JS 表达式
- 可执行组件代码

### 3.5 门户运行时必须可版本化

模板、数据契约、动作协议都必须带版本：

- 模板版本
- 协议版本
- 对接能力版本

避免模板升级后导致旧系统无法渲染。

---

## 4. 推荐总体架构

建议拆成 5 层：

### 4.1 模板中心（元数据系统）

负责：

- 模板定义
- 模板版本管理
- 模板发布与回滚
- 模板校验
- 模板预览
- 模板治理与审计

### 4.2 门户运行时聚合层（对接系统后端）

负责：

- 接收模板中的数据契约
- 根据实体与上下文装配标准数据集
- 基于当前登录人做权限控制
- 返回前端渲染所需 datasets

### 4.3 数据适配层（对接系统后端内部）

负责：

- 将本地系统的用户 / 客户 / 产品 / 工作流 / 销售数据映射成标准 dataset
- 解耦模板协议与本地数据库结构

### 4.4 门户渲染层（对接系统前端）

负责：

- 拉取模板
- 拉取运行时 datasets
- 将模板 block 映射为前端组件
- 执行动作协议
- 做局部降级显示

### 4.5 动作路由层（对接系统前端或后端）

负责：

- 将语义动作映射成本地路由 / 弹窗 / 事件
- 保证门户模板不依赖具体平台 URL

---

## 5. 双方职责边界

## 5.1 元数据系统职责

元数据系统应负责以下事项：

### A. 模板定义与治理

- 维护门户模板协议 `portal-template/v1`
- 维护模板 ID、版本号、变体、说明
- 管理模板发布、下线、回滚
- 管理 block 白名单
- 管理 format 白名单
- 管理 action 白名单

### B. 数据契约定义

- 定义标准 dataset 名称
- 定义 dataset 语义与字段 shape
- 约束模板使用的数据契约必须来自白名单
- 禁止模板直接引用对接系统数据库表名和字段名

### C. 模板内容输出

- 输出 header、field-grid、stat-group、entity-list、workflow-list、tabs、section 等 block 定义
- 输出字段绑定表达式
- 输出动作协议，不输出本地页面路由
- 输出显隐条件规则

### D. 模板预览能力

- 基于 mock 数据预览模板渲染效果
- 校验模板字段绑定是否完整
- 校验 block 是否符合协议
- 校验 action 是否为白名单动作

### E. 模板开放接口

至少应提供：

- `GET /portal-templates/{templateId}`
- `GET /portal-templates/{templateId}/versions/{version}`
- `POST /portal-templates/validate`
- `POST /portal-templates/preview`（可选）

### F. 不应由元数据系统负责的内容

元数据系统不应承担：

- 对接系统的业务主数据查询
- 运行时权限判断
- 对接系统内部路由管理
- 对接系统业务接口编排
- 对接系统页面跳转 URL 拼装

---

## 5.2 对接系统职责

对接系统应负责以下事项：

### A. 提供标准化数据集

根据模板声明的数据契约，输出标准 dataset，例如：

- `user.base`
- `user.workflow`
- `sales.summary`
- `sales.customers`
- `sales.products`
- `sales.ranking`
- `object.base`
- `object.performance`
- `object.relatedUsers`
- `object.relatedProducts`
- `object.workflow`
- `product.base`
- `product.summary`
- `product.relatedCustomers`
- `product.relatedUsers`
- `product.workflow`

### B. 做权限与数据域控制

对接系统必须基于当前登录人完成：

- 菜单权限控制
- 数据范围控制
- 客户 / 产品 / 用户访问权限控制
- 字段级或区块级隐藏控制（如有）

### C. 提供运行时聚合接口

建议对前端暴露单一入口：

- `POST /api/portal-runtime/resolve`

由该接口统一接收模板 `dataContracts`，并返回 datasets。

### D. 提供 PortalRenderer 运行时

前端应实现统一渲染器，而不是为每个模板单独写页面：

- `PortalRenderer`
- `HeaderBlock`
- `FieldGridBlock`
- `StatGroupBlock`
- `EntityListBlock`
- `WorkflowListBlock`
- `TabsBlock`
- `SectionBlock`

### E. 解释模板动作

将模板里的动作协议转换成本地承接方式，例如：

- `openPortal(user, id)` → 本地人员门户页面
- `openPortal(object, id)` → 本地客户门户页面
- `openPortal(product, id)` → 本地产品门户页面
- `openDetail` → 本地业务详情页
- `emitEvent` → 通知宿主系统

### F. 对接系统不应承担的内容

对接系统不应自行维护另一套模板协议，也不应在模板之外随意扩展不受控的私有字段，避免模板中心失控。

---

## 6. 推荐对接标准

## 6.1 模板协议标准

建议统一使用：

- `schemaVersion = portal-template/v1`

模板顶层建议包含：

- `schemaVersion`
- `templateId`
- `version`
- `name`
- `entityType`
- `variant`
- `description`
- `layout`
- `theme`
- `dataContracts`
- `blocks`
- `actions`
- `extensions`

## 6.2 数据契约标准

模板中的数据契约采用：

- `alias`：模板内部引用名
- `dataset`：标准语义数据集名
- `required`：是否必需
- `shape`：期望字段结构（可选但建议保留）

禁止在模板中出现：

- `sys_user.name`
- `crm_customer.last_follow_time`
- `select * from ...`

应统一绑定为语义路径，例如：

- `{user.name}`
- `{customer.contact}`
- `{product.code}`
- `{salesSummary.performance}`

## 6.3 block 白名单标准

V1 推荐支持的 block：

- `header`
- `field-grid`
- `stat-group`
- `entity-list`
- `workflow-list`
- `tabs`
- `section`

## 6.4 format 白名单标准

V1 推荐支持：

- `text`
- `number`
- `currency`
- `percent`
- `date`
- `datetime`
- `status`
- `tag`
- `rank`

## 6.5 action 白名单标准

V1 推荐支持：

- `openPortal`
- `openDetail`
- `openList`
- `emitEvent`
- `customAction`

---

## 7. 推荐接口清单

## 7.1 元数据系统接口

### 获取模板

```http
GET /portal-templates/{templateId}
GET /portal-templates/{templateId}/versions/{version}
```

### 校验模板

```http
POST /portal-templates/validate
```

### 预览模板（可选）

```http
POST /portal-templates/preview
```

---

## 7.2 对接系统接口

### 门户运行时解析

```http
POST /api/portal-runtime/resolve
```

请求示例：

```json
{
  "templateId": "user.sales.portal",
  "templateVersion": "1.0.0",
  "entityType": "user",
  "entityId": "U1001",
  "context": {
    "positionId": "P01",
    "scope": "personal"
  },
  "contracts": [
    { "alias": "user", "dataset": "user.base" },
    { "alias": "workflow", "dataset": "user.workflow" },
    { "alias": "salesSummary", "dataset": "sales.summary" },
    { "alias": "salesCustomers", "dataset": "sales.customers" },
    { "alias": "salesProducts", "dataset": "sales.products" }
  ]
}
```

返回示例：

```json
{
  "templateId": "user.sales.portal",
  "templateVersion": "1.0.0",
  "entityType": "user",
  "entityId": "U1001",
  "portalContext": {
    "variant": "USER_SALES",
    "permissions": ["openPortal", "openDetail"]
  },
  "datasets": {
    "user": {
      "id": "U1001",
      "name": "张三",
      "role": "SALES",
      "orgName": "销售一部",
      "positionName": "销售经理",
      "empNo": "E1001",
      "email": "zhangsan@example.com",
      "phone": "13800000000"
    },
    "workflow": [],
    "salesSummary": {
      "performance": 1280000,
      "rank": 2,
      "completionRate": 86
    },
    "salesCustomers": [
      { "id": "C01", "name": "某某客户", "lastActiveAt": "2026-04-01" }
    ],
    "salesProducts": [
      { "id": "P01", "name": "ASC580", "code": "ASC580" }
    ]
  },
  "errors": []
}
```

### 动作解析（可选）

```http
POST /api/portal-runtime/actions/resolve
```

### 运行时能力查询（可选）

```http
GET /api/portal-runtime/capabilities
```

---

## 8. 门户打开时序

建议统一按以下时序执行：

### 8.1 首次打开门户

1. 前端根据实体类型与业务场景决定要打开哪个模板
2. 前端从元数据系统拉取模板
3. 前端读取模板中的 `dataContracts`
4. 前端调用对接系统 `/api/portal-runtime/resolve`
5. 对接系统按 `dataset` 装配标准数据集
6. 对接系统返回 `datasets + portalContext + errors`
7. 前端 `PortalRenderer` 根据模板和 datasets 渲染页面

### 8.2 点击门户内动作

1. 用户点击模板里定义的动作
2. 前端动作执行器读取 action 协议
3. 前端本地解析或请求动作解析接口
4. 跳转到本地承接页面 / 弹窗 / 事件总线

### 8.3 多岗位 / 多范围切换

1. 门户切换岗位或范围
2. 前端更新 `context.positionId` / `context.scope`
3. 重新请求 `/api/portal-runtime/resolve`
4. 使用同一模板重新渲染 datasets

---

## 9. 当前 micro-office 推荐迁移路径

考虑到 `micro-office` 已经有现成门户逻辑，建议采用“并行迁移”，不要推倒重来。

## 9.1 保留现有门户接口

现有接口继续服务当前页面：

- `/api/portal/users/{id}`
- `/api/portal/objects/{id}`
- `/api/portal/products/{id}`

## 9.2 新增运行时聚合接口

新增：

- `/api/portal-runtime/resolve`

用于模板驱动的新门户运行时。

## 9.3 拆分现有后端组装逻辑为 dataset resolver

建议将现有 PortalController 中的组装能力拆成 resolver：

- `buildUserHeader` → `user.base`
- `buildSalesUserWorkItems` → `user.workflow`
- `buildSalesActionCards / 当前绩效汇总` → `sales.summary`
- `customerPerformance` → `sales.customers`
- `relatedProducts` → `sales.products`
- `buildSalesRanking` → `sales.ranking`
- 客户门户头部 / 明细 → `object.base`、`object.performance` 等
- 产品门户头部 / 汇总 → `product.base`、`product.summary` 等

## 9.4 前端 PortalPage 渐进迁移

当前 `PortalPage.tsx` 可以先继续使用旧结构。

新方案建议新增：

- `PortalRenderer.tsx`
- `blocks/HeaderBlock.tsx`
- `blocks/FieldGridBlock.tsx`
- `blocks/StatGroupBlock.tsx`
- `blocks/EntityListBlock.tsx`
- `blocks/WorkflowListBlock.tsx`
- `PortalActionExecutor.ts`

在新模板场景逐步切换到 renderer。

---

## 10. 元数据系统实施清单

元数据系统建议按以下任务拆分：

### 第一阶段：协议与治理

- 定义 `portal-template/v1`
- 固化 dataset 白名单
- 固化 block 白名单
- 固化 action 白名单
- 固化模板校验规则

### 第二阶段：模板中心

- 模板存储
- 模板版本管理
- 模板发布 / 回滚
- 模板检索接口
- 模板校验接口
- 模板预览接口

### 第三阶段：模板编辑能力

- 模板 JSON 编辑
- mock 数据预览
- schema 校验
- 变更审计

### 第四阶段：模板治理

- 模板发布审批
- 模板变更 diff
- 模板引用关系管理
- 模板兼容性检查

---

## 11. 对接系统实施清单

对接系统建议按以下任务拆分：

### 第一阶段：运行时底座

- 建立 `/api/portal-runtime/resolve`
- 建立 `PortalDatasetResolver` 注册机制
- 建立统一 dataset 白名单校验
- 建立权限校验与错误返回格式

### 第二阶段：数据适配

至少先完成以下 dataset：

- `user.base`
- `user.workflow`
- `sales.summary`
- `sales.customers`
- `sales.products`
- `object.base`
- `object.performance`
- `product.base`
- `product.summary`

### 第三阶段：前端渲染器

- 实现 `PortalRenderer`
- 实现 block 组件映射
- 实现字段绑定解析
- 实现 format 渲染
- 实现 visibleWhen 规则
- 实现 action executor

### 第四阶段：页面承接与动作映射

- `openPortal(user)` 映射到人员门户
- `openPortal(object)` 映射到客户门户
- `openPortal(product)` 映射到产品门户
- `openDetail` 映射到详情页
- `emitEvent` 映射到宿主事件

### 第五阶段：性能与治理

- datasets 并行装配
- 局部缓存
- 慢接口熔断与降级
- 埋点与审计日志

---

## 12. 验收标准

当满足以下条件时，可认为门户模板跨平台对接具备上线条件：

### 协议层

- 模板协议有正式版本号
- 模板可独立校验
- 数据契约、动作、block、format 有白名单

### 元数据系统

- 模板可查询、可发布、可回滚
- 模板变更可审计
- 模板可做 mock 预览

### 对接系统

- 能根据模板一次性返回所需 datasets
- 权限控制稳定有效
- 非必需 dataset 失败时页面可局部降级
- 动作协议可正确映射本地承接页

### 用户体验

- 人 / 客户 / 产品三类门户均可按模板正确渲染
- 多岗位 / 多范围切换可稳定刷新
- 页面打开时间可接受
- 模板升级不破坏旧版本运行

---

## 13. 风险与注意事项

### 13.1 最大风险：模板越权取数

必须保证：

- 模板只能声明白名单 dataset
- dataset resolver 必须基于当前登录用户做权限校验
- 模板不能注入任意查询逻辑

### 13.2 最大风险：模板直接绑定数据库字段

必须禁止模板出现数据库表字段路径，否则协议会失去跨平台能力。

### 13.3 最大风险：动作写死 URL

若模板直接写死某个系统的 URL，则跨平台能力会立即退化为“伪模板复用”。

### 13.4 最大风险：前端无限扩展 block

V1 必须严格控制 block 种类，避免前端变成另一套低代码平台，导致实现复杂度失控。

---

## 14. 建议结论

基于当前 `micro-office` 情况，建议明确采取以下路线：

### 元数据系统做什么

- 做模板中心
- 做模板协议
- 做数据契约白名单
- 做动作协议白名单
- 做模板版本与治理
- 不直接承接业务数据

### 对接系统做什么

- 做标准 dataset 适配
- 做运行时聚合接口
- 做权限控制
- 做 PortalRenderer
- 做动作承接
- 做本地页面跳转与事件路由

### 双方通过什么对接

- 模板协议：`portal-template/v1`
- 数据契约：标准 dataset 列表
- 动作协议：语义动作白名单
- 运行时接口：`/api/portal-runtime/resolve`

最终形成：

**元数据系统管模板，对接系统管数据，前端运行时负责渲染。**

这才是当前场景下最稳妥、最容易扩展、也最符合“跨平台对接门户模板”的落地方式。
