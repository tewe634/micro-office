# V1.1.10 测试拆解

## 1. 测试目标

- 验证模板层保持纯编排。
- 验证 DAILY_ENTRY 打开链路按策略表正确分流。

## 2. 核心用例

### 2.1 模板层稳定

- 模板定义不新增日常特殊字段
- `daily_list` 仍按标准 block/dataKey/action 渲染

### 2.2 provider 注册

- 已注册 `dataKey` 正常工作
- 未注册 `dataKey` 明确报错，不隐式降级

### 2.3 DAILY_ENTRY 打开链路

- `BY_ENTRY_ONLY`：
  - 同一条目进入统一群
- `BY_ENTRY_AND_USER`：
  - 同一条目不同用户进入各自会话

### 2.4 非模板层特殊化

- 前端不需要写特殊分支才能跑通
- 模板 schema 不被污染

## 3. 验收标准

- 日常特殊性由 runtime/provider 层承担
- 模板层保持纯编排
- DAILY_ENTRY 的个人群 / 统一群都能正确打开
