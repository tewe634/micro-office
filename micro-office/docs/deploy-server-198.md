# micro-office 线上部署说明（198 别名）

如果你按“198”查部署说明，优先看这份正式文档：

- `docs/deploy-server-1988.md`

快速执行命令：

```bash
cd /home/user/.openclaw/workspace/micro-office
SERVER_PASS='你的服务器密码' ./scripts/deploy-server-1988.sh
```

关键提醒：
- 线上主机：`47.111.167.198`
- 项目目录：`/opt/micro-office-1988`
- 真实数据库容器：`prod-amd64-20260418-postgres-1`
- backend 应连接：`host.docker.internal:5433`
