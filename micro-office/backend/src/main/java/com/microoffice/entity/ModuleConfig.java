package com.microoffice.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;
import java.time.OffsetDateTime;

@Data
@TableName("module_config")
public class ModuleConfig {
    @TableId(type = IdType.AUTO)
    private Integer id;
    private String keyword;
    private String moduleName;
    private String moduleUrl;
    private OffsetDateTime createdAt;
}
