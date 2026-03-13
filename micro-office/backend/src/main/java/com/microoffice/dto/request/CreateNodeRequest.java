package com.microoffice.dto.request;

import com.microoffice.enums.NodeType;
import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class CreateNodeRequest {
    @NotBlank
    private String name;
    private NodeType type;
    private Integer ownerId;
    private Integer prevNodeId;
    private Integer poolPositionId;
    private Object moduleData;
}
