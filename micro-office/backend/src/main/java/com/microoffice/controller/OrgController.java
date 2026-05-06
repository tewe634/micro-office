package com.microoffice.controller;

import com.microoffice.dto.response.ApiResponse;
import com.microoffice.entity.Organization;
import com.microoffice.service.OrgService;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.*;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/orgs")
@RequiredArgsConstructor
public class OrgController {
    private final OrgService orgService;
    private final JdbcTemplate jdbc;

    @GetMapping
    public ApiResponse<List<Organization>> list() {
        return ApiResponse.ok(orgService.list());
    }

    @GetMapping("/chart")
    public ApiResponse<Map<String, Object>> chart() {
        List<Organization> orgs = orgService.list();
        List<Map<String, Object>> users = jdbc.queryForList(
            "SELECT su.id, su.name, su.email, su.phone, su.emp_no, su.org_id, o.name AS org_name, su.role, su.hired_at, " +
            "su.primary_position_id, p.name AS primary_position_name, " +
            "COALESCE(string_agg(DISTINCT p2.name, '、') FILTER (WHERE p2.name IS NOT NULL), '') AS extra_position_names " +
            "FROM sys_user su " +
            "LEFT JOIN organization o ON o.id = su.org_id " +
            "LEFT JOIN position p ON p.id = su.primary_position_id " +
            "LEFT JOIN user_position up ON up.user_id = su.id " +
            "LEFT JOIN position p2 ON p2.id = up.position_id " +
            "WHERE su.org_id IS NOT NULL " +
            "GROUP BY su.id, su.name, su.email, su.phone, su.emp_no, su.org_id, o.name, su.role, su.hired_at, su.primary_position_id, p.name " +
            "ORDER BY su.org_id, su.name"
        );

        Map<String, List<Map<String, Object>>> usersByOrg = users.stream()
            .peek(user -> {
                String positionName = user.get("primary_position_name") == null ? null : String.valueOf(user.get("primary_position_name"));
                String extraPositionNames = user.get("extra_position_names") == null ? null : String.valueOf(user.get("extra_position_names"));
                String role = user.get("role") == null ? null : String.valueOf(user.get("role"));
                user.put("leaderCandidate", isLeaderCandidate(positionName, extraPositionNames, role));
            })
            .collect(Collectors.groupingBy(row -> String.valueOf(row.get("org_id")), LinkedHashMap::new, Collectors.toList()));

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("orgs", orgs);
        result.put("users", users);
        result.put("userCountByOrg", usersByOrg.entrySet().stream().collect(Collectors.toMap(Map.Entry::getKey, e -> e.getValue().size(), (a, b) -> a, LinkedHashMap::new)));
        return ApiResponse.ok(result);
    }

    private boolean isLeaderCandidate(String positionName, String extraPositionNames, String role) {
        String combined = String.format("%s %s", positionName == null ? "" : positionName, extraPositionNames == null ? "" : extraPositionNames);
        String[] keywords = {"负责人", "总经理", "总监", "经理", "主管", "主任", "部长", "厂长", "组长", "科长"};
        for (String keyword : keywords) {
            if (combined.contains(keyword)) {
                return true;
            }
        }
        return "ADMIN".equals(role);
    }

    @GetMapping("/{id}")
    public ApiResponse<Organization> get(@PathVariable String id) {
        return ApiResponse.ok(orgService.getById(id));
    }

    @GetMapping("/{id}/children")
    public ApiResponse<List<Organization>> children(@PathVariable String id) {
        return ApiResponse.ok(orgService.children(id));
    }

    @PostMapping
    public ApiResponse<Organization> create(@RequestBody Organization org) {
        return ApiResponse.ok(orgService.create(org));
    }

    @PutMapping("/{id}")
    public ApiResponse<Void> update(@PathVariable String id, @RequestBody Organization org) {
        org.setId(id);
        orgService.update(org);
        return ApiResponse.ok(null);
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Void> delete(@PathVariable String id) {
        orgService.delete(id);
        return ApiResponse.ok(null);
    }
}
