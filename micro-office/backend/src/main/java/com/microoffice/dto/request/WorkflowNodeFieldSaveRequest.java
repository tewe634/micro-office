package com.microoffice.dto.request;

import lombok.Data;

import java.util.LinkedHashMap;
import java.util.Map;

@Data
public class WorkflowNodeFieldSaveRequest {
    private String id;
    private String fieldScope;
    private String fieldKey;
    private String label;
    private String dataType;
    private Boolean required;
    private Boolean readOnly;
    private Integer sortOrder;
    private Object defaultValue;
    private Map<String, Object> schemaMeta = new LinkedHashMap<>();
}
