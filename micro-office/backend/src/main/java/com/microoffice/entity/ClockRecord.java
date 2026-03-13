package com.microoffice.entity;

import com.baomidou.mybatisplus.annotation.*;
import com.microoffice.enums.ClockType;
import lombok.Data;
import java.time.OffsetDateTime;

@Data
@TableName("clock_record")
public class ClockRecord {
    @TableId(type = IdType.AUTO)
    private Integer id;
    private Integer userId;
    private ClockType type;
    private OffsetDateTime clockTime;
    private OffsetDateTime createdAt;
}
