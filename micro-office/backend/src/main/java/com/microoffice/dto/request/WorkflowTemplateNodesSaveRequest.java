package com.microoffice.dto.request;

import lombok.Data;

import java.util.ArrayList;
import java.util.List;

@Data
public class WorkflowTemplateNodesSaveRequest {
    private List<WorkflowTemplateNodeSaveRequest> nodes = new ArrayList<>();
}
