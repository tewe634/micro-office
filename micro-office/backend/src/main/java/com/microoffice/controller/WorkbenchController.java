package com.microoffice.controller;

import com.microoffice.dto.response.ApiResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import java.util.*;

@RestController
@RequestMapping("/api/workbench")
@RequiredArgsConstructor
public class WorkbenchController {
    private final JdbcTemplate jdbc;

    @GetMapping
    public ApiResponse<Map<String, Object>> index(
            @RequestParam(defaultValue = "active") String view, Authentication auth) {
        Integer userId = (Integer) auth.getPrincipal();
        String baseWhere = "(wt.creator_id = ? OR wt.id IN (SELECT thread_id FROM work_node WHERE owner_id = ?))";
        String statusFilter = switch (view) {
            case "active" -> " AND wt.status = 'ACTIVE'";
            case "completed" -> " AND wt.status = 'COMPLETED'";
            case "cancelled" -> " AND wt.status = 'CANCELLED'";
            default -> " AND wt.status = 'ACTIVE'";
        };
        List<Map<String, Object>> threads = jdbc.queryForList(
            "SELECT wt.*, su.name AS creator_name, eo.name AS object_name " +
            "FROM work_thread wt JOIN sys_user su ON su.id = wt.creator_id " +
            "LEFT JOIN external_object eo ON eo.id = wt.object_id " +
            "WHERE " + baseWhere + statusFilter + " ORDER BY wt.updated_at DESC",
            userId, userId);

        List<Map<String, Object>> todoNodes = jdbc.queryForList(
            "SELECT wn.*, wt.title AS thread_title FROM work_node wn " +
            "JOIN work_thread wt ON wt.id = wn.thread_id " +
            "WHERE wn.owner_id = ? AND wn.status IN ('IN_PROGRESS','PENDING_NEXT') ORDER BY wn.created_at DESC", userId);

        // 各状态计数
        Map<String, Object> counts = new LinkedHashMap<>();
        counts.put("todo", todoNodes.size());
        String countBase = "SELECT COUNT(DISTINCT wt.id) FROM work_thread wt LEFT JOIN work_node wn ON wn.thread_id = wt.id WHERE " + baseWhere.replace("?", userId.toString());
        counts.put("active", jdbc.queryForObject(countBase + " AND wt.status = 'ACTIVE'", Integer.class));
        counts.put("completed", jdbc.queryForObject(countBase + " AND wt.status = 'COMPLETED'", Integer.class));
        counts.put("cancelled", jdbc.queryForObject(countBase + " AND wt.status = 'CANCELLED'", Integer.class));

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("threads", threads);
        result.put("todoNodes", todoNodes);
        result.put("counts", counts);
        return ApiResponse.ok(result);
    }
}
