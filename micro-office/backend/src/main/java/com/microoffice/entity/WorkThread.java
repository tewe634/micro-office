package com.microoffice.entity;

import com.baomidou.mybatisplus.annotation.*;
import com.microoffice.enums.ThreadStatus;
import lombok.Data;
import java.time.OffsetDateTime;

@Data
@TableName("work_thread")
public class WorkThread {
    @TableId(type = IdType.AUTO)
    private Integer id;
    private String title;
    private String content;
    private ThreadStatus status;
    private Integer creatorId;
    private Integer objectId;
    private Integer templateId;
    private Integer productId;
    private OffsetDateTime createdAt;
    private OffsetDateTime updatedAt;
}
