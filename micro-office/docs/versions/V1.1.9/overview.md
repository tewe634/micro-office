# V1.1.9 概览（岗位模板关系收敛到 position_id）

## 1. 版本目标

- 将岗位模板与岗位的绑定关系从 `mo_portal_templates.meta.positionId` 收敛到结构化列 `position_id`。
- 明确“岗位模板关系”是结构化事实，不再落在 JSON `meta` 里。
- 不引入独立关系表，不做过度建模；按当前产品阶段采用“模板表内一对一岗位绑定”方案。

## 2. 问题背景

- 当前岗位模板关系存放在：
  - `mo_portal_templates.meta.positionId`
- 查询与写入依赖 JSON 路径：
  - 列表查询
  - 岗位生成模板
  - 查询岗位已绑定模板
  - 角色种子模板选择等链路
- 这会导致：
  - 关系事实落在 JSON，语义不清
  - 查询与索引不理想
  - 后续维护成本高

## 3. 设计结论

### 3.1 本版不做独立关系表

原因：

- 当前产品阶段更接近：
  - 一个岗位最多绑定一个当前模板
- 暂无明确需求支持：
  - 一个岗位多模板并存
  - 生效期切换
  - 历史绑定审计
  - 多对多关系

因此本版不采用独立关系表：

- 不新增 `mo_portal_position_template_binding`

### 3.2 本版采用结构化列方案

在 `mo_portal_templates` 上新增：

- `position_id`

规则：

- 仅 `PERSON_ROLE` 模板允许使用 `position_id`
- 非 `PERSON_ROLE` 模板该字段为空
- `position_id` 成为唯一事实字段
- `meta.positionId` 不再作为关系事实使用

### 3.3 最新版单路径原则

- 不做 `position_id + meta.positionId` 长期双读
- 不做后端 fallback 兼容旧 JSON 关系
- 不做前端兼容推断
- 数据回填和关系迁移由数据库线程完成
- 后端切换后直接按 `position_id` 单路径运行

## 4. In / Out

### In Scope

- `mo_portal_templates.position_id` 增列
- 将历史 `meta.positionId` 回填到 `position_id`
- 后端查询与写入全部改读/改写 `position_id`
- 删除旧 `meta.positionId` 关系查询逻辑

### Out of Scope

- 不引入独立关系表
- 不支持岗位多模板切换
- 不支持生效期绑定
- 不保留旧版兼容读取

## 5. 关键改动口径

### 5.1 数据库

- 增加 `mo_portal_templates.position_id`
- 回填：
  - `position_id = meta.positionId`
- 建索引，至少覆盖：
  - `template_type = 'PERSON_ROLE'`
  - `status`
  - `position_id`

### 5.2 后端

- 所有岗位模板相关查询改为使用 `position_id`
- 岗位模板生成逻辑写入 `position_id`
- 不再把 `meta.positionId` 作为关系事实字段使用

### 5.3 Meta 处理原则

- `meta.positionId` 不再参与关系判断
- 是否保留 `meta.positionId` 作为冗余展示字段，不在本版保留为事实字段
- 本版默认按“删事实、留结构化列”处理，不保留双重语义

## 6. 依赖顺序

1. 数据库线程先出 migration 与 backfill。
2. 后端线程切查询与写入到 `position_id`。
3. 前端线程只做必要契约确认，不承担兼容逻辑。
4. 测试线程验证岗位模板生成、查询、编辑链路。

## 7. 关键风险

1. **双读残留风险**
   - 如果后端还保留 `meta.positionId` fallback，会重新回到兼容泥潭。

2. **回填不完整风险**
   - 若数据库未正确回填，切换后会导致岗位模板查询不到。

3. **对象模板误用风险**
   - 必须明确 `position_id` 仅适用于 `PERSON_ROLE` 模板。

## 8. 验收口径

- 岗位模板查询不再依赖 `meta.positionId`
- 岗位模板生成后，`position_id` 写入成功
- `PERSON_ROLE` 模板按 `position_id` 可稳定查找
- 不保留旧 JSON 关系兼容分支
- 数据迁移后系统按最新结构可直接运行
