# V1.1.7 前端拆解

## 1. 线程目标

- 重做“门户模板”首页的信息架构。
- 让“卡片块定义”和“模板设计”两个模块在产品上清晰可见。
- 删除不符合最新版本产品定义的旧入口和旧编辑心智。

## 2. 必做项

### 2.1 首页重构

- 改造 [AdminPortalTemplatePage.tsx](/Users/kevin/workspace/micro-office/micro-office/frontend/src/pages/admin/AdminPortalTemplatePage.tsx)
- 首页至少要有四个明确表达：
  - 按岗位生成模板
  - 对象模板新建
  - 模板列表
  - 卡片块定义入口

### 2.2 卡片块定义入口补齐

- 在系统管理菜单中新增：
  - `卡片块定义`
- 补齐：
  - 页面标题
  - 菜单高亮
  - 首页可见入口
- 不允许继续存在“路由有了但页面无入口”的隐形模块状态

### 2.3 对象模板新建入口业务化

- 删除“只有一个新建空模板按钮”的入口表达
- 改成显式对象入口：
  - 新建客户模板
  - 新建供应商模板
  - 新建承运商模板
  - 新建银行模板
  - 新建产品模板
  - 新建组织模板

### 2.4 模板设计页职责收敛

- 改造 [AdminPortalTemplateEditorPage.tsx](/Users/kevin/workspace/micro-office/micro-office/frontend/src/pages/admin/AdminPortalTemplateEditorPage.tsx)
- 主路径改为：
  - 选择块
  - 排序
  - 启停
  - 分区装配

- 删除或下线旧主交互：
  - 模板页直接编辑 `itemKey`
  - 模板页直接编辑 `dataKey`
  - 模板页直接编辑 `displayType`
  - 模板页直接编辑 `actions`

### 2.5 不做前端兼容兜底

- 不为旧数据形态添加 UI fallback
- 不在模板页里继续保留旧编辑路径供用户绕行
- 若数据不符合最新结构，应由数据库/后端修正

## 3. 前端验收标准

- 用户能从菜单或首页进入“卡片块定义”。
- 首页能直接看见对象模板新建按钮。
- 模板设计页默认通过引用块完成装配。
- 旧 items/actions 直接编辑主路径已移除。

## 4. 重点改动文件

- `frontend/src/pages/admin/AdminPortalTemplatePage.tsx`
- `frontend/src/pages/admin/AdminPortalTemplateEditorPage.tsx`
- `frontend/src/pages/admin/AdminPortalBlockTemplatePage.tsx`
- `frontend/src/pages/admin/AdminPortalBlockTemplateEditorPage.tsx`
- `frontend/src/layouts/MainLayout.tsx`
- `frontend/src/App.tsx`
- `frontend/src/constants/routes.ts`

## 5. 非目标

- 不改正式业务门户展示页
- 不做块级拖拽设计器
- 不保留旧版前端兼容模式
