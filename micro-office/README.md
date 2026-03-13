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
| 外部对象 | /api/objects | 客户/供应商等 |
| 产品 | /api/products | 产品服务 CRUD |
| 工作主帖 | /api/threads | 创建/查看工作 |
| 节点 | /api/threads/:id/nodes, /api/nodes/:id/* | 节点 CRUD + 完成 + 回退 |
| 评论 | /api/threads/:id/comments | 评论（含关键词触发） |
| 任务池 | /api/taskpool | 查看 + 领取（Redis 分布式锁） |
| 工作台 | /api/workbench?view=active\|done\|todo | 三视图 |
| 打卡 | /api/clock | 上下班打卡 |
| 管理 | /api/admin/modules, /templates | 模块配置 + 流程模板 |
