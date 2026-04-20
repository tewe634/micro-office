package com.microoffice.dto.response;

import lombok.AllArgsConstructor;
import lombok.Data;

@Data
@AllArgsConstructor
public class WorkflowInstantiationResponse {
    private String workflowId;
    private String startNodeId;
    private String endNodeId;
    private int nodeCount;
    private int edgeCount;
}
