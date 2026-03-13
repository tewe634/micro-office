package com.microoffice.entity;

import com.baomidou.mybatisplus.annotation.*;
import com.microoffice.enums.NodeType;
import lombok.Data;

@Data
@TableName("template_node")
public class TemplateNode {
    @TableId(type = IdType.AUTO)
    private Integer id;
    private Integer templateId;
    private String name;
    private Integer sortOrder;
    private NodeType type;
    private Integer positionId;
}
