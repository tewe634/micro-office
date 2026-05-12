package com.microoffice.dto.request;

import lombok.Data;

import java.util.ArrayList;
import java.util.List;

@Data
public class WorkflowTemplateNodeGraphSaveRequest {
    private List<List<String>> nodeGraph = new ArrayList<>();
}
