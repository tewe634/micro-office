# V1.1.7 后端拆解

## 1. 线程目标

- 让后端契约只服务最新产品模型：
  - 卡片块定义
  - 模板装配引用
- 删除旧版兼容逻辑与 fallback 解析，不保留长期双轨制。

## 2. 必做项

### 2.1 契约收敛到最新结构

- 模板详情与保存接口围绕“块引用”收敛
- 不再把旧 `items/actions` 作为主模型继续扩展

### 2.2 删除旧兼容解析

- 清理预览与运行时中仅为旧模板结构保留的 fallback 逻辑
- 不保留“既支持旧 items，又支持新 block refs”作为长期方案

### 2.3 卡片块定义模块接口正式化

- 保证 `/api/admin/portal-block-templates/*` 成为正式管理接口
- 支持：
  - 列表
  - 详情
  - 新建
  - 编辑
  - 状态切换
  - 引用查询

### 2.4 模板设计接口只做装配

- 模板接口负责：
  - 分区
  - 块引用
  - 排序
  - 启停
- 不再鼓励在模板保存接口里承接块内部定义修改

### 2.5 权限与菜单链路补齐

- 确保“卡片块定义”模块有完整菜单权限键
- 避免出现前端有入口、后端权限缺失导致页面不可访问

## 3. 后端验收标准

- 卡片块定义接口稳定可用
- 模板接口以块引用为主模型
- 预览/运行时不再依赖旧版兼容分支
- 菜单权限链路完整

## 4. 重点改动文件

- `backend/src/main/java/com/microoffice/controller/PortalBlockTemplateAdminController.java`
- `backend/src/main/java/com/microoffice/controller/PortalTemplateAdminController.java`
- 可能涉及菜单权限/管理接口相关代码

## 5. 非目标

- 不保留旧版结构兼容解析
- 不做通用低代码能力
