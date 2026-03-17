package com.microoffice.controller;

import com.microoffice.dto.response.ApiResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import java.util.*;

@RestController
@RequestMapping("/api/dashboard")
@RequiredArgsConstructor
public class DashboardController {
    private final JdbcTemplate jdbc;

    private String timeCond(String period, String col) {
        return switch (period) {
            case "yesterday" -> col + "::date = CURRENT_DATE - 1";
            case "week" -> col + " >= date_trunc('week', CURRENT_DATE)";
            case "month" -> col + " >= date_trunc('month', CURRENT_DATE)";
            default -> col + "::date = CURRENT_DATE";
        };
    }

    // 个人时间维度
    @GetMapping("/time")
    public ApiResponse<Map<String, Object>> timeSummary(
            @RequestParam(defaultValue = "today") String period, Authentication auth) {
        Integer userId = (Integer) auth.getPrincipal();
        String tc = timeCond(period, "created_at");
        Map<String, Object> r = new LinkedHashMap<>();
        r.put("threadsCreated", jdbc.queryForObject("SELECT COUNT(*) FROM work_thread WHERE creator_id = ? AND " + tc, Integer.class, userId));
        r.put("threadsCompleted", jdbc.queryForObject("SELECT COUNT(*) FROM work_thread WHERE creator_id = ? AND status = 'COMPLETED' AND " + tc, Integer.class, userId));
        r.put("nodesCompleted", jdbc.queryForObject("SELECT COUNT(*) FROM work_node WHERE owner_id = ? AND status = 'COMPLETED' AND " + timeCond(period, "completed_at"), Integer.class, userId));
        r.put("commentsCount", jdbc.queryForObject("SELECT COUNT(*) FROM comment WHERE author_id = ? AND " + tc, Integer.class, userId));
        r.put("clockRecords", jdbc.queryForList("SELECT type, clock_time FROM clock_record WHERE user_id = ? AND " + timeCond(period, "clock_time") + " ORDER BY clock_time", userId));
        return ApiResponse.ok(r);
    }

    // 自动检测用户可见的组织层级 tabs
    @GetMapping("/scopes")
    public ApiResponse<List<Map<String, Object>>> scopes(Authentication auth) {
        Integer userId = (Integer) auth.getPrincipal();
        List<Map<String, Object>> tabs = new ArrayList<>();
        tabs.add(Map.of("key", "personal", "label", "个人"));

        Map<String, Object> user = jdbc.queryForMap(
            "SELECT su.org_id, su.primary_position_id, su.role, COALESCE(p.code,'') AS pos_code, COALESCE(p.level,99) AS pos_level " +
            "FROM sys_user su LEFT JOIN position p ON p.id = su.primary_position_id WHERE su.id = ?", userId);
        Integer orgId = (Integer) user.get("org_id");
        String role = (String) user.get("role");
        String posCode = (String) user.get("pos_code");
        int posLevel = ((Number) user.get("pos_level")).intValue();
        boolean isMgr = posLevel <= 3; // 经理及以上
        boolean isDirector = posLevel <= 2; // 总监及以上

        if (orgId != null) {
            String orgName = jdbc.queryForObject("SELECT name FROM organization WHERE id = ?", String.class, orgId);
            // 经理级别 or HR → 看本部门
            if (isMgr || "HR".equals(role)) {
                tabs.add(Map.of("key", "department", "label", orgName, "orgId", orgId));
            }
            // 有子组织 → 含下级
            Integer childCount = jdbc.queryForObject("SELECT COUNT(*) FROM organization WHERE parent_id = ?", Integer.class, orgId);
            if (childCount > 0 && (isMgr || "ADMIN".equals(role))) {
                tabs.add(Map.of("key", "region", "label", orgName + "（含下级）", "orgId", orgId));
            }
            // 总监级别 → 上级组织含下级
            Integer parentOrgId = jdbc.queryForObject("SELECT parent_id FROM organization WHERE id = ?", Integer.class, orgId);
            if (parentOrgId != null && isDirector) {
                String parentName = jdbc.queryForObject("SELECT name FROM organization WHERE id = ?", String.class, parentOrgId);
                tabs.add(Map.of("key", "region", "label", parentName + "（含下级）", "orgId", parentOrgId));
            }
        }
        // ADMIN or 老板 → 公司全局
        if ("ADMIN".equals(role) || "BOSS".equals(posCode)) {
            tabs.add(Map.of("key", "company", "label", "公司"));
        }
        return ApiResponse.ok(tabs);
    }

    // 组织维度汇总 - 自动根据scope+orgId+时间
    @GetMapping("/org")
    public ApiResponse<Map<String, Object>> orgSummary(
            @RequestParam(defaultValue = "personal") String scope,
            @RequestParam(required = false) Integer orgId,
            @RequestParam(defaultValue = "today") String period,
            Authentication auth) {
        Integer userId = (Integer) auth.getPrincipal();
        String tc = timeCond(period, "wt.created_at");
        String userSet;
        switch (scope) {
            case "department" -> userSet = "SELECT id FROM sys_user WHERE org_id = " + orgId;
            case "region" -> userSet = "SELECT id FROM sys_user WHERE org_id IN (WITH RECURSIVE org_tree AS (SELECT id FROM organization WHERE id = " + orgId + " UNION ALL SELECT o.id FROM organization o JOIN org_tree t ON o.parent_id = t.id) SELECT id FROM org_tree)";
            case "company" -> userSet = "SELECT id FROM sys_user";
            default -> userSet = "SELECT " + userId;
        }

        Map<String, Object> r = new LinkedHashMap<>();
        r.put("scope", scope);

        // 按人员统计 - 核心表格
        List<Map<String, Object>> byUser = jdbc.queryForList(
            "SELECT su.id, su.name, o.name AS org_name, p.name AS pos_name, " +
            "COUNT(wt.id) AS total, " +
            "COUNT(CASE WHEN wt.status='COMPLETED' THEN 1 END) AS completed, " +
            "COUNT(CASE WHEN wt.status='ACTIVE' THEN 1 END) AS active " +
            "FROM sys_user su " +
            "LEFT JOIN organization o ON o.id = su.org_id " +
            "LEFT JOIN position p ON p.id = su.primary_position_id " +
            "LEFT JOIN work_thread wt ON wt.creator_id = su.id AND " + tc + " " +
            "WHERE su.id IN (" + userSet + ") " +
            "GROUP BY su.id, su.name, o.name, p.name ORDER BY total DESC", new Object[]{});
        r.put("byUser", byUser);

        // 汇总数字
        r.put("totalThreads", byUser.stream().mapToInt(m -> ((Number) m.get("total")).intValue()).sum());
        r.put("activeThreads", byUser.stream().mapToInt(m -> ((Number) m.get("active")).intValue()).sum());
        r.put("completedThreads", byUser.stream().mapToInt(m -> ((Number) m.get("completed")).intValue()).sum());
        r.put("userCount", byUser.size());

        // 外部对象统计
        r.put("externalObjects", jdbc.queryForList(
            "SELECT type, COUNT(*) AS count FROM external_object WHERE owner_id IN (" + userSet + ") GROUP BY type ORDER BY count DESC"));

        return ApiResponse.ok(r);
    }
}
