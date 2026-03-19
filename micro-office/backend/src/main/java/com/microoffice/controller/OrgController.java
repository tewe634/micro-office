package com.microoffice.controller;

import com.microoffice.dto.response.ApiResponse;
import com.microoffice.entity.Organization;
import com.microoffice.service.DataScopeService;
import com.microoffice.service.OrgService;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.*;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/orgs")
@RequiredArgsConstructor
public class OrgController {
    private final OrgService orgService;
    private final JdbcTemplate jdbc;
    private final DataScopeService dataScopeService;

    @GetMapping
    public ApiResponse<List<Organization>> list() {
        return ApiResponse.ok(orgService.list());
    }

    @GetMapping("/chart")
    public ApiResponse<Map<String, Object>> chart(Authentication auth) {
        String currentUserId = (String) auth.getPrincipal();
        List<Organization> orgs = orgService.list();
        List<String> visibleOrgIds = dataScopeService.getVisibleOrgIds(currentUserId);

        List<Map<String, Object>> users;
        if (visibleOrgIds.isEmpty()) {
            users = new ArrayList<>();
        } else {
            users = jdbc.queryForList(
                "SELECT su.id, su.name, su.phone, su.role, su.org_id, su.primary_position_id, p.name AS primary_position_name " +
                "FROM sys_user su " +
                "LEFT JOIN position p ON p.id = su.primary_position_id " +
                "WHERE su.org_id = ANY(?::varchar[]) " +
                "ORDER BY su.org_id, su.name",
                (Object) visibleOrgIds.toArray(new String[0])
            );
        }

        Map<String, List<Map<String, Object>>> usersByOrg = users.stream()
            .collect(Collectors.groupingBy(row -> String.valueOf(row.get("org_id")), LinkedHashMap::new, Collectors.toList()));

        for (Map<String, Object> user : users) {
            String positionName = user.get("primary_position_name") == null ? null : String.valueOf(user.get("primary_position_name"));
            String role = user.get("role") == null ? null : String.valueOf(user.get("role"));
            user.put("leaderCandidate", isLeaderCandidate(positionName, role));
        }

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("orgs", orgs);
        result.put("users", users);
        result.put("userCountByOrg", usersByOrg.entrySet().stream().collect(Collectors.toMap(Map.Entry::getKey, e -> e.getValue().size(), (a, b) -> a, LinkedHashMap::new)));
        return ApiResponse.ok(result);
    }

    private boolean isLeaderCandidate(String positionName, String role) {
        if (positionName != null) {
            String[] keywords = {"负责人", "总经理", "总监", "经理", "主管", "主任", "部长", "厂长", "组长", "科长"};
            for (String keyword : keywords) {
                if (positionName.contains(keyword)) {
                    return true;
                }
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
