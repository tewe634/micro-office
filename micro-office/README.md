# 微办公论坛系统

工作即帖子，流程由人驱动的微办公协作平台。

## 技术栈

- **后端**: Java 17 + Spring Boot 3.3 + MyBatis-Plus + PostgreSQL + Redis + Flyway
- **前端**: React 18 + TypeScript + Vite + Ant Design 5 + Zustand + Axios

## 项目结构

```
micro-office/
├── backend/                    # Java 后端
│   ├── pom.xml
│   └── src/main/
│       ├── java/com/microoffice/
│       │   ├── config/         # Security, JWT, 异常处理
│       │   ├── controller/     # 11个 REST Controller
│       │   ├── dto/            # 请求/响应 DTO
│       │   ├── entity/         # 12个实体类
│       │   ├── enums/          # 枚举类型
│       │   ├── mapper/         # MyBatis-Plus Mapper
│       │   ├── service/        # 11个业务 Service
│       │   └── util/           # JWT 工具
│       └── resources/
│           ├── application.yml
│           └── db/migration/   # Flyway SQL
└── frontend/                   # React 前端
    ├── vite.config.ts
    └── src/
        ├── api/                # Axios 封装 + 全部 API
        ├── store/              # Zustand 状态管理
        ├── layouts/            # 主布局
        └── pages/              # 10个页面
            ├── auth/           # 登录
            ├── workbench/      # 工作台
            ├── thread/         # 工作主帖详情
            ├── org/            # 组织架构 + 岗位
            ├── object/         # 外部对象
            ├── product/        # 产品服务
            ├── taskpool/       # 任务池
            ├── clock/          # 打卡
            └── admin/          # 模块配置 + 流程模板
```

## Docker 一键启动（推荐）

```bash
cd micro-office
docker compose up --build -d
```

启动后：
- 前端: http://localhost (Nginx, 端口80)
- 后端: http://localhost:8080
- PostgreSQL: localhost:5432
- Redis: localhost:6379

停止: `docker compose down`
清除数据: `docker compose down -v`

## API 回归冒烟脚本

在本地栈已经启动后，可从仓库根目录运行：

```bash
npm run smoke:api
```

默认会登录 `http://127.0.0.1:8080/api`，使用当前本地演示栈默认管理员账号 `13305713391 / 123456`，并自动创建/清理临时数据，覆盖以下当前后端流转：

- auth（register/login）
- org / positions / users
- objects / products / portal
- admin permissions / user object types / position object types
- admin sales-collab（meta / templates / org-bindings）

如需覆盖其他地址或管理员账号，可设置环境变量：

```bash
MICRO_OFFICE_BASE_URL=http://127.0.0.1:8080/api \
MICRO_OFFICE_ADMIN_LOGIN=13305713391 \
MICRO_OFFICE_ADMIN_PASSWORD=123456 \
npm run smoke:api
```

## 本地开发启动

### 后端

```bash
# 确保 PostgreSQL 和 Redis 已运行，创建数据库
createdb micro_office

cd backend
mvn spring-boot:run
# 后端运行在 http://localhost:8080
```

### 前端

```bash
cd frontend
npm install
npm run dev
# 前端运行在 http://localhost:5173，自动代理 /api 到后端
```

## API 概览

| 模块 | 路径 | 说明 |
|------|------|------|
| 认证 | POST /api/auth/login, /register | 登录注册 |
| 组织 | /api/orgs | 组织架构 CRUD |
| 岗位 | /api/positions | 岗位管理 CRUD |
| 用户 | /api/users | 用户资料、自助信息、权限可见范围内查询 |
| 外部对象 | /api/objects | 客户 / 供应商等对象 CRUD |
| 产品 | /api/products | 产品服务 CRUD |
| 门户 | /api/portal/users/:id / objects/:id / products/:id | 用户 / 对象 / 产品门户 |
| 管理权限 | /api/admin/permissions 等 | 角色菜单、用户菜单、对象类型配置 |
| 销售协同配置 | /api/admin/sales-collab/* | 协同模板、规则、部门绑定 |

> 注：旧版工作流相关接口（如 `/api/threads`、`/api/workbench`、`/api/taskpool`、`/api/clock`、`/api/admin/templates`）已在迁移 `V20__remove_workflow_and_unused_modules.sql` 中下线，不属于当前后端 API。
