package com.microoffice.controller;

import com.microoffice.dto.response.ApiResponse;
import com.microoffice.service.MenuPermissionService;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.EmptyResultDataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.ArrayList;
import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;

@RestController
@RequestMapping("/api/admin/sales-collab")
@RequiredArgsConstructor
public class SalesCollabController {
    private static final String SALES_SYSTEM_NAME = "销售体系";
    private static final String OWNER_ROLE = "OWNER";
    private static final String COLLABORATOR_ROLE = "COLLABORATOR";
    private static final String SOURCE_TYPE_USER = "USER";
    private static final String SOURCE_TYPE_POSITION = "POSITION";
    private static final String SOURCE_TYPE_LEADER = "LEADER";
    private static final String SOURCE_TYPE_SALES_OWNER = "SALES_OWNER";
    private static final String SCOPE_CURRENT_DEPT = "CURRENT_SALES_DEPT";
    private static final String SCOPE_CURRENT_REGION = "CURRENT_SALES_REGION";
    private static final String SCOPE_FIXED_ORG = "FIXED_ORG";

    private final JdbcTemplate jdbc;
    private final MenuPermissionService menuPermissionService;

    @GetMapping("/meta")
    public ApiResponse<Map<String, Object>> meta(Authentication auth) {
        requireAdmin(auth);
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("groups", loadGroupsWithScenes());
        result.put("sourceTypes", List.of(
            option(SOURCE_TYPE_USER, "指定人员"),
            option(SOURCE_TYPE_POSITION, "岗位"),
            option(SOURCE_TYPE_LEADER, "领导")
        ));
        result.put("scopeTypes", List.of(
            option(SCOPE_CURRENT_DEPT, "当前销售部门"),
            option(SCOPE_CURRENT_REGION, "当前销售大区"),
            option(SCOPE_FIXED_ORG, "固定组织")
        ));
        result.put("participantRoles", List.of(
            option(OWNER_ROLE, "主责"),
            option(COLLABORATOR_ROLE, "协同")
        ));
        result.put("ownerSourceType", SOURCE_TYPE_SALES_OWNER);
        return ApiResponse.ok(result);
    }

    @GetMapping("/templates")
    public ApiResponse<List<Map<String, Object>>> listTemplates(Authentication auth) {
        requireAdmin(auth);
        List<Map<String, Object>> rows = jdbc.queryForList(
            "SELECT t.id, t.name, t.applicable_scope, t.enabled, t.remark, t.created_at, t.updated_at, " +
                "COALESCE((SELECT COUNT(*) FROM sales_collab_template_rule r WHERE r.template_id = t.id), 0) AS rule_count, " +
                "COALESCE((SELECT COUNT(*) FROM sales_collab_org_binding b WHERE b.template_id = t.id), 0) AS binding_count " +
                "FROM sales_collab_template t ORDER BY t.enabled DESC, t.updated_at DESC, t.created_at DESC"
        );
        List<Map<String, Object>> result = new ArrayList<>();
        for (Map<String, Object> row : rows) {
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("id", asString(row.get("id")));
            item.put("name", asString(row.get("name")));
            item.put("applicableScope", asString(row.get("applicable_scope")));
            item.put("enabled", asBoolean(row.get("enabled"), true));
            item.put("remark", asString(row.get("remark")));
            item.put("createdAt", row.get("created_at"));
            item.put("updatedAt", row.get("updated_at"));
            item.put("ruleCount", asInt(row.get("rule_count"), 0));
            item.put("bindingCount", asInt(row.get("binding_count"), 0));
            result.add(item);
        }
        return ApiResponse.ok(result);
    }

    @GetMapping("/templates/{id}")
    public ApiResponse<Map<String, Object>> getTemplate(@PathVariable String id, Authentication auth) {
        requireAdmin(auth);
        return ApiResponse.ok(loadTemplateDetail(id));
    }

    @PostMapping("/templates")
    public ApiResponse<Map<String, Object>> createTemplate(@RequestBody Map<String, Object> body, Authentication auth) {
        requireAdmin(auth);
        String name = requireText(body.get("name"), "模板名称不能为空");
        boolean enabled = asBoolean(body.get("enabled"), true);
        String remark = asNullableString(body.get("remark"));
        String id = UUID.randomUUID().toString();
        jdbc.update(
            "INSERT INTO sales_collab_template (id, name, applicable_scope, enabled, remark) VALUES (?, ?, 'SALES_DEPARTMENT', ?, ?)",
            id,
            name,
            enabled,
            remark
        );
        return ApiResponse.ok(loadTemplateDetail(id));
    }

    @PostMapping("/templates/{id}/copy")
    public ApiResponse<Map<String, Object>> copyTemplate(@PathVariable String id,
                                                         @RequestBody(required = false) Map<String, Object> body,
                                                         Authentication auth) {
        requireAdmin(auth);
        Map<String, Object> source = loadTemplateDetail(id);
        String copiedId = UUID.randomUUID().toString();
        String targetName = body == null ? null : asNullableString(body.get("name"));
        if (targetName == null) {
            targetName = asString(source.get("name")) + "（复制）";
        }
        jdbc.update(
            "INSERT INTO sales_collab_template (id, name, applicable_scope, enabled, remark) VALUES (?, ?, 'SALES_DEPARTMENT', ?, ?)",
            copiedId,
            targetName,
            asBoolean(source.get("enabled"), true),
            asNullableString(source.get("remark"))
        );
        List<Map<String, Object>> groups = asListOfMap(source.get("groups"));
        for (Map<String, Object> group : groups) {
            String groupId = asString(group.get("id"));
            for (Map<String, Object> rule : asListOfMap(group.get("rules"))) {
                insertTemplateRule(copiedId, groupId, rule);
            }
        }
        return ApiResponse.ok(loadTemplateDetail(copiedId));
    }

    @PutMapping("/templates/{id}")
    public ApiResponse<Map<String, Object>> updateTemplate(@PathVariable String id,
                                                           @RequestBody Map<String, Object> body,
                                                           Authentication auth) {
        requireAdmin(auth);
        String name = requireText(body.get("name"), "模板名称不能为空");
        boolean enabled = asBoolean(body.get("enabled"), true);
        String remark = asNullableString(body.get("remark"));
        jdbc.update(
            "UPDATE sales_collab_template SET name = ?, enabled = ?, remark = ?, updated_at = NOW() WHERE id = ?",
            name,
            enabled,
            remark,
            id
        );
        return ApiResponse.ok(loadTemplateDetail(id));
    }

    @DeleteMapping("/templates/{id}")
    public ApiResponse<Void> deleteTemplate(@PathVariable String id, Authentication auth) {
        requireAdmin(auth);
        Integer bindingCount = jdbc.queryForObject(
            "SELECT COUNT(*) FROM sales_collab_org_binding WHERE template_id = ?",
            Integer.class,
            id
        );
        if (bindingCount != null && bindingCount > 0) {
            throw new IllegalArgumentException("已有部门绑定该模板，不能删除");
        }
        jdbc.update("DELETE FROM sales_collab_template WHERE id = ?", id);
        return ApiResponse.ok(null);
    }

    @PutMapping("/templates/{id}/rules")
    public ApiResponse<Map<String, Object>> saveTemplateRules(@PathVariable String id,
                                                              @RequestBody Map<String, Object> body,
                                                              Authentication auth) {
        requireAdmin(auth);
        List<Map<String, Object>> groups = asListOfMap(body.get("groups"));
        jdbc.update("DELETE FROM sales_collab_template_rule WHERE template_id = ?", id);
        for (Map<String, Object> group : groups) {
            String groupId = asString(group.get("groupId"));
            if (groupId == null) {
                continue;
            }
            List<Map<String, Object>> rules = asListOfMap(group.get("rules"));
            for (Map<String, Object> rule : rules) {
                insertTemplateRule(id, groupId, rule);
            }
        }
        jdbc.update("UPDATE sales_collab_template SET updated_at = NOW() WHERE id = ?", id);
        return ApiResponse.ok(loadTemplateDetail(id));
    }

    @GetMapping("/org-binding/{orgId}")
    public ApiResponse<Map<String, Object>> getOrgBinding(@PathVariable String orgId, Authentication auth) {
        requireAdmin(auth);
        return ApiResponse.ok(loadOrgBinding(orgId));
    }

    @PutMapping("/org-binding/{orgId}")
    public ApiResponse<Map<String, Object>> saveOrgBinding(@PathVariable String orgId,
                                                           @RequestBody Map<String, Object> body,
                                                           Authentication auth) {
        requireAdmin(auth);
        String templateId = asNullableString(body.get("templateId"));
        String remark = asNullableString(body.get("remark"));
        boolean enabled = asBoolean(body.get("enabled"), true);

        if (templateId == null || templateId.isBlank()) {
            jdbc.update("DELETE FROM sales_collab_org_rule WHERE org_id = ?", orgId);
            jdbc.update("DELETE FROM sales_collab_org_binding WHERE org_id = ?", orgId);
            return ApiResponse.ok(loadOrgBinding(orgId));
        }

        Integer exists = jdbc.queryForObject(
            "SELECT COUNT(*) FROM sales_collab_org_binding WHERE org_id = ?",
            Integer.class,
            orgId
        );
        if (exists != null && exists > 0) {
            jdbc.update(
                "UPDATE sales_collab_org_binding SET template_id = ?, enabled = ?, remark = ?, updated_at = NOW() WHERE org_id = ?",
                templateId,
                enabled,
                remark,
                orgId
            );
        } else {
            jdbc.update(
                "INSERT INTO sales_collab_org_binding (id, org_id, template_id, enabled, remark) VALUES (?, ?, ?, ?, ?)",
                UUID.randomUUID().toString(),
                orgId,
                templateId,
                enabled,
                remark
            );
        }
        return ApiResponse.ok(loadOrgBinding(orgId));
    }

    @GetMapping("/org-rules/{orgId}")
    public ApiResponse<Map<String, Object>> getOrgRules(@PathVariable String orgId, Authentication auth) {
        requireAdmin(auth);
        return ApiResponse.ok(loadOrgRuleDetail(orgId));
    }

    @PutMapping("/org-rules/{orgId}")
    public ApiResponse<Map<String, Object>> saveOrgRules(@PathVariable String orgId,
                                                         @RequestBody Map<String, Object> body,
                                                         Authentication auth) {
        requireAdmin(auth);
        List<Map<String, Object>> groups = asListOfMap(body.get("groups"));
        jdbc.update("DELETE FROM sales_collab_org_rule WHERE org_id = ?", orgId);
        for (Map<String, Object> group : groups) {
            String overrideMode = asString(group.get("overrideMode"));
            if (!"CUSTOM".equals(overrideMode)) {
                continue;
            }
            String groupId = asString(group.get("groupId"));
            if (groupId == null) {
                continue;
            }
            List<Map<String, Object>> rules = asListOfMap(group.get("rules"));
            for (Map<String, Object> rule : rules) {
                insertOrgRule(orgId, groupId, rule);
            }
        }
        return ApiResponse.ok(loadOrgRuleDetail(orgId));
    }

    @PostMapping("/org-rules/{orgId}/copy")
    public ApiResponse<Map<String, Object>> copyOrgRules(@PathVariable String orgId,
                                                         @RequestBody Map<String, Object> body,
                                                         Authentication auth) {
        requireAdmin(auth);
        List<String> targetOrgIds = asStringList(body.get("targetOrgIds"));
        List<String> filteredTargetOrgIds = targetOrgIds.stream()
            .filter(Objects::nonNull)
            .map(String::trim)
            .filter(value -> !value.isBlank() && !Objects.equals(value, orgId))
            .distinct()
            .toList();
        if (filteredTargetOrgIds.isEmpty()) {
            throw new IllegalArgumentException("请选择至少一个目标销售部门");
        }

        Map<String, Object> binding = loadOrgBinding(orgId);
        String templateId = asNullableString(binding.get("templateId"));
        List<Map<String, Object>> sourceRules = jdbc.queryForList(
            "SELECT group_id, participant_role, source_type, source_ref_id, source_ref_name, resolve_scope_type, resolve_scope_ref_id, duty_label, sort_order, enabled, remark " +
                "FROM sales_collab_org_rule WHERE org_id = ? ORDER BY group_id, sort_order, created_at",
            orgId
        );

        for (String targetOrgId : filteredTargetOrgIds) {
            jdbc.update("DELETE FROM sales_collab_org_rule WHERE org_id = ?", targetOrgId);
            jdbc.update("DELETE FROM sales_collab_org_binding WHERE org_id = ?", targetOrgId);
            if (templateId != null) {
                jdbc.update(
                    "INSERT INTO sales_collab_org_binding (id, org_id, template_id, enabled, remark) VALUES (?, ?, ?, ?, ?)",
                    UUID.randomUUID().toString(),
                    targetOrgId,
                    templateId,
                    asBoolean(binding.get("enabled"), true),
                    asNullableString(binding.get("remark"))
                );
            }
            for (Map<String, Object> rule : sourceRules) {
                insertOrgRule(targetOrgId, asString(rule.get("group_id")), toRulePayload(rule));
            }
        }

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("sourceOrgId", orgId);
        result.put("targetOrgIds", filteredTargetOrgIds);
        result.put("copiedCount", filteredTargetOrgIds.size());
        result.put("templateId", templateId);
        return ApiResponse.ok(result);
    }

    @PostMapping("/preview")
    public ApiResponse<Map<String, Object>> preview(@RequestBody Map<String, Object> body, Authentication auth) {
        requireAdmin(auth);
        String orgId = requireText(body.get("orgId"), "请选择销售部门");
        String salesOwnerUserId = asNullableString(body.get("salesOwnerUserId"));
        String groupId = asNullableString(body.get("groupId"));
        String groupKey = asNullableString(body.get("groupKey"));
        String sceneKey = asNullableString(body.get("sceneKey"));

        Map<String, Object> group = resolveTargetGroup(groupId, groupKey, sceneKey);
        if (group == null) {
            throw new IllegalArgumentException("未找到对应的协同组");
        }

        String targetGroupId = asString(group.get("id"));
        Map<String, Object> binding = loadOrgBinding(orgId);
        String templateId = asNullableString(binding.get("templateId"));
        Map<String, List<Map<String, Object>>> templateRulesByGroup = templateId == null
            ? Map.of()
            : loadTemplateRulesByGroup(templateId);
        Map<String, List<Map<String, Object>>> orgRulesByGroup = loadOrgRulesByGroup(orgId);

        List<Map<String, Object>> effectiveRules = new ArrayList<>(orgRulesByGroup.getOrDefault(
            targetGroupId,
            templateRulesByGroup.getOrDefault(targetGroupId, List.of())
        ));

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("group", buildGroupSummary(group));
        result.put("owner", salesOwnerUserId == null ? null : loadUserSummary(salesOwnerUserId));
        Map<String, Object> resolved = resolveCollaborators(orgId, effectiveRules);
        result.put("collaborators", resolved.get("collaborators"));
        result.put("unmatchedRules", resolved.get("unmatchedRules"));
        result.put("binding", binding);
        return ApiResponse.ok(result);
    }

    private void requireAdmin(Authentication auth) {
        String currentUserId = (String) auth.getPrincipal();
        menuPermissionService.requireMenu(currentUserId, "/admin");
    }

    private Map<String, Object> option(String value, String label) {
        Map<String, Object> item = new LinkedHashMap<>();
        item.put("value", value);
        item.put("label", label);
        return item;
    }

    private List<Map<String, Object>> loadGroupsWithScenes() {
        List<Map<String, Object>> groupRows = jdbc.queryForList(
            "SELECT id, group_key, group_name, domain_key, description, sort_order, enabled " +
                "FROM sales_collab_group ORDER BY sort_order, group_name"
        );
        Map<String, List<Map<String, Object>>> scenesByGroup = new LinkedHashMap<>();
        List<Map<String, Object>> sceneRows = jdbc.queryForList(
            "SELECT gs.group_id, s.id AS scene_id, s.scene_key, s.scene_name, s.domain_key, gs.sort_order " +
                "FROM sales_collab_group_scene gs " +
                "JOIN sales_collab_scene s ON s.id = gs.scene_id " +
                "ORDER BY gs.sort_order, s.sort_order, s.scene_name"
        );
        for (Map<String, Object> row : sceneRows) {
            String groupId = asString(row.get("group_id"));
            if (groupId == null) {
                continue;
            }
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("id", asString(row.get("scene_id")));
            item.put("sceneKey", asString(row.get("scene_key")));
            item.put("sceneName", asString(row.get("scene_name")));
            item.put("domainKey", asString(row.get("domain_key")));
            item.put("sortOrder", asInt(row.get("sort_order"), 0));
            scenesByGroup.computeIfAbsent(groupId, key -> new ArrayList<>()).add(item);
        }

        List<Map<String, Object>> groups = new ArrayList<>();
        for (Map<String, Object> row : groupRows) {
            String groupId = asString(row.get("id"));
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("id", groupId);
            item.put("groupKey", asString(row.get("group_key")));
            item.put("groupName", asString(row.get("group_name")));
            item.put("domainKey", asString(row.get("domain_key")));
            item.put("description", asString(row.get("description")));
            item.put("sortOrder", asInt(row.get("sort_order"), 0));
            item.put("enabled", asBoolean(row.get("enabled"), true));
            item.put("scenes", new ArrayList<>(scenesByGroup.getOrDefault(groupId, List.of())));
            groups.add(item);
        }
        return groups;
    }

    private Map<String, Object> loadTemplateDetail(String templateId) {
        Map<String, Object> template = queryForMapOrNull(
            "SELECT id, name, applicable_scope, enabled, remark, created_at, updated_at FROM sales_collab_template WHERE id = ?",
            templateId
        );
        if (template == null) {
            throw new IllegalArgumentException("模板不存在");
        }
        List<Map<String, Object>> groups = loadGroupsWithScenes();
        Map<String, List<Map<String, Object>>> rulesByGroup = loadTemplateRulesByGroup(templateId);
        for (Map<String, Object> group : groups) {
            String groupId = asString(group.get("id"));
            group.put("rules", new ArrayList<>(rulesByGroup.getOrDefault(groupId, List.of())));
        }
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("id", asString(template.get("id")));
        result.put("name", asString(template.get("name")));
        result.put("applicableScope", asString(template.get("applicable_scope")));
        result.put("enabled", asBoolean(template.get("enabled"), true));
        result.put("remark", asString(template.get("remark")));
        result.put("createdAt", template.get("created_at"));
        result.put("updatedAt", template.get("updated_at"));
        result.put("groups", groups);
        return result;
    }

    private Map<String, List<Map<String, Object>>> loadTemplateRulesByGroup(String templateId) {
        List<Map<String, Object>> rows = jdbc.queryForList(
            "SELECT id, group_id, participant_role, source_type, source_ref_id, source_ref_name, " +
                "resolve_scope_type, resolve_scope_ref_id, duty_label, sort_order, enabled, remark " +
                "FROM sales_collab_template_rule WHERE template_id = ? ORDER BY group_id, sort_order, created_at",
            templateId
        );
        return groupRules(rows);
    }

    private Map<String, List<Map<String, Object>>> loadOrgRulesByGroup(String orgId) {
        List<Map<String, Object>> rows = jdbc.queryForList(
            "SELECT id, group_id, participant_role, source_type, source_ref_id, source_ref_name, " +
                "resolve_scope_type, resolve_scope_ref_id, duty_label, sort_order, enabled, remark " +
                "FROM sales_collab_org_rule WHERE org_id = ? ORDER BY group_id, sort_order, created_at",
            orgId
        );
        return groupRules(rows);
    }

    private Map<String, List<Map<String, Object>>> groupRules(List<Map<String, Object>> rows) {
        Map<String, List<Map<String, Object>>> result = new LinkedHashMap<>();
        for (Map<String, Object> row : rows) {
            String groupId = asString(row.get("group_id"));
            if (groupId == null) {
                continue;
            }
            result.computeIfAbsent(groupId, key -> new ArrayList<>()).add(toRulePayload(row));
        }
        return result;
    }

    private Map<String, Object> toRulePayload(Map<String, Object> row) {
        Map<String, Object> item = new LinkedHashMap<>();
        item.put("id", asString(row.get("id")));
        item.put("participantRole", asString(row.get("participant_role")));
        item.put("sourceType", asString(row.get("source_type")));
        item.put("sourceRefId", asString(row.get("source_ref_id")));
        item.put("sourceRefName", asString(row.get("source_ref_name")));
        item.put("resolveScopeType", asString(row.get("resolve_scope_type")));
        item.put("resolveScopeRefId", asString(row.get("resolve_scope_ref_id")));
        item.put("dutyLabel", asString(row.get("duty_label")));
        item.put("sortOrder", asInt(row.get("sort_order"), 0));
        item.put("enabled", asBoolean(row.get("enabled"), true));
        item.put("remark", asString(row.get("remark")));
        return item;
    }

    private Map<String, Object> loadOrgBinding(String orgId) {
        Map<String, Object> binding = queryForMapOrNull(
            "SELECT b.id, b.org_id, b.template_id, b.enabled, b.remark, t.name AS template_name " +
                "FROM sales_collab_org_binding b JOIN sales_collab_template t ON t.id = b.template_id WHERE b.org_id = ?",
            orgId
        );
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("orgId", orgId);
        result.put("templateId", binding == null ? null : asString(binding.get("template_id")));
        result.put("templateName", binding == null ? null : asString(binding.get("template_name")));
        result.put("enabled", binding == null ? true : asBoolean(binding.get("enabled"), true));
        result.put("remark", binding == null ? null : asString(binding.get("remark")));
        return result;
    }

    private Map<String, Object> loadOrgRuleDetail(String orgId) {
        Map<String, Object> binding = loadOrgBinding(orgId);
        String templateId = asNullableString(binding.get("templateId"));
        Map<String, List<Map<String, Object>>> templateRulesByGroup = templateId == null
            ? Map.of()
            : loadTemplateRulesByGroup(templateId);
        Map<String, List<Map<String, Object>>> orgRulesByGroup = loadOrgRulesByGroup(orgId);

        List<Map<String, Object>> groups = loadGroupsWithScenes();
        for (Map<String, Object> group : groups) {
            String groupId = asString(group.get("id"));
            List<Map<String, Object>> templateRules = new ArrayList<>(templateRulesByGroup.getOrDefault(groupId, List.of()));
            List<Map<String, Object>> orgRules = new ArrayList<>(orgRulesByGroup.getOrDefault(groupId, List.of()));
            boolean custom = !orgRules.isEmpty();
            group.put("templateRules", templateRules);
            group.put("rules", custom ? orgRules : templateRules);
            group.put("customRules", orgRules);
            group.put("overrideMode", custom ? "CUSTOM" : "INHERIT");
        }

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("orgId", orgId);
        result.put("binding", binding);
        result.put("groups", groups);
        return result;
    }

    private Map<String, Object> resolveCollaborators(String orgId, List<Map<String, Object>> rules) {
        LinkedHashMap<String, Map<String, Object>> collaborators = new LinkedHashMap<>();
        List<Map<String, Object>> unmatchedRules = new ArrayList<>();
        for (Map<String, Object> rule : rules) {
            if (!asBoolean(rule.get("enabled"), true)) {
                continue;
            }
            String sourceType = asString(rule.get("sourceType"));
            if (SOURCE_TYPE_USER.equals(sourceType)) {
                String userId = asString(rule.get("sourceRefId"));
                if (userId == null) {
                    unmatchedRules.add(unmatchedRule(rule, "未指定人员"));
                    continue;
                }
                Map<String, Object> user = loadUserSummary(userId);
                if (user == null) {
                    unmatchedRules.add(unmatchedRule(rule, "指定人员不存在或不可用"));
                    continue;
                }
                mergeCollaborator(collaborators, user, rule, "指定人员");
                continue;
            }
            if (SOURCE_TYPE_POSITION.equals(sourceType)) {
                String positionId = asString(rule.get("sourceRefId"));
                if (positionId == null) {
                    unmatchedRules.add(unmatchedRule(rule, "未指定岗位"));
                    continue;
                }
                List<String> scopeOrgIds = resolveScopeOrgIds(orgId, rule);
                if (scopeOrgIds.isEmpty()) {
                    unmatchedRules.add(unmatchedRule(rule, "岗位解析范围为空"));
                    continue;
                }
                List<Map<String, Object>> matchedUsers = loadUsersByPosition(positionId, scopeOrgIds);
                if (matchedUsers.isEmpty()) {
                    unmatchedRules.add(unmatchedRule(rule, "未匹配到岗位人员"));
                    continue;
                }
                for (Map<String, Object> user : matchedUsers) {
                    mergeCollaborator(collaborators, user, rule, "岗位解析");
                }
                continue;
            }
            if (SOURCE_TYPE_LEADER.equals(sourceType)) {
                List<String> scopeOrgIds = resolveScopeOrgIds(orgId, rule);
                if (scopeOrgIds.isEmpty()) {
                    unmatchedRules.add(unmatchedRule(rule, "领导解析范围为空"));
                    continue;
                }
                List<Map<String, Object>> matchedUsers = loadLeaderUsers(scopeOrgIds);
                if (matchedUsers.isEmpty()) {
                    unmatchedRules.add(unmatchedRule(rule, "未匹配到领导人员"));
                    continue;
                }
                for (Map<String, Object> user : matchedUsers) {
                    mergeCollaborator(collaborators, user, rule, "领导解析");
                }
                continue;
            }
            unmatchedRules.add(unmatchedRule(rule, "暂不支持的来源类型"));
        }
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("collaborators", new ArrayList<>(collaborators.values()));
        result.put("unmatchedRules", unmatchedRules);
        return result;
    }

    private void mergeCollaborator(Map<String, Map<String, Object>> collaborators,
                                   Map<String, Object> user,
                                   Map<String, Object> rule,
                                   String resolvedBy) {
        String userId = asString(user.get("userId"));
        if (userId == null) {
            return;
        }
        Map<String, Object> existing = collaborators.get(userId);
        if (existing == null) {
            Map<String, Object> item = new LinkedHashMap<>();
            item.putAll(user);
            item.put("participantRole", COLLABORATOR_ROLE);
            item.put("dutyLabel", asString(rule.get("dutyLabel")));
            item.put("sourceType", asString(rule.get("sourceType")));
            item.put("sourceRefName", asString(rule.get("sourceRefName")));
            item.put("resolvedBy", resolvedBy);
            collaborators.put(userId, item);
            return;
        }
        String currentDuty = asNullableString(existing.get("dutyLabel"));
        String newDuty = asNullableString(rule.get("dutyLabel"));
        if (newDuty != null && (currentDuty == null || currentDuty.isBlank())) {
            existing.put("dutyLabel", newDuty);
        } else if (newDuty != null && currentDuty != null && !currentDuty.contains(newDuty)) {
            existing.put("dutyLabel", currentDuty + " / " + newDuty);
        }
    }

    private Map<String, Object> unmatchedRule(Map<String, Object> rule, String reason) {
        Map<String, Object> item = new LinkedHashMap<>();
        item.put("reason", reason);
        item.put("sourceType", asString(rule.get("sourceType")));
        item.put("sourceRefId", asString(rule.get("sourceRefId")));
        item.put("sourceRefName", asString(rule.get("sourceRefName")));
        item.put("resolveScopeType", asString(rule.get("resolveScopeType")));
        item.put("resolveScopeRefId", asString(rule.get("resolveScopeRefId")));
        item.put("dutyLabel", asString(rule.get("dutyLabel")));
        return item;
    }

    private List<Map<String, Object>> loadUsersByPosition(String positionId, Collection<String> orgIds) {
        if (orgIds.isEmpty()) {
            return List.of();
        }
        List<String> orgList = new ArrayList<>(orgIds);
        return jdbc.query(
            "SELECT DISTINCT su.id, su.name, su.org_id, o.name AS org_name " +
                "FROM sys_user su " +
                "LEFT JOIN organization o ON o.id = su.org_id " +
                "WHERE su.org_id = ANY(?::varchar[]) AND (su.primary_position_id = ? OR EXISTS (" +
                "SELECT 1 FROM user_position up WHERE up.user_id = su.id AND up.position_id = ?)) " +
                "ORDER BY o.name, su.name",
            (rs, rowNum) -> {
                Map<String, Object> item = new LinkedHashMap<>();
                item.put("userId", rs.getString("id"));
                item.put("name", rs.getString("name"));
                item.put("orgId", rs.getString("org_id"));
                item.put("orgName", rs.getString("org_name"));
                return item;
            },
            (Object) orgList.toArray(new String[0]),
            positionId,
            positionId
        );
    }

    private List<Map<String, Object>> loadLeaderUsers(Collection<String> orgIds) {
        if (orgIds.isEmpty()) {
            return List.of();
        }
        List<String> orgList = new ArrayList<>(orgIds);
        List<Map<String, Object>> rows = jdbc.queryForList(
            "SELECT su.id, su.name, su.org_id, o.name AS org_name, su.role, p.name AS primary_position_name, " +
                "COALESCE(string_agg(DISTINCT p2.name, '、') FILTER (WHERE p2.name IS NOT NULL), '') AS extra_position_names " +
                "FROM sys_user su " +
                "LEFT JOIN organization o ON o.id = su.org_id " +
                "LEFT JOIN position p ON p.id = su.primary_position_id " +
                "LEFT JOIN user_position up ON up.user_id = su.id " +
                "LEFT JOIN position p2 ON p2.id = up.position_id " +
                "WHERE su.org_id = ANY(?::varchar[]) " +
                "GROUP BY su.id, su.name, su.org_id, o.name, su.role, p.name " +
                "ORDER BY o.name, su.name",
            (Object) orgList.toArray(new String[0])
        );
        List<Map<String, Object>> result = new ArrayList<>();
        for (Map<String, Object> row : rows) {
            String positionName = asString(row.get("primary_position_name"));
            String extraPositionNames = asString(row.get("extra_position_names"));
            String role = asString(row.get("role"));
            if (!isLeaderCandidate(positionName, extraPositionNames, role)) {
                continue;
            }
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("userId", asString(row.get("id")));
            item.put("name", asString(row.get("name")));
            item.put("orgId", asString(row.get("org_id")));
            item.put("orgName", asString(row.get("org_name")));
            result.add(item);
        }
        return result;
    }

    private List<String> resolveScopeOrgIds(String orgId, Map<String, Object> rule) {
        String scopeType = asNullableString(rule.get("resolveScopeType"));
        if (scopeType == null || scopeType.isBlank() || SCOPE_CURRENT_DEPT.equals(scopeType)) {
            return collectSubtreeOrgIds(orgId);
        }
        if (SCOPE_CURRENT_REGION.equals(scopeType)) {
            String regionRootId = findSalesRegionRootOrgId(orgId);
            return collectSubtreeOrgIds(regionRootId == null ? orgId : regionRootId);
        }
        if (SCOPE_FIXED_ORG.equals(scopeType)) {
            String fixedOrgId = asNullableString(rule.get("resolveScopeRefId"));
            return fixedOrgId == null ? List.of() : collectSubtreeOrgIds(fixedOrgId);
        }
        return collectSubtreeOrgIds(orgId);
    }

    private String findSalesRegionRootOrgId(String orgId) {
        if (orgId == null) {
            return null;
        }
        String salesSystemId = queryForStringOrNull("SELECT id FROM organization WHERE name = ? LIMIT 1", SALES_SYSTEM_NAME);
        if (salesSystemId == null) {
            return orgId;
        }
        String regionRoot = queryForStringOrNull(
            "WITH RECURSIVE path AS (" +
                "SELECT id, parent_id FROM organization WHERE id = ? " +
                "UNION ALL " +
                "SELECT o.id, o.parent_id FROM organization o JOIN path p ON o.id = p.parent_id" +
            ") SELECT id FROM path WHERE parent_id = ? LIMIT 1",
            orgId,
            salesSystemId
        );
        return regionRoot == null ? orgId : regionRoot;
    }

    private List<String> collectSubtreeOrgIds(String orgId) {
        if (orgId == null) {
            return List.of();
        }
        return jdbc.queryForList(
            "WITH RECURSIVE sub AS (" +
                "SELECT id FROM organization WHERE id = ? " +
                "UNION ALL " +
                "SELECT o.id FROM organization o JOIN sub s ON o.parent_id = s.id" +
            ") SELECT id FROM sub",
            String.class,
            orgId
        );
    }

    private Map<String, Object> loadUserSummary(String userId) {
        Map<String, Object> row = queryForMapOrNull(
            "SELECT su.id, su.name, su.org_id, o.name AS org_name FROM sys_user su LEFT JOIN organization o ON o.id = su.org_id WHERE su.id = ?",
            userId
        );
        if (row == null) {
            return null;
        }
        Map<String, Object> item = new LinkedHashMap<>();
        item.put("userId", asString(row.get("id")));
        item.put("name", asString(row.get("name")));
        item.put("orgId", asString(row.get("org_id")));
        item.put("orgName", asString(row.get("org_name")));
        return item;
    }

    private Map<String, Object> resolveTargetGroup(String groupId, String groupKey, String sceneKey) {
        if (groupId != null && !groupId.isBlank()) {
            return queryForMapOrNull(
                "SELECT id, group_key, group_name, domain_key FROM sales_collab_group WHERE id = ?",
                groupId
            );
        }
        if (groupKey != null && !groupKey.isBlank()) {
            return queryForMapOrNull(
                "SELECT id, group_key, group_name, domain_key FROM sales_collab_group WHERE group_key = ?",
                groupKey
            );
        }
        if (sceneKey != null && !sceneKey.isBlank()) {
            return queryForMapOrNull(
                "SELECT g.id, g.group_key, g.group_name, g.domain_key " +
                    "FROM sales_collab_group g " +
                    "JOIN sales_collab_group_scene gs ON gs.group_id = g.id " +
                    "JOIN sales_collab_scene s ON s.id = gs.scene_id " +
                    "WHERE s.scene_key = ? LIMIT 1",
                sceneKey
            );
        }
        return null;
    }

    private Map<String, Object> buildGroupSummary(Map<String, Object> row) {
        Map<String, Object> item = new LinkedHashMap<>();
        item.put("id", asString(row.get("id")));
        item.put("groupKey", asString(row.get("group_key")));
        item.put("groupName", asString(row.get("group_name")));
        item.put("domainKey", asString(row.get("domain_key")));
        return item;
    }

    private void insertTemplateRule(String templateId, String groupId, Map<String, Object> rule) {
        String sourceType = requireText(rule.get("sourceType"), "规则来源类型不能为空");
        String sourceRefId = asNullableString(rule.get("sourceRefId"));
        String sourceRefName = resolveSourceRefName(sourceType, sourceRefId, asNullableString(rule.get("sourceRefName")));
        jdbc.update(
            "INSERT INTO sales_collab_template_rule (id, template_id, group_id, participant_role, source_type, source_ref_id, source_ref_name, resolve_scope_type, resolve_scope_ref_id, duty_label, sort_order, enabled, remark) " +
                "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            UUID.randomUUID().toString(),
            templateId,
            groupId,
            asNullableString(rule.get("participantRole")) == null ? COLLABORATOR_ROLE : asString(rule.get("participantRole")),
            sourceType,
            sourceRefId,
            sourceRefName,
            asNullableString(rule.get("resolveScopeType")),
            asNullableString(rule.get("resolveScopeRefId")),
            asNullableString(rule.get("dutyLabel")),
            asInt(rule.get("sortOrder"), 0),
            asBoolean(rule.get("enabled"), true),
            asNullableString(rule.get("remark"))
        );
    }

    private void insertOrgRule(String orgId, String groupId, Map<String, Object> rule) {
        String sourceType = requireText(rule.get("sourceType"), "规则来源类型不能为空");
        String sourceRefId = asNullableString(rule.get("sourceRefId"));
        String sourceRefName = resolveSourceRefName(sourceType, sourceRefId, asNullableString(rule.get("sourceRefName")));
        jdbc.update(
            "INSERT INTO sales_collab_org_rule (id, org_id, group_id, participant_role, source_type, source_ref_id, source_ref_name, resolve_scope_type, resolve_scope_ref_id, duty_label, sort_order, enabled, remark) " +
                "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            UUID.randomUUID().toString(),
            orgId,
            groupId,
            asNullableString(rule.get("participantRole")) == null ? COLLABORATOR_ROLE : asString(rule.get("participantRole")),
            sourceType,
            sourceRefId,
            sourceRefName,
            asNullableString(rule.get("resolveScopeType")),
            asNullableString(rule.get("resolveScopeRefId")),
            asNullableString(rule.get("dutyLabel")),
            asInt(rule.get("sortOrder"), 0),
            asBoolean(rule.get("enabled"), true),
            asNullableString(rule.get("remark"))
        );
    }

    private String resolveSourceRefName(String sourceType, String sourceRefId, String fallback) {
        if (SOURCE_TYPE_LEADER.equals(sourceType)) {
            return fallback == null ? "领导" : fallback;
        }
        if (sourceRefId == null || sourceRefId.isBlank()) {
            return fallback;
        }
        if (SOURCE_TYPE_USER.equals(sourceType)) {
            String name = queryForStringOrNull("SELECT name FROM sys_user WHERE id = ?", sourceRefId);
            return name == null ? fallback : name;
        }
        if (SOURCE_TYPE_POSITION.equals(sourceType)) {
            String name = queryForStringOrNull("SELECT name FROM position WHERE id = ?", sourceRefId);
            return name == null ? fallback : name;
        }
        return fallback;
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

    private Map<String, Object> queryForMapOrNull(String sql, Object... args) {
        try {
            return jdbc.queryForMap(sql, args);
        } catch (EmptyResultDataAccessException ignored) {
            return null;
        }
    }

    private String queryForStringOrNull(String sql, Object... args) {
        try {
            return jdbc.queryForObject(sql, String.class, args);
        } catch (EmptyResultDataAccessException ignored) {
            return null;
        }
    }

    private String requireText(Object value, String message) {
        String text = asNullableString(value);
        if (text == null || text.isBlank()) {
            throw new IllegalArgumentException(message);
        }
        return text.trim();
    }

    private String asNullableString(Object value) {
        if (value == null) {
            return null;
        }
        String text = String.valueOf(value).trim();
        return text.isEmpty() ? null : text;
    }

    private String asString(Object value) {
        return value == null ? null : String.valueOf(value);
    }

    private boolean asBoolean(Object value, boolean defaultValue) {
        if (value == null) {
            return defaultValue;
        }
        if (value instanceof Boolean bool) {
            return bool;
        }
        return Boolean.parseBoolean(String.valueOf(value));
    }

    private int asInt(Object value, int defaultValue) {
        if (value == null) {
            return defaultValue;
        }
        if (value instanceof Number number) {
            return number.intValue();
        }
        try {
            return Integer.parseInt(String.valueOf(value));
        } catch (NumberFormatException ignored) {
            return defaultValue;
        }
    }

    @SuppressWarnings("unchecked")
    private List<Map<String, Object>> asListOfMap(Object value) {
        if (value == null) {
            return List.of();
        }
        List<?> rawList = (List<?>) value;
        List<Map<String, Object>> result = new ArrayList<>();
        for (Object item : rawList) {
            if (item instanceof Map<?, ?> map) {
                result.add((Map<String, Object>) map);
            }
        }
        return result;
    }

    private List<String> asStringList(Object value) {
        if (value == null) {
            return List.of();
        }
        List<?> rawList = (List<?>) value;
        List<String> result = new ArrayList<>();
        for (Object item : rawList) {
            if (item != null) {
                result.add(String.valueOf(item));
            }
        }
        return result;
    }
}
