# micro-office 线上部署说明（47.111.167.198）

适用环境：`http://47.111.167.198`

当前线上信息：
- 主机：`47.111.167.198`
- 用户：`root`
- 项目目录：`/opt/micro-office-1988`
- 真实数据库容器：`prod-amd64-20260418-postgres-1`
- 真实数据库入口：宿主机 `5433`

## 一键部署脚本

本地已提供可重复执行脚本：

```bash
cd /home/user/.openclaw/workspace/micro-office
SERVER_PASS='你的服务器密码' ./scripts/deploy-server-1988.sh
```

如果本机已经配置好 SSH key，可直接执行：

```bash
cd /home/user/.openclaw/workspace/micro-office
./scripts/deploy-server-1988.sh
```

## 脚本做的事

脚本会自动完成：

1. 检查本地 `micro-office` 工作区状态
2. 检查线上 `.env.server` 是否存在
3. 校验线上后端目标数据库是否为：
   - `jdbc:postgresql://host.docker.internal:5433/micro_office?stringtype=unspecified`
4. 备份线上：
   - 项目目录
   - `.env.server`
   - 真实业务数据库
5. 打包并上传本地代码
6. 使用 `docker compose` 重建前后端
7. 验证：
   - 前端首页返回 `200`
   - 登录接口返回 `200`
   - backend 实际 `SPRING_DATASOURCE_URL` 指向真实业务库
8. 切换线上目录，并保留上一版目录

## ⚠️ 重要：数据库迁移问题

**项目未启用 Flyway 自动迁移**，这意味着：

- ✅ 部署脚本只会更新代码（前端/后端）
- ❌ 部署脚本**不会**自动执行数据库结构变更（DDL）
- ❌ `backend/src/main/resources/db/migration/` 目录下的迁移脚本不会自动执行

### 如果代码包含数据库结构变更

当你的代码修改了数据库表结构（新增字段、修改字段、新增表等），需要**手动执行 DDL**：

#### 方法1：手动执行 SQL（推荐）

```bash
# 1. 连接到线上数据库
ssh root@47.111.167.198
docker exec -it prod-amd64-20260418-postgres-1 psql -U postgres -d micro_office

# 2. 手动执行 DDL，例如：
ALTER TABLE external_object ADD COLUMN IF NOT EXISTS new_field VARCHAR(200);
COMMENT ON COLUMN external_object.new_field IS '字段说明';
```

#### 方法2：从本地上传 SQL 文件执行

```bash
# 1. 准备 SQL 文件（例如 /tmp/migration.sql）
# 2. 上传并执行
scp /tmp/migration.sql root@47.111.167.198:/tmp/
ssh root@47.111.167.198 "docker exec -i prod-amd64-20260418-postgres-1 psql -U postgres -d micro_office < /tmp/migration.sql"
```

#### 方法3：启用 Flyway（需要修改配置）

如果希望自动执行迁移脚本，需要修改 `backend/src/main/resources/application.yml`：

```yaml
spring:
  flyway:
    enabled: true
    baseline-on-migrate: true
    baseline-version: 0
```

**注意**：首次启用 Flyway 需要谨慎，因为线上数据库可能已经手动执行过一些迁移，需要确保 Flyway 的版本号和实际数据库状态一致。

### 数据导入场景

如果需要从 Excel 或其他数据源导入数据到线上：

1. **先在本地导入并验证**
2. **导出本地数据为 SQL 脚本**
3. **上传并在线上执行 SQL 脚本**

示例：

```bash
# 本地导出数据
cd /home/user/.openclaw/workspace/micro-office
docker exec micro-office-postgres-1 pg_dump -U postgres -d micro_office \
  --table=external_object --data-only --column-inserts > /tmp/data_export.sql

# 上传到线上
scp /tmp/data_export.sql root@47.111.167.198:/tmp/

# 在线上执行
ssh root@47.111.167.198 "docker exec -i prod-amd64-20260418-postgres-1 \
  psql -U postgres -d micro_office < /tmp/data_export.sql"
```

## 真实数据库说明

**不要把 compose 自带的 `micro-office-1988-postgres-1` 误认为正式业务库。**

正式环境业务库应该看这里：

- 主机：`47.111.167.198`
- 端口：`5433`
- 真实数据库容器：`prod-amd64-20260418-postgres-1`

从宿主机直连时可理解为：

```text
jdbc:postgresql://47.111.167.198:5433/micro_office?stringtype=unspecified
```

从线上 backend 容器内连接时应为：

```text
jdbc:postgresql://host.docker.internal:5433/micro_office?stringtype=unspecified
```

## 线上 `.env.server` 要求

线上 `.env.server` 至少应包含：

```env
POSTGRES_DB=micro_office
POSTGRES_USER=postgres
POSTGRES_PASSWORD=***
JWT_SECRET=***
JWT_EXPIRATION=0
HTTP_PORT=80
SPRING_DATASOURCE_URL=jdbc:postgresql://host.docker.internal:5433/micro_office?stringtype=unspecified
SPRING_DATASOURCE_PASSWORD=postgres
```

> 不要把真实密码写进仓库。

## 验收命令

如果想手动复核，可在服务器上执行：

```bash
cd /opt/micro-office-1988
docker compose -f docker-compose.server.yml --env-file .env.server ps
```

查看 backend 实际数据源：

```bash
docker exec micro-office-1988-backend-1 env | grep '^SPRING_DATASOURCE_URL='
```

预期结果：

```bash
SPRING_DATASOURCE_URL=jdbc:postgresql://host.docker.internal:5433/micro_office?stringtype=unspecified
```

首页探活：

```bash
curl -I http://127.0.0.1/
```

登录探活：

```bash
curl -X POST http://127.0.0.1/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"login":"13305713391","password":"123456"}'
```

验证数据库表结构（如果有新增字段）：

```bash
ssh root@47.111.167.198 "docker exec prod-amd64-20260418-postgres-1 psql -U postgres -d micro_office -c '\\d external_object'"
```

## 回滚

脚本执行成功后，会保留上一版目录：

```bash
/opt/micro-office-1988.prev
```

如果要手动回滚，建议流程：

1. 停止当前容器
2. 把当前目录改名备用
3. 将 `/opt/micro-office-1988.prev` 改回 `/opt/micro-office-1988`
4. 重新执行：

```bash
cd /opt/micro-office-1988
docker compose -f docker-compose.server.yml --env-file .env.server up -d
```

**注意**：回滚只能恢复代码，无法自动回滚数据库结构变更。如果需要回滚数据库，需要手动执行反向 DDL 或从备份恢复。

## 完整部署检查清单

每次部署前检查：

- [ ] 代码已提交并推送到 master 分支
- [ ] 本地测试通过
- [ ] 如果有数据库结构变更，准备好 DDL 脚本
- [ ] 如果有数据导入，准备好数据导出脚本
- [ ] 确认线上数据库已备份（部署脚本会自动备份）

部署步骤：

1. [ ] 执行部署脚本：`./scripts/deploy-server-1988.sh`
2. [ ] 如果有数据库结构变更，手动执行 DDL
3. [ ] 如果有数据导入，手动执行数据导入脚本
4. [ ] 验证前端页面正常访问
5. [ ] 验证登录功能正常
6. [ ] 验证新功能正常工作
7. [ ] 检查后端日志无异常：`ssh root@47.111.167.198 "docker logs micro-office-1988-backend-1 --tail 50"`

## 常见问题

### Q: 部署后前端显示数据为空？

A: 可能是数据库字段缺失。检查：
1. 后端实体类是否定义了新字段
2. 数据库表是否添加了对应字段
3. 数据是否已导入

### Q: 如何查看线上数据库的表结构？

```bash
ssh root@47.111.167.198 "docker exec prod-amd64-20260418-postgres-1 psql -U postgres -d micro_office -c '\\d+ external_object'"
```

### Q: 如何查看线上某个表的数据量？

```bash
ssh root@47.111.167.198 "docker exec prod-amd64-20260418-postgres-1 psql -U postgres -d micro_office -c 'SELECT COUNT(*) FROM external_object WHERE type='\''CUSTOMER'\'';'"
```

### Q: 如何对比本地和线上的数据差异？

参考本文档"数据导入场景"部分，使用 MD5 校验或导出对比。
