package com.microoffice.controller;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.microoffice.dto.request.CreateThreadRequest;
import com.microoffice.dto.response.ApiResponse;
import com.microoffice.entity.WorkThread;
import com.microoffice.mapper.WorkThreadMapper;
import com.microoffice.service.ThreadService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import java.util.*;

@RestController
@RequestMapping("/api/threads")
@RequiredArgsConstructor
public class ThreadController {
    private final ThreadService threadService;
    private final WorkThreadMapper threadMapper;
    private final JdbcTemplate jdbc;

    @GetMapping
    public ApiResponse<List<Map<String, Object>>> list(
            @RequestParam(required = false) String status,
            @RequestParam(required = false) Integer objectId,
            Authentication auth) {
        Integer userId = (Integer) auth.getPrincipal();
        // 用户能看到：自己创建的 + 自己参与节点的工作流
        String sql = "SELECT DISTINCT wt.*, su.name AS creator_name, eo.name AS object_name, p.name AS product_name " +
            "FROM work_thread wt " +
            "JOIN sys_user su ON su.id = wt.creator_id " +
            "LEFT JOIN external_object eo ON eo.id = wt.object_id " +
            "LEFT JOIN product p ON p.id = wt.product_id " +
            "LEFT JOIN work_node wn ON wn.thread_id = wt.id " +
            "WHERE (wt.creator_id = ? OR wn.owner_id = ?)";
        List<Object> params = new ArrayList<>(List.of(userId, userId));
        if (status != null) { sql += " AND wt.status = ?::thread_status"; params.add(status); }
        if (objectId != null) { sql += " AND wt.object_id = ?"; params.add(objectId); }
        sql += " ORDER BY wt.updated_at DESC";
        return ApiResponse.ok(jdbc.queryForList(sql, params.toArray()));
    }

    @PostMapping
    public ApiResponse<WorkThread> create(@Valid @RequestBody CreateThreadRequest req, Authentication auth) {
        return ApiResponse.ok(threadService.create(req, (Integer) auth.getPrincipal()));
    }

    @GetMapping("/{id}")
    public ApiResponse<Map<String, Object>> get(@PathVariable Integer id, Authentication auth) {
        Integer userId = (Integer) auth.getPrincipal();
        Map<String, Object> thread = jdbc.queryForMap(
            "SELECT wt.*, su.name AS creator_name, eo.name AS object_name, eo.type AS object_type, p.name AS product_name " +
            "FROM work_thread wt JOIN sys_user su ON su.id = wt.creator_id " +
            "LEFT JOIN external_object eo ON eo.id = wt.object_id " +
            "LEFT JOIN product p ON p.id = wt.product_id WHERE wt.id = ?", id);

        // 节点列表（只返回基本信息，详情需要单独请求节点接口）
        List<Map<String, Object>> nodes = jdbc.queryForList(
            "SELECT wn.id, wn.name, wn.type, wn.status, wn.owner_id, su.name AS owner_name, wn.created_at, wn.completed_at " +
            "FROM work_node wn LEFT JOIN sys_user su ON su.id = wn.owner_id WHERE wn.thread_id = ? ORDER BY wn.created_at", id);

        // 标记当前用户可查看的节点
        for (var node : nodes) {
            Integer ownerId = (Integer) node.get("owner_id");
            boolean canView = (ownerId != null && ownerId.equals(userId));
            if (!canView) {
                Integer creatorId = (Integer) thread.get("creator_id");
                canView = creatorId != null && creatorId.equals(userId);
            }
            if (!canView) {
                String role = jdbc.queryForObject("SELECT role FROM sys_user WHERE id = ?", String.class, userId);
                canView = "ADMIN".equals(role);
            }
            if (!canView && ownerId != null) {
                // 部门领导检查
                try {
                    Integer ownerOrgId = jdbc.queryForObject("SELECT org_id FROM sys_user WHERE id = ?", Integer.class, ownerId);
                    Integer viewerOrgId = jdbc.queryForObject("SELECT org_id FROM sys_user WHERE id = ?", Integer.class, userId);
                    if (ownerOrgId != null && ownerOrgId.equals(viewerOrgId)) {
                        String posCode = jdbc.queryForObject(
                            "SELECT COALESCE(p.code,'') FROM sys_user su LEFT JOIN position p ON p.id = su.primary_position_id WHERE su.id = ?", String.class, userId);
                        canView = Set.of("BOSS","SALES_DIR","SALES_MGR","DEPT_MGR","SYS_ADMIN").contains(posCode);
                    }
                } catch (Exception ignored) {}
            }
            node.put("canView", canView);
            node.put("isOwner", ownerId != null && ownerId.equals(userId));
        }

        thread.put("currentUserId", userId);
        thread.put("nodes", nodes);
        return ApiResponse.ok(thread);
    }

    @PutMapping("/{id}")
    public ApiResponse<Void> update(@PathVariable Integer id, @RequestBody Map<String, Object> body) {
        WorkThread t = threadMapper.selectById(id);
        if (t == null) throw new RuntimeException("工作不存在");
        if (body.containsKey("title")) t.setTitle((String) body.get("title"));
        if (body.containsKey("content")) t.setContent((String) body.get("content"));
        if (body.containsKey("status")) t.setStatus(com.microoffice.enums.ThreadStatus.valueOf((String) body.get("status")));
        if (body.containsKey("objectId")) t.setObjectId((Integer) body.get("objectId"));
        if (body.containsKey("productId")) t.setProductId((Integer) body.get("productId"));
        threadMapper.updateById(t);
        return ApiResponse.ok(null);
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Void> delete(@PathVariable Integer id) {
        threadMapper.deleteById(id);
        return ApiResponse.ok(null);
    }
}
