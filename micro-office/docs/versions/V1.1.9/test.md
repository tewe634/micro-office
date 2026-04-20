# V1.1.9 测试拆解

## 1. 测试目标

- 验证岗位模板关系已从 `meta.positionId` 成功收敛到 `position_id`。

## 2. 核心用例

### 2.1 岗位模板生成

- 为岗位生成模板后，模板记录的 `position_id` 正确写入
- 生成后岗位列表能正确显示当前模板

### 2.2 岗位模板查询

- `PERSON_ROLE` 模板按岗位可稳定查到
- 不依赖 `meta.positionId` 才能命中

### 2.3 非岗位模板

- 产品/客户/供应商/组织等模板不误用 `position_id`

### 2.4 单路径验证

- 后端不存在旧 JSON 关系 fallback
- 前端不存在旧关系兼容逻辑

## 3. 验收标准

- 岗位模板关系链路全部按 `position_id` 工作
- 不再以 `meta.positionId` 作为事实来源
