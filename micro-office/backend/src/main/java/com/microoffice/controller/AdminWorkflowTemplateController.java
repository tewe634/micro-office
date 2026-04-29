package com.microoffice.controller;

import com.microoffice.dto.request.WorkflowTemplatePackageSaveRequest;
import com.microoffice.dto.request.WorkflowTemplateStatusUpdateRequest;
import com.microoffice.dto.response.ApiResponse;
import com.microoffice.service.MenuPermissionService;
import com.microoffice.service.WorkflowTemplateService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
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
     * 查询模板包列表。
     */
    @GetMapping("/packages")
    public ApiResponse<List<Map<String, Object>>> listPackages(@RequestParam(required = false) String positionId,
                                                               @RequestParam(required = false) String sceneCategory,
                                                               @RequestParam(required = false) String status,
                                                               Authentication auth) {
        requireAdmin(auth);
        return ApiResponse.ok(workflowTemplateService.listPackages(positionId, sceneCategory, status));
    }

    /**
     * 查询模板包关联岗位选项。
     */
    @GetMapping("/positions")
    public ApiResponse<List<Map<String, Object>>> listPositions(Authentication auth) {
        requireAdmin(auth);
        return ApiResponse.ok(workflowTemplateService.listTemplatePositions());
    }

    /**
     * 查询单个模板包详情。
     */
    @GetMapping("/packages/{id}")
    public ApiResponse<Map<String, Object>> getPackage(@PathVariable String id, Authentication auth) {
        requireAdmin(auth);
        return ApiResponse.ok(workflowTemplateService.getPackage(id));
    }

    /**
     * 创建模板包，默认状态 DISABLED。
     */
    @PostMapping("/packages")
    public ApiResponse<Map<String, Object>> createPackage(@RequestBody WorkflowTemplatePackageSaveRequest body, Authentication auth) {
        String userId = requireAdmin(auth);
        return ApiResponse.ok(workflowTemplateService.createPackage(body, userId));
    }

    /**
     * 更新模板包基础信息。
     */
    @PutMapping("/packages/{id}")
    public ApiResponse<Map<String, Object>> updatePackage(@PathVariable String id,
                                                          @RequestBody WorkflowTemplatePackageSaveRequest body,
                                                          Authentication auth) {
        String userId = requireAdmin(auth);
        return ApiResponse.ok(workflowTemplateService.updatePackageInfo(id, body, userId));
    }

    /**
     * 更新模板包状态，仅支持 ACTIVE / DISABLED。
     */
    @PutMapping("/packages/{id}/status")
    public ApiResponse<Map<String, Object>> updatePackageStatus(@PathVariable String id,
                                                                @RequestBody WorkflowTemplateStatusUpdateRequest body,
                                                                Authentication auth) {
        String userId = requireAdmin(auth);
        return ApiResponse.ok(workflowTemplateService.updatePackageStatus(id, body == null ? null : body.getStatus(), userId));
    }

    /**
     * 复制模板包与节点。
     */
    @PostMapping("/packages/{id}/copy")
    public ApiResponse<Map<String, Object>> copyPackage(@PathVariable String id, Authentication auth) {
        String userId = requireAdmin(auth);
        return ApiResponse.ok(workflowTemplateService.copyPackage(id, userId));
    }

    /**
     * 查询模板包节点编排。
     */
    @GetMapping("/packages/{id}/nodes")
    public ApiResponse<List<Map<String, Object>>> listPackageNodes(@PathVariable String id, Authentication auth) {
        requireAdmin(auth);
        return ApiResponse.ok(workflowTemplateService.listPackageNodes(id));
    }

    /**
     * 整包覆盖保存节点拓扑，含结构校验。请求体仅允许 { nodes: [...] }。
     */
    @PutMapping("/packages/{id}/nodes")
    public ApiResponse<List<Map<String, Object>>> savePackageNodes(@PathVariable String id,
                                                                   @RequestBody Map<String, Object> body,
                                                                   Authentication auth) {
        String userId = requireAdmin(auth);
        return ApiResponse.ok(workflowTemplateService.saveNodes(id, body, userId));
    }

    /**
     * 查询可用模块定义。
     */
    @GetMapping("/module-definitions")
    public ApiResponse<List<Map<String, Object>>> listModuleDefinitions(@RequestParam(required = false) String nodeType,
                                                                        @RequestParam(required = false) String roleKey,
                                                                        @RequestParam(required = false) String positionKey,
                                                                        Authentication auth) {
        requireAdmin(auth);
        return ApiResponse.ok(workflowTemplateService.listModuleDefinitions(nodeType, roleKey, positionKey));
    }

    /**
     * 查询模块字段定义（INPUT / OUTPUT）。
     */
    @GetMapping("/module-definitions/{id}/fields")
    public ApiResponse<List<Map<String, Object>>> listModuleFields(@PathVariable String id, Authentication auth) {
        requireAdmin(auth);
        return ApiResponse.ok(workflowTemplateService.listModuleFields(id));
    }

    /**
     * 查询节点推荐规则（仅 is_active=true）。
     */
    @GetMapping("/recommendations")
    public ApiResponse<List<Map<String, Object>>> recommendations(@RequestParam(required = false) String sceneCategory,
                                                                  @RequestParam(required = false) String currentModuleDefinitionId,
                                                                  @RequestParam(required = false) String currentNodeType,
                                                                  Authentication auth) {
        requireAdmin(auth);
        return ApiResponse.ok(workflowTemplateService.listRecommendations(sceneCategory, currentModuleDefinitionId, currentNodeType));
    }

    private String requireAdmin(Authentication auth) {
        String currentUserId = (String) auth.getPrincipal();
        menuPermissionService.requireMenu(currentUserId, "/admin");
        return currentUserId;
    }
}
