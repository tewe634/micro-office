package com.microoffice.dto.request;

import com.fasterxml.jackson.annotation.JsonAlias;
import lombok.Data;

import java.util.ArrayList;
import java.util.List;

@Data
public class WorkflowTemplatePackageSaveRequest {
    private String name;
    private String code;
    @JsonAlias({"applicable_subject_type", "scene_category"})
    private String applicableSubjectType;
    @JsonAlias("position_id")
    private String positionId;
    @JsonAlias("position_ids")
    private List<String> positionIds = new ArrayList<>();
    private String description;
    private Integer version;
    @JsonAlias("allow_create_as_normal")
    private Boolean allowCreateAsNormal;
    @JsonAlias("allow_create_as_subflow")
    private Boolean allowCreateAsSubflow;
    @JsonAlias("sort_order")
    private Integer sortOrder;
}
