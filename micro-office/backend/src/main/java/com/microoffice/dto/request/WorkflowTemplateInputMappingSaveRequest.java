package com.microoffice.dto.request;

import com.fasterxml.jackson.annotation.JsonAlias;
import lombok.Data;

import java.util.Map;

@Data
public class WorkflowTemplateInputMappingSaveRequest {
    private String id;

    @JsonAlias("target_type")
    private String targetType;

    @JsonAlias("target_ref")
    private String targetRef;

    @JsonAlias("target_path")
    private String targetPath;

    @JsonAlias("source_path")
    private String sourcePath;

    @JsonAlias("sort_order")
    private Integer sortOrder;

    private String status;
    private Map<String, Object> meta;
    private Integer version;
}
