-- 仅保留元数据管理所需的核心模型：组织、人员、产品、外部对象、权限配置
-- 清理已下线的工作流 / 模板 / 打卡 / 仪表盘残留表与权限

DELETE FROM role_menu_permission
WHERE menu_key IN (
  '/portal',
  '/dashboard',
  '/workbench',
  '/threads',
  '/taskpool',
  '/clock',
  '/admin/modules',
  '/admin/templates'
);

DELETE FROM user_menu_permission
WHERE menu_key IN (
  '/portal',
  '/dashboard',
  '/workbench',
  '/threads',
  '/taskpool',
  '/clock',
  '/admin/modules',
  '/admin/templates'
);

DROP TABLE IF EXISTS node_reference;
DROP TABLE IF EXISTS node_message;
DROP TABLE IF EXISTS comment;
DROP TABLE IF EXISTS field_visibility;
DROP TABLE IF EXISTS work_node;
DROP TABLE IF EXISTS work_thread;
DROP TABLE IF EXISTS template_node;
DROP TABLE IF EXISTS workflow_template;
DROP TABLE IF EXISTS module_config_position;
DROP TABLE IF EXISTS module_config;
DROP TABLE IF EXISTS clock_record;
DROP TABLE IF EXISTS user_achievement;

DROP TYPE IF EXISTS node_status;
DROP TYPE IF EXISTS thread_status;
DROP TYPE IF EXISTS node_type;
DROP TYPE IF EXISTS clock_type;
