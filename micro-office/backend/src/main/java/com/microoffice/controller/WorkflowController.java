package com.microoffice.controller;

import com.microoffice.dto.request.WorkflowFromTemplateRequest;
import com.microoffice.dto.response.ApiResponse;
import com.microoffice.dto.response.WorkflowInstantiationResponse;
import com.microoffice.service.WorkflowTemplateService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/workflows")
@RequiredArgsConstructor
public class WorkflowController {
    private final WorkflowTemplateService workflowTemplateService;

    /**
     * 基于 ACTIVE 模板创建运行时流程实例。
     */
    @PostMapping("/from-template")
    public ApiResponse<WorkflowInstantiationResponse> instantiate(@RequestBody WorkflowFromTemplateRequest body,
                                                                  Authentication auth) {
        String currentUserId = (String) auth.getPrincipal();
        return ApiResponse.ok(workflowTemplateService.instantiateWorkflow(body, currentUserId));
    }
}
