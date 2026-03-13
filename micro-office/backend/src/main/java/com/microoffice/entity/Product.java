package com.microoffice.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;
import java.time.OffsetDateTime;
import java.math.BigDecimal;

@Data
@TableName("product")
public class Product {
    @TableId(type = IdType.AUTO)
    private Integer id;
    private String name;
    private String code;
    private Integer parentId;
    private String spec;
    private BigDecimal price;
    private Integer orgId;
    private OffsetDateTime createdAt;
    private OffsetDateTime updatedAt;
}
