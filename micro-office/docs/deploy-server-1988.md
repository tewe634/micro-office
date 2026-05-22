# micro-office 线上部署完整指南

> 适用环境：`http://47.111.167.198`  
> 最后更新：2026-05-22

## 📌 目录

- [环境信息](#环境信息)
- [快速部署](#快速部署)
- [数据库迁移处理](#数据库迁移处理)
- [数据导入处理](#数据导入处理)
- [部署检查清单](#部署检查清单)
- [验收与测试](#验收与测试)
- [回滚操作](#回滚操作)
- [常见问题](#常见问题)
- [故障排查](#故障排查)

---

## 环境信息

### 线上服务器

| 项目 | 值 |
|------|-----|
| 主机 | `47.111.167.198` |
| 用户 | `root` |
| 项目目录 | `/opt/micro-office-1988` |
| 访问地址 | `http://47.111.167.198` |

### 数据库配置

| 项目 | 值 |
|------|-----|
| 真实数据库容器 | `prod-amd64-20260418-postgres-1` |
| 宿主机端口 | `5433` |
| 数据库名 | `micro_office` |
| 用户名 | `postgres` |

**⚠️ 重要**：不要把 compose 自带的 `micro-office-1988-postgres-1` 误认为正式业务库。

### 容器说明

| 容器名 | 用途 | 说明 |
|--------|------|------|
| `micro-office-1988-backend-1` | 后端服务 | Spring Boot 应用 |
| `micro-office-1988-frontend-1` | 前端服务 | Nginx + React |
| `micro-office-1988-postgres-1` | 开发数据库 | **不是生产库** |
| `micro-office-1988-redis-1` | 缓存服务 | Redis |
| `prod-amd64-20260418-postgres-1` | **生产数据库** | **真实业务数据** |

---

## 快速部署

### 前置条件

- [ ] 本地代码已提交并推送到 `master` 分支
- [ ] 本地测试通过
- [ ] 已配置 SSH key 或知道服务器密码

### 执行部署

#### 方式1：使用 SSH Key（推荐）

```bash
cd /home/user/.openclaw/workspace/micro-office
./scripts/deploy-server-1988.sh
```

#### 方式2：使用密码

```bash
cd /home/user/.openclaw/workspace/micro-office
SERVER_PASS='你的服务器密码' ./scripts/deploy-server-1988.sh
```

### 部署脚本做什么

1. ✅ 检查本地工作区状态
2. ✅ 验证线上环境配置
3. ✅ 备份线上代码、配置、数据库
4. ✅ 打包并上传本地代码
5. ✅ 重建并启动前后端容器
6. ✅ 验证服务可用性
7. ✅ 保留上一版本目录（用于回滚）

### 部署脚本不做什么

- ❌ **不会**自动执行数据库结构变更（DDL）
- ❌ **不会**自动导入数据
- ❌ **不会**修改数据库配置

---

## 数据库迁移处理

### ⚠️ 重要说明

**项目未启用 Flyway 自动迁移**，`backend/src/main/resources/db/migration/` 目录下的迁移脚本不会自动执行。

### 判断是否需要数据库迁移

如果你的代码包含以下变更，需要手动执行数据库迁移：

- 新增表
- 新增字段
- 修改字段类型
- 删除字段
- 新增索引
- 修改约束

### 方法1：手动执行 SQL（推荐）

**适用场景**：简单的 DDL 变更

```bash
# 1. 连接到线上数据库
ssh root@47.111.167.198
docker exec -it prod-amd64-20260418-postgres-1 psql -U postgres -d micro_office

# 2. 执行 DDL
ALTER TABLE external_object ADD COLUMN IF NOT EXISTS new_field VARCHAR(200);
COMMENT ON COLUMN external_object.new_field IS '字段说明';

# 3. 验证
\d external_object

# 4. 退出
\q
```

### 方法2：上传 SQL 文件执行

**适用场景**：复杂的迁移脚本或多个 DDL

```bash
# 1. 准备 SQL 文件（例如 /tmp/migration.sql）
cat > /tmp/migration.sql << 'EOF'
BEGIN;

ALTER TABLE external_object ADD COLUMN IF NOT EXISTS field1 VARCHAR(200);
ALTER TABLE external_object ADD COLUMN IF NOT EXISTS field2 INTEGER;
CREATE INDEX IF NOT EXISTS idx_field1 ON external_object(field1);

COMMENT ON COLUMN external_object.field1 IS '字段1说明';
COMMENT ON COLUMN external_object.field2 IS '字段2说明';

COMMIT;
EOF

# 2. 上传到服务器
scp /tmp/migration.sql root@47.111.167.198:/tmp/

# 3. 执行迁移
ssh root@47.111.167.198 "docker exec -i prod-amd64-20260418-postgres-1 psql -U postgres -d micro_office < /tmp/migration.sql"

# 4. 验证结果
ssh root@47.111.167.198 "docker exec prod-amd64-20260418-postgres-1 psql -U postgres -d micro_office -c '\\d external_object'"
```

### 方法3：启用 Flyway（需要修改配置）

**适用场景**：希望自动化迁移流程

修改 `backend/src/main/resources/application.yml`：

```yaml
spring:
  flyway:
    enabled: true
    baseline-on-migrate: true
    baseline-version: 0
```

**⚠️ 注意**：
- 首次启用需要谨慎，确保 Flyway 版本号和实际数据库状态一致
- 需要重新部署后端才能生效
- 建议在测试环境先验证

### 迁移脚本命名规范

如果使用 Flyway，迁移脚本应遵循命名规范：

```
V{版本号}__{描述}.sql

示例：
V62__add_bank_name_to_external_object.sql
V63__add_customer_level_field.sql
```

---

## 数据导入处理

### 场景1：从 Excel 导入数据

**流程**：Excel → 本地数据库 → 导出 SQL → 线上数据库

#### 步骤1：在本地导入并验证

```bash
# 使用 Node.js 脚本或其他工具导入到本地数据库
cd /home/user/.openclaw/workspace/micro-office
node import_data.js

# 验证本地数据
docker exec micro-office-postgres-1 psql -U postgres -d micro_office -c \
  "SELECT COUNT(*) FROM external_object WHERE bank_name IS NOT NULL;"
```

#### 步骤2：导出本地数据为 SQL

**方式A：导出特定字段的更新语句**

```bash
# 导出为 UPDATE 语句
docker exec micro-office-postgres-1 psql -U postgres -d micro_office -t -A -F'|' -c \
  "SELECT id, bank_name, account_no, subject_code FROM external_object WHERE type='CUSTOMER' ORDER BY id;" \
  > /tmp/data_export.txt

# 生成 UPDATE SQL
cat > /tmp/update_data.sql << 'EOF'
BEGIN;
EOF

awk -F'|' '{
  id = $1
  bank_name = $2
  account_no = $3
  subject_code = $4
  
  gsub(/'\''/, "'\'''\''", bank_name)
  gsub(/'\''/, "'\'''\''", account_no)
  gsub(/'\''/, "'\'''\''", subject_code)
  
  printf "UPDATE external_object SET bank_name = '\''%s'\'', account_no = '\''%s'\'', subject_code = '\''%s'\'' WHERE id = '\''%s'\'';\n", bank_name, account_no, subject_code, id
}' /tmp/data_export.txt >> /tmp/update_data.sql

echo "COMMIT;" >> /tmp/update_data.sql
```

**方式B：使用 pg_dump 导出**

```bash
# 导出整表数据（INSERT 语句）
docker exec micro-office-postgres-1 pg_dump -U postgres -d micro_office \
  --table=external_object --data-only --column-inserts \
  --inserts > /tmp/data_export.sql
```

#### 步骤3：上传并执行

```bash
# 上传到服务器
scp /tmp/update_data.sql root@47.111.167.198:/tmp/

# 在线上执行
ssh root@47.111.167.198 "docker exec -i prod-amd64-20260418-postgres-1 \
  psql -U postgres -d micro_office < /tmp/update_data.sql"
```

#### 步骤4：验证数据

```bash
# 验证数据量
ssh root@47.111.167.198 "docker exec prod-amd64-20260418-postgres-1 \
  psql -U postgres -d micro_office -c \
  \"SELECT COUNT(*) as total, COUNT(bank_name) as has_bank_name FROM external_object WHERE type='CUSTOMER';\""

# 抽查几条数据
ssh root@47.111.167.198 "docker exec prod-amd64-20260418-postgres-1 \
  psql -U postgres -d micro_office -c \
  \"SELECT id, name, bank_name, account_no FROM external_object WHERE type='CUSTOMER' LIMIT 5;\""
```

### 场景2：数据一致性校验

**对比本地和线上数据是否一致**

```bash
# 本地数据 MD5
cd /home/user/.openclaw/workspace/micro-office
docker exec micro-office-postgres-1 psql -U postgres -d micro_office -t -A -c \
  "SELECT md5(string_agg(COALESCE(bank_name, '') || '|' || COALESCE(account_no, ''), '' ORDER BY id)) \
   FROM external_object WHERE type='CUSTOMER';"

# 线上数据 MD5
ssh root@47.111.167.198 "docker exec prod-amd64-20260418-postgres-1 \
  psql -U postgres -d micro_office -t -A -c \
  \"SELECT md5(string_agg(COALESCE(bank_name, '') || '|' || COALESCE(account_no, ''), '' ORDER BY id)) \
   FROM external_object WHERE type='CUSTOMER';\""

# 如果 MD5 一致，说明数据完全相同
```

---

## 部署检查清单

### 部署前检查

- [ ] 代码已提交并推送到 `master` 分支
- [ ] 本地测试通过（前端、后端、数据库）
- [ ] 确认是否有数据库结构变更
  - [ ] 如有，准备好 DDL 脚本
- [ ] 确认是否有数据导入需求
  - [ ] 如有，准备好数据导出脚本
- [ ] 确认线上数据库已备份（部署脚本会自动备份）
- [ ] 通知相关人员即将部署

### 部署步骤

1. [ ] **执行部署脚本**
   ```bash
   cd /home/user/.openclaw/workspace/micro-office
   ./scripts/deploy-server-1988.sh
   ```

2. [ ] **执行数据库迁移**（如有）
   ```bash
   ssh root@47.111.167.198 "docker exec -i prod-amd64-20260418-postgres-1 \
     psql -U postgres -d micro_office < /tmp/migration.sql"
   ```

3. [ ] **执行数据导入**（如有）
   ```bash
   ssh root@47.111.167.198 "docker exec -i prod-amd64-20260418-postgres-1 \
     psql -U postgres -d micro_office < /tmp/data_import.sql"
   ```

4. [ ] **验证部署结果**（见下一节）

### 部署后验证

- [ ] 前端页面可以正常访问
- [ ] 登录功能正常
- [ ] 新功能正常工作
- [ ] 数据库字段存在（如有新增）
- [ ] 数据内容正确（如有导入）
- [ ] 后端日志无异常
- [ ] 通知相关人员部署完成

---

## 验收与测试

### 1. 基础服务验证

```bash
# 检查容器状态
ssh root@47.111.167.198 "cd /opt/micro-office-1988 && \
  docker compose -f docker-compose.server.yml --env-file .env.server ps"

# 预期结果：backend 和 frontend 状态为 Up
```

### 2. 数据库连接验证

```bash
# 验证 backend 连接的数据库
ssh root@47.111.167.198 "docker exec micro-office-1988-backend-1 \
  env | grep '^SPRING_DATASOURCE_URL='"

# 预期结果：
# SPRING_DATASOURCE_URL=jdbc:postgresql://host.docker.internal:5433/micro_office?stringtype=unspecified
```

### 3. 前端访问验证

```bash
# 首页探活
ssh root@47.111.167.198 "curl -I http://127.0.0.1/"

# 预期结果：HTTP/1.1 200 OK
```

### 4. 登录接口验证

```bash
# 登录接口测试
ssh root@47.111.167.198 "curl -X POST http://127.0.0.1/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{\"login\":\"13305713391\",\"password\":\"123456\"}'"

# 预期结果：返回 token 和用户信息
```

### 5. 数据库表结构验证

```bash
# 查看表结构（如有新增字段）
ssh root@47.111.167.198 "docker exec prod-amd64-20260418-postgres-1 \
  psql -U postgres -d micro_office -c '\\d external_object'"

# 验证特定字段是否存在
ssh root@47.111.167.198 "docker exec prod-amd64-20260418-postgres-1 \
  psql -U postgres -d micro_office -c \
  \"SELECT column_name, data_type FROM information_schema.columns \
   WHERE table_name='external_object' AND column_name='bank_name';\""
```

### 6. 数据内容验证

```bash
# 统计数据量
ssh root@47.111.167.198 "docker exec prod-amd64-20260418-postgres-1 \
  psql -U postgres -d micro_office -c \
  \"SELECT COUNT(*) as total, \
          COUNT(bank_name) as has_bank_name, \
          COUNT(account_no) as has_account_no \
   FROM external_object WHERE type='CUSTOMER';\""

# 抽查数据
ssh root@47.111.167.198 "docker exec prod-amd64-20260418-postgres-1 \
  psql -U postgres -d micro_office -c \
  \"SELECT id, name, bank_name, account_no FROM external_object \
   WHERE type='CUSTOMER' AND name LIKE '%中电鑫龙%';\""
```

### 7. 后端日志检查

```bash
# 查看最近日志
ssh root@47.111.167.198 "docker logs micro-office-1988-backend-1 --tail 50"

# 查看错误日志
ssh root@47.111.167.198 "docker logs micro-office-1988-backend-1 2>&1 | grep -i error"
```

### 8. 浏览器测试

- [ ] 访问 `http://47.111.167.198`
- [ ] 登录系统
- [ ] 测试新功能
- [ ] 检查客户列表数据显示
- [ ] 检查客户详情页字段显示

---

## 回滚操作

### 自动回滚（推荐）

部署脚本会自动保留上一版本目录：`/opt/micro-office-1988.prev`

```bash
ssh root@47.111.167.198

# 1. 停止当前容器
cd /opt/micro-office-1988
docker compose -f docker-compose.server.yml --env-file .env.server down

# 2. 备份当前版本（可选）
mv /opt/micro-office-1988 /opt/micro-office-1988.failed

# 3. 恢复上一版本
mv /opt/micro-office-1988.prev /opt/micro-office-1988

# 4. 启动容器
cd /opt/micro-office-1988
docker compose -f docker-compose.server.yml --env-file .env.server up -d

# 5. 验证
docker compose -f docker-compose.server.yml --env-file .env.server ps
curl -I http://127.0.0.1/
```

### 数据库回滚

**⚠️ 注意**：代码回滚不会自动回滚数据库变更。

#### 方式1：从备份恢复

```bash
# 查看备份文件
ssh root@47.111.167.198 "ls -lh /root/deploy-backups/ | tail -10"

# 恢复数据库（谨慎操作！）
ssh root@47.111.167.198 "docker exec -i prod-amd64-20260418-postgres-1 \
  psql -U postgres -d micro_office < /root/deploy-backups/micro-office-1988-db-YYYYMMDD-HHMMSS.sql"
```

#### 方式2：执行反向 DDL

```bash
# 例如：删除新增的字段
ssh root@47.111.167.198 "docker exec -i prod-amd64-20260418-postgres-1 \
  psql -U postgres -d micro_office -c 'ALTER TABLE external_object DROP COLUMN IF EXISTS new_field;'"
```

---

## 常见问题

### Q1: 部署后前端显示数据为空？

**可能原因**：
1. 数据库字段缺失
2. 后端实体类未定义新字段
3. 数据未导入

**排查步骤**：
```bash
# 1. 检查表结构
ssh root@47.111.167.198 "docker exec prod-amd64-20260418-postgres-1 \
  psql -U postgres -d micro_office -c '\\d external_object'"

# 2. 检查数据
ssh root@47.111.167.198 "docker exec prod-amd64-20260418-postgres-1 \
  psql -U postgres -d micro_office -c \
  \"SELECT COUNT(*), COUNT(bank_name) FROM external_object WHERE type='CUSTOMER';\""

# 3. 检查后端日志
ssh root@47.111.167.198 "docker logs micro-office-1988-backend-1 --tail 100"
```

### Q2: 部署脚本执行失败？

**常见错误**：

1. **SSH 连接失败**
   ```bash
   # 测试 SSH 连接
   ssh root@47.111.167.198 "echo 'Connection OK'"
   ```

2. **权限不足**
   ```bash
   # 检查服务器目录权限
   ssh root@47.111.167.198 "ls -la /opt/"
   ```

3. **Docker 服务异常**
   ```bash
   # 检查 Docker 状态
   ssh root@47.111.167.198 "docker ps"
   ```

### Q3: 如何查看线上数据库的表结构？

```bash
# 查看所有表
ssh root@47.111.167.198 "docker exec prod-amd64-20260418-postgres-1 \
  psql -U postgres -d micro_office -c '\\dt'"

# 查看特定表结构
ssh root@47.111.167.198 "docker exec prod-amd64-20260418-postgres-1 \
  psql -U postgres -d micro_office -c '\\d+ external_object'"
```

### Q4: 如何查看线上某个表的数据量？

```bash
ssh root@47.111.167.198 "docker exec prod-amd64-20260418-postgres-1 \
  psql -U postgres -d micro_office -c \
  \"SELECT type, COUNT(*) FROM external_object GROUP BY type;\""
```

### Q5: 如何对比本地和线上的数据差异？

```bash
# 方法1：使用 MD5 校验（见"数据一致性校验"章节）

# 方法2：导出对比
# 本地导出
cd /home/user/.openclaw/workspace/micro-office
docker exec micro-office-postgres-1 psql -U postgres -d micro_office -t -A -F'|' -c \
  "SELECT id, name, bank_name FROM external_object WHERE type='CUSTOMER' ORDER BY id;" \
  > /tmp/local_data.txt

# 线上导出
ssh root@47.111.167.198 "docker exec prod-amd64-20260418-postgres-1 \
  psql -U postgres -d micro_office -t -A -F'|' -c \
  \"SELECT id, name, bank_name FROM external_object WHERE type='CUSTOMER' ORDER BY id;\"" \
  > /tmp/remote_data.txt

# 对比
diff /tmp/local_data.txt /tmp/remote_data.txt | head -20
```

### Q6: 部署后前端修改未生效？

**可能原因**：浏览器缓存

**解决方法**：
1. 强制刷新：`Ctrl + F5` (Windows) 或 `Cmd + Shift + R` (Mac)
2. 清除浏览器缓存
3. 使用无痕模式测试

### Q7: 如何查看部署历史？

```bash
# 查看备份目录
ssh root@47.111.167.198 "ls -lht /root/deploy-backups/ | head -20"

# 查看 Git 提交历史
cd /home/user/.openclaw/workspace/micro-office
git log --oneline -10
```

---

## 故障排查

### 容器无法启动

```bash
# 查看容器状态
ssh root@47.111.167.198 "docker ps -a | grep micro-office-1988"

# 查看容器日志
ssh root@47.111.167.198 "docker logs micro-office-1988-backend-1"
ssh root@47.111.167.198 "docker logs micro-office-1988-frontend-1"

# 重启容器
ssh root@47.111.167.198 "cd /opt/micro-office-1988 && \
  docker compose -f docker-compose.server.yml --env-file .env.server restart"
```

### 数据库连接失败

```bash
# 检查数据库容器状态
ssh root@47.111.167.198 "docker ps | grep postgres"

# 测试数据库连接
ssh root@47.111.167.198 "docker exec prod-amd64-20260418-postgres-1 \
  psql -U postgres -d micro_office -c 'SELECT 1;'"

# 检查 backend 环境变量
ssh root@47.111.167.198 "docker exec micro-office-1988-backend-1 \
  env | grep DATASOURCE"
```

### 前端 404 错误

```bash
# 检查 Nginx 配置
ssh root@47.111.167.198 "docker exec micro-office-1988-frontend-1 \
  cat /etc/nginx/conf.d/default.conf"

# 检查前端文件
ssh root@47.111.167.198 "docker exec micro-office-1988-frontend-1 \
  ls -la /usr/share/nginx/html/"

# 重启前端容器
ssh root@47.111.167.198 "docker restart micro-office-1988-frontend-1"
```

### 后端接口 500 错误

```bash
# 查看详细错误日志
ssh root@47.111.167.198 "docker logs micro-office-1988-backend-1 --tail 200"

# 检查数据库连接
ssh root@47.111.167.198 "docker exec micro-office-1988-backend-1 \
  nc -zv host.docker.internal 5433"

# 重启后端容器
ssh root@47.111.167.198 "docker restart micro-office-1988-backend-1"
```

### 磁盘空间不足

```bash
# 检查磁盘使用情况
ssh root@47.111.167.198 "df -h"

# 清理 Docker 资源
ssh root@47.111.167.198 "docker system prune -a --volumes"

# 清理旧备份（谨慎操作）
ssh root@47.111.167.198 "ls -lht /root/deploy-backups/ | tail -20"
ssh root@47.111.167.198 "rm /root/deploy-backups/micro-office-1988-*-YYYYMMDD-*.tgz"
```

---

## 附录

### 线上 `.env.server` 配置示例

```env
# 数据库配置（compose 自带，不是生产库）
POSTGRES_DB=micro_office
POSTGRES_USER=postgres
POSTGRES_PASSWORD=***

# JWT 配置
JWT_SECRET=***
JWT_EXPIRATION=0

# 服务端口
HTTP_PORT=80

# 生产数据库连接（重要！）
SPRING_DATASOURCE_URL=jdbc:postgresql://host.docker.internal:5433/micro_office?stringtype=unspecified
SPRING_DATASOURCE_PASSWORD=postgres
```

### 常用命令速查

```bash
# 连接线上服务器
ssh root@47.111.167.198

# 进入项目目录
cd /opt/micro-office-1988

# 查看容器状态
docker compose -f docker-compose.server.yml --env-file .env.server ps

# 查看日志
docker logs micro-office-1988-backend-1 --tail 50
docker logs micro-office-1988-frontend-1 --tail 50

# 重启服务
docker compose -f docker-compose.server.yml --env-file .env.server restart

# 停止服务
docker compose -f docker-compose.server.yml --env-file .env.server down

# 启动服务
docker compose -f docker-compose.server.yml --env-file .env.server up -d

# 连接数据库
docker exec -it prod-amd64-20260418-postgres-1 psql -U postgres -d micro_office

# 查看备份
ls -lht /root/deploy-backups/
```

### 联系方式

如遇到无法解决的问题，请联系：
- 开发团队
- 运维团队

---

**文档版本**：v2.0  
**最后更新**：2026-05-22  
**维护者**：开发团队
