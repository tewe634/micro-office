# micro-office 联调种子数据文档

## 1. 文档目标

提供前后端联调用的最小数据集建议，确保多岗位、门户、权限链路可快速验证。

## 2. 建议账号

- 管理员：用于配置与回归脚本
- 多岗位销售账号：验证岗位并集与门户表现
- 业务负责人账号：验证范围提升场景

参考详细方案：

- [multi-position-portal-test-plan.md](/Users/kevin/workspace/micro-office/micro-office/docs/multi-position-portal-test-plan.md)

## 3. 建议最小对象集

- 组织：根组织 + 业务部 + 部门
- 岗位：销售、商务、财务、管理岗
- 用户：至少 3 人（管理员、普通、leader）
- 外部对象：`CUSTOMER`、`SUPPLIER`、`BANK` 各至少 1 条
- 产品：至少 2 条

## 4. 建议联调场景

- 管理员登录和权限配置
- 多岗位用户登录后 `users/me.objectTypes` 并集验证
- 对象列表权限过滤验证
- 对象门户可访问性验证
- 产品门户可访问性验证

## 5. 脚本入口

- `npm run smoke:api`
- `bash scripts/multi-position-smoke.sh`
