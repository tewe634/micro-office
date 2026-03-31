package com.microoffice.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;
import java.time.LocalDate;
import java.time.OffsetDateTime;

@Data
@TableName("sys_user")
public class SysUser {
    @TableId(type = IdType.ASSIGN_UUID)
    private String id;
    private String name;
    private String phone;
    private String email;
    private String passwordHash;
    private String orgId;
    private String primaryPositionId;
    private String role;
    private String empNo;
    private LocalDate hiredAt;
    private OffsetDateTime createdAt;
    private OffsetDateTime updatedAt;
}
