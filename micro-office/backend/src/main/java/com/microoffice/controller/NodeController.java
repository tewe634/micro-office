package com.microoffice.controller;

import com.microoffice.dto.request.CompleteNodeRequest;
import com.microoffice.dto.request.CreateNodeRequest;
import com.microoffice.dto.response.ApiResponse;
import com.microoffice.entity.WorkNode;
import com.microoffice.service.NodeService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import java.util.*;

@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class NodeController {
    private final NodeService nodeService;
    private final JdbcTemplate jdbc;

    @PostMapping("/threads/{threadId}/nodes")
    public ApiResponse<WorkNode> create(@PathVariable Integer threadId, @Valid @RequestBody CreateNodeRequest req) {
        return ApiResponse.ok(nodeService.create(threadId, req));
    }

    @GetMapping("/threads/{threadId}/nodes")
    public ApiResponse<List<WorkNode>> list(@PathVariable Integer threadId) {
        return ApiResponse.ok(nodeService.listByThread(threadId));
    }

    // 获取单个节点详情（含权限检查：只有参与人或部门领导可见）
    @GetMapping("/nodes/{id}")
    public ApiResponse<Map<String, Object>> getNode(@PathVariable Integer id, Authentication auth) {
        Integer userId = (Integer) auth.getPrincipal();
        WorkNode node = nodeService.getById(id);
        if (node == null) throw new RuntimeException("节点不存在");

        // 权限检查：节点参与人 or 部门领导
        if (!canViewNode(userId, node)) throw new RuntimeException("无权查看此节点");

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("node", node);

        // 节点消息
        result.put("messages", jdbc.queryForList(
            "SELECT nm.*, su.name AS author_name FROM node_message nm JOIN sys_user su ON su.id = nm.author_id WHERE nm.node_id = ? ORDER BY nm.created_at", id));

        // 节点关联引用
        result.put("references", jdbc.queryForList(
            "SELECT * FROM node_reference WHERE node_id = ? ORDER BY created_at", id));

        // 字段可见性 - 根据当前用户岗位过滤
        Integer posId = jdbc.queryForObject("SELECT primary_position_id FROM sys_user WHERE id = ?", Integer.class, userId);
        if (posId != null) {
            List<String> hidden = jdbc.queryForList(
                "SELECT unnest(hidden_fields) FROM field_visibility WHERE position_id = ? AND entity_type = 'WORK_NODE'", String.class, posId);
            result.put("hiddenFields", hidden);
        }

        return ApiResponse.ok(result);
    }

    // 指派/重新指派节点处理人
    @PutMapping("/nodes/{id}/assign")
    public ApiResponse<Void> assign(@PathVariable Integer id, @RequestBody Map<String, Integer> body) {
        Integer assigneeId = body.get("assigneeId");
        jdbc.update("UPDATE work_node SET owner_id = ?, response_at = NULL WHERE id = ?", assigneeId, id);
        return ApiResponse.ok(null);
    }

    @PutMapping("/nodes/{id}/complete")
    public ApiResponse<WorkNode> complete(@PathVariable Integer id, @RequestBody CompleteNodeRequest req, Authentication auth) {
        Integer userId = (Integer) auth.getPrincipal();
        WorkNode result = nodeService.complete(id, req);
        // 自动记录操作日志
        String userName = jdbc.queryForObject("SELECT name FROM sys_user WHERE id = ?", String.class, userId);
        if ("ASSIGN".equals(req.getNextAction()) && req.getAssignToUserId() != null) {
            String assigneeName = jdbc.queryForObject("SELECT name FROM sys_user WHERE id = ?", String.class, req.getAssignToUserId());
            String nodeName = req.getCustomNodeName() != null ? req.getCustomNodeName() : "待处理";
            jdbc.update("INSERT INTO node_message (node_id, author_id, content) VALUES (?, ?, ?)",
                id, userId, "[系统] " + userName + " 完成节点并指派给 " + assigneeName + "（" + nodeName + "）");
        } else if ("COMPLETE_TASK".equals(req.getNextAction())) {
            jdbc.update("INSERT INTO node_message (node_id, author_id, content) VALUES (?, ?, ?)",
                id, userId, "[系统] " + userName + " 完成节点并标记工作流完成");
        }
        return ApiResponse.ok(result);
    }

    @PutMapping("/nodes/{id}/cancel")
    public ApiResponse<Void> cancel(@PathVariable Integer id, Authentication auth) {
        Integer userId = (Integer) auth.getPrincipal();
        jdbc.update("UPDATE work_node SET status = 'CANCELLED', completed_at = NOW() WHERE id = ?", id);
        String userName = jdbc.queryForObject("SELECT name FROM sys_user WHERE id = ?", String.class, userId);
        jdbc.update("INSERT INTO node_message (node_id, author_id, content) VALUES (?, ?, ?)",
            id, userId, "[系统] " + userName + " 取消了此节点");
        return ApiResponse.ok(null);
    }

    // 转派节点给其他人
    @PutMapping("/nodes/{id}/transfer")
    public ApiResponse<Void> transfer(@PathVariable Integer id, @RequestBody Map<String, Integer> body, Authentication auth) {
        Integer userId = (Integer) auth.getPrincipal();
        Integer targetId = body.get("targetUserId");
        if (targetId == null) throw new RuntimeException("请选择转派目标");
        String userName = jdbc.queryForObject("SELECT name FROM sys_user WHERE id = ?", String.class, userId);
        String targetName = jdbc.queryForObject("SELECT name FROM sys_user WHERE id = ?", String.class, targetId);
        jdbc.update("UPDATE work_node SET owner_id = ? WHERE id = ?", targetId, id);
        jdbc.update("INSERT INTO node_message (node_id, author_id, content) VALUES (?, ?, ?)",
            id, userId, "[系统] " + userName + " 将节点转派给 " + targetName);
        return ApiResponse.ok(null);
    }

    // 在当前节点发起子工作流，自动关联到节点引用
    @PostMapping("/nodes/{id}/spawn-thread")
    public ApiResponse<Map<String, Object>> spawnThread(@PathVariable Integer id, @RequestBody Map<String, Object> body, Authentication auth) {
        Integer userId = (Integer) auth.getPrincipal();
        WorkNode node = nodeService.getById(id);
        if (node == null) throw new RuntimeException("节点不存在");

        // 创建子工作流
        String title = (String) body.get("title");
        String content = (String) body.get("content");
        Integer objectId = body.get("objectId") != null ? ((Number) body.get("objectId")).intValue() : null;
        Integer productId = body.get("productId") != null ? ((Number) body.get("productId")).intValue() : null;

        // 继承父工作流的objectId/productId（如果子流程没指定）
        if (objectId == null) objectId = jdbc.queryForObject("SELECT object_id FROM work_thread WHERE id = ?", Integer.class, node.getThreadId());
        if (productId == null) productId = jdbc.queryForObject("SELECT product_id FROM work_thread WHERE id = ?", Integer.class, node.getThreadId());

        jdbc.update("INSERT INTO work_thread (title, content, status, creator_id, object_id, product_id) VALUES (?, ?, 'ACTIVE'::thread_status, ?, ?, ?)",
            title, content, userId, objectId, productId);
        Integer newThreadId = jdbc.queryForObject("SELECT currval(pg_get_serial_sequence('work_thread','id'))", Integer.class);

        // 自动创建第一个节点
        Integer assignTo = body.get("assignToUserId") != null ? ((Number) body.get("assignToUserId")).intValue() : userId;
        String nodeName = body.get("firstNodeName") != null ? (String) body.get("firstNodeName") : "发起处理";
        jdbc.update("INSERT INTO work_node (thread_id, name, type, status, owner_id) VALUES (?, ?, 'TASK'::node_type, 'IN_PROGRESS'::node_status, ?)",
            newThreadId, nodeName, assignTo);

        // 自动关联到当前节点
        jdbc.update("INSERT INTO node_reference (node_id, ref_type, ref_id, ref_label) VALUES (?, 'THREAD', ?, ?)",
            id, newThreadId, "子工作流: " + title);

        // 记录操作日志
        String userName = jdbc.queryForObject("SELECT name FROM sys_user WHERE id = ?", String.class, userId);
        jdbc.update("INSERT INTO node_message (node_id, author_id, content) VALUES (?, ?, ?)",
            id, userId, "[系统] " + userName + " 发起子工作流「" + title + "」");

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("threadId", newThreadId);
        return ApiResponse.ok(result);
    }

    @PutMapping("/nodes/{id}/rollback")
    public ApiResponse<Void> rollback(@PathVariable Integer id, @RequestParam Integer targetNodeId) {
        nodeService.rollback(id, targetNodeId);
        return ApiResponse.ok(null);
    }

    // === 节点消息通道 ===
    @PostMapping("/nodes/{id}/messages")
    public ApiResponse<Void> addMessage(@PathVariable Integer id, @RequestBody Map<String, String> body, Authentication auth) {
        Integer userId = (Integer) auth.getPrincipal();
        WorkNode node = nodeService.getById(id);
        if (!canViewNode(userId, node)) throw new RuntimeException("无权操作此节点");
        jdbc.update("INSERT INTO node_message (node_id, author_id, content, file_url, file_name) VALUES (?, ?, ?, ?, ?)",
            id, userId, body.get("content"), body.get("fileUrl"), body.get("fileName"));
        return ApiResponse.ok(null);
    }

    @GetMapping("/nodes/{id}/messages")
    public ApiResponse<List<Map<String, Object>>> getMessages(@PathVariable Integer id, Authentication auth) {
        Integer userId = (Integer) auth.getPrincipal();
        WorkNode node = nodeService.getById(id);
        if (!canViewNode(userId, node)) throw new RuntimeException("无权查看此节点消息");
        return ApiResponse.ok(jdbc.queryForList(
            "SELECT nm.*, su.name AS author_name FROM node_message nm JOIN sys_user su ON su.id = nm.author_id WHERE nm.node_id = ? ORDER BY nm.created_at", id));
    }

    // === 节点关联引用 ===
    @PostMapping("/nodes/{id}/references")
    public ApiResponse<Void> addReference(@PathVariable Integer id, @RequestBody Map<String, Object> body) {
        jdbc.update("INSERT INTO node_reference (node_id, ref_type, ref_id, ref_label) VALUES (?, ?, ?, ?)",
            id, body.get("refType"), body.get("refId"), body.get("refLabel"));
        return ApiResponse.ok(null);
    }

    @DeleteMapping("/nodes/{id}/references/{refId}")
    public ApiResponse<Void> removeReference(@PathVariable Integer id, @PathVariable Integer refId) {
        jdbc.update("DELETE FROM node_reference WHERE id = ? AND node_id = ?", refId, id);
        return ApiResponse.ok(null);
    }

    // === 字段可见性配置 (ADMIN) ===
    @GetMapping("/admin/field-visibility")
    public ApiResponse<List<Map<String, Object>>> listFieldVisibility() {
        return ApiResponse.ok(jdbc.queryForList("SELECT fv.*, p.name AS position_name FROM field_visibility fv JOIN position p ON p.id = fv.position_id ORDER BY fv.position_id"));
    }

    @PutMapping("/admin/field-visibility")
    public ApiResponse<Void> saveFieldVisibility(@RequestBody List<Map<String, Object>> rules) {
        jdbc.update("DELETE FROM field_visibility");
        for (var rule : rules) {
            @SuppressWarnings("unchecked")
            List<String> fields = (List<String>) rule.get("hiddenFields");
            jdbc.update("INSERT INTO field_visibility (position_id, entity_type, hidden_fields) VALUES (?, ?, ?::text[])",
                rule.get("positionId"), rule.get("entityType"), "{" + String.join(",", fields) + "}");
        }
        return ApiResponse.ok(null);
    }

    // 权限检查：节点参与人 or 参与人的部门领导
    private boolean canViewNode(Integer userId, WorkNode node) {
        if (node.getOwnerId() != null && node.getOwnerId().equals(userId)) return true;
        // 检查是否是 ADMIN
        String role = jdbc.queryForObject("SELECT role FROM sys_user WHERE id = ?", String.class, userId);
        if ("ADMIN".equals(role)) return true;
        // 检查是否是节点参与人的部门领导
        if (node.getOwnerId() != null) {
            Integer ownerOrgId = jdbc.queryForObject("SELECT org_id FROM sys_user WHERE id = ?", Integer.class, node.getOwnerId());
            Integer viewerOrgId = jdbc.queryForObject("SELECT org_id FROM sys_user WHERE id = ?", Integer.class, userId);
            if (ownerOrgId != null && ownerOrgId.equals(viewerOrgId)) {
                String posCode = jdbc.queryForObject(
                    "SELECT COALESCE(p.code,'') FROM sys_user su LEFT JOIN position p ON p.id = su.primary_position_id WHERE su.id = ?", String.class, userId);
                if (Set.of("BOSS","SALES_DIR","SALES_MGR","DEPT_MGR","SYS_ADMIN").contains(posCode)) return true;
            }
        }
        // 检查是否是工作流创建者
        Integer creatorId = jdbc.queryForObject("SELECT creator_id FROM work_thread WHERE id = ?", Integer.class, node.getThreadId());
        return creatorId != null && creatorId.equals(userId);
    }
}
