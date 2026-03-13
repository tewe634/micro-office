package com.microoffice.controller;

import com.microoffice.dto.response.ApiResponse;
import com.microoffice.entity.ClockRecord;
import com.microoffice.enums.ClockType;
import com.microoffice.service.ClockService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/clock")
@RequiredArgsConstructor
public class ClockController {
    private final ClockService clockService;

    @PostMapping("/punch")
    public ApiResponse<ClockRecord> punch(@RequestBody Map<String, String> body, Authentication auth) {
        ClockType type = ClockType.valueOf(body.get("type"));
        return ApiResponse.ok(clockService.punch((Integer) auth.getPrincipal(), type));
    }

    @GetMapping("/today")
    public ApiResponse<List<ClockRecord>> today(Authentication auth) {
        return ApiResponse.ok(clockService.today((Integer) auth.getPrincipal()));
    }
}
