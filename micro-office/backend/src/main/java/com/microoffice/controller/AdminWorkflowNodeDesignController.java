package com.microoffice.controller;

import com.microoffice.dto.request.WorkflowNodeDesignSaveRequest;
import com.microoffice.dto.request.WorkflowNodeDesignStatusUpdateRequest;
import com.microoffice.dto.request.WorkflowNodeFieldsSaveRequest;
import com.microoffice.dto.request.WorkflowNodeRecommendationsSaveRequest;
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
@RequestMapping("/api/admin/workflow-node-designs")
@RequiredArgsConstructor
public class AdminWorkflowNodeDesignController {
    private final WorkflowTemplateService workflowTemplateService;
    private final MenuPermissionService menuPermissionService;

    @GetMapping
    public ApiResponse<List<Map<String, Object>>> list(@RequestParam(required = false) String status,
                                                       @RequestParam(required = false) String keyword,
                                                       Authentication auth) {
        requireAdmin(auth);
        return ApiResponse.ok(workflowTemplateService.listNodeDesigns(status, keyword));
    }

    @GetMapping("/{id}")
    public ApiResponse<Map<String, Object>> detail(@PathVariable String id, Authentication auth) {
        requireAdmin(auth);
        return ApiResponse.ok(workflowTemplateService.getNodeDesign(id));
    }

    @PostMapping
    public ApiResponse<Map<String, Object>> create(@RequestBody WorkflowNodeDesignSaveRequest body, Authentication auth) {
        String userId = requireAdmin(auth);
        return ApiResponse.ok(workflowTemplateService.createNodeDesign(body, userId));
    }

    @PutMapping("/{id}")
    public ApiResponse<Map<String, Object>> update(@PathVariable String id,
                                                   @RequestBody WorkflowNodeDesignSaveRequest body,
                                                   Authentication auth) {
        String userId = requireAdmin(auth);
        return ApiResponse.ok(workflowTemplateService.updateNodeDesign(id, body, userId));
    }

    @PutMapping("/{id}/status")
    public ApiResponse<Map<String, Object>> updateStatus(@PathVariable String id,
                                                         @RequestBody WorkflowNodeDesignStatusUpdateRequest body,
                                                         Authentication auth) {
        String userId = requireAdmin(auth);
        return ApiResponse.ok(workflowTemplateService.updateNodeDesignStatus(id, body == null ? null : body.getStatus(), userId));
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Map<String, Object>> delete(@PathVariable String id, Authentication auth) {
        String userId = requireAdmin(auth);
        return ApiResponse.ok(workflowTemplateService.deleteNodeDesign(id, userId));
    }

    @GetMapping("/{id}/input-fields")
    public ApiResponse<List<Map<String, Object>>> inputFields(@PathVariable String id, Authentication auth) {
        requireAdmin(auth);
        return ApiResponse.ok(workflowTemplateService.listNodeDesignFields(id, true));
    }

    @PutMapping("/{id}/input-fields")
    public ApiResponse<List<Map<String, Object>>> saveInputFields(@PathVariable String id,
                                                                  @RequestBody WorkflowNodeFieldsSaveRequest body,
                                                                  Authentication auth) {
        String userId = requireAdmin(auth);
        return ApiResponse.ok(workflowTemplateService.saveNodeDesignFields(id, body, true, userId));
    }

    @GetMapping("/{id}/output-fields")
    public ApiResponse<List<Map<String, Object>>> outputFields(@PathVariable String id, Authentication auth) {
        requireAdmin(auth);
        return ApiResponse.ok(workflowTemplateService.listNodeDesignFields(id, false));
    }

    @PutMapping("/{id}/output-fields")
    public ApiResponse<List<Map<String, Object>>> saveOutputFields(@PathVariable String id,
                                                                   @RequestBody WorkflowNodeFieldsSaveRequest body,
                                                                   Authentication auth) {
        String userId = requireAdmin(auth);
        return ApiResponse.ok(workflowTemplateService.saveNodeDesignFields(id, body, false, userId));
    }

    @GetMapping("/{id}/recommendations")
    public ApiResponse<List<Map<String, Object>>> recommendations(@PathVariable String id, Authentication auth) {
        requireAdmin(auth);
        return ApiResponse.ok(workflowTemplateService.listNodeDesignRecommendations(id));
    }

    @PutMapping("/{id}/recommendations")
    public ApiResponse<List<Map<String, Object>>> saveRecommendations(@PathVariable String id,
                                                                      @RequestBody WorkflowNodeRecommendationsSaveRequest body,
                                                                      Authentication auth) {
        String userId = requireAdmin(auth);
        return ApiResponse.ok(workflowTemplateService.saveNodeDesignRecommendations(id, body, userId));
    }

    private String requireAdmin(Authentication auth) {
        String currentUserId = (String) auth.getPrincipal();
        menuPermissionService.requireMenu(currentUserId, "/admin");
        return currentUserId;
    }
}
