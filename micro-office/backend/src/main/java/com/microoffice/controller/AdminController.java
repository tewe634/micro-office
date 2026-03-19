package com.microoffice.controller;

import com.microoffice.dto.response.ApiResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.*;

import java.util.*;

@RestController
@RequestMapping("/api/admin")
@RequiredArgsConstructor
public class AdminController {
    private final JdbcTemplate jdbc;

    @GetMapping("/permissions")
    public ApiResponse<Map<String, List<String>>> listPermissions() {
        List<Map<String, Object>> rows = jdbc.queryForList(
            "SELECT r.code AS role, p.menu_key " +
            "FROM sys_role r " +
            "LEFT JOIN role_menu_permission p ON p.role = r.code " +
            "ORDER BY r.sort_order, p.menu_key"
        );

        Map<String, List<String>> result = new LinkedHashMap<>();
        for (Map<String, Object> row : rows) {
            String role = (String) row.get("role");
            String menuKey = (String) row.get("menu_key");
            result.computeIfAbsent(role, k -> new ArrayList<>());
            if (menuKey != null) {
                result.get(role).add(menuKey);
            }
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

    @GetMapping("/user-permissions/{userId}")
    public ApiResponse<List<String>> getUserMenus(@PathVariable String userId) {
        return ApiResponse.ok(jdbc.queryForList(
            "SELECT menu_key FROM user_menu_permission WHERE user_id = ? ORDER BY menu_key", String.class, userId));
    }

    @PutMapping("/user-permissions/{userId}")
    public ApiResponse<Void> saveUserMenus(@PathVariable String userId, @RequestBody List<String> menuKeys) {
        jdbc.update("DELETE FROM user_menu_permission WHERE user_id = ?", userId);
        for (String key : menuKeys) {
            jdbc.update("INSERT INTO user_menu_permission (user_id, menu_key) VALUES (?, ?)", userId, key);
        }
        return ApiResponse.ok(null);
    }

    @DeleteMapping("/user-permissions/{userId}")
    public ApiResponse<Void> resetUserMenus(@PathVariable String userId) {
        jdbc.update("DELETE FROM user_menu_permission WHERE user_id = ?", userId);
        return ApiResponse.ok(null);
    }

    @GetMapping("/user-object-types/{userId}")
    public ApiResponse<List<String>> getUserObjectTypes(@PathVariable String userId) {
        return ApiResponse.ok(jdbc.queryForList(
            "SELECT object_type FROM user_object_type WHERE user_id = ? ORDER BY object_type", String.class, userId));
    }

    @PutMapping("/user-object-types/{userId}")
    public ApiResponse<Void> saveUserObjectTypes(@PathVariable String userId, @RequestBody List<String> types) {
        jdbc.update("DELETE FROM user_object_type WHERE user_id = ?", userId);
        for (String t : types) {
            jdbc.update("INSERT INTO user_object_type (user_id, object_type) VALUES (?, ?)", userId, t);
        }
        return ApiResponse.ok(null);
    }

    @DeleteMapping("/user-object-types/{userId}")
    public ApiResponse<Void> resetUserObjectTypes(@PathVariable String userId) {
        jdbc.update("DELETE FROM user_object_type WHERE user_id = ?", userId);
        return ApiResponse.ok(null);
    }

    @GetMapping("/position-object-types")
    public ApiResponse<Map<String, List<String>>> listPositionObjectTypes() {
        List<Map<String, Object>> rows = jdbc.queryForList("SELECT position_id, object_type FROM position_object_type ORDER BY position_id");
        Map<String, List<String>> result = new LinkedHashMap<>();
        for (Map<String, Object> row : rows) {
            String posId = (String) row.get("position_id");
            result.computeIfAbsent(posId, k -> new ArrayList<>()).add((String) row.get("object_type"));
        }
        return ApiResponse.ok(result);
    }

    @PutMapping("/position-object-types")
    public ApiResponse<Void> savePositionObjectTypes(@RequestBody Map<String, List<String>> data) {
        jdbc.update("DELETE FROM position_object_type");
        for (Map.Entry<String, List<String>> entry : data.entrySet()) {
            for (String type : entry.getValue()) {
                jdbc.update("INSERT INTO position_object_type (position_id, object_type) VALUES (?, ?)", entry.getKey(), type);
            }
        }
        return ApiResponse.ok(null);
    }
}
