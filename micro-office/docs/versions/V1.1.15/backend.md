# V1.1.15 后端拆解

## 1. 线程目标

- 基于 `mo_user_external_accounts` 提供人员外部账号绑定管理接口。
- 明确接口语义归属用户，而不是岗位。

## 2. 必做项

### 2.1 列表接口

提供外部账号绑定列表，至少返回：

- userId
- userName
- orgName
- primaryPositionName
- extraPositionNames
- provider
- corpId
- externalUserId（可脱敏）
- status
- boundAt

接口：

- `GET /api/admin/user-external-accounts`
- query:
  - `provider`：当前仅支持 `DINGTALK`
  - `status`：`ACTIVE | UNBOUND`
  - `keyword`：匹配用户姓名 / 工号 / 组织名 / corpId / externalUserId

### 2.2 详情 / 保存接口

支持：

- 根据用户读取绑定详情
- 新增或更新绑定

接口：

- `GET /api/admin/users/{userId}/external-accounts`
- `PUT /api/admin/users/{userId}/external-accounts`

保存 body 主字段：

- `id`：可选；传入时按记录更新
- `provider`：当前固定 `DINGTALK`
- `corpId`
- `externalUserId`
- `status`：`ACTIVE | UNBOUND`
- `boundAt`
- `meta`
- `version`

约束：

- 绑定关系正式挂在 `user_id`
- 不接受 `positionId` / `position_id` 作为主路径字段

### 2.3 解绑接口

建议实现为状态更新：

- `ACTIVE -> UNBOUND`

接口：

- `PUT /api/admin/users/{userId}/external-accounts/unbind`

请求体：

- 优先支持 `id`
- 若未传 `id`，则要求 `provider + corpId`

### 2.4 唯一约束冲突处理

明确返回错误：

- 外部账号已绑定其他用户
- 用户在同平台同企业下已存在绑定

标准错误文案：

- `该外部账号已绑定其他用户`
- `当前用户在该平台企业下已存在绑定`

### 2.5 文档更新

同步更新：

- `docs/api-design.md`

## 3. 后端验收标准

- 接口主语义是用户绑定
- 列表/详情/保存/解绑完整
- 唯一约束冲突有明确错误
- 解绑默认更新为 `UNBOUND`，不做物理删除

## 4. 重点改动文件

可能涉及：

- 用户管理 controller / service
- 新增 external account binding service
- `docs/api-design.md`

## 5. 非目标

- 不新增 `position_id` 绑定关系
- 不把外部账号字段回写 `sys_user`
