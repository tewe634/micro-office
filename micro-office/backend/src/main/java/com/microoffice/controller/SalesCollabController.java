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
import java.util.Comparator;
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
    private static final String GROUP_KEY_TECH_COLLAB = "TECH_COLLAB";
    private static final String GROUP_KEY_PRE_SALES_TECH = "PRE_SALES_TECH";
    private static final String GROUP_KEY_AFTER_SALES_TECH = "AFTER_SALES_TECH";
    private static final String GROUP_KEY_MANAGEMENT_SYNC = "MANAGEMENT_SYNC";
    private static final int MANAGEMENT_SYNC_CURRENT_DEPT_SORT = 10;
    private static final int MANAGEMENT_SYNC_CURRENT_REGION_SORT = 20;
    private static final int MANAGEMENT_SYNC_FIXED_SYSTEM_SORT = 30;
    private static final String GROUP_NAME_TECH_COLLAB = "技术协同";
    private static final String GROUP_DESC_TECH_COLLAB = "销售与技术共同参与售前、售后技术支持";

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
        insertDefaultManagementSyncRules(id);
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

    @GetMapping("/org-bindings")
    public ApiResponse<List<Map<String, Object>>> listOrgBindings(Authentication auth) {
        requireAdmin(auth);
        return ApiResponse.ok(loadOrgBindings());
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
        String canonicalTechGroupId = resolveCanonicalTechGroupId(groupRows);

        Map<String, List<Map<String, Object>>> scenesByGroupKey = new LinkedHashMap<>();
        Map<String, Set<String>> sceneKeysByGroupKey = new LinkedHashMap<>();
        List<Map<String, Object>> sceneRows = jdbc.queryForList(
            "SELECT gs.group_id, g.group_key, s.id AS scene_id, s.scene_key, s.scene_name, s.domain_key, gs.sort_order " +
                "FROM sales_collab_group_scene gs " +
                "JOIN sales_collab_group g ON g.id = gs.group_id " +
                "JOIN sales_collab_scene s ON s.id = gs.scene_id " +
                "ORDER BY gs.sort_order, s.sort_order, s.scene_name"
        );
        for (Map<String, Object> row : sceneRows) {
            String normalizedGroupKey = normalizeGroupKey(asString(row.get("group_key")));
            if (normalizedGroupKey == null) {
                continue;
            }
            String sceneKey = asString(row.get("scene_key"));
            String dedupKey = sceneKey == null ? asString(row.get("scene_id")) : sceneKey;
            Set<String> seen = sceneKeysByGroupKey.computeIfAbsent(normalizedGroupKey, key -> new LinkedHashSet<>());
            if (dedupKey != null && !seen.add(dedupKey)) {
                continue;
            }
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("id", asString(row.get("scene_id")));
            item.put("sceneKey", sceneKey);
            item.put("sceneName", asString(row.get("scene_name")));
            item.put("domainKey", asString(row.get("domain_key")));
            item.put("sortOrder", asInt(row.get("sort_order"), 0));
            scenesByGroupKey.computeIfAbsent(normalizedGroupKey, key -> new ArrayList<>()).add(item);
        }

        Map<String, Map<String, Object>> groupsByKey = new LinkedHashMap<>();
        for (Map<String, Object> row : groupRows) {
            String rawGroupKey = asString(row.get("group_key"));
            String normalizedGroupKey = normalizeGroupKey(rawGroupKey);
            if (normalizedGroupKey == null) {
                continue;
            }
            boolean techGroup = isTechGroupKey(rawGroupKey);
            Map<String, Object> existing = groupsByKey.get(normalizedGroupKey);
            if (existing == null) {
                Map<String, Object> item = new LinkedHashMap<>();
                item.put("id", techGroup ? (canonicalTechGroupId == null ? asString(row.get("id")) : canonicalTechGroupId) : asString(row.get("id")));
                item.put("groupKey", normalizedGroupKey);
                item.put("groupName", techGroup ? GROUP_NAME_TECH_COLLAB : asString(row.get("group_name")));
                item.put("domainKey", techGroup ? "TECH" : asString(row.get("domain_key")));
                item.put("description", techGroup ? GROUP_DESC_TECH_COLLAB : asString(row.get("description")));
                item.put("sortOrder", asInt(row.get("sort_order"), 0));
                item.put("enabled", asBoolean(row.get("enabled"), true));
                groupsByKey.put(normalizedGroupKey, item);
                continue;
            }
            existing.put("sortOrder", Math.min(asInt(existing.get("sortOrder"), 0), asInt(row.get("sort_order"), 0)));
            existing.put("enabled", asBoolean(existing.get("enabled"), true) || asBoolean(row.get("enabled"), true));
        }

        List<Map<String, Object>> groups = new ArrayList<>();
        for (Map<String, Object> group : groupsByKey.values()) {
            String groupKey = asString(group.get("groupKey"));
            group.put("scenes", new ArrayList<>(scenesByGroupKey.getOrDefault(groupKey, List.of())));
            groups.add(group);
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
            "SELECT r.id, r.group_id, g.group_key, r.participant_role, r.source_type, r.source_ref_id, r.source_ref_name, " +
                "r.resolve_scope_type, r.resolve_scope_ref_id, r.duty_label, r.sort_order, r.enabled, r.remark " +
                "FROM sales_collab_template_rule r " +
                "JOIN sales_collab_group g ON g.id = r.group_id " +
                "WHERE r.template_id = ? ORDER BY r.group_id, r.sort_order, r.created_at",
            templateId
        );
        return groupRules(rows);
    }

    private Map<String, List<Map<String, Object>>> loadOrgRulesByGroup(String orgId) {
        List<Map<String, Object>> rows = jdbc.queryForList(
            "SELECT r.id, r.group_id, g.group_key, r.participant_role, r.source_type, r.source_ref_id, r.source_ref_name, " +
                "r.resolve_scope_type, r.resolve_scope_ref_id, r.duty_label, r.sort_order, r.enabled, r.remark " +
                "FROM sales_collab_org_rule r " +
                "JOIN sales_collab_group g ON g.id = r.group_id " +
                "WHERE r.org_id = ? ORDER BY r.group_id, r.sort_order, r.created_at",
            orgId
        );
        return groupRules(rows);
    }

    private Map<String, List<Map<String, Object>>> groupRules(List<Map<String, Object>> rows) {
        Map<String, List<Map<String, Object>>> result = new LinkedHashMap<>();
        Map<String, Map<String, Map<String, Object>>> dedupIndex = new LinkedHashMap<>();
        String canonicalTechGroupId = resolveCanonicalTechGroupId();
        for (Map<String, Object> row : rows) {
            String rawGroupId = asString(row.get("group_id"));
            String rawGroupKey = asString(row.get("group_key"));
            if (rawGroupId == null) {
                continue;
            }
            String targetGroupId = isTechGroupKey(rawGroupKey) && canonicalTechGroupId != null ? canonicalTechGroupId : rawGroupId;
            Map<String, Object> payload = toRulePayload(row);
            String signature = buildRuleSignature(payload);
            Map<String, Map<String, Object>> bySignature = dedupIndex.computeIfAbsent(targetGroupId, key -> new LinkedHashMap<>());
            Map<String, Object> existing = bySignature.get(signature);
            if (existing == null) {
                bySignature.put(signature, payload);
                result.computeIfAbsent(targetGroupId, key -> new ArrayList<>()).add(payload);
                continue;
            }
            existing.put("sortOrder", Math.min(asInt(existing.get("sortOrder"), 0), asInt(payload.get("sortOrder"), 0)));
            existing.put("enabled", asBoolean(existing.get("enabled"), true) || asBoolean(payload.get("enabled"), true));
        }
        result.values().forEach(rules -> rules.sort(Comparator.comparingInt(rule -> asInt(rule.get("sortOrder"), 0))));
        return result;
    }

    private boolean isTechGroupKey(String groupKey) {
        return GROUP_KEY_TECH_COLLAB.equals(groupKey)
            || GROUP_KEY_PRE_SALES_TECH.equals(groupKey)
            || GROUP_KEY_AFTER_SALES_TECH.equals(groupKey);
    }

    private String normalizeGroupKey(String groupKey) {
        return isTechGroupKey(groupKey) ? GROUP_KEY_TECH_COLLAB : groupKey;
    }

    private String resolveCanonicalTechGroupId() {
        List<Map<String, Object>> rows = jdbc.queryForList(
            "SELECT id, group_key FROM sales_collab_group WHERE group_key IN (?, ?, ?) " +
                "ORDER BY CASE WHEN group_key = ? THEN 0 WHEN group_key = ? THEN 1 ELSE 2 END",
            GROUP_KEY_TECH_COLLAB,
            GROUP_KEY_PRE_SALES_TECH,
            GROUP_KEY_AFTER_SALES_TECH,
            GROUP_KEY_TECH_COLLAB,
            GROUP_KEY_PRE_SALES_TECH
        );
        return resolveCanonicalTechGroupId(rows);
    }

    private String resolveCanonicalTechGroupId(List<Map<String, Object>> rows) {
        for (Map<String, Object> row : rows) {
            if (GROUP_KEY_TECH_COLLAB.equals(asString(row.get("group_key")))) {
                return asString(row.get("id"));
            }
        }
        for (Map<String, Object> row : rows) {
            if (GROUP_KEY_PRE_SALES_TECH.equals(asString(row.get("group_key")))) {
                return asString(row.get("id"));
            }
        }
        for (Map<String, Object> row : rows) {
            if (GROUP_KEY_AFTER_SALES_TECH.equals(asString(row.get("group_key")))) {
                return asString(row.get("id"));
            }
        }
        return null;
    }

    private String canonicalizeGroupId(String groupId) {
        if (groupId == null || groupId.isBlank()) {
            return groupId;
        }
        Map<String, Object> row = queryForMapOrNull("SELECT id, group_key FROM sales_collab_group WHERE id = ?", groupId);
        if (row == null) {
            return groupId;
        }
        String groupKey = asString(row.get("group_key"));
        if (!isTechGroupKey(groupKey)) {
            return groupId;
        }
        String canonicalTechGroupId = resolveCanonicalTechGroupId();
        return canonicalTechGroupId == null ? groupId : canonicalTechGroupId;
    }

    private Map<String, Object> queryCanonicalTechGroupRow() {
        return queryForMapOrNull(
            "SELECT id, group_key, group_name, domain_key FROM sales_collab_group " +
                "WHERE group_key IN (?, ?, ?) " +
                "ORDER BY CASE WHEN group_key = ? THEN 0 WHEN group_key = ? THEN 1 ELSE 2 END LIMIT 1",
            GROUP_KEY_TECH_COLLAB,
            GROUP_KEY_PRE_SALES_TECH,
            GROUP_KEY_AFTER_SALES_TECH,
            GROUP_KEY_TECH_COLLAB,
            GROUP_KEY_PRE_SALES_TECH
        );
    }

    private String resolveGroupKeyById(String groupId) {
        return groupId == null ? null : queryForStringOrNull("SELECT group_key FROM sales_collab_group WHERE id = ?", groupId);
    }

    private Map<String, Object> normalizeResolvedGroup(Map<String, Object> row) {
        if (row == null) {
            return null;
        }
        String groupKey = asString(row.get("group_key"));
        if (!isTechGroupKey(groupKey)) {
            return row;
        }
        Map<String, Object> item = new LinkedHashMap<>();
        item.put("id", canonicalizeGroupId(asString(row.get("id"))));
        item.put("group_key", GROUP_KEY_TECH_COLLAB);
        item.put("group_name", GROUP_NAME_TECH_COLLAB);
        item.put("domain_key", "TECH");
        return item;
    }

    private String buildRuleSignature(Map<String, Object> rule) {
        return String.join("|",
            safeSignatureValue(rule.get("sourceType")),
            safeSignatureValue(rule.get("sourceRefId")),
            safeSignatureValue(rule.get("sourceRefName")),
            safeSignatureValue(rule.get("resolveScopeType")),
            safeSignatureValue(rule.get("resolveScopeRefId")),
            safeSignatureValue(rule.get("enabled")),
            safeSignatureValue(rule.get("remark"))
        );
    }

    private String safeSignatureValue(Object value) {
        return value == null ? "" : String.valueOf(value);
    }

    private Map<String, Object> toRulePayload(Map<String, Object> row) {
        Map<String, Object> item = new LinkedHashMap<>();
        item.put("id", asString(row.get("id")));
        item.put("participantRole", COLLABORATOR_ROLE);
        item.put("sourceType", asString(row.get("source_type")));
        item.put("sourceRefId", asString(row.get("source_ref_id")));
        item.put("sourceRefName", asString(row.get("source_ref_name")));
        item.put("resolveScopeType", asString(row.get("resolve_scope_type")));
        item.put("resolveScopeRefId", asString(row.get("resolve_scope_ref_id")));
        item.put("sortOrder", asInt(row.get("sort_order"), 0));
        item.put("enabled", asBoolean(row.get("enabled"), true));
        item.put("remark", asString(row.get("remark")));
        return item;
    }

    private List<Map<String, Object>> loadOrgBindings() {
        List<Map<String, Object>> rows = jdbc.queryForList(
            "SELECT b.org_id, b.template_id, t.name AS template_name, b.enabled, b.remark, b.updated_at " +
                "FROM sales_collab_org_binding b " +
                "LEFT JOIN sales_collab_template t ON t.id = b.template_id " +
                "ORDER BY b.updated_at DESC, b.org_id"
        );
        List<Map<String, Object>> result = new ArrayList<>();
        for (Map<String, Object> row : rows) {
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("orgId", asString(row.get("org_id")));
            item.put("templateId", asString(row.get("template_id")));
            item.put("templateName", asString(row.get("template_name")));
            item.put("enabled", asBoolean(row.get("enabled"), true));
            item.put("remark", asString(row.get("remark")));
            item.put("updatedAt", row.get("updated_at") == null ? null : String.valueOf(row.get("updated_at")));
            result.add(item);
        }
        return result;
    }

    private Map<String, Object> loadOrgBinding(String orgId) {
        Map<String, Object> binding = queryForMapOrNull(
            "SELECT b.id, b.org_id, b.template_id, b.enabled, b.remark, b.updated_at, t.name AS template_name " +
                "FROM sales_collab_org_binding b LEFT JOIN sales_collab_template t ON t.id = b.template_id WHERE b.org_id = ?",
            orgId
        );
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("orgId", orgId);
        result.put("templateId", binding == null ? null : asString(binding.get("template_id")));
        result.put("templateName", binding == null ? null : asString(binding.get("template_name")));
        result.put("enabled", binding == null ? true : asBoolean(binding.get("enabled"), true));
        result.put("remark", binding == null ? null : asString(binding.get("remark")));
        result.put("updatedAt", binding == null || binding.get("updated_at") == null ? null : String.valueOf(binding.get("updated_at")));
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

    private Map<String, Object> resolveCollaborators(String orgId,
                                                     Map<String, Object> owner,
                                                     List<Map<String, Object>> rules) {
        LinkedHashMap<String, Map<String, Object>> collaborators = new LinkedHashMap<>();
        List<Map<String, Object>> unmatchedRules = new ArrayList<>();
        String salesOwnerUserId = owner == null ? null : asNullableString(owner.get("userId"));
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
                mergeCollaborator(collaborators, user, rule, salesOwnerUserId, "指定人员");
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
                    mergeCollaborator(collaborators, user, rule, salesOwnerUserId, "岗位解析");
                }
                continue;
            }
            if (SOURCE_TYPE_LEADER.equals(sourceType)) {
                List<Map<String, Object>> matchedUsers = resolveLeaderUsers(orgId, owner, rule);
                if (matchedUsers.isEmpty()) {
                    unmatchedRules.add(unmatchedRule(rule, "未匹配到领导人员"));
                    continue;
                }
                for (Map<String, Object> user : matchedUsers) {
                    mergeCollaborator(collaborators, user, rule, salesOwnerUserId, resolveLeaderScopeLabel(rule));
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
                                   String salesOwnerUserId,
                                   String resolvedBy) {
        String userId = asString(user.get("userId"));
        if (userId == null || Objects.equals(userId, salesOwnerUserId)) {
            return;
        }
        Map<String, Object> existing = collaborators.get(userId);
        if (existing == null) {
            Map<String, Object> item = new LinkedHashMap<>();
            item.putAll(user);
            item.put("participantRole", COLLABORATOR_ROLE);
            item.put("sourceType", asString(rule.get("sourceType")));
            item.put("sourceRefName", asString(rule.get("sourceRefName")));
            item.put("resolvedBy", resolvedBy);
            collaborators.put(userId, item);
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

    private List<Map<String, Object>> resolveLeaderUsers(String orgId,
                                                         Map<String, Object> owner,
                                                         Map<String, Object> rule) {
        String ownerUserId = owner == null ? null : asNullableString(owner.get("userId"));
        String scopeType = asNullableString(rule.get("resolveScopeType"));
        List<String> candidateOrgIds = resolveLeaderOrgIds(orgId, owner, rule);
        if (candidateOrgIds.isEmpty()) {
            return List.of();
        }
        Map<String, Map<String, Object>> result = new LinkedHashMap<>();
        for (String candidateOrgId : candidateOrgIds) {
            for (Map<String, Object> leader : loadLeaderUsersByOrg(candidateOrgId, ownerUserId)) {
                String userId = asString(leader.get("userId"));
                if (userId != null) {
                    result.putIfAbsent(userId, leader);
                }
            }
        }
        if ((SCOPE_CURRENT_REGION.equals(scopeType) || SCOPE_FIXED_ORG.equals(scopeType)) && !candidateOrgIds.isEmpty()) {
            String terminalOrgId = candidateOrgIds.get(candidateOrgIds.size() - 1);
            if (loadLeaderUsersByOrg(terminalOrgId, ownerUserId).isEmpty()) {
                String parentOrgId = findParentOrgId(terminalOrgId);
                Set<String> visited = new LinkedHashSet<>(candidateOrgIds);
                while (parentOrgId != null && visited.add(parentOrgId)) {
                    List<Map<String, Object>> fallbackLeaders = loadLeaderUsersByOrg(parentOrgId, ownerUserId);
                    if (!fallbackLeaders.isEmpty()) {
                        for (Map<String, Object> leader : fallbackLeaders) {
                            String userId = asString(leader.get("userId"));
                            if (userId != null) {
                                result.putIfAbsent(userId, leader);
                            }
                        }
                        break;
                    }
                    parentOrgId = findParentOrgId(parentOrgId);
                }
            }
        }
        return new ArrayList<>(result.values());
    }

    private String resolveLeaderScopeLabel(Map<String, Object> rule) {
        String scopeType = asNullableString(rule.get("resolveScopeType"));
        if (scopeType == null || scopeType.isBlank() || SCOPE_CURRENT_DEPT.equals(scopeType)) {
            return "当前销售部门领导";
        }
        if (SCOPE_CURRENT_REGION.equals(scopeType)) {
            return "销售大区领导链";
        }
        if (SCOPE_FIXED_ORG.equals(scopeType)) {
            return "固定组织领导链";
        }
        return "领导解析";
    }

    private List<String> resolveLeaderOrgIds(String orgId,
                                             Map<String, Object> owner,
                                             Map<String, Object> rule) {
        String ownerOrgId = owner == null ? null : asNullableString(owner.get("orgId"));
        String baseOrgId = ownerOrgId == null ? orgId : ownerOrgId;
        String scopeType = asNullableString(rule.get("resolveScopeType"));
        if (scopeType == null || scopeType.isBlank() || SCOPE_CURRENT_DEPT.equals(scopeType)) {
            return baseOrgId == null ? List.of() : List.of(baseOrgId);
        }
        if (SCOPE_CURRENT_REGION.equals(scopeType)) {
            String regionRootId = findSalesRegionRootOrgId(baseOrgId);
            return collectOrgPathIds(baseOrgId, regionRootId == null ? baseOrgId : regionRootId);
        }
        if (SCOPE_FIXED_ORG.equals(scopeType)) {
            String fixedOrgId = asNullableString(rule.get("resolveScopeRefId"));
            List<String> orgIds = collectOrgPathIds(baseOrgId, fixedOrgId);
            if (fixedOrgId != null && orgIds.contains(fixedOrgId) && loadLeaderUsersByOrg(fixedOrgId, null).isEmpty()) {
                String fallbackOrgId = findNearestLeaderAncestor(fixedOrgId);
                if (fallbackOrgId != null && !orgIds.contains(fallbackOrgId)) {
                    orgIds = new ArrayList<>(orgIds);
                    orgIds.add(fallbackOrgId);
                }
            }
            return orgIds;
        }
        return baseOrgId == null ? List.of() : List.of(baseOrgId);
    }

    private List<String> collectOrgPathIds(String startOrgId, String targetOrgId) {
        if (startOrgId == null || startOrgId.isBlank()) {
            return List.of();
        }
        List<String> result = new ArrayList<>();
        String currentOrgId = startOrgId;
        Set<String> visited = new LinkedHashSet<>();
        while (currentOrgId != null && visited.add(currentOrgId)) {
            result.add(currentOrgId);
            if (Objects.equals(currentOrgId, targetOrgId)) {
                return result;
            }
            currentOrgId = findParentOrgId(currentOrgId);
        }
        if (targetOrgId != null && !targetOrgId.isBlank()) {
            return List.of(targetOrgId);
        }
        return result;
    }

    private List<Map<String, Object>> loadLeaderUsersByOrg(String orgId,
                                                           String excludedUserId) {
        if (orgId == null || orgId.isBlank()) {
            return List.of();
        }
        List<Map<String, Object>> rows = jdbc.queryForList(
            "SELECT su.id, su.name, su.org_id, o.name AS org_name, su.role, p.name AS primary_position_name, " +
                "COALESCE(string_agg(DISTINCT p2.name, '、') FILTER (WHERE p2.name IS NOT NULL), '') AS extra_position_names " +
                "FROM sys_user su " +
                "LEFT JOIN organization o ON o.id = su.org_id " +
                "LEFT JOIN position p ON p.id = su.primary_position_id " +
                "LEFT JOIN user_position up ON up.user_id = su.id " +
                "LEFT JOIN position p2 ON p2.id = up.position_id " +
                "WHERE su.org_id = ? " +
                "GROUP BY su.id, su.name, su.org_id, o.name, su.role, p.name " +
                "ORDER BY su.name",
            orgId
        );
        List<Map<String, Object>> result = new ArrayList<>();
        for (Map<String, Object> row : rows) {
            String userId = asString(row.get("id"));
            if (Objects.equals(userId, excludedUserId)) {
                continue;
            }
            String role = asString(row.get("role"));
            String positionName = asString(row.get("primary_position_name"));
            String extraPositionNames = asString(row.get("extra_position_names"));
            if (!isLeaderCandidate(positionName, extraPositionNames, role)) {
                continue;
            }
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("userId", userId);
            item.put("name", asString(row.get("name")));
            item.put("orgId", asString(row.get("org_id")));
            item.put("orgName", asString(row.get("org_name")));
            result.add(item);
        }
        return result;
    }

    private String findNearestLeaderAncestor(String orgId) {
        String currentOrgId = findParentOrgId(orgId);
        Set<String> visited = new LinkedHashSet<>();
        while (currentOrgId != null && visited.add(currentOrgId)) {
            if (!loadLeaderUsersByOrg(currentOrgId, null).isEmpty()) {
                return currentOrgId;
            }
            currentOrgId = findParentOrgId(currentOrgId);
        }
        return null;
    }

    private String findParentOrgId(String orgId) {
        return queryForStringOrNull("SELECT parent_id FROM organization WHERE id = ?", orgId);
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
            return normalizeResolvedGroup(queryForMapOrNull(
                "SELECT id, group_key, group_name, domain_key FROM sales_collab_group WHERE id = ?",
                canonicalizeGroupId(groupId)
            ));
        }
        if (groupKey != null && !groupKey.isBlank()) {
            if (isTechGroupKey(groupKey)) {
                return normalizeResolvedGroup(queryCanonicalTechGroupRow());
            }
            return normalizeResolvedGroup(queryForMapOrNull(
                "SELECT id, group_key, group_name, domain_key FROM sales_collab_group WHERE group_key = ?",
                groupKey
            ));
        }
        if (sceneKey != null && !sceneKey.isBlank()) {
            return normalizeResolvedGroup(queryForMapOrNull(
                "SELECT g.id, g.group_key, g.group_name, g.domain_key " +
                    "FROM sales_collab_group g " +
                    "JOIN sales_collab_group_scene gs ON gs.group_id = g.id " +
                    "JOIN sales_collab_scene s ON s.id = gs.scene_id " +
                    "WHERE s.scene_key = ? " +
                    "ORDER BY CASE WHEN g.group_key = ? THEN 0 WHEN g.group_key = ? THEN 1 WHEN g.group_key = ? THEN 2 ELSE 3 END " +
                    "LIMIT 1",
                sceneKey,
                GROUP_KEY_TECH_COLLAB,
                GROUP_KEY_PRE_SALES_TECH,
                GROUP_KEY_AFTER_SALES_TECH
            ));
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

    private void insertDefaultManagementSyncRules(String templateId) {
        String managementGroupId = queryForStringOrNull(
            "SELECT id FROM sales_collab_group WHERE group_key = ? LIMIT 1",
            GROUP_KEY_MANAGEMENT_SYNC
        );
        if (managementGroupId == null) {
            return;
        }
        insertTemplateRule(templateId, managementGroupId, managementSyncLeaderRule(SCOPE_CURRENT_DEPT, null, MANAGEMENT_SYNC_CURRENT_DEPT_SORT));
        insertTemplateRule(templateId, managementGroupId, managementSyncLeaderRule(SCOPE_CURRENT_REGION, null, MANAGEMENT_SYNC_CURRENT_REGION_SORT));
        String salesSystemOrgId = queryForStringOrNull("SELECT id FROM organization WHERE name = ? LIMIT 1", SALES_SYSTEM_NAME);
        if (salesSystemOrgId != null) {
            insertTemplateRule(templateId, managementGroupId, managementSyncLeaderRule(SCOPE_FIXED_ORG, salesSystemOrgId, MANAGEMENT_SYNC_FIXED_SYSTEM_SORT));
        }
    }

    private Map<String, Object> managementSyncLeaderRule(String scopeType, String scopeRefId, int sortOrder) {
        Map<String, Object> rule = new LinkedHashMap<>();
        rule.put("sourceType", SOURCE_TYPE_LEADER);
        rule.put("sourceRefName", "领导");
        rule.put("resolveScopeType", scopeType);
        rule.put("resolveScopeRefId", scopeRefId);
        rule.put("sortOrder", sortOrder);
        rule.put("enabled", true);
        return rule;
    }

    private void insertTemplateRule(String templateId, String groupId, Map<String, Object> rule) {
        String sourceType = requireText(rule.get("sourceType"), "规则来源类型不能为空");
        String sourceRefId = asNullableString(rule.get("sourceRefId"));
        String targetGroupId = canonicalizeGroupId(groupId);
        String targetGroupKey = resolveGroupKeyById(targetGroupId);
        if (GROUP_KEY_MANAGEMENT_SYNC.equals(targetGroupKey)
            && !SOURCE_TYPE_LEADER.equals(sourceType)
            && !SOURCE_TYPE_USER.equals(sourceType)) {
            throw new IllegalArgumentException("管理沟通协同仅支持按领导或指定人员配置");
        }
        String resolveScopeType = asNullableString(rule.get("resolveScopeType"));
        String resolveScopeRefId = asNullableString(rule.get("resolveScopeRefId"));
        if (GROUP_KEY_MANAGEMENT_SYNC.equals(targetGroupKey) && SOURCE_TYPE_LEADER.equals(sourceType)) {
            if (resolveScopeType == null || resolveScopeType.isBlank()) {
                resolveScopeType = SCOPE_CURRENT_DEPT;
            }
            if (SCOPE_FIXED_ORG.equals(resolveScopeType) && (resolveScopeRefId == null || resolveScopeRefId.isBlank())) {
                resolveScopeRefId = queryForStringOrNull("SELECT id FROM organization WHERE name = ? LIMIT 1", SALES_SYSTEM_NAME);
            }
        }
        String sourceRefName = resolveSourceRefName(sourceType, sourceRefId, asNullableString(rule.get("sourceRefName")));
        jdbc.update(
            "INSERT INTO sales_collab_template_rule (id, template_id, group_id, participant_role, source_type, source_ref_id, source_ref_name, resolve_scope_type, resolve_scope_ref_id, duty_label, sort_order, enabled, remark) " +
                "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            UUID.randomUUID().toString(),
            templateId,
            targetGroupId,
            COLLABORATOR_ROLE,
            sourceType,
            sourceRefId,
            sourceRefName,
            resolveScopeType,
            resolveScopeRefId,
            null,
            asInt(rule.get("sortOrder"), 0),
            asBoolean(rule.get("enabled"), true),
            asNullableString(rule.get("remark"))
        );
    }

    private void insertOrgRule(String orgId, String groupId, Map<String, Object> rule) {
        String sourceType = requireText(rule.get("sourceType"), "规则来源类型不能为空");
        String sourceRefId = asNullableString(rule.get("sourceRefId"));
        String targetGroupId = canonicalizeGroupId(groupId);
        String targetGroupKey = resolveGroupKeyById(targetGroupId);
        if (GROUP_KEY_MANAGEMENT_SYNC.equals(targetGroupKey)
            && !SOURCE_TYPE_LEADER.equals(sourceType)
            && !SOURCE_TYPE_USER.equals(sourceType)) {
            throw new IllegalArgumentException("管理沟通协同仅支持按领导或指定人员配置");
        }
        String resolveScopeType = asNullableString(rule.get("resolveScopeType"));
        String resolveScopeRefId = asNullableString(rule.get("resolveScopeRefId"));
        if (GROUP_KEY_MANAGEMENT_SYNC.equals(targetGroupKey) && SOURCE_TYPE_LEADER.equals(sourceType)) {
            if (resolveScopeType == null || resolveScopeType.isBlank()) {
                resolveScopeType = SCOPE_CURRENT_DEPT;
            }
            if (SCOPE_FIXED_ORG.equals(resolveScopeType) && (resolveScopeRefId == null || resolveScopeRefId.isBlank())) {
                resolveScopeRefId = queryForStringOrNull("SELECT id FROM organization WHERE name = ? LIMIT 1", SALES_SYSTEM_NAME);
            }
        }
        String sourceRefName = resolveSourceRefName(sourceType, sourceRefId, asNullableString(rule.get("sourceRefName")));
        jdbc.update(
            "INSERT INTO sales_collab_org_rule (id, org_id, group_id, participant_role, source_type, source_ref_id, source_ref_name, resolve_scope_type, resolve_scope_ref_id, duty_label, sort_order, enabled, remark) " +
                "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            UUID.randomUUID().toString(),
            orgId,
            targetGroupId,
            COLLABORATOR_ROLE,
            sourceType,
            sourceRefId,
            sourceRefName,
            resolveScopeType,
            resolveScopeRefId,
            null,
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
        if ("STAFF".equals(role)) {
            return false;
        }
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
