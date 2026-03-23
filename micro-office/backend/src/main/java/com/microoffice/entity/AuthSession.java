package com.microoffice.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.OffsetDateTime;

@Data
@TableName("auth_session")
public class AuthSession {
    @TableId(type = IdType.ASSIGN_UUID)
    private String id;
    private String userId;
    private OffsetDateTime revokedAt;
    private OffsetDateTime createdAt;
}
