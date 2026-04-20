# V1.1.6 前端拆解

## 1. 线程目标

- 在管理端新增“块模板管理”入口。
- 改造门户模板编辑页，让页面模板从“手工编辑内嵌块”升级为“引用块模板进行装配”。
- 维持现有预览渲染器消费协议不变，优先保证复用能力落地。

## 2. 必做项

### 2.1 新增块模板管理页

- 新增管理页面：
  - 块模板列表页
  - 块模板编辑页
- 最小能力：
  - 新建块模板
  - 编辑块模板
  - 启停块模板
  - 复制块模板
- 列表字段至少包含：
  - `code`
  - `name`
  - `status`
  - `displayType`
  - `dataKey`
  - `引用次数`
  - `更新时间`

### 2.2 门户模板编辑页改造

- 当前 [AdminPortalTemplateEditorPage.tsx](/Users/kevin/workspace/micro-office/micro-office/frontend/src/pages/admin/AdminPortalTemplateEditorPage.tsx) 中，section 下是直接编辑 `items/actions`。
- 本版改造目标：
  - 保留存量模板的展示兼容
  - 对新建/改造模板支持“从块模板库引用”

编辑页交互要求：

- 在 section 区域增加“添加块模板”入口。
- 弹窗/侧栏中可搜索并选择 `ACTIVE` 块模板。
- 引用后页面模板里展示：
  - 块名称
  - 块编码
  - displayType
  - dataKey
  - 块模板状态
- 支持：
  - 调整 section 内排序
  - 删除引用
  - 启停引用

### 2.3 引用优先的编辑语义

- 对块模板引用项，前端默认不开放深度编辑：
  - 不允许在页面模板编辑页修改引用块的 `dataKey`
  - 不允许修改 `displayType`
  - 不允许直接改动作列表
- 如需改块本身，应跳转到块模板编辑页。

### 2.4 存量模板兼容展示

- 若模板仍使用旧内嵌 item：
  - 编辑页应明确标识“内嵌块（旧）”
  - 允许继续查看与保存，不要求本版强制迁移
- 新增块优先通过“块模板引用”方式加入

### 2.5 预览页兼容

- 预览页不重写协议。
- 继续消费后端输出的：
  - `template.sections[].blocks[]`
  - `data.blocks`

## 3. 前端验收标准

- 能在管理端创建“消息中心”块模板。
- 能在两个不同岗位模板中引用同一个“消息中心”块模板。
- 引用块在模板编辑页中可排序、可删除、可启停。
- 修改块模板后，两个模板预览结果同步更新。
- 存量旧模板仍可打开与保存。

## 4. 重点改动文件

- `frontend/src/pages/admin/AdminPortalTemplateEditorPage.tsx`
- `frontend/src/pages/admin/*`（新增块模板管理页）
- `frontend/src/api/index.ts`
- `frontend/src/layouts/MainLayout.tsx`
- `frontend/src/App.tsx`

## 5. 非目标

- 不在本版做块级可视化拖拽编排。
- 不在引用侧开放无限制覆盖项。
- 不改正式业务门户视觉与交互。
