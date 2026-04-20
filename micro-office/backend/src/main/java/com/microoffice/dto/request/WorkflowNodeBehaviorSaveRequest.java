package com.microoffice.dto.request;

import lombok.Data;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Data
public class WorkflowNodeBehaviorSaveRequest {
    private Map<String, Object> assignment = new LinkedHashMap<>();
    private Map<String, Object> sla = new LinkedHashMap<>();
    private List<String> actionPermissions = new ArrayList<>();
    private Map<String, Object> triggers = new LinkedHashMap<>();
}
