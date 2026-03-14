package com.microoffice.controller;

import com.microoffice.dto.response.ApiResponse;
import com.microoffice.entity.ModuleConfig;
import com.microoffice.entity.WorkflowTemplate;
import com.microoffice.entity.TemplateNode;
import com.microoffice.service.ModuleConfigService;
import com.microoffice.service.TemplateService;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.*;
import java.util.*;

@RestController
@RequestMapping("/api/admin")
@RequiredArgsConstructor
public class AdminController {
    private final ModuleConfigService moduleConfigService;
    private final TemplateService templateService;
    private final JdbcTemplate jdbc;

    // --- 角色权限配置 ---
    @GetMapping("/permissions")
    public ApiResponse<Map<String, List<String>>> listPermissions() {
        List<Map<String, Object>> rows = jdbc.queryForList("SELECT role, menu_key FROM role_menu_permission ORDER BY role, menu_key");
        Map<String, List<String>> result = new LinkedHashMap<>();
        for (Map<String, Object> row : rows) {
            String role = (String) row.get("role");
            result.computeIfAbsent(role, k -> new ArrayList<>()).add((String) row.get("menu_key"));
        }
        return ApiResponse.ok(result);
    }

    @PutMapping("/permissions")
    public ApiResponse<Void> savePermissions(@RequestBody Map<String, List<String>> perms) {
        jdbc.update("DELETE FROM role_menu_permission");
        for (Map.Entry<String, List<String>> entry : perms.entrySet()) {
            for (String menuKey : entry.getValue()) {
                jdbc.update("INSERT INTO role_menu_permission (role, menu_key) VALUES (?, ?)", entry.getKey(), menuKey);
            }
        }
        return ApiResponse.ok(null);
    }

    // --- 用户个人菜单权限 ---
    @GetMapping("/user-permissions/{userId}")
    public ApiResponse<List<String>> getUserMenus(@PathVariable Integer userId) {
        List<String> menus = jdbc.queryForList(
            "SELECT menu_key FROM user_menu_permission WHERE user_id = ? ORDER BY menu_key", String.class, userId);
        return ApiResponse.ok(menus);
    }

    @PutMapping("/user-permissions/{userId}")
    public ApiResponse<Void> saveUserMenus(@PathVariable Integer userId, @RequestBody List<String> menuKeys) {
        jdbc.update("DELETE FROM user_menu_permission WHERE user_id = ?", userId);
        for (String key : menuKeys) {
            jdbc.update("INSERT INTO user_menu_permission (user_id, menu_key) VALUES (?, ?)", userId, key);
        }
        return ApiResponse.ok(null);
    }

    @DeleteMapping("/user-permissions/{userId}")
    public ApiResponse<Void> resetUserMenus(@PathVariable Integer userId) {
        jdbc.update("DELETE FROM user_menu_permission WHERE user_id = ?", userId);
        return ApiResponse.ok(null);
    }

    // --- 岗位-对象类型权限 ---
    @GetMapping("/position-object-types")
    public ApiResponse<Map<Integer, List<String>>> listPositionObjectTypes() {
        List<Map<String, Object>> rows = jdbc.queryForList("SELECT position_id, object_type FROM position_object_type ORDER BY position_id");
        Map<Integer, List<String>> result = new LinkedHashMap<>();
        for (Map<String, Object> row : rows) {
            Integer posId = (Integer) row.get("position_id");
            result.computeIfAbsent(posId, k -> new ArrayList<>()).add((String) row.get("object_type"));
        }
        return ApiResponse.ok(result);
    }

    @PutMapping("/position-object-types")
    public ApiResponse<Void> savePositionObjectTypes(@RequestBody Map<String, List<String>> data) {
        jdbc.update("DELETE FROM position_object_type");
        for (Map.Entry<String, List<String>> entry : data.entrySet()) {
            int posId = Integer.parseInt(entry.getKey());
            for (String type : entry.getValue()) {
                jdbc.update("INSERT INTO position_object_type (position_id, object_type) VALUES (?, ?)", posId, type);
            }
        }
        return ApiResponse.ok(null);
    }

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
