package com.microoffice.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;
import java.time.OffsetDateTime;

@Data
@TableName("organization")
public class Organization {
    @TableId(type = IdType.ASSIGN_UUID)
    private String id;
    private String name;
    private String parentId;
    private Integer sortOrder;
    private OffsetDateTime createdAt;
    private OffsetDateTime updatedAt;
}
