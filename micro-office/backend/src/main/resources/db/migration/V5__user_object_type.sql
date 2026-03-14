-- V5: 用户个人对象类型权限
CREATE TABLE user_object_type (
    id          SERIAL PRIMARY KEY,
    user_id     INT NOT NULL REFERENCES sys_user(id) ON DELETE CASCADE,
    object_type VARCHAR(30) NOT NULL,
    UNIQUE(user_id, object_type)
);
