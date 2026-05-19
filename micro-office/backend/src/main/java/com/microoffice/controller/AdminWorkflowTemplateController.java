package com.microoffice.controller;

import com.microoffice.dto.request.WorkflowTemplateFieldDefinitionSaveRequest;
import com.microoffice.dto.request.WorkflowTemplateInputMappingSaveRequest;
import com.microoffice.dto.request.WorkflowTemplateNodeGraphSaveRequest;
import com.microoffice.dto.request.WorkflowTemplatePackageSaveRequest;
import com.microoffice.dto.request.WorkflowTemplateStatusUpdateRequest;
import com.microoffice.dto.response.ApiResponse;
import com.microoffice.service.MenuPermissionService;
import com.microoffice.service.WorkflowTemplateService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/admin/workflow-templates")
@RequiredArgsConstructor
public class AdminWorkflowTemplateController {
    private final WorkflowTemplateService workflowTemplateService;
    private final MenuPermissionService menuPermissionService;

    /**
     * 查询工作流模板列表。
     */
    @GetMapping("/packages")
    public ApiResponse<List<Map<String, Object>>> listPackages(@RequestParam(required = false) String positionId,
                                                               @RequestParam(required = false) String status,
                                                               Authentication auth) {
        requireAdmin(auth);
        return ApiResponse.ok(workflowTemplateService.listPackages(positionId, status));
    }

    /**
     * 查询模板适用岗位选项。
     */
    @GetMapping("/positions")
    public ApiResponse<List<Map<String, Object>>> listPositions(Authentication auth) {
        requireAdmin(auth);
        return ApiResponse.ok(workflowTemplateService.listTemplatePositions());
    }

    /**
     * 查询单个工作流模板详情。
     */
    @GetMapping("/packages/{id}")
    public ApiResponse<Map<String, Object>> getPackage(@PathVariable String id, Authentication auth) {
        requireAdmin(auth);
        return ApiResponse.ok(workflowTemplateService.getPackage(id));
    }

    /**
     * 创建工作流模板，默认状态 DISABLED。
     */
    @PostMapping("/packages")
    public ApiResponse<Map<String, Object>> createPackage(@RequestBody WorkflowTemplatePackageSaveRequest body, Authentication auth) {
        String userId = requireAdmin(auth);
        return ApiResponse.ok(workflowTemplateService.createPackage(body, userId));
    }

    /**
     * 更新工作流模板基础信息。
     */
    @PutMapping("/packages/{id}")
    public ApiResponse<Map<String, Object>> updatePackage(@PathVariable String id,
                                                          @RequestBody WorkflowTemplatePackageSaveRequest body,
                                                          Authentication auth) {
        String userId = requireAdmin(auth);
        return ApiResponse.ok(workflowTemplateService.updatePackageInfo(id, body, userId));
    }

    /**
     * 更新工作流模板状态，仅支持 ACTIVE / DISABLED。
     */
    @PutMapping("/packages/{id}/status")
    public ApiResponse<Map<String, Object>> updatePackageStatus(@PathVariable String id,
                                                                @RequestBody WorkflowTemplateStatusUpdateRequest body,
                                                                Authentication auth) {
        String userId = requireAdmin(auth);
        return ApiResponse.ok(workflowTemplateService.updatePackageStatus(id, body == null ? null : body.getStatus(), userId));
    }

    /**
     * 删除工作流模板及其节点配置。
     */
    @DeleteMapping("/packages/{id}")
    public ApiResponse<Map<String, Object>> deletePackage(@PathVariable String id, Authentication auth) {
        String userId = requireAdmin(auth);
        return ApiResponse.ok(workflowTemplateService.deletePackage(id, userId));
    }

    /**
     * 复制工作流模板与节点配置。
     */
    @PostMapping("/packages/{id}/copy")
    public ApiResponse<Map<String, Object>> copyPackage(@PathVariable String id, Authentication auth) {
        String userId = requireAdmin(auth);
        return ApiResponse.ok(workflowTemplateService.copyPackage(id, userId));
    }

    @GetMapping("/packages/{id}/node-graph")
    public ApiResponse<Map<String, Object>> getPackageNodeGraph(@PathVariable String id, Authentication auth) {
        requireAdmin(auth);
        return ApiResponse.ok(workflowTemplateService.getPackageNodeGraph(id));
    }

    @PutMapping("/packages/{id}/node-graph")
    public ApiResponse<Map<String, Object>> savePackageNodeGraph(@PathVariable String id,
                                                                 @RequestBody WorkflowTemplateNodeGraphSaveRequest body,
                                                                 Authentication auth) {
        String userId = requireAdmin(auth);
        return ApiResponse.ok(workflowTemplateService.savePackageNodeGraph(id, body, userId));
    }

    @GetMapping("/packages/{id}/input-mappings")
    public ApiResponse<List<Map<String, Object>>> listInputMappings(@PathVariable String id, Authentication auth) {
        requireAdmin(auth);
        return ApiResponse.ok(workflowTemplateService.listInputMappings(id));
    }

    @GetMapping("/packages/{id}/input-mapping-options")
    public ApiResponse<Map<String, Object>> getInputMappingOptions(@PathVariable String id, Authentication auth) {
        requireAdmin(auth);
        return ApiResponse.ok(workflowTemplateService.getInputMappingOptions(id));
    }

    @PutMapping("/packages/{id}/input-mappings")
    public ApiResponse<List<Map<String, Object>>> saveInputMappings(@PathVariable String id,
                                                                    @RequestBody List<WorkflowTemplateInputMappingSaveRequest> body,
                                                                    Authentication auth) {
        String userId = requireAdmin(auth);
        return ApiResponse.ok(workflowTemplateService.saveInputMappings(id, body, userId));
    }

    /**
     * 查询全局字段定义。
     */
    @GetMapping("/field-definitions")
    public ApiResponse<List<Map<String, Object>>> listFieldDefinitions(@RequestParam(required = false) Boolean enabled,
                                                                       @RequestParam(required = false) String keyword,
                                                                       Authentication auth) {
        requireAdmin(auth);
        return ApiResponse.ok(workflowTemplateService.listFieldDefinitions(enabled, keyword));
    }

    /**
     * 新建全局字段定义。
     */
    @PostMapping("/field-definitions")
    public ApiResponse<Map<String, Object>> createFieldDefinition(@RequestBody WorkflowTemplateFieldDefinitionSaveRequest body,
                                                                  Authentication auth) {
        String userId = requireAdmin(auth);
        return ApiResponse.ok(workflowTemplateService.createFieldDefinition(body, userId));
    }

    /**
     * 更新全局字段定义。
     */
    @PutMapping("/field-definitions/{fieldKey}")
    public ApiResponse<Map<String, Object>> updateFieldDefinition(@PathVariable String fieldKey,
                                                                  @RequestBody WorkflowTemplateFieldDefinitionSaveRequest body,
                                                                  Authentication auth) {
        String userId = requireAdmin(auth);
        return ApiResponse.ok(workflowTemplateService.updateFieldDefinition(fieldKey, body, userId));
    }

    /**
     * 删除全局字段定义。
     */
    @DeleteMapping("/field-definitions/{fieldKey}")
    public ApiResponse<Map<String, Object>> deleteFieldDefinition(@PathVariable String fieldKey,
                                                                  Authentication auth) {
        String userId = requireAdmin(auth);
        return ApiResponse.ok(workflowTemplateService.deleteFieldDefinition(fieldKey, userId));
    }

    private String requireAdmin(Authentication auth) {
        String currentUserId = (String) auth.getPrincipal();
        menuPermissionService.requireMenu(currentUserId, "/admin");
        return currentUserId;
    }
}
