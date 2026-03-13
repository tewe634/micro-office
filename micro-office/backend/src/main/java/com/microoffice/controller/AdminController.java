package com.microoffice.controller;

import com.microoffice.dto.response.ApiResponse;
import com.microoffice.entity.ModuleConfig;
import com.microoffice.entity.WorkflowTemplate;
import com.microoffice.entity.TemplateNode;
import com.microoffice.service.ModuleConfigService;
import com.microoffice.service.TemplateService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/api/admin")
@RequiredArgsConstructor
public class AdminController {
    private final ModuleConfigService moduleConfigService;
    private final TemplateService templateService;

    // --- 模块配置 ---
    @GetMapping("/modules")
    public ApiResponse<List<ModuleConfig>> listModules() { return ApiResponse.ok(moduleConfigService.list()); }

    @PostMapping("/modules")
    public ApiResponse<ModuleConfig> createModule(@RequestBody ModuleConfig mc) { return ApiResponse.ok(moduleConfigService.create(mc)); }

    @PutMapping("/modules/{id}")
    public ApiResponse<Void> updateModule(@PathVariable Integer id, @RequestBody ModuleConfig mc) {
        mc.setId(id); moduleConfigService.update(mc); return ApiResponse.ok(null);
    }

    @DeleteMapping("/modules/{id}")
    public ApiResponse<Void> deleteModule(@PathVariable Integer id) { moduleConfigService.delete(id); return ApiResponse.ok(null); }

    // --- 流程模板 ---
    @GetMapping("/templates")
    public ApiResponse<List<WorkflowTemplate>> listTemplates() { return ApiResponse.ok(templateService.list()); }

    @PostMapping("/templates")
    public ApiResponse<WorkflowTemplate> createTemplate(@RequestBody WorkflowTemplate t) { return ApiResponse.ok(templateService.create(t)); }

    @GetMapping("/templates/{id}/nodes")
    public ApiResponse<List<TemplateNode>> templateNodes(@PathVariable Integer id) { return ApiResponse.ok(templateService.getNodes(id)); }

    @PostMapping("/templates/{id}/nodes")
    public ApiResponse<TemplateNode> addTemplateNode(@PathVariable Integer id, @RequestBody TemplateNode node) {
        node.setTemplateId(id); return ApiResponse.ok(templateService.addNode(node));
    }

    @DeleteMapping("/templates/{id}")
    public ApiResponse<Void> deleteTemplate(@PathVariable Integer id) { templateService.delete(id); return ApiResponse.ok(null); }
}
