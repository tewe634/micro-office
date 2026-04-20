# V1.1.8 前端拆解

## 1. 线程目标

- 让“门户卡片管理”列表看起来像卡片资产管理，而不是模板拆分残留列表。

## 2. 必做项

### 2.1 列表字段调整

- 修改 [AdminPortalBlockTemplatePage.tsx](/Users/kevin/workspace/micro-office/micro-office/frontend/src/pages/admin/AdminPortalBlockTemplatePage.tsx)
- 保留列：
  - 卡片块
  - 状态
  - 展示类型
  - 数据键
  - 标题
  - 引用次数
- 删除列：
  - 更新时间

### 2.2 卡片块列展示收敛

- `卡片块`列仅显示卡片资产名称
- 不再显示第二行 `code`
- 不做前端字符串截断/清洗 legacy 文本作为长期方案

### 2.3 不做前端兜底

- 如果后端返回的 `name` 仍是 legacy 技术名，按契约缺口记录
- 不在前端加：
  - `LEGACY_` 前缀裁剪
  - UUID 正则切除
  - 模板名截断规则

## 3. 前端验收标准

- 页面不显示 `更新时间`
- 页面不显示 `code`
- 页面主列只显示卡片块名称
- 不存在任何前端 legacy 文本清洗兜底逻辑

## 4. 重点改动文件

- `frontend/src/pages/admin/AdminPortalBlockTemplatePage.tsx`

## 5. 非目标

- 不改编辑页结构
- 不改列表筛选逻辑
