package com.microoffice.controller;

import com.microoffice.dto.response.ApiResponse;
import com.microoffice.service.DailyEntryChatAdminService;
import com.microoffice.service.MenuPermissionService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/admin/daily-entry-chat-policies")
@RequiredArgsConstructor
public class DailyEntryChatAdminController {
    private final DailyEntryChatAdminService dailyEntryChatAdminService;
    private final MenuPermissionService menuPermissionService;

    @GetMapping
    public ApiResponse<List<Map<String, Object>>> list(@RequestParam(required = false) String status,
                                                       @RequestParam(required = false) String keyword,
                                                       Authentication auth) {
        requireAdmin(auth);
        return ApiResponse.ok(dailyEntryChatAdminService.listPolicies(status, keyword));
    }

    @GetMapping("/{dailyEntryId}")
    public ApiResponse<Map<String, Object>> detail(@PathVariable String dailyEntryId, Authentication auth) {
        requireAdmin(auth);
        return ApiResponse.ok(dailyEntryChatAdminService.getPolicy(dailyEntryId));
    }

    @PutMapping("/{dailyEntryId}")
    public ApiResponse<Map<String, Object>> save(@PathVariable String dailyEntryId,
                                                 @RequestBody Map<String, Object> body,
                                                 Authentication auth) {
        String userId = requireAdmin(auth);
        return ApiResponse.ok(dailyEntryChatAdminService.savePolicy(dailyEntryId, body, userId));
    }

    @GetMapping("/{dailyEntryId}/session-bindings")
    public ApiResponse<List<Map<String, Object>>> listBindings(@PathVariable String dailyEntryId, Authentication auth) {
        requireAdmin(auth);
        return ApiResponse.ok(dailyEntryChatAdminService.listSessionBindings(dailyEntryId));
    }

    @PutMapping("/{dailyEntryId}/session-bindings")
    public ApiResponse<List<Map<String, Object>>> saveBindings(@PathVariable String dailyEntryId,
                                                               @RequestBody Object body,
                                                               Authentication auth) {
        String userId = requireAdmin(auth);
        return ApiResponse.ok(dailyEntryChatAdminService.saveSessionBindings(dailyEntryId, extractListBody(body, "bindings"), userId));
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

}
