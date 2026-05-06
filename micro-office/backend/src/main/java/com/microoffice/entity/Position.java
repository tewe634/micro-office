package com.microoffice.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;
import java.time.OffsetDateTime;

@Data
@TableName("position")
public class Position {
    @TableId(type = IdType.ASSIGN_UUID)
    private String id;
    private String name;
    private String code;
    private String parentId;
    private OffsetDateTime createdAt;
    private OffsetDateTime updatedAt;
}
