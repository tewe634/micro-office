package com.microoffice.dto.request;

import lombok.Data;

import java.util.ArrayList;
import java.util.List;

@Data
public class WorkflowNodeFeatureBindingValidateRequest {
    private List<String> moduleDefinitionIds = new ArrayList<>();
}
