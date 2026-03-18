package com.microoffice.entity;

import com.baomidou.mybatisplus.annotation.*;
import com.microoffice.enums.ObjectType;
import lombok.Data;
import java.time.OffsetDateTime;

@Data
@TableName("external_object")
public class ExternalObject {
    @TableId(type = IdType.ASSIGN_UUID)
    private String id;
    private ObjectType type;
    private String name;
    private String contact;
    private String phone;
    private String address;
    private String remark;
    private String accountNo;
    private String subjectCode;
    private String orgId;
    private String deptId;
    private String ownerId;
    private String industry;
    private OffsetDateTime createdAt;
    private OffsetDateTime updatedAt;
}
