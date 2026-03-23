package com.microoffice.controller;

import com.microoffice.dto.request.LoginRequest;
import com.microoffice.dto.request.RegisterRequest;
import com.microoffice.dto.response.ApiResponse;
import com.microoffice.service.AuthService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {
    private final AuthService authService;

    @PostMapping("/register")
    public ApiResponse<Map<String, Object>> register(@Valid @RequestBody RegisterRequest req) {
        return ApiResponse.ok(authService.register(req));
    }

    @PostMapping("/login")
    public ApiResponse<Map<String, Object>> login(@Valid @RequestBody LoginRequest req) {
        return ApiResponse.ok(authService.login(req));
    }

    @PostMapping("/logout")
    public ApiResponse<Void> logout(Authentication authentication) {
        authService.logout((String) authentication.getPrincipal(), (String) authentication.getDetails());
        return ApiResponse.ok(null);
    }
}
