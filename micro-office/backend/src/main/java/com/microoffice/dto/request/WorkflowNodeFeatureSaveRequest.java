package com.microoffice.dto.request;

import lombok.Data;

@Data
public class WorkflowNodeFeatureSaveRequest {
    private String code;
    private String name;
    private String sourceModuleId;
    private String sourceSystem;
    private String nodeType;
    private Integer version;
    private Integer sortOrder;
    private String positionKey;
    private String roleKey;
}
