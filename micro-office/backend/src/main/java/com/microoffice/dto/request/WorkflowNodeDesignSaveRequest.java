package com.microoffice.dto.request;

import com.fasterxml.jackson.annotation.JsonAlias;
import lombok.Data;

@Data
public class WorkflowNodeDesignSaveRequest {
    private String id;
    @JsonAlias("module_definition_id")
    private String moduleDefinitionId;
    private String name;
    private String code;
    private String nodeType;
    private Integer version;
}
