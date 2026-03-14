package com.microoffice.entity;

import com.baomidou.mybatisplus.annotation.*;
import com.microoffice.enums.ObjectType;
import lombok.Data;
import java.time.OffsetDateTime;

@Data
@TableName("external_object")
public class ExternalObject {
    @TableId(type = IdType.AUTO)
    private Integer id;
    private ObjectType type;
    private String name;
    private String contact;
    private String phone;
    private String address;
    private String remark;
    private Integer orgId;
    private Integer ownerId;
    private OffsetDateTime createdAt;
    private OffsetDateTime updatedAt;
}
