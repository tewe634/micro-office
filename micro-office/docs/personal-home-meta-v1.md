# micro-office 个人主页元数据协议 V1

## 1. 文档目的

本文定义 `micro-office` 中“个人主页 / 工作台首页”的元数据输出协议，用于在**元数据平台**与**工作台系统**之间建立稳定的契约。

协议目标不是传递页面实现，而是传递：

- 当前用户与岗位上下文
- 首页显示哪些区域
- 每个区域中的入口按钮如何展示
- 每个按钮点击后跳转到哪里
- 工作流状态入口如何与工作台详情页联动

该协议面向：

- 后端聚合接口设计
- 前端工作台个人主页渲染
- 个人门户与工作台之间的数据解耦
- 后续移动端 / AI 入口 / 新主页模板扩展

---

## 2. 设计原则

### 2.1 传定义，不传页面

元数据平台不向工作台传递 React 组件、HTML 结构或 CSS，而是传递“首页定义协议”。

### 2.2 首页只保留入口，不承载明细

个人主页保持简洁，只展示：

- 顶部基础信息
- 中间输入框占位
- 下方模块入口按钮

详细列表与业务明细统一跳转到工作台 / 详情页查看。

### 2.3 `positionId` 是个人主页上下文主键

岗位切换不能只是前端切换标题，必须携带稳定的 `positionId` 重新请求个人主页元数据，并在后续跳转中透传。

### 2.4 工作流首页只保留四个状态入口

V1 首页工作流模块只保留：

- `TODO` / 待办
- `IN_PROGRESS` / 进行中
- `COMPLETED` / 已完成
- `CANCELLED` / 取消

首页不展示：

- `ALL` / 全部工作
- 维度模块
- 工作流明细列表

### 2.5 变体驱动显示规则

首页模块由岗位门户变体控制：

- `USER_SALES`：显示销售入口组 + 工作流入口组
- `USER_WORK_*`：只显示工作流入口组

---

## 3. 系统职责边界

### 3.1 元数据平台负责

- 用户 / 岗位 / 组织上下文
- 首页布局语义定义
- 模块可见性规则
- 入口按钮定义
- 跳转目标定义
- 首页展示值（V1 可直接携带 count / amount）

### 3.2 工作台系统负责

- 工作流运行态列表查询
- 工作流详情页展示
- 待办 / 进行中 / 已完成 / 取消列表
- 线程详情与任务处理
- 入口点击后的实际页面承接

### 3.3 不建议的耦合方式

不建议让工作台直接消费 `PortalPage.tsx` 的页面实现，也不建议让工作台直接依赖前端页面结构。

建议工作台只消费一个稳定的 `home-meta` 协议。

---

## 4. 当前项目约束（基于现有需求）

在 `micro-office` 当前阶段，个人主页应遵循以下产品约束：

1. 页面风格简约、清爽、居中
2. 顶部基础信息区域保持紧凑
3. 中间保留一个输入框占位区域
4. 下方只放模块入口按钮
5. 首页不堆明细信息
6. 销售岗位才显示第一排销售入口
7. 工作流首页只保留四个状态入口
8. 工作流详细信息统一跳转到详情页 / 工作台页查看
9. 只有多岗位用户才显示岗位切换

---

## 5. 推荐接口

## 5.1 首页元数据接口

```http
GET /api/workbench/home-meta?positionId={positionId}
```

说明：

- `positionId` 可选
- 不传时由后端根据当前登录用户的默认岗位决定
- 传入时表示切换个人主页上下文

## 5.2 工作台详情承接接口

```http
GET /api/workbench?view=todo&positionId={positionId}
GET /api/workbench?view=active&positionId={positionId}
GET /api/workbench?view=completed&positionId={positionId}
GET /api/workbench?view=cancelled&positionId={positionId}
```

说明：

- 首页按钮只负责跳转
- 明细列表由工作台接口负责返回

---

## 6. 顶层协议结构

```json
{
  "protocolVersion": "personal-home/v1",
  "generatedAt": "2026-03-27T16:00:00+08:00",
  "context": {},
  "header": {},
  "positionSwitcher": {},
  "searchEntry": {},
  "layout": {},
  "groups": []
}
```

字段说明如下。

---

## 7. `context`：主页上下文

```json
{
  "userId": "U1001",
  "userName": "张三",
  "orgId": "ORG001",
  "orgName": "销售一部",
  "activePositionId": "POS_SALES_01",
  "activePositionName": "销售经理",
  "variant": "USER_SALES",
  "positionCount": 2
}
```

### 字段说明

| 字段 | 必填 | 说明 |
| --- | --- | --- |
| `userId` | 是 | 当前登录用户 ID |
| `userName` | 是 | 当前用户姓名 |
| `orgId` | 否 | 当前岗位所在组织 ID |
| `orgName` | 否 | 当前岗位所在组织名称 |
| `activePositionId` | 是 | 当前主页上下文岗位 ID，主页主键 |
| `activePositionName` | 否 | 当前岗位名称 |
| `variant` | 是 | 当前个人门户变体，例如 `USER_SALES`、`USER_WORK_TECH` |
| `positionCount` | 是 | 当前用户可切换岗位数量 |

### 约束

- `activePositionId` 必须稳定可追踪
- 前端切岗时必须重新请求 `home-meta`
- 所有后续跳转都应透传 `positionId`

---

## 8. `header`：顶部基础信息

```json
{
  "name": "张三",
  "role": "SALES",
  "roleLabel": "销售",
  "orgName": "销售一部",
  "positionName": "销售经理",
  "phone": "138****8888",
  "email": "zhangsan@example.com",
  "tags": [
    { "label": "销售视图", "tone": "cyan" }
  ]
}
```

### 规则

- 首页 `header` 保持轻量，不放长说明
- 不展示“当前视图”“提示文案”类信息
- 标签只保留少量高价值信息

---

## 9. `positionSwitcher`：岗位切换协议

```json
{
  "visible": true,
  "activePositionId": "POS_SALES_01",
  "options": [
    {
      "positionId": "POS_SALES_01",
      "label": "销售经理",
      "role": "SALES",
      "orgName": "销售一部"
    },
    {
      "positionId": "POS_OPS_01",
      "label": "运营专员",
      "role": "OPS",
      "orgName": "运营中心"
    }
  ]
}
```

### 规则

- `visible=false` 时前端不显示岗位切换
- 推荐由后端根据 `positionCount > 1` 决定 `visible`
- `options` 中每项都应能唯一定位一个岗位上下文

---

## 10. `searchEntry`：中间输入占位

```json
{
  "visible": true,
  "mode": "placeholder",
  "placeholder": "搜索客户、产品、待办，或输入一句任务",
  "rightTag": "即将接入",
  "enabled": false
}
```

### 说明

V1 只做占位协议，后续可平滑扩展为：

- 搜索入口
- AI 指令入口
- 快捷任务入口
- 导航命令入口

---

## 11. `layout`：布局语义提示

```json
{
  "template": "personal-home-v1",
  "sections": ["header", "searchEntry", "groups"],
  "styleHints": {
    "compactHeader": true,
    "centeredSearchEntry": true,
    "lightweightShortcutCards": true
  }
}
```

### 说明

`layout` 只表达布局意图，不表达前端具体样式实现。工作台前端可以根据该信息选择对应模板，但不应将其视为 CSS 协议。

---

## 12. `groups`：模块入口组

首页入口以 `groups` 形式返回。

```json
[
  {
    "code": "sales",
    "title": "销售",
    "visible": true,
    "items": []
  },
  {
    "code": "workflow",
    "title": "工作流",
    "visible": true,
    "items": []
  }
]
```

### 组级规则

| `code` | 说明 | 显示规则 |
| --- | --- | --- |
| `sales` | 销售相关快捷入口 | 仅 `USER_SALES` 显示 |
| `workflow` | 工作流状态入口 | 所有个人主页显示 |

V1 不输出：

- `dimension` / 维度组
- `allWork` / 全部工作首页入口
- 工作流明细表格

---

## 13. `items`：入口按钮标准结构

每个入口按钮统一遵循如下结构：

```json
{
  "code": "TODO",
  "label": "待办",
  "value": {
    "type": "count",
    "number": 12,
    "suffix": "项"
  },
  "target": {},
  "binding": {},
  "visible": true
}
```

### 字段说明

| 字段 | 必填 | 说明 |
| --- | --- | --- |
| `code` | 是 | 入口唯一编码 |
| `label` | 是 | 展示名称 |
| `value` | 是 | 展示值，可为 count / amount / text |
| `target` | 是 | 点击跳转目标 |
| `binding` | 否 | 业务关联上下文，用于工作台理解入口含义 |
| `visible` | 是 | 是否显示 |

---

## 14. `value`：展示值结构

### 14.1 数量

```json
{
  "type": "count",
  "number": 12,
  "suffix": "项"
}
```

### 14.2 金额

```json
{
  "type": "amount",
  "number": 1280000,
  "suffix": "元"
}
```

### 14.3 文本

```json
{
  "type": "text",
  "text": "即将接入"
}
```

---

## 15. `target`：统一跳转目标协议

推荐统一为内部路由跳转结构。

```json
{
  "type": "internal-route",
  "app": "workbench",
  "route": "/workbench",
  "query": {
    "view": "todo",
    "status": "TODO",
    "positionId": "POS_SALES_01"
  }
}
```

### 规则

- 所有首页入口必须带 `target`
- 工作流入口统一跳到工作台详情页
- `positionId` 应随路由透传
- 后续可以扩展更多 `type`，例如：
  - `internal-route`
  - `object-detail`
  - `product-detail`
  - `thread-detail`
  - `external-url`

V1 以 `internal-route` 为主。

---

## 16. `binding`：业务关联绑定协议

`binding` 用于说明“这个入口本质上关联的业务对象是什么”。

```json
{
  "subjectType": "USER",
  "subjectId": "U1001",
  "positionId": "POS_SALES_01",
  "scope": "personal",
  "filters": {
    "status": ["TODO"]
  }
}
```

### 作用

- 给工作台提供更明确的业务解释
- 避免工作台只依赖前端 query 参数猜业务含义
- 支持后续做数据埋点、行为审计、入口追踪

---

## 17. 销售入口组约定

`sales` 组只在 `USER_SALES` 中返回。

推荐入口包括：

- `PERFORMANCE` / 当前绩效
- `CUSTOMERS` / 关联客户
- `PRODUCTS` / 主推产品

示例：

```json
{
  "code": "sales",
  "title": "销售",
  "visible": true,
  "items": [
    {
      "code": "PERFORMANCE",
      "label": "当前绩效",
      "value": {
        "type": "amount",
        "number": 1280000,
        "suffix": "元"
      },
      "target": {
        "type": "internal-route",
        "app": "workbench",
        "route": "/workbench/home/details/performance",
        "query": {
          "positionId": "POS_SALES_01"
        }
      },
      "binding": {
        "subjectType": "USER",
        "subjectId": "U1001",
        "positionId": "POS_SALES_01"
      },
      "visible": true
    }
  ]
}
```

---

## 18. 工作流入口组约定

`workflow` 组在 V1 中只保留四个状态入口：

- `TODO`
- `IN_PROGRESS`
- `COMPLETED`
- `CANCELLED`

### 18.1 不返回的内容

V1 首页不返回：

- `ALL` / 全部工作首页入口
- `OPEN`
- 维度分布入口
- 任何工作流明细列表

### 18.2 工作流组示例

```json
{
  "code": "workflow",
  "title": "工作流",
  "visible": true,
  "items": [
    {
      "code": "TODO",
      "label": "待办",
      "value": {
        "type": "count",
        "number": 12,
        "suffix": "项"
      },
      "target": {
        "type": "internal-route",
        "app": "workbench",
        "route": "/workbench",
        "query": {
          "view": "todo",
          "status": "TODO",
          "positionId": "POS_SALES_01"
        }
      },
      "binding": {
        "subjectType": "USER",
        "subjectId": "U1001",
        "positionId": "POS_SALES_01",
        "scope": "personal",
        "filters": {
          "status": ["TODO"]
        }
      },
      "visible": true
    },
    {
      "code": "IN_PROGRESS",
      "label": "进行中",
      "value": {
        "type": "count",
        "number": 8,
        "suffix": "项"
      },
      "target": {
        "type": "internal-route",
        "app": "workbench",
        "route": "/workbench",
        "query": {
          "view": "active",
          "status": "IN_PROGRESS",
          "positionId": "POS_SALES_01"
        }
      },
      "binding": {
        "subjectType": "USER",
        "subjectId": "U1001",
        "positionId": "POS_SALES_01",
        "scope": "personal",
        "filters": {
          "status": ["IN_PROGRESS"]
        }
      },
      "visible": true
    },
    {
      "code": "COMPLETED",
      "label": "已完成",
      "value": {
        "type": "count",
        "number": 20,
        "suffix": "项"
      },
      "target": {
        "type": "internal-route",
        "app": "workbench",
        "route": "/workbench",
        "query": {
          "view": "completed",
          "status": "COMPLETED",
          "positionId": "POS_SALES_01"
        }
      },
      "binding": {
        "subjectType": "USER",
        "subjectId": "U1001",
        "positionId": "POS_SALES_01",
        "scope": "personal",
        "filters": {
          "status": ["COMPLETED"]
        }
      },
      "visible": true
    },
    {
      "code": "CANCELLED",
      "label": "取消",
      "value": {
        "type": "count",
        "number": 2,
        "suffix": "项"
      },
      "target": {
        "type": "internal-route",
        "app": "workbench",
        "route": "/workbench",
        "query": {
          "view": "cancelled",
          "status": "CANCELLED",
          "positionId": "POS_SALES_01"
        }
      },
      "binding": {
        "subjectType": "USER",
        "subjectId": "U1001",
        "positionId": "POS_SALES_01",
        "scope": "personal",
        "filters": {
          "status": ["CANCELLED"]
        }
      },
      "visible": true
    }
  ]
}
```

---

## 19. 非销售岗位输出规则

当 `variant` 为 `USER_WORK_*` 时：

- 不返回 `sales` 入口组
- 只返回 `workflow` 入口组
- `workflow` 同样只保留四个状态入口

示例：

```json
{
  "context": {
    "variant": "USER_WORK_TECH"
  },
  "groups": [
    {
      "code": "workflow",
      "title": "工作流",
      "visible": true,
      "items": [
        { "code": "TODO" },
        { "code": "IN_PROGRESS" },
        { "code": "COMPLETED" },
        { "code": "CANCELLED" }
      ]
    }
  ]
}
```

---

## 20. 与当前 `micro-office` 项目的字段映射

当前 `PortalController` 已具备一部分可复用的门户聚合能力。建议映射如下：

| 当前字段 | 协议字段 | 说明 |
| --- | --- | --- |
| `portalOptions` | `positionSwitcher.options` | 多岗位切换选项 |
| `activePortal` | `context.activePositionId` / `positionSwitcher.activePositionId` | 当前岗位上下文 |
| `header` | `header` | 顶部基础信息 |
| `variant` | `context.variant` | 决定首页模块显示逻辑 |
| `salesActionCards` | `groups[code=sales].items` | 销售快捷入口 |
| `workflowStatusCards` | `groups[code=workflow].items` | 工作流状态入口，需要过滤到 4 个 |
| `workItems` | 不进入首页协议 | 仅用于工作台详情列表 |
| `workBuckets` | 不进入首页协议 | V1 首页已明确移除维度模块 |

---

## 21. V1 推荐实现策略

### 21.1 后端

建议新增独立接口：

```http
GET /api/workbench/home-meta
```

推荐新增服务层：

- `WorkbenchHomeMetaService`
- 或 `PersonalHomeMetaService`

由该服务负责：

1. 读取当前用户与岗位上下文
2. 复用门户聚合逻辑
3. 过滤并映射为 `personal-home/v1` 协议结构

### 21.2 前端

建议新增：

- `workbenchHomeApi.meta()`
- `WorkbenchHomePage.tsx`

前端首页只做：

1. 加载 `home-meta`
2. 渲染 `header`
3. 渲染 `searchEntry`
4. 渲染 `groups`
5. 根据 `target` 做跳转

### 21.3 工作台详情页

继续由 `WorkbenchPage` 承接：

- 待办
- 进行中
- 已完成
- 取消

首页只负责“入口”，不负责“列表”。

---

## 22. 版本演进建议

### V1

- 返回首页元数据
- 直接携带 count / amount
- 跳转统一用 `internal-route`
- 工作流只保留四状态

### V2 可扩展方向

- `searchEntry.enabled=true`，真正接入搜索 / AI 指令
- 增加埋点字段，例如 `tracking.eventKey`
- 增加权限来源信息，例如 `visibleReason`
- 支持更多目标类型，例如 `thread-detail` / `object-detail`
- 支持移动端专用布局模板

---

## 23. 结论

`micro-office` 中的个人主页不应被实现为一个与工作台紧耦合的页面，而应被抽象为一份稳定的**个人主页元数据协议**。

V1 的核心结论如下：

1. 元数据平台输出首页定义协议
2. 工作台负责承接列表与详情
3. 首页只保留基础信息、输入框占位、模块入口
4. 销售首页显示销售入口组，非销售不显示
5. 工作流首页只保留四个状态入口
6. `positionId` 是个人主页上下文主键
7. 所有入口必须带 `target`，必要时带 `binding`

该方案既符合当前产品要求，也便于后续扩展为统一的工作台个人主页能力。
