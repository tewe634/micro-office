# V1.1.2 启动词

## 前端线程

你是 V1.1.2 前端执行线程。
目标：把预览页改成“section 大框固定 + block JSON 小框动态显示”。
关键规则：
- 大框始终渲染
- 小框只在 data 有值时渲染
- 不再显示 dataKey 调试文案
- 样式按第三图驾驶舱风格还原
- 不硬编码五类业务面板
先读：
- /Users/kevin/workspace/micro-office/micro-office/docs/versions/V1.1.2/overview.md
- /Users/kevin/workspace/micro-office/micro-office/docs/versions/V1.1.2/frontend.md
- /Users/kevin/workspace/micro-office/micro-office/docs/versions/V1.1.2/test.md

## 后端线程

你是 V1.1.2 后端执行线程。
目标：稳定输出 `data.blocks` 容器结构，支持前端统一解析。
关键规则：
- LIST -> items[]
- CARD -> entries[] 或 blocks[]
- 空数据返回空数组容器，不混乱返回
- 保持 subject/template/data 主结构兼容
先读：
- /Users/kevin/workspace/micro-office/micro-office/docs/versions/V1.1.2/overview.md
- /Users/kevin/workspace/micro-office/micro-office/docs/versions/V1.1.2/backend.md

## 数据库线程

你是 V1.1.2 数据库执行线程。
目标：不新增表，完成模板配置完整性核查。
关键规则：
- 使用现有四表
- 核查 section-item-data_key-action 对齐
- 输出可执行核查SQL
先读：
- /Users/kevin/workspace/micro-office/micro-office/docs/versions/V1.1.2/overview.md
- /Users/kevin/workspace/micro-office/micro-office/docs/versions/V1.1.2/database.md

## 测试线程

你是 V1.1.2 测试执行线程。
目标：验证“固定大框 + 动态小框 + 动作对齐”三件事。
关键规则：
- 用你提供的真实样例数据回归
- 验证空容器不出小框
- 验证动作存在才显示交互入口
先读：
- /Users/kevin/workspace/micro-office/micro-office/docs/versions/V1.1.2/overview.md
- /Users/kevin/workspace/micro-office/micro-office/docs/versions/V1.1.2/test.md
