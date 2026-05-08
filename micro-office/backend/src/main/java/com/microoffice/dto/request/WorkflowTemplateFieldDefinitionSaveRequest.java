package com.microoffice.dto.request;

import com.fasterxml.jackson.annotation.JsonAlias;
import lombok.Data;

@Data
public class WorkflowTemplateFieldDefinitionSaveRequest {
    @JsonAlias("field_key")
    private String fieldKey;
    private String name;
    @JsonAlias("field_type")
    private String fieldType;
    private String description;
    private Boolean enabled;
    private Boolean sensitive;
    @JsonAlias("group_key")
    private String groupKey;
    @JsonAlias("display_order")
    private Integer displayOrder;
}
