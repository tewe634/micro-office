package com.microoffice.controller;

import com.microoffice.dto.response.ApiResponse;
import com.microoffice.entity.ClockRecord;
import com.microoffice.enums.ClockType;
import com.microoffice.service.ClockService;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/clock")
@RequiredArgsConstructor
public class ClockController {
    private final ClockService clockService;
    private final JdbcTemplate jdbc;

    @PostMapping("/punch")
    public ApiResponse<ClockRecord> punch(@RequestBody Map<String, String> body, Authentication auth) {
        ClockType type = ClockType.valueOf(body.get("type"));
        return ApiResponse.ok(clockService.punch((Integer) auth.getPrincipal(), type));
    }

    @GetMapping("/today")
    public ApiResponse<List<ClockRecord>> today(Authentication auth) {
        return ApiResponse.ok(clockService.today((Integer) auth.getPrincipal()));
    }

    @GetMapping("/history")
    public ApiResponse<List<Map<String, Object>>> history(
            @RequestParam(required = false) Integer userId,
            @RequestParam(defaultValue = "30") int days, Authentication auth) {
        int uid = userId != null ? userId : (Integer) auth.getPrincipal();
        return ApiResponse.ok(jdbc.queryForList(
            "SELECT id, user_id, type, clock_time, created_at FROM clock_record WHERE user_id = ? AND clock_time > NOW() - INTERVAL '" + days + " days' ORDER BY clock_time DESC",
            uid));
    }
}
