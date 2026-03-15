package com.microoffice.controller;

import com.microoffice.dto.response.ApiResponse;
import com.microoffice.entity.WorkflowTemplate;
import com.microoffice.service.TemplateService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/api/templates")
@RequiredArgsConstructor
public class TemplateController {
    private final TemplateService templateService;

    @GetMapping
    public ApiResponse<List<WorkflowTemplate>> list() { return ApiResponse.ok(templateService.list()); }
}
