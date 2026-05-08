package com.microoffice.dto.request;

import com.fasterxml.jackson.annotation.JsonAlias;
import lombok.Data;

@Data
public class WorkflowTemplateNodeRecommendationSaveRequest {
    @JsonAlias("recommended_workflow_template_id")
    private String recommendedWorkflowTemplateId;
    private String reason;
    @JsonAlias("display_order")
    private Integer displayOrder;
    private Boolean enabled;
}
