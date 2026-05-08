package com.microoffice.dto.request;

import com.fasterxml.jackson.annotation.JsonAlias;
import lombok.Data;

@Data
public class WorkflowTemplateNodeFieldConfigSaveRequest {
    @JsonAlias("field_key")
    private String fieldKey;
    @JsonAlias("display_name")
    private String displayName;
    @JsonAlias("display_order")
    private Integer displayOrder;
    private Boolean required;
    @JsonAlias("read_only")
    private Boolean readOnly;
    @JsonAlias("allow_write_back_parent")
    private Boolean allowWriteBackParent;
}
