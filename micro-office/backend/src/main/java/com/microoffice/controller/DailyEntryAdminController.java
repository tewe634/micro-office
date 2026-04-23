package com.microoffice.controller;

import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.microoffice.dto.response.ApiResponse;
import com.microoffice.service.DailyEntryAdminService;
import com.microoffice.service.DailyEntryChatAdminService;
import com.microoffice.service.MenuPermissionService;
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
@RequestMapping("/api/admin/daily-entries")
@RequiredArgsConstructor
public class DailyEntryAdminController {
    private final DailyEntryAdminService dailyEntryAdminService;
    private final DailyEntryChatAdminService dailyEntryChatAdminService;
    private final MenuPermissionService menuPermissionService;

    @GetMapping
    public ApiResponse<Page<Map<String, Object>>> list(@RequestParam(defaultValue = "1") long current,
                                                       @RequestParam(defaultValue = "20") long size,
                                                       @RequestParam(required = false) String status,
                                                       @RequestParam(required = false) String keyword,
                                                       Authentication auth) {
        requireAdmin(auth);
        return ApiResponse.ok(dailyEntryAdminService.listEntries(current, size, status, keyword));
    }

    @GetMapping("/{id}")
    public ApiResponse<Map<String, Object>> detail(@PathVariable String id, Authentication auth) {
        requireAdmin(auth);
        return ApiResponse.ok(dailyEntryAdminService.getEntry(id));
    }

    @PostMapping
    public ApiResponse<Map<String, Object>> create(@RequestBody Map<String, Object> body, Authentication auth) {
        String userId = requireAdmin(auth);
        return ApiResponse.ok(dailyEntryAdminService.createEntry(body, userId));
    }

    @PutMapping("/{id}")
    public ApiResponse<Map<String, Object>> update(@PathVariable String id,
                                                   @RequestBody Map<String, Object> body,
                                                   Authentication auth) {
        String userId = requireAdmin(auth);
        return ApiResponse.ok(dailyEntryAdminService.updateEntry(id, body, userId));
    }

    @PutMapping("/{id}/status")
    public ApiResponse<Map<String, Object>> changeStatus(@PathVariable String id,
                                                         @RequestBody Map<String, Object> body,
                                                         Authentication auth) {
        String userId = requireAdmin(auth);
        return ApiResponse.ok(dailyEntryAdminService.updateEntryStatus(id, body == null ? null : asNullableString(body.get("status")), userId));
    }

    @GetMapping("/{id}/targets")
    public ApiResponse<List<Map<String, Object>>> listTargets(@PathVariable String id, Authentication auth) {
        requireAdmin(auth);
        return ApiResponse.ok(dailyEntryAdminService.listTargets(id));
    }

    @PutMapping("/{id}/targets")
    public ApiResponse<List<Map<String, Object>>> saveTargets(@PathVariable String id,
                                                              @RequestBody Object body,
                                                              Authentication auth) {
        String userId = requireAdmin(auth);
        return ApiResponse.ok(dailyEntryAdminService.saveTargets(id, extractListBody(body, "targets"), userId));
    }

    @GetMapping("/{id}/chat-policy")
    public ApiResponse<Map<String, Object>> legacyChatPolicy(@PathVariable String id, Authentication auth) {
        requireAdmin(auth);
        return ApiResponse.ok(dailyEntryChatAdminService.getPolicy(id));
    }

    @PutMapping("/{id}/chat-policy")
    public ApiResponse<Map<String, Object>> legacySaveChatPolicy(@PathVariable String id,
                                                                 @RequestBody Map<String, Object> body,
                                                                 Authentication auth) {
        String userId = requireAdmin(auth);
        return ApiResponse.ok(dailyEntryChatAdminService.savePolicy(id, body, userId));
    }

    @GetMapping("/{id}/session-bindings")
    public ApiResponse<List<Map<String, Object>>> legacySessionBindings(@PathVariable String id, Authentication auth) {
        requireAdmin(auth);
        return ApiResponse.ok(dailyEntryChatAdminService.listSessionBindings(id));
    }

    @PutMapping("/{id}/session-bindings")
    public ApiResponse<List<Map<String, Object>>> legacySaveSessionBindings(@PathVariable String id,
                                                                            @RequestBody Object body,
                                                                            Authentication auth) {
        String userId = requireAdmin(auth);
        return ApiResponse.ok(dailyEntryChatAdminService.saveSessionBindings(id, extractListBody(body, "bindings"), userId));
    }

    private String requireAdmin(Authentication auth) {
        String currentUserId = (String) auth.getPrincipal();
        menuPermissionService.requireMenu(currentUserId, "/admin");
        return currentUserId;
    }

    @SuppressWarnings("unchecked")
    private List<Map<String, Object>> extractListBody(Object body, String key) {
        if (body == null) {
            return List.of();
        }
        if (body instanceof List<?> list) {
            return (List<Map<String, Object>>) list;
        }
        if (body instanceof Map<?, ?> map) {
            Object value = map.get(key);
            if (value instanceof List<?> list) {
                return (List<Map<String, Object>>) list;
            }
        }
        throw new IllegalArgumentException("请求体必须为数组，或 { \"" + key + "\": [...] }");
    }

    private String asNullableString(Object value) {
        if (value == null) {
            return null;
        }
        String text = String.valueOf(value).trim();
        return text.isEmpty() ? null : text;
    }
}
