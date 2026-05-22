# micro-office 线上部署说明（47.111.167.198）

适用环境：`http://47.111.167.198`

## 环境信息

- **主机**：`47.111.167.198`
- **用户**：`root`
- **项目目录**：`/opt/micro-office-1988`
- **真实数据库容器**：`prod-amd64-20260418-postgres-1`
- **真实数据库端口**：宿主机 `5433`

**⚠️ 重要**：不要把 compose 自带的 `micro-office-1988-postgres-1` 误认为正式业务库。

---

## 快速部署

### 执行部署脚本

```bash
cd /home/user/.openclaw/workspace/micro-office
./scripts/deploy-server-1988.sh
```

如果需要密码：

```bash
SERVER_PASS='你的服务器密码' ./scripts/deploy-server-1988.sh
```

### 脚本会做什么

1. 检查本地工作区状态
2. 验证线上环境配置
3. 备份线上代码、配置、数据库
4. 打包并上传本地代码
5. 重建并启动前后端容器
6. 验证服务可用性
7. 保留上一版本目录（用于回滚）

### ⚠️ 脚本不会做什么

- **不会**自动执行数据库结构变更（DDL）
- **不会**自动导入数据

---

## 数据库迁移（如有结构变更）

**项目未启用 Flyway**，`db/migration/` 目录下的迁移脚本不会自动执行。

### 如果代码包含数据库结构变更

**方式1：直接执行 SQL**

```bash
ssh root@47.111.167.198 "docker exec -i prod-amd64-20260418-postgres-1 psql -U postgres -d micro_office" <<'EOF'
ALTER TABLE external_object ADD COLUMN IF NOT EXISTS new_field VARCHAR(200);
COMMENT ON COLUMN external_object.new_field IS '字段说明';
EOF
```

**方式2：上传 SQL 文件执行**

```bash
# 准备 SQL 文件
cat > /tmp/migration.sql << 'EOF'
BEGIN;
ALTER TABLE external_object ADD COLUMN IF NOT EXISTS field1 VARCHAR(200);
ALTER TABLE external_object ADD COLUMN IF NOT EXISTS field2 INTEGER;
COMMIT;
EOF

# 上传并执行
scp /tmp/migration.sql root@47.111.167.198:/tmp/
ssh root@47.111.167.198 "docker exec -i prod-amd64-20260418-postgres-1 psql -U postgres -d micro_office < /tmp/migration.sql"
```

**验证结果**

```bash
ssh root@47.111.167.198 "docker exec prod-amd64-20260418-postgres-1 psql -U postgres -d micro_office -c '\\d external_object'"
```

---

## 数据导入（如有数据变更）

### 从本地同步数据到线上

**步骤1：在本地导入并验证数据**

```bash
# 使用你的导入脚本
cd /home/user/.openclaw/workspace/micro-office
node import_data.js

# 验证本地数据
docker exec micro-office-postgres-1 psql -U postgres -d micro_office -c \
  "SELECT COUNT(*) FROM external_object WHERE bank_name IS NOT NULL;"
```

**步骤2：导出本地数据为 UPDATE 语句**

```bash
# 导出数据
docker exec micro-office-postgres-1 psql -U postgres -d micro_office -t -A -F'|' -c \
  "SELECT id, bank_name, account_no, subject_code FROM external_object WHERE type='CUSTOMER' ORDER BY id;" \
  > /tmp/data_export.txt

# 生成 UPDATE SQL
cat > /tmp/update_data.sql << 'EOF'
BEGIN;
EOF

awk -F'|' '{
  id = $1; bank_name = $2; account_no = $3; subject_code = $4
  gsub(/'\''/, "'\'''\''", bank_name); gsub(/'\''/, "'\'''\''", account_no); gsub(/'\''/, "'\'''\''", subject_code)
  if (bank_name == "" && account_no == "" && subject_code == "") {
    printf "UPDATE external_object SET bank_name = NULL, account_no = NULL, subject_code = NULL WHERE id = '\''%s'\'';\n", id
  } else if (bank_name == "" && account_no == "") {
    printf "UPDATE external_object SET bank_name = NULL, account_no = NULL, subject_code = '\''%s'\'' WHERE id = '\''%s'\'';\n", subject_code, id
  } else if (bank_name == "" && subject_code == "") {
    printf "UPDATE external_object SET bank_name = NULL, account_no = '\''%s'\'', subject_code = NULL WHERE id = '\''%s'\'';\n", account_no, id
  } else if (account_no == "" && subject_code == "") {
    printf "UPDATE external_object SET bank_name = '\''%s'\'', account_no = NULL, subject_code = NULL WHERE id = '\''%s'\'';\n", bank_name, id
  } else if (bank_name == "") {
    printf "UPDATE external_object SET bank_name = NULL, account_no = '\''%s'\'', subject_code = '\''%s'\'' WHERE id = '\''%s'\'';\n", account_no, subject_code, id
  } else if (account_no == "") {
    printf "UPDATE external_object SET bank_name = '\''%s'\'', account_no = NULL, subject_code = '\''%s'\'' WHERE id = '\''%s'\'';\n", bank_name, subject_code, id
  } else if (subject_code == "") {
    printf "UPDATE external_object SET bank_name = '\''%s'\'', account_no = '\''%s'\'', subject_code = NULL WHERE id = '\''%s'\'';\n", bank_name, account_no, id
  } else {
    printf "UPDATE external_object SET bank_name = '\''%s'\'', account_no = '\''%s'\'', subject_code = '\''%s'\'' WHERE id = '\''%s'\'';\n", bank_name, account_no, subject_code, id
  }
}' /tmp/data_export.txt >> /tmp/update_data.sql

echo "COMMIT;" >> /tmp/update_data.sql
```

**步骤3：上传并执行**

```bash
scp /tmp/update_data.sql root@47.111.167.198:/tmp/
ssh root@47.111.167.198 "docker exec -i prod-amd64-20260418-postgres-1 psql -U postgres -d micro_office < /tmp/update_data.sql"
```

**步骤4：验证数据**

```bash
# 验证数据量
ssh root@47.111.167.198 "docker exec prod-amd64-20260418-postgres-1 psql -U postgres -d micro_office -c \
  \"SELECT COUNT(*) as total, COUNT(bank_name) as has_bank_name, COUNT(account_no) as has_account_no FROM external_object WHERE type='CUSTOMER';\""

# 抽查数据
ssh root@47.111.167.198 "docker exec prod-amd64-20260418-postgres-1 psql -U postgres -d micro_office -c \
  \"SELECT id, name, bank_name, account_no FROM external_object WHERE type='CUSTOMER' LIMIT 3;\""
```

---

## 部署检查清单

### 部署前

- [ ] 代码已提交并推送到 `master` 分支
- [ ] 本地测试通过
- [ ] 确认是否有数据库结构变更（准备 DDL 脚本）
- [ ] 确认是否有数据导入需求（准备数据脚本）

### 部署步骤

1. [ ] 执行部署脚本：`./scripts/deploy-server-1988.sh`
2. [ ] 如有数据库结构变更，执行 DDL
3. [ ] 如有数据导入，执行数据导入脚本
4. [ ] 验证部署结果

### 部署后验证

```bash
# 1. 检查容器状态
ssh root@47.111.167.198 "cd /opt/micro-office-1988 && docker compose -f docker-compose.server.yml --env-file .env.server ps"

# 2. 验证数据库连接
ssh root@47.111.167.198 "docker exec micro-office-1988-backend-1 env | grep '^SPRING_DATASOURCE_URL='"
# 预期：jdbc:postgresql://host.docker.internal:5433/micro_office?stringtype=unspecified

# 3. 测试前端
curl -I http://47.111.167.198/
# 预期：HTTP/1.1 200 OK

# 4. 测试登录
ssh root@47.111.167.198 "curl -X POST http://127.0.0.1/api/auth/login -H 'Content-Type: application/json' -d '{\"login\":\"13305713391\",\"password\":\"123456\"}'"
# 预期：返回 token

# 5. 检查后端日志
ssh root@47.111.167.198 "docker logs micro-office-1988-backend-1 --tail 50"
```

---

## 回滚

```bash
ssh root@47.111.167.198

# 停止当前容器
cd /opt/micro-office-1988
docker compose -f docker-compose.server.yml --env-file .env.server down

# 恢复上一版本
mv /opt/micro-office-1988 /opt/micro-office-1988.failed
mv /opt/micro-office-1988.prev /opt/micro-office-1988

# 启动容器
cd /opt/micro-office-1988
docker compose -f docker-compose.server.yml --env-file .env.server up -d
```

**注意**：回滚只能恢复代码，无法自动回滚数据库变更。

---

## 常见问题

### 部署后数据显示为空？

检查数据库字段和数据：

```bash
# 检查表结构
ssh root@47.111.167.198 "docker exec prod-amd64-20260418-postgres-1 psql -U postgres -d micro_office -c '\\d external_object'"

# 检查数据
ssh root@47.111.167.198 "docker exec prod-amd64-20260418-postgres-1 psql -U postgres -d micro_office -c \
  \"SELECT COUNT(*), COUNT(bank_name) FROM external_object WHERE type='CUSTOMER';\""
```

### 如何查看线上数据库？

```bash
# 连接数据库
ssh root@47.111.167.198 "docker exec -it prod-amd64-20260418-postgres-1 psql -U postgres -d micro_office"

# 查看表结构
\d external_object

# 查询数据
SELECT * FROM external_object WHERE type='CUSTOMER' LIMIT 5;

# 退出
\q
```

### 前端修改未生效？

浏览器强制刷新：`Ctrl + F5` (Windows) 或 `Cmd + Shift + R` (Mac)

---

## 线上 `.env.server` 配置

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

---

## 数据库连接说明

**从宿主机连接**：
```
jdbc:postgresql://47.111.167.198:5433/micro_office?stringtype=unspecified
```

**从 backend 容器内连接**：
```
jdbc:postgresql://host.docker.internal:5433/micro_office?stringtype=unspecified
```

---

**最后更新**：2026-05-22
