package com.microoffice.dto.request;

import com.fasterxml.jackson.annotation.JsonAlias;
import lombok.Data;

import java.util.LinkedHashMap;
import java.util.Map;

@Data
public class WorkflowTemplatePackageSaveRequest {
    private String name;
    @JsonAlias("scene_category")
    private String sceneCategory;
    @JsonAlias("position_id")
    private String positionId;
    private String description;
    @JsonAlias("sort_order")
    private Integer sortOrder;
    private Object tags;
    private Map<String, Object> meta = new LinkedHashMap<>();
}
