package com.microoffice.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;
import java.time.OffsetDateTime;
import java.math.BigDecimal;

@Data
@TableName("product")
public class Product {
    @TableId(type = IdType.ASSIGN_UUID)
    private String id;
    private String name;
    private String code;
    private String parentId;
    private String spec;
    private BigDecimal price;
    private String orgId;
    private String categoryCode;
    private String categoryLevel1;
    private String categoryLevel2;
    private String categoryLevel3;
    private OffsetDateTime createdAt;
    private OffsetDateTime updatedAt;
}
