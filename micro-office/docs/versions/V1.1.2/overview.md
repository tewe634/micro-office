# V1.1.2 概览

## 1. 版本目标

- 将门户模板预览从“调试字段直出”升级为“业务化驾驶舱渲染”。
- 渲染规则以 JSON 数据为准：**大框固定，小框按数据有无动态显示**。
- 保持现有模板四表结构，不做 schema 扩张。

## 2. 需求基线（已确认）

- 第一、二图是现状：大区块里仍在展示 `dataKey` / 字段名 / 原始数据感。
- 第三图是目标：深色驾驶舱布局，业务卡片表达，空数据不占小框。
- 不是固定 `todo/customer/daily/relation/ai` 五类硬编码；而是根据 `template + data.blocks` 动态生成。

## 3. 核心渲染规则

### 3.1 大框（Section）

- 来源：`data.template.sections[]`
- 规则：全部渲染（默认存在）
- 排序：按 section 顺序（当前数据已是业务顺序）

### 3.2 小框（Block Item）

- 来源：`section.blocks[]` 对应 `data.data.blocks[block.data_key]`
- 规则：有数据才渲染小框；无数据不渲染小框
- 空数据判定：
  - `null`
  - `{}`
  - `items: []`
  - `entries: []`
  - `blocks: []`

### 3.3 交互按钮

- 只根据数据中的 action 对象显示：
  - `switch_subject`
  - `open_workbench_session`
- 无 action 时只展示，不可点击。

## 4. 前后端协议口径

## 4.1 请求

- 预览接口：`GET /api/admin/portal-templates/templates/{id}/preview`
- 保留已确认 query 扩展：`entityType`、`entityId`

## 4.2 响应关键结构

```json
{
  "data": {
    "template": {
      "sections": [
        {
          "key": "CUSTOMER_LIST",
          "title": "客户列表",
          "blocks": [
            { "key": "customer_list", "data_key": "customer_list", "display_type": "LIST" }
          ]
        }
      ]
    },
    "data": {
      "blocks": {
        "customer_list": { "items": [ ... ] }
      }
    }
  }
}
```

## 4.3 容器约定

- LIST 类型优先读取 `items`
- CARD 类型优先读取 `entries`，其次 `blocks`
- 若容器缺失或为空，视为无小框

## 5. In / Out

### In
- 管理端预览页视觉重构（第三图风格）
- JSON 驱动小框渲染引擎
- 调试信息折叠保留

### Out
- 不改正式业务门户页
- 不新增数据库表
- 不做自动轮播（后续版本）

## 6. 依赖顺序

1. 后端先稳定 `template.sections + data.blocks` 响应容器一致性。
2. 前端实现“section 固定 + block 数据驱动小框”。
3. 测试验证空/非空/混合数据场景。

## 7. 验收口径

- 大框始终显示。
- 小框严格按 JSON 有值显示，无值不显示。
- 主视图不出现 `dataKey` 调试文案。
- 客户列表/日常/关系图/AI提醒按你提供样例正确渲染。
