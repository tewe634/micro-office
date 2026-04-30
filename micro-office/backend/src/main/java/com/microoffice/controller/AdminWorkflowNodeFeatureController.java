package com.microoffice.controller;

import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.microoffice.dto.request.WorkflowNodeBehaviorSaveRequest;
import com.microoffice.dto.request.WorkflowNodeFeatureBindingValidateRequest;
import com.microoffice.dto.request.WorkflowNodeFeatureSaveRequest;
import com.microoffice.dto.request.WorkflowNodeFeatureStatusUpdateRequest;
import com.microoffice.dto.request.WorkflowNodeFieldsSaveRequest;
import com.microoffice.dto.response.ApiResponse;
import com.microoffice.service.MenuPermissionService;
import com.microoffice.service.WorkflowNodeFeatureService;
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
@RequestMapping("/api/admin/workflow-node-features")
@RequiredArgsConstructor
public class AdminWorkflowNodeFeatureController {
    private final WorkflowNodeFeatureService workflowNodeFeatureService;
    private final MenuPermissionService menuPermissionService;

    /**
     * 查询节点功能列表。
     */
    @GetMapping
    public ApiResponse<Page<Map<String, Object>>> list(@RequestParam(defaultValue = "1") long current,
                                                        @RequestParam(defaultValue = "20") long size,
                                                        @RequestParam(required = false) String status,
                                                        @RequestParam(required = false) String nodeType,
                                                        @RequestParam(required = false) String keyword,
                                                        @RequestParam(required = false) String positionKey,
                                                        @RequestParam(required = false) String roleKey,
                                                        Authentication auth) {
        requireAdmin(auth);
        return ApiResponse.ok(workflowNodeFeatureService.listFeatures(current, size, status, nodeType, keyword, positionKey, roleKey));
    }

    /**
     * 查询节点功能详情。
     */
    @GetMapping("/{id}")
    public ApiResponse<Map<String, Object>> detail(@PathVariable String id, Authentication auth) {
        requireAdmin(auth);
        return ApiResponse.ok(workflowNodeFeatureService.getFeature(id));
    }

    /**
     * 新建节点功能。
     */
    @PostMapping
    public ApiResponse<Map<String, Object>> create(@RequestBody WorkflowNodeFeatureSaveRequest body, Authentication auth) {
        String userId = requireAdmin(auth);
        return ApiResponse.ok(workflowNodeFeatureService.createFeature(body, userId));
    }

    /**
     * 更新节点功能基础信息。
     */
    @PutMapping("/{id}")
    public ApiResponse<Map<String, Object>> update(@PathVariable String id,
                                                   @RequestBody WorkflowNodeFeatureSaveRequest body,
                                                   Authentication auth) {
        String userId = requireAdmin(auth);
        return ApiResponse.ok(workflowNodeFeatureService.updateFeature(id, body, userId));
    }

    /**
     * 删除节点功能。若已被模板节点引用则拒绝删除。
     */
    @DeleteMapping("/{id}")
    public ApiResponse<Map<String, Object>> delete(@PathVariable String id, Authentication auth) {
        String userId = requireAdmin(auth);
        return ApiResponse.ok(workflowNodeFeatureService.deleteFeature(id, userId));
    }

    /**
     * 更新节点功能状态（仅 ACTIVE / DISABLED）。
     */
    @PutMapping("/{id}/status")
    public ApiResponse<Map<String, Object>> updateStatus(@PathVariable String id,
                                                         @RequestBody WorkflowNodeFeatureStatusUpdateRequest body,
                                                         Authentication auth) {
        String userId = requireAdmin(auth);
        return ApiResponse.ok(workflowNodeFeatureService.updateFeatureStatus(id, body == null ? null : body.getStatus(), userId));
    }

    /**
     * 复制节点功能，复制后默认 DISABLED。
     */
    @PostMapping("/{id}/copy")
    public ApiResponse<Map<String, Object>> copy(@PathVariable String id, Authentication auth) {
        String userId = requireAdmin(auth);
        return ApiResponse.ok(workflowNodeFeatureService.copyFeature(id, userId));
    }

    /**
     * 查询字段契约。
     */
    @GetMapping("/{id}/fields")
    public ApiResponse<List<Map<String, Object>>> fields(@PathVariable String id, Authentication auth) {
        requireAdmin(auth);
        return ApiResponse.ok(workflowNodeFeatureService.listFields(id));
    }

    /**
     * 保存字段契约（整包覆盖）。
     */
    @PutMapping("/{id}/fields")
    public ApiResponse<List<Map<String, Object>>> saveFields(@PathVariable String id,
                                                             @RequestBody WorkflowNodeFieldsSaveRequest body,
                                                             Authentication auth) {
        String userId = requireAdmin(auth);
        return ApiResponse.ok(workflowNodeFeatureService.saveFields(id, body, userId));
    }

    /**
     * 查询行为配置，支持岗位优先、角色兜底解析预览。
     */
    @GetMapping("/{id}/behaviors")
    public ApiResponse<Map<String, Object>> behaviors(@PathVariable String id,
                                                      @RequestParam(required = false) String positionKey,
                                                      @RequestParam(required = false) String roleKey,
                                                      Authentication auth) {
        requireAdmin(auth);
        return ApiResponse.ok(workflowNodeFeatureService.getBehaviors(id, positionKey, roleKey));
    }

    /**
     * 保存行为配置。
     */
    @PutMapping("/{id}/behaviors")
    public ApiResponse<Map<String, Object>> saveBehaviors(@PathVariable String id,
                                                          @RequestBody WorkflowNodeBehaviorSaveRequest body,
                                                          Authentication auth) {
        String userId = requireAdmin(auth);
        return ApiResponse.ok(workflowNodeFeatureService.saveBehaviors(id, body, userId));
    }

    /**
     * 查询节点功能在模板中的引用关系。
     */
    @GetMapping("/{id}/references")
    public ApiResponse<Map<String, Object>> references(@PathVariable String id, Authentication auth) {
        requireAdmin(auth);
        return ApiResponse.ok(workflowNodeFeatureService.getReferences(id));
    }

    /**
     * 模板保存前联动校验节点功能状态（仅 ACTIVE 可绑定）。
     */
    @PostMapping("/validate-bindings")
    public ApiResponse<Map<String, Object>> validateBindings(@RequestBody WorkflowNodeFeatureBindingValidateRequest body,
                                                             Authentication auth) {
        requireAdmin(auth);
        return ApiResponse.ok(workflowNodeFeatureService.validateTemplateBindings(body));
    }

    private String requireAdmin(Authentication auth) {
        String currentUserId = (String) auth.getPrincipal();
        menuPermissionService.requireMenu(currentUserId, "/admin");
        return currentUserId;
    }
}
