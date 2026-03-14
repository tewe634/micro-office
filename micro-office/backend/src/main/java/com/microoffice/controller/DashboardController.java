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

    // 时间维度汇总
    @GetMapping("/time")
    public ApiResponse<Map<String, Object>> timeSummary(
            @RequestParam(defaultValue = "today") String period, Authentication auth) {
        Integer userId = (Integer) auth.getPrincipal();
        String interval = switch (period) {
            case "yesterday" -> "clock_time::date = CURRENT_DATE - 1";
            case "today" -> "clock_time::date = CURRENT_DATE";
            case "week" -> "clock_time >= date_trunc('week', CURRENT_DATE)";
            case "month" -> "clock_time >= date_trunc('month', CURRENT_DATE)";
            default -> "clock_time::date = CURRENT_DATE";
        };
        String threadInterval = switch (period) {
            case "yesterday" -> "created_at::date = CURRENT_DATE - 1";
            case "today" -> "created_at::date = CURRENT_DATE";
            case "week" -> "created_at >= date_trunc('week', CURRENT_DATE)";
            case "month" -> "created_at >= date_trunc('month', CURRENT_DATE)";
            default -> "created_at::date = CURRENT_DATE";
        };

        Map<String, Object> result = new LinkedHashMap<>();
        // 个人工作统计
        result.put("threadsCreated", jdbc.queryForObject(
            "SELECT COUNT(*) FROM work_thread WHERE creator_id = ? AND " + threadInterval, Integer.class, userId));
        result.put("threadsCompleted", jdbc.queryForObject(
            "SELECT COUNT(*) FROM work_thread WHERE creator_id = ? AND status = 'COMPLETED' AND " + threadInterval, Integer.class, userId));
        result.put("nodesCompleted", jdbc.queryForObject(
            "SELECT COUNT(*) FROM work_node WHERE owner_id = ? AND status = 'COMPLETED' AND " +
            threadInterval.replace("created_at", "completed_at"), Integer.class, userId));
        result.put("commentsCount", jdbc.queryForObject(
            "SELECT COUNT(*) FROM comment WHERE author_id = ? AND " + threadInterval, Integer.class, userId));
        // 打卡
        result.put("clockRecords", jdbc.queryForList(
            "SELECT type, clock_time FROM clock_record WHERE user_id = ? AND " + interval + " ORDER BY clock_time", userId));
        return ApiResponse.ok(result);
    }

    // 组织维度汇总
    @GetMapping("/org")
    public ApiResponse<Map<String, Object>> orgSummary(@RequestParam(defaultValue = "company") String scope,
            @RequestParam(required = false) Integer orgId, Authentication auth) {
        Map<String, Object> result = new LinkedHashMap<>();
        String where;
        switch (scope) {
            case "personal" -> {
                Integer userId = (Integer) auth.getPrincipal();
                where = "creator_id = " + userId;
                result.put("scope", "个人");
            }
            case "department" -> {
                if (orgId == null) {
                    Integer userId = (Integer) auth.getPrincipal();
                    orgId = jdbc.queryForObject("SELECT org_id FROM sys_user WHERE id = ?", Integer.class, userId);
                }
                where = "creator_id IN (SELECT id FROM sys_user WHERE org_id = " + orgId + ")";
                result.put("scope", "部门");
                result.put("orgId", orgId);
            }
            case "region" -> {
                // 大区 = 某组织及其子组织
                if (orgId == null) {
                    Integer userId = (Integer) auth.getPrincipal();
                    orgId = jdbc.queryForObject("SELECT org_id FROM sys_user WHERE id = ?", Integer.class, userId);
                }
                where = "creator_id IN (SELECT id FROM sys_user WHERE org_id IN " +
                    "(SELECT id FROM organization WHERE id = " + orgId + " OR parent_id = " + orgId + "))";
                result.put("scope", "大区");
                result.put("orgId", orgId);
            }
            default -> {
                where = "1=1";
                result.put("scope", "公司");
            }
        }

        result.put("totalThreads", jdbc.queryForObject("SELECT COUNT(*) FROM work_thread WHERE " + where, Integer.class));
        result.put("activeThreads", jdbc.queryForObject("SELECT COUNT(*) FROM work_thread WHERE status = 'ACTIVE' AND " + where, Integer.class));
        result.put("completedThreads", jdbc.queryForObject("SELECT COUNT(*) FROM work_thread WHERE status = 'COMPLETED' AND " + where, Integer.class));

        // 按人统计
        List<Map<String, Object>> byUser = jdbc.queryForList(
            "SELECT su.id, su.name, " +
            "COUNT(wt.id) AS total, COUNT(CASE WHEN wt.status='COMPLETED' THEN 1 END) AS completed " +
            "FROM sys_user su LEFT JOIN work_thread wt ON wt.creator_id = su.id AND " + where.replace("creator_id", "wt.creator_id") +
            " WHERE su.id IN (SELECT creator_id FROM work_thread WHERE " + where + ") " +
            "GROUP BY su.id, su.name ORDER BY total DESC");
        result.put("byUser", byUser);

        // 外部对象统计
        String objWhere = where.replace("creator_id", "owner_id");
        result.put("externalObjects", jdbc.queryForList(
            "SELECT type, COUNT(*) AS count FROM external_object WHERE " + objWhere + " GROUP BY type ORDER BY count DESC"));

        return ApiResponse.ok(result);
    }
}
