package com.microoffice.dto.request;

import com.fasterxml.jackson.annotation.JsonAlias;
import lombok.Data;

import java.util.ArrayList;
import java.util.List;

@Data
public class WorkflowTemplateNodeSaveRequest {
    private String id;
    @JsonAlias({"template_id", "package_id"})
    private String templateId;
    @JsonAlias("module_definition_id")
    private String moduleDefinitionId;
    private String name;
    private String code;
    private String nodeType;
    private Integer sequence;
    private Boolean isMainPath;
    private Boolean allowAppendNextNode;
    private Boolean allowDeriveSubflow;
    private List<WorkflowTemplateNodeFieldConfigSaveRequest> inputFields = new ArrayList<>();
    private List<WorkflowTemplateNodeFieldConfigSaveRequest> outputFields = new ArrayList<>();
    private List<WorkflowTemplateNodeRecommendationSaveRequest> recommendedTemplates = new ArrayList<>();
    private Integer version;
}
