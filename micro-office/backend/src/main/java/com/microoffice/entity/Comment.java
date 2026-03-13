package com.microoffice.entity;

import com.baomidou.mybatisplus.annotation.*;
import com.baomidou.mybatisplus.extension.handlers.JacksonTypeHandler;
import lombok.Data;
import java.time.OffsetDateTime;

@Data
@TableName(value = "comment", autoResultMap = true)
public class Comment {
    @TableId(type = IdType.AUTO)
    private Integer id;
    private Integer threadId;
    private Integer authorId;
    private String content;
    @TableField(typeHandler = JacksonTypeHandler.class)
    private Object triggers;
    private OffsetDateTime createdAt;
    private OffsetDateTime updatedAt;
}
