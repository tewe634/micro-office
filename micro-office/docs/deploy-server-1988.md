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
