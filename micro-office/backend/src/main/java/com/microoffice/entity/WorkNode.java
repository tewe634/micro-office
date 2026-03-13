package com.microoffice.entity;

import com.baomidou.mybatisplus.annotation.*;
import com.baomidou.mybatisplus.extension.handlers.JacksonTypeHandler;
import com.microoffice.enums.NodeStatus;
import com.microoffice.enums.NodeType;
import lombok.Data;
import java.time.OffsetDateTime;

@Data
@TableName(value = "work_node", autoResultMap = true)
public class WorkNode {
    @TableId(type = IdType.AUTO)
    private Integer id;
    private Integer threadId;
    private String name;
    private NodeType type;
    private NodeStatus status;
    private Integer ownerId;
    private Integer prevNodeId;
    private Integer nextNodeId;
    @TableField(typeHandler = JacksonTypeHandler.class)
    private Object moduleData;
    @TableField(typeHandler = JacksonTypeHandler.class)
    private Object nextOptions;
    private Integer poolPositionId;
    private OffsetDateTime responseAt;
    private OffsetDateTime createdAt;
    private OffsetDateTime completedAt;
}
