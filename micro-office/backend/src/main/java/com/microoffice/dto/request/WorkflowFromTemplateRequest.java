package com.microoffice.dto.request;

import lombok.Data;

import java.util.LinkedHashMap;
import java.util.Map;

@Data
public class WorkflowFromTemplateRequest {
    private String templatePackageId;
    private Map<String, Object> bizContext = new LinkedHashMap<>();
}
