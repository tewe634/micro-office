package com.microoffice.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;
import java.time.LocalDate;
import java.time.OffsetDateTime;

@Data
@TableName("sys_user")
public class SysUser {
    @TableId(type = IdType.AUTO)
    private Integer id;
    private String name;
    private String phone;
    private String email;
    private String passwordHash;
    private Integer orgId;
    private Integer primaryPositionId;
    private String role;
    private LocalDate hiredAt;
    private OffsetDateTime createdAt;
    private OffsetDateTime updatedAt;
}
