package com.microoffice.dto.request;

import com.fasterxml.jackson.annotation.JsonAlias;
import lombok.Data;

import java.util.LinkedHashMap;
import java.util.Map;

@Data
public class WorkflowTemplateNodeSaveRequest {
    private String id;
    @JsonAlias("package_id")
    private String packageId;
    @JsonAlias("module_definition_id")
    private String moduleDefinitionId;
    @JsonAlias("parent_package_node_id")
    private String parentPackageNodeId;
    @JsonAlias("sort_order")
    private Integer sortOrder;
    @JsonAlias("display_name")
    private String displayName;
    @JsonAlias("hierarchy_level")
    private Integer hierarchyLevel;
    @JsonAlias("relation_type")
    private String relationType;
    @JsonAlias("branch_group_key")
    private String branchGroupKey;
    @JsonAlias("branch_order")
    private Integer branchOrder;
    private Map<String, Object> meta = new LinkedHashMap<>();
    private Integer version;
}
