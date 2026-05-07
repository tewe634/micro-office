package com.microoffice.controller;

import com.microoffice.dto.response.ApiResponse;
import com.microoffice.service.MenuPermissionService;
import com.microoffice.service.UserExternalAccountAdminService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.DeleteMapping;
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
@RequestMapping("/api/admin")
@RequiredArgsConstructor
public class UserExternalAccountAdminController {
    private final UserExternalAccountAdminService userExternalAccountAdminService;
    private final MenuPermissionService menuPermissionService;

    @GetMapping("/user-external-accounts")
    public ApiResponse<List<Map<String, Object>>> list(@RequestParam(required = false) String provider,
                                                       @RequestParam(required = false) String status,
                                                       @RequestParam(required = false) String keyword,
                                                       Authentication auth) {
        requireUsersMenu(auth);
        return ApiResponse.ok(userExternalAccountAdminService.listAccounts(provider, status, keyword));
    }

    @GetMapping("/users/{userId}/external-accounts")
    public ApiResponse<Map<String, Object>> detail(@PathVariable String userId, Authentication auth) {
        requireUsersMenu(auth);
        return ApiResponse.ok(userExternalAccountAdminService.getUserAccounts(userId));
    }

    @PutMapping("/users/{userId}/external-accounts")
    public ApiResponse<Map<String, Object>> save(@PathVariable String userId,
                                                 @RequestBody Map<String, Object> body,
                                                 Authentication auth) {
        String operatorId = requireUsersMenu(auth);
        return ApiResponse.ok(userExternalAccountAdminService.saveAccount(userId, body, operatorId));
    }

    @PutMapping("/users/{userId}/external-accounts/unbind")
    public ApiResponse<Map<String, Object>> unbind(@PathVariable String userId,
                                                   @RequestBody(required = false) Map<String, Object> body,
                                                   Authentication auth) {
        String operatorId = requireUsersMenu(auth);
        return ApiResponse.ok(userExternalAccountAdminService.unbindAccount(userId, body, operatorId));
    }

    @DeleteMapping("/users/{userId}/external-accounts")
    public ApiResponse<Map<String, Object>> remove(@PathVariable String userId,
                                                   @RequestParam(required = false) String corpId,
                                                   @RequestParam(required = false) String provider,
                                                   Authentication auth) {
        String operatorId = requireUsersMenu(auth);
        return ApiResponse.ok(userExternalAccountAdminService.removeAccount(userId, corpId, provider, operatorId));
    }

    private String requireUsersMenu(Authentication auth) {
        String currentUserId = (String) auth.getPrincipal();
        menuPermissionService.requireMenu(currentUserId, "/users");
        return currentUserId;
    }
}
