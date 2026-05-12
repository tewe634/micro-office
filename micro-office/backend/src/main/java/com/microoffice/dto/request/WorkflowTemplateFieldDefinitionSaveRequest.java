package com.microoffice.dto.request;

import com.fasterxml.jackson.annotation.JsonAlias;
import lombok.Data;

import java.util.ArrayList;
import java.util.List;

@Data
public class WorkflowTemplateFieldDefinitionSaveRequest {
    @JsonAlias("field_key")
    private String fieldKey;
    private String name;
    @JsonAlias("field_type")
    private String fieldType;
    private String description;
    private Boolean enabled;
    private Boolean sensitive;
    @JsonAlias("group_key")
    private String groupKey;
    @JsonAlias("display_order")
    private Integer displayOrder;
    private Meta meta;

    @Data
    public static class Meta {
        private List<ListSubField> listSubFields = new ArrayList<>();
    }

    @Data
    public static class ListSubField {
        @JsonAlias("field_key")
        private String fieldKey;
        private String name;
        @JsonAlias("field_type")
        private String fieldType;
        private Boolean required;
        @JsonAlias("sort_order")
        private Integer sortOrder;
        private String description;
    }
}
