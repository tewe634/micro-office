package com.microoffice.service;

import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.microoffice.dto.request.WorkflowNodeBehaviorSaveRequest;
import com.microoffice.dto.request.WorkflowNodeFeatureBindingValidateRequest;
import com.microoffice.dto.request.WorkflowNodeFeatureSaveRequest;
import com.microoffice.dto.request.WorkflowNodeFieldsSaveRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Map;

import static org.springframework.http.HttpStatus.GONE;

@Service
@RequiredArgsConstructor
public class WorkflowNodeFeatureService {

    private static final String DEPRECATED_MESSAGE =
        "节点功能/模块定义接口已废弃，请使用工作流模板节点和模板字段接口：" +
            "mo_workflow_recommendation_package_nodes、mo_workflow_template_field_definitions、" +
            "mo_workflow_template_node_input_fields、mo_workflow_template_node_output_fields。";

    public Page<Map<String, Object>> listFeatures(long current,
                                                  long size,
                                                  String status,
                                                  String nodeType,
                                                  String keyword,
                                                  String positionKey,
                                                  String roleKey) {
        long safeCurrent = current <= 0 ? 1 : current;
        long safeSize = size <= 0 ? 20 : Math.min(size, 200);
        Page<Map<String, Object>> page = new Page<>(safeCurrent, safeSize, 0);
        page.setRecords(List.of());
        return page;
    }

    public Map<String, Object> getFeature(String id) {
        throw deprecated();
    }

    public Map<String, Object> createFeature(WorkflowNodeFeatureSaveRequest request, String userId) {
        throw deprecated();
    }

    public Map<String, Object> updateFeature(String id, WorkflowNodeFeatureSaveRequest request, String userId) {
        throw deprecated();
    }

    public Map<String, Object> deleteFeature(String id, String userId) {
        throw deprecated();
    }

    public Map<String, Object> updateFeatureStatus(String id, String status, String userId) {
        throw deprecated();
    }

    public Map<String, Object> copyFeature(String id, String userId) {
        throw deprecated();
    }

    public List<Map<String, Object>> listFields(String featureId) {
        throw deprecated();
    }

    public List<Map<String, Object>> saveFields(String featureId, WorkflowNodeFieldsSaveRequest request, String userId) {
        throw deprecated();
    }

    public Map<String, Object> getBehaviors(String featureId, String positionKey, String roleKey) {
        throw deprecated();
    }

    public Map<String, Object> saveBehaviors(String featureId, WorkflowNodeBehaviorSaveRequest request, String userId) {
        throw deprecated();
    }

    public Map<String, Object> getReferences(String featureId) {
        throw deprecated();
    }

    public Map<String, Object> validateTemplateBindings(WorkflowNodeFeatureBindingValidateRequest request) {
        return Map.of(
            "valid", true,
            "deprecated", true,
            "message", DEPRECATED_MESSAGE,
            "invalidItems", List.of()
        );
    }

    private ResponseStatusException deprecated() {
        return new ResponseStatusException(GONE, DEPRECATED_MESSAGE);
    }
}
