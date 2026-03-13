package com.microoffice.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;
import java.time.OffsetDateTime;

@Data
@TableName("position")
public class Position {
    @TableId(type = IdType.AUTO)
    private Integer id;
    private String name;
    private String code;
    private Integer parentId;
    private OffsetDateTime createdAt;
    private OffsetDateTime updatedAt;
}
