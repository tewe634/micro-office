package com.microoffice.controller;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.microoffice.dto.response.ApiResponse;
import com.microoffice.service.MenuPermissionService;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.EmptyResultDataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.util.ArrayList;
import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.regex.Pattern;

@RestController
@RequestMapping("/api/admin/portal-templates")
@RequiredArgsConstructor
public class PortalTemplateAdminController {
    private static final TypeReference<LinkedHashMap<String, Object>> MAP_TYPE = new TypeReference<>() {};
    private static final TypeReference<List<Map<String, Object>>> LIST_OF_MAP_TYPE = new TypeReference<>() {};
    private static final List<String> TEMPLATE_TYPES = List.of("PERSON_ROLE", "PRODUCT", "CUSTOMER_COMPANY", "SUPPLIER", "CARRIER", "BANK", "ORGANIZATION");
    private static final List<String> ROLE_KEYS = List.of("SALES", "FINANCE", "HR");
    private static final List<String> TEMPLATE_STATUS = List.of("DRAFT", "ACTIVE", "INACTIVE");
    private static final List<String> SECTION_TYPES = List.of("BLOCK");
    private static final List<String> DISPLAY_TYPES = List.of("STAT", "LIST", "CARD", "TEXT");
    private static final List<String> ACTION_TYPES = List.of("switch_subject", "open_workbench_session");
    private static final List<String> SUBJECT_TYPES = List.of("PERSON", "ORGANIZATION", "PRODUCT", "CUSTOMER_COMPANY", "SUPPLIER", "CARRIER", "BANK");
    private static final List<String> SESSION_TYPES = List.of("DAILY_ENTRY", "SUPPLIER", "CARRIER", "BANK", "PRODUCT", "CUSTOMER_COMPANY", "ORGANIZATION", "PERSON");
    private static final Pattern NON_CODE_PATTERN = Pattern.compile("[^A-Z0-9_]+");

    private final JdbcTemplate jdbc;
    private final MenuPermissionService menuPermissionService;
    private final ObjectMapper objectMapper;

    @GetMapping("/meta")
    public ApiResponse<Map<String, Object>> meta(Authentication auth) {
        requireAdmin(auth);
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("templateTypes", buildOptions(TEMPLATE_TYPES, Map.of(
            "PERSON_ROLE", "人员岗位门户",
            "PRODUCT", "产品门户",
            "CUSTOMER_COMPANY", "客户公司门户",
            "SUPPLIER", "供应商门户",
            "CARRIER", "承运商门户",
            "BANK", "银行门户",
            "ORGANIZATION", "组织门户"
        )));
        result.put("roleKeys", buildOptions(ROLE_KEYS, Map.of(
            "SALES", "销售",
            "FINANCE", "财务",
            "HR", "人事 / 行政"
        )));
        result.put("statusOptions", buildOptions(TEMPLATE_STATUS, Map.of(
            "DRAFT", "草稿",
            "ACTIVE", "启用",
            "INACTIVE", "停用"
        )));
        result.put("sectionTypes", buildOptions(SECTION_TYPES, Map.of("BLOCK", "区块")));
        result.put("displayTypes", buildOptions(DISPLAY_TYPES, Map.of(
            "STAT", "统计",
            "LIST", "列表",
            "CARD", "卡片",
            "TEXT", "文本"
        )));
        result.put("actionTypes", buildOptions(ACTION_TYPES, Map.of(
            "switch_subject", "切换主体",
            "open_workbench_session", "打开工作台会话"
        )));
        result.put("subjectTypes", buildOptions(SUBJECT_TYPES, Map.of(
            "PERSON", "人员",
            "ORGANIZATION", "组织",
            "PRODUCT", "产品",
            "CUSTOMER_COMPANY", "客户公司",
            "SUPPLIER", "供应商",
            "CARRIER", "承运商",
            "BANK", "银行"
        )));
        result.put("sessionTypes", buildOptions(SESSION_TYPES, Map.of(
            "DAILY_ENTRY", "日常入口",
            "SUPPLIER", "供应商",
            "CARRIER", "承运商",
            "BANK", "银行",
            "PRODUCT", "产品",
            "CUSTOMER_COMPANY", "客户公司",
            "ORGANIZATION", "组织",
            "PERSON", "人员"
        )));
        return ApiResponse.ok(result);
    }

    @GetMapping("/positions")
    public ApiResponse<List<Map<String, Object>>> positions(Authentication auth) {
        requireAdmin(auth);
        return ApiResponse.ok(loadPositionTargets());
    }

    @GetMapping("/templates")
    public ApiResponse<List<Map<String, Object>>> templates(Authentication auth) {
        requireAdmin(auth);
        return ApiResponse.ok(loadTemplateSummaries());
    }

    @GetMapping("/templates/{id}")
    public ApiResponse<Map<String, Object>> template(@PathVariable String id, Authentication auth) {
        requireAdmin(auth);
        return ApiResponse.ok(loadTemplateDetail(id));
    }

    @PostMapping("/generate-by-position")
    @Transactional
    public ApiResponse<Map<String, Object>> generateByPosition(@RequestBody Map<String, Object> body, Authentication auth) {
        String currentUserId = requireAdmin(auth);
        String positionId = requireText(body.get("positionId"), "岗位不能为空");
        Map<String, Object> position = loadPosition(positionId);
        String existingTemplateId = loadPositionTemplateId(positionId);
        if (hasText(existingTemplateId)) {
            return ApiResponse.ok(loadTemplateDetail(existingTemplateId));
        }

        String positionName = asString(position.get("name"));
        String positionCode = asString(position.get("code"));
        String derivedRole = recommendedRole(
            asString(position.get("defaultRole")),
            positionCode,
            positionName
        );
        Map<String, Object> seedTemplate = loadSeedTemplate(derivedRole);

        String templateId = UUID.randomUUID().toString();
        String templateCode = buildUniqueGeneratedCode(positionCode, positionId);
        Map<String, Object> meta = new LinkedHashMap<>();
        if (seedTemplate != null) {
            meta.putAll(asMap(seedTemplate.get("meta")));
        }
        meta.putIfAbsent("page_kind", "PORTAL");
        meta.putIfAbsent("layout_version", "FIX1.1.8");
        meta.put("generatedFrom", "POSITION");
        meta.put("positionId", positionId);
        meta.put("positionCode", positionCode);
        meta.put("positionName", positionName);
        if (hasText(derivedRole)) {
            meta.put("derivedRole", derivedRole);
        }
        if (seedTemplate != null) {
            meta.put("seedTemplateId", seedTemplate.get("id"));
            meta.put("seedTemplateCode", seedTemplate.get("code"));
            meta.put("seedTemplateName", seedTemplate.get("name"));
        }

        jdbc.update(
            "INSERT INTO mo_portal_templates (id, code, name, template_type, role_key, status, version, meta, created_by, updated_by) " +
                "VALUES (?, ?, ?, 'PERSON_ROLE', ?, 'ACTIVE', 1, CAST(? AS jsonb), ?, ?)",
            templateId,
            templateCode,
            positionName + "门户模板",
            derivedRole,
            toJson(meta),
            currentUserId,
            currentUserId
        );

        if (seedTemplate != null) {
            saveTemplateSections(
                templateId,
                cloneSections(asListOfMap(loadTemplateDetail(asString(seedTemplate.get("id"))).get("sections"))),
                currentUserId
            );
        }
        return ApiResponse.ok(loadTemplateDetail(templateId));
    }

    @PostMapping("/templates")
    @Transactional
    public ApiResponse<Map<String, Object>> createTemplate(@RequestBody Map<String, Object> body, Authentication auth) {
        String currentUserId = requireAdmin(auth);
        String id = UUID.randomUUID().toString();
        String code = requireText(body.get("code"), "模板编码不能为空");
        ensureCodeUnique(code, null);
        String name = requireText(body.get("name"), "模板名称不能为空");
        String templateType = normalizeAllowed(body.get("templateType"), TEMPLATE_TYPES, false, "模板类型不合法");
        String roleKey = normalizeAllowed(body.get("roleKey"), ROLE_KEYS, true, "角色标识不合法");
        String status = normalizeAllowed(body.get("status"), TEMPLATE_STATUS, true, "模板状态不合法");
        Map<String, Object> meta = asMap(body.get("meta"));
        int version = asInt(body.get("version"), 1);

        if (!"PERSON_ROLE".equals(templateType)) {
            roleKey = null;
        }
        if (!hasText(status)) {
            status = "DRAFT";
        }

        jdbc.update(
            "INSERT INTO mo_portal_templates (id, code, name, template_type, role_key, status, version, meta, created_by, updated_by) " +
                "VALUES (?, ?, ?, ?, ?, ?, ?, CAST(? AS jsonb), ?, ?)",
            id,
            code,
            name,
            templateType,
            roleKey,
            status,
            version,
            toJson(meta),
            currentUserId,
            currentUserId
        );
        saveTemplateSections(id, asListOfMap(body.get("sections")), currentUserId);
        return ApiResponse.ok(loadTemplateDetail(id));
    }

    @PutMapping("/templates/{id}")
    @Transactional
    public ApiResponse<Map<String, Object>> updateTemplate(@PathVariable String id,
                                                           @RequestBody Map<String, Object> body,
                                                           Authentication auth) {
        String currentUserId = requireAdmin(auth);
        loadTemplateDetail(id);

        String code = requireText(body.get("code"), "模板编码不能为空");
        ensureCodeUnique(code, id);
        String name = requireText(body.get("name"), "模板名称不能为空");
        String templateType = normalizeAllowed(body.get("templateType"), TEMPLATE_TYPES, false, "模板类型不合法");
        String roleKey = normalizeAllowed(body.get("roleKey"), ROLE_KEYS, true, "角色标识不合法");
        String status = normalizeAllowed(body.get("status"), TEMPLATE_STATUS, true, "模板状态不合法");
        Map<String, Object> meta = asMap(body.get("meta"));
        int version = asInt(body.get("version"), 1);

        if (!"PERSON_ROLE".equals(templateType)) {
            roleKey = null;
        }
        if (!hasText(status)) {
            status = "DRAFT";
        }

        jdbc.update(
            "UPDATE mo_portal_templates SET code = ?, name = ?, template_type = ?, role_key = ?, status = ?, version = ?, meta = CAST(? AS jsonb), updated_at = NOW(), updated_by = ? WHERE id = ?",
            code,
            name,
            templateType,
            roleKey,
            status,
            version,
            toJson(meta),
            currentUserId,
            id
        );
        saveTemplateSections(id, asListOfMap(body.get("sections")), currentUserId);
        return ApiResponse.ok(loadTemplateDetail(id));
    }

    @DeleteMapping("/templates/{id}")
    @Transactional
    public ApiResponse<Void> deleteTemplate(@PathVariable String id, Authentication auth) {
        requireAdmin(auth);
        jdbc.update("DELETE FROM mo_portal_templates WHERE id = ?", id);
        return ApiResponse.ok(null);
    }

    private String requireAdmin(Authentication auth) {
        String currentUserId = (String) auth.getPrincipal();
        menuPermissionService.requireMenu(currentUserId, "/admin");
        return currentUserId;
    }

    private List<Map<String, Object>> loadPositionTargets() {
        List<Map<String, Object>> rows = jdbc.queryForList(
            "SELECT p.id, p.name, p.code, COALESCE(p.default_role, '') AS default_role, " +
                "tpl.id AS template_id, tpl.name AS template_name, tpl.code AS template_code, tpl.role_key AS template_role_key, tpl.updated_at AS template_updated_at " +
                "FROM position p " +
                "LEFT JOIN LATERAL (" +
                "  SELECT t.id, t.name, t.code, t.role_key, t.updated_at " +
                "  FROM mo_portal_templates t " +
                "  WHERE t.template_type = 'PERSON_ROLE' AND COALESCE(t.meta ->> 'positionId', '') = p.id " +
                "  ORDER BY t.updated_at DESC, t.created_at DESC LIMIT 1" +
                ") tpl ON TRUE " +
                "ORDER BY p.name, p.id"
        );
        Map<String, Map<String, Object>> seedByRole = loadSeedTemplateByRole();
        List<Map<String, Object>> result = new ArrayList<>();
        for (Map<String, Object> row : rows) {
            String derivedRole = recommendedRole(asString(row.get("default_role")), asString(row.get("code")), asString(row.get("name")));
            Map<String, Object> seed = derivedRole == null ? null : seedByRole.get(derivedRole);
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("positionId", asString(row.get("id")));
            item.put("positionName", asString(row.get("name")));
            item.put("positionCode", asString(row.get("code")));
            item.put("defaultRole", blankToNull(asString(row.get("default_role"))));
            item.put("recommendedRole", derivedRole);
            item.put("templateId", asString(row.get("template_id")));
            item.put("templateName", asString(row.get("template_name")));
            item.put("templateCode", asString(row.get("template_code")));
            item.put("templateRoleKey", asString(row.get("template_role_key")));
            item.put("templateUpdatedAt", row.get("template_updated_at"));
            if (seed != null) {
                item.put("seedTemplateId", seed.get("id"));
                item.put("seedTemplateName", seed.get("name"));
                item.put("seedTemplateCode", seed.get("code"));
            }
            result.add(item);
        }
        return result;
    }

    private Map<String, Map<String, Object>> loadSeedTemplateByRole() {
        List<Map<String, Object>> rows = jdbc.queryForList(
            "SELECT id, code, name, role_key, meta, updated_at, created_at " +
                "FROM mo_portal_templates " +
                "WHERE template_type = 'PERSON_ROLE' AND status = 'ACTIVE' AND COALESCE(meta ->> 'positionId', '') = '' " +
                "ORDER BY updated_at DESC, created_at DESC"
        );
        Map<String, Map<String, Object>> result = new LinkedHashMap<>();
        for (Map<String, Object> row : rows) {
            String roleKey = asString(row.get("role_key"));
            if (!hasText(roleKey) || result.containsKey(roleKey)) {
                continue;
            }
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("id", asString(row.get("id")));
            item.put("code", asString(row.get("code")));
            item.put("name", asString(row.get("name")));
            item.put("roleKey", roleKey);
            item.put("meta", toJsonMap(row.get("meta")));
            result.put(roleKey, item);
        }
        return result;
    }

    private Map<String, Object> loadSeedTemplate(String roleKey) {
        if (!hasText(roleKey)) {
            return null;
        }
        try {
            Map<String, Object> row = jdbc.queryForMap(
                "SELECT id, code, name, role_key, status, version, meta, created_at, updated_at " +
                    "FROM mo_portal_templates " +
                    "WHERE template_type = 'PERSON_ROLE' AND status = 'ACTIVE' AND role_key = ? AND COALESCE(meta ->> 'positionId', '') = '' " +
                    "ORDER BY updated_at DESC, created_at DESC LIMIT 1",
                roleKey
            );
            Map<String, Object> result = new LinkedHashMap<>();
            result.put("id", asString(row.get("id")));
            result.put("code", asString(row.get("code")));
            result.put("name", asString(row.get("name")));
            result.put("roleKey", asString(row.get("role_key")));
            result.put("status", asString(row.get("status")));
            result.put("version", asInt(row.get("version"), 1));
            result.put("meta", toJsonMap(row.get("meta")));
            return result;
        } catch (EmptyResultDataAccessException ignore) {
            return null;
        }
    }

    private List<Map<String, Object>> loadTemplateSummaries() {
        List<Map<String, Object>> rows = jdbc.queryForList(
            "SELECT t.id, t.code, t.name, t.template_type, t.role_key, t.status, t.version, t.meta, t.created_at, t.updated_at, " +
                "COALESCE((SELECT COUNT(*) FROM mo_portal_template_sections s WHERE s.template_id = t.id), 0) AS section_count, " +
                "COALESCE((SELECT COUNT(*) FROM mo_portal_template_items i WHERE i.template_id = t.id), 0) AS item_count, " +
                "COALESCE((SELECT COUNT(*) FROM mo_portal_template_item_actions a WHERE a.template_id = t.id), 0) AS action_count " +
                "FROM mo_portal_templates t " +
                "ORDER BY CASE WHEN COALESCE(t.meta ->> 'positionId', '') <> '' THEN 0 ELSE 1 END, COALESCE(t.meta ->> 'positionName', t.name), t.updated_at DESC, t.created_at DESC"
        );
        List<Map<String, Object>> result = new ArrayList<>();
        for (Map<String, Object> row : rows) {
            Map<String, Object> meta = toJsonMap(row.get("meta"));
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("id", asString(row.get("id")));
            item.put("code", asString(row.get("code")));
            item.put("name", asString(row.get("name")));
            item.put("templateType", asString(row.get("template_type")));
            item.put("roleKey", asString(row.get("role_key")));
            item.put("status", asString(row.get("status")));
            item.put("version", asInt(row.get("version"), 1));
            item.put("meta", meta);
            item.put("createdAt", row.get("created_at"));
            item.put("updatedAt", row.get("updated_at"));
            item.put("sectionCount", asInt(row.get("section_count"), 0));
            item.put("itemCount", asInt(row.get("item_count"), 0));
            item.put("actionCount", asInt(row.get("action_count"), 0));
            item.put("positionId", asString(meta.get("positionId")));
            item.put("positionName", asString(meta.get("positionName")));
            item.put("generatedFrom", asString(meta.get("generatedFrom")));
            result.add(item);
        }
        return result;
    }

    private Map<String, Object> loadTemplateDetail(String id) {
        Map<String, Object> template;
        try {
            template = jdbc.queryForMap(
                "SELECT id, code, name, template_type, role_key, status, version, meta, created_at, created_by, updated_at, updated_by FROM mo_portal_templates WHERE id = ?",
                id
            );
        } catch (EmptyResultDataAccessException ex) {
            throw new IllegalArgumentException("模板不存在");
        }

        List<Map<String, Object>> sectionRows = jdbc.queryForList(
            "SELECT id, template_id, code, name, section_type, sort_order, meta, created_at, created_by, updated_at, updated_by " +
                "FROM mo_portal_template_sections WHERE template_id = ? ORDER BY sort_order, code, id",
            id
        );
        List<Map<String, Object>> itemRows = jdbc.queryForList(
            "SELECT id, template_id, section_id, item_key, label, data_key, display_type, sort_order, meta, created_at, created_by, updated_at, updated_by " +
                "FROM mo_portal_template_items WHERE template_id = ? ORDER BY section_id, sort_order, item_key, id",
            id
        );
        List<Map<String, Object>> actionRows = jdbc.queryForList(
            "SELECT id, template_id, item_id, action_type, target_subject_type, target_id_path, session_type, meta, created_at, created_by, updated_at, updated_by " +
                "FROM mo_portal_template_item_actions WHERE template_id = ? ORDER BY item_id, action_type, id",
            id
        );

        Map<String, List<Map<String, Object>>> actionsByItemId = new LinkedHashMap<>();
        for (Map<String, Object> row : actionRows) {
            String itemId = asString(row.get("item_id"));
            actionsByItemId.computeIfAbsent(itemId, key -> new ArrayList<>()).add(toActionMap(row));
        }

        Map<String, List<Map<String, Object>>> itemsBySectionId = new LinkedHashMap<>();
        for (Map<String, Object> row : itemRows) {
            String sectionId = asString(row.get("section_id"));
            Map<String, Object> item = toItemMap(row);
            item.put("actions", actionsByItemId.getOrDefault(asString(row.get("id")), List.of()));
            itemsBySectionId.computeIfAbsent(sectionId, key -> new ArrayList<>()).add(item);
        }

        List<Map<String, Object>> sections = new ArrayList<>();
        for (Map<String, Object> row : sectionRows) {
            Map<String, Object> section = toSectionMap(row);
            section.put("items", itemsBySectionId.getOrDefault(asString(row.get("id")), List.of()));
            sections.add(section);
        }

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("id", asString(template.get("id")));
        result.put("code", asString(template.get("code")));
        result.put("name", asString(template.get("name")));
        result.put("templateType", asString(template.get("template_type")));
        result.put("roleKey", asString(template.get("role_key")));
        result.put("status", asString(template.get("status")));
        result.put("version", asInt(template.get("version"), 1));
        result.put("meta", toJsonMap(template.get("meta")));
        result.put("createdAt", template.get("created_at"));
        result.put("createdBy", asString(template.get("created_by")));
        result.put("updatedAt", template.get("updated_at"));
        result.put("updatedBy", asString(template.get("updated_by")));
        result.put("sections", sections);
        return result;
    }

    private Map<String, Object> toSectionMap(Map<String, Object> row) {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("id", asString(row.get("id")));
        result.put("templateId", asString(row.get("template_id")));
        result.put("code", asString(row.get("code")));
        result.put("name", asString(row.get("name")));
        result.put("sectionType", asString(row.get("section_type")));
        result.put("sortOrder", asInt(row.get("sort_order"), 0));
        result.put("meta", toJsonMap(row.get("meta")));
        result.put("createdAt", row.get("created_at"));
        result.put("createdBy", asString(row.get("created_by")));
        result.put("updatedAt", row.get("updated_at"));
        result.put("updatedBy", asString(row.get("updated_by")));
        return result;
    }

    private Map<String, Object> toItemMap(Map<String, Object> row) {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("id", asString(row.get("id")));
        result.put("templateId", asString(row.get("template_id")));
        result.put("sectionId", asString(row.get("section_id")));
        result.put("itemKey", asString(row.get("item_key")));
        result.put("label", asString(row.get("label")));
        result.put("dataKey", asString(row.get("data_key")));
        result.put("displayType", asString(row.get("display_type")));
        result.put("sortOrder", asInt(row.get("sort_order"), 0));
        result.put("meta", toJsonMap(row.get("meta")));
        result.put("createdAt", row.get("created_at"));
        result.put("createdBy", asString(row.get("created_by")));
        result.put("updatedAt", row.get("updated_at"));
        result.put("updatedBy", asString(row.get("updated_by")));
        return result;
    }

    private Map<String, Object> toActionMap(Map<String, Object> row) {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("id", asString(row.get("id")));
        result.put("templateId", asString(row.get("template_id")));
        result.put("itemId", asString(row.get("item_id")));
        result.put("actionType", asString(row.get("action_type")));
        result.put("targetSubjectType", asString(row.get("target_subject_type")));
        result.put("targetIdPath", asString(row.get("target_id_path")));
        result.put("sessionType", asString(row.get("session_type")));
        result.put("meta", toJsonMap(row.get("meta")));
        result.put("createdAt", row.get("created_at"));
        result.put("createdBy", asString(row.get("created_by")));
        result.put("updatedAt", row.get("updated_at"));
        result.put("updatedBy", asString(row.get("updated_by")));
        return result;
    }

    private void saveTemplateSections(String templateId, List<Map<String, Object>> sections, String currentUserId) {
        jdbc.update("DELETE FROM mo_portal_template_sections WHERE template_id = ?", templateId);
        for (Map<String, Object> section : sections) {
            String sectionId = persistentId(asString(section.get("id")));
            jdbc.update(
                "INSERT INTO mo_portal_template_sections (id, template_id, code, name, section_type, sort_order, meta, created_by, updated_by) VALUES (?, ?, ?, ?, ?, ?, CAST(? AS jsonb), ?, ?)",
                sectionId,
                templateId,
                requireText(section.get("code"), "分区编码不能为空"),
                requireText(section.get("name"), "分区名称不能为空"),
                normalizeAllowed(section.get("sectionType"), SECTION_TYPES, true, "分区类型不合法") == null ? "BLOCK" : normalizeAllowed(section.get("sectionType"), SECTION_TYPES, true, "分区类型不合法"),
                asInt(section.get("sortOrder"), 0),
                toJson(asMap(section.get("meta"))),
                currentUserId,
                currentUserId
            );
            for (Map<String, Object> item : asListOfMap(section.get("items"))) {
                String itemId = persistentId(asString(item.get("id")));
                jdbc.update(
                    "INSERT INTO mo_portal_template_items (id, template_id, section_id, item_key, label, data_key, display_type, sort_order, meta, created_by, updated_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, CAST(? AS jsonb), ?, ?)",
                    itemId,
                    templateId,
                    sectionId,
                    requireText(item.get("itemKey"), "展示项标识不能为空"),
                    requireText(item.get("label"), "展示项名称不能为空"),
                    requireText(item.get("dataKey"), "数据键不能为空"),
                    normalizeAllowed(item.get("displayType"), DISPLAY_TYPES, false, "展示类型不合法"),
                    asInt(item.get("sortOrder"), 0),
                    toJson(asMap(item.get("meta"))),
                    currentUserId,
                    currentUserId
                );
                for (Map<String, Object> action : asListOfMap(item.get("actions"))) {
                    jdbc.update(
                        "INSERT INTO mo_portal_template_item_actions (id, template_id, item_id, action_type, target_subject_type, target_id_path, session_type, meta, created_by, updated_by) VALUES (?, ?, ?, ?, ?, ?, ?, CAST(? AS jsonb), ?, ?)",
                        persistentId(asString(action.get("id"))),
                        templateId,
                        itemId,
                        normalizeAllowed(action.get("actionType"), ACTION_TYPES, false, "动作类型不合法"),
                        asNullableString(action.get("targetSubjectType")),
                        asNullableString(action.get("targetIdPath")),
                        asNullableString(action.get("sessionType")),
                        toJson(asMap(action.get("meta"))),
                        currentUserId,
                        currentUserId
                    );
                }
            }
        }
    }

    private Map<String, Object> loadPosition(String positionId) {
        try {
            Map<String, Object> row = jdbc.queryForMap(
                "SELECT id, name, code, COALESCE(default_role, '') AS default_role FROM position WHERE id = ?",
                positionId
            );
            Map<String, Object> result = new LinkedHashMap<>();
            result.put("id", asString(row.get("id")));
            result.put("name", asString(row.get("name")));
            result.put("code", asString(row.get("code")));
            result.put("defaultRole", blankToNull(asString(row.get("default_role"))));
            return result;
        } catch (EmptyResultDataAccessException ex) {
            throw new IllegalArgumentException("岗位不存在");
        }
    }

    private String loadPositionTemplateId(String positionId) {
        List<String> ids = jdbc.query(
            "SELECT id FROM mo_portal_templates WHERE template_type = 'PERSON_ROLE' AND COALESCE(meta ->> 'positionId', '') = ? ORDER BY updated_at DESC, created_at DESC LIMIT 1",
            (rs, rowNum) -> rs.getString(1),
            positionId
        );
        return ids.isEmpty() ? null : ids.get(0);
    }

    private String recommendedRole(String defaultRole, String code, String name) {
        if (hasText(defaultRole)) {
            String normalized = defaultRole.trim().toUpperCase(Locale.ROOT);
            if (ROLE_KEYS.contains(normalized)) {
                return normalized;
            }
        }
        String subject = (Objects.toString(code, "") + " " + Objects.toString(name, "")).toUpperCase(Locale.ROOT);
        if (subject.contains("SALES") || subject.contains("销售") || subject.contains("商务")) {
            return "SALES";
        }
        if (subject.contains("FINANCE") || subject.contains("财务") || subject.contains("会计") || subject.contains("出纳") || subject.contains("审计")) {
            return "FINANCE";
        }
        if (subject.contains("HR") || subject.contains("人事") || subject.contains("行政") || subject.contains("招聘")) {
            return "HR";
        }
        return null;
    }

    private List<Map<String, Object>> cloneSections(List<Map<String, Object>> sections) {
        List<Map<String, Object>> clones = new ArrayList<>();
        for (Map<String, Object> section : sections) {
            Map<String, Object> sectionClone = new LinkedHashMap<>();
            sectionClone.put("code", section.get("code"));
            sectionClone.put("name", section.get("name"));
            sectionClone.put("sectionType", section.get("sectionType"));
            sectionClone.put("sortOrder", section.get("sortOrder"));
            sectionClone.put("meta", asMap(section.get("meta")));
            List<Map<String, Object>> items = new ArrayList<>();
            for (Map<String, Object> item : asListOfMap(section.get("items"))) {
                Map<String, Object> itemClone = new LinkedHashMap<>();
                itemClone.put("itemKey", item.get("itemKey"));
                itemClone.put("label", item.get("label"));
                itemClone.put("dataKey", item.get("dataKey"));
                itemClone.put("displayType", item.get("displayType"));
                itemClone.put("sortOrder", item.get("sortOrder"));
                itemClone.put("meta", asMap(item.get("meta")));
                List<Map<String, Object>> actions = new ArrayList<>();
                for (Map<String, Object> action : asListOfMap(item.get("actions"))) {
                    Map<String, Object> actionClone = new LinkedHashMap<>();
                    actionClone.put("actionType", action.get("actionType"));
                    actionClone.put("targetSubjectType", action.get("targetSubjectType"));
                    actionClone.put("targetIdPath", action.get("targetIdPath"));
                    actionClone.put("sessionType", action.get("sessionType"));
                    actionClone.put("meta", asMap(action.get("meta")));
                    actions.add(actionClone);
                }
                itemClone.put("actions", actions);
                items.add(itemClone);
            }
            sectionClone.put("items", items);
            clones.add(sectionClone);
        }
        return clones;
    }

    private void ensureCodeUnique(String code, String ignoreId) {
        Integer count;
        if (hasText(ignoreId)) {
            count = jdbc.queryForObject("SELECT COUNT(*) FROM mo_portal_templates WHERE code = ? AND id <> ?", Integer.class, code, ignoreId);
        } else {
            count = jdbc.queryForObject("SELECT COUNT(*) FROM mo_portal_templates WHERE code = ?", Integer.class, code);
        }
        if (count != null && count > 0) {
            throw new IllegalArgumentException("模板编码已存在");
        }
    }

    private String buildUniqueGeneratedCode(String positionCode, String positionId) {
        String base = sanitizeCode(hasText(positionCode) ? "POSITION_" + positionCode : "POSITION_" + positionId.replace('-', '_'));
        if (!hasText(base)) {
            base = "POSITION_TEMPLATE";
        }
        String candidate = base;
        int index = 2;
        while (Boolean.TRUE.equals(jdbc.queryForObject("SELECT EXISTS(SELECT 1 FROM mo_portal_templates WHERE code = ?)", Boolean.class, candidate))) {
            candidate = base + "_" + index;
            index += 1;
        }
        return candidate;
    }

    private String sanitizeCode(String value) {
        String upper = Objects.toString(value, "").toUpperCase(Locale.ROOT);
        String normalized = NON_CODE_PATTERN.matcher(upper).replaceAll("_");
        normalized = normalized.replaceAll("_+", "_").replaceAll("^_+|_+$", "");
        return normalized;
    }

    private List<Map<String, Object>> buildOptions(Collection<String> values, Map<String, String> labels) {
        List<Map<String, Object>> result = new ArrayList<>();
        for (String value : values) {
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("value", value);
            item.put("label", labels.getOrDefault(value, value));
            result.add(item);
        }
        return result;
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> asMap(Object value) {
        if (value == null) {
            return new LinkedHashMap<>();
        }
        if (value instanceof Map<?, ?> map) {
            Map<String, Object> result = new LinkedHashMap<>();
            map.forEach((key, item) -> result.put(String.valueOf(key), item));
            return result;
        }
        if (value instanceof String text) {
            return parseJsonMapText(text);
        }
        String textValue = Objects.toString(value, "").trim();
        if (textValue.startsWith("{") && textValue.endsWith("}")) {
            return parseJsonMapText(textValue);
        }
        return objectMapper.convertValue(value, MAP_TYPE);
    }

    private Map<String, Object> parseJsonMapText(String text) {
        String trimmed = text == null ? "" : text.trim();
        if (trimmed.isEmpty()) {
            return new LinkedHashMap<>();
        }
        try {
            return objectMapper.readValue(trimmed, MAP_TYPE);
        } catch (Exception ex) {
            throw new IllegalArgumentException("JSON 内容格式不合法");
        }
    }

    private List<Map<String, Object>> asListOfMap(Object value) {
        if (value == null) {
            return List.of();
        }
        if (value instanceof List<?> list) {
            List<Map<String, Object>> result = new ArrayList<>();
            for (Object item : list) {
                result.add(asMap(item));
            }
            return result;
        }
        return objectMapper.convertValue(value, LIST_OF_MAP_TYPE);
    }

    private Map<String, Object> toJsonMap(Object value) {
        return asMap(value);
    }

    private String toJson(Object value) {
        try {
            return objectMapper.writeValueAsString(value == null ? Map.of() : value);
        } catch (Exception ex) {
            throw new IllegalArgumentException("JSON 序列化失败");
        }
    }

    private String normalizeAllowed(Object value, List<String> allowedValues, boolean allowBlank, String errorMessage) {
        String text = asNullableString(value);
        if (!hasText(text)) {
            return allowBlank ? null : requireText(value, errorMessage);
        }
        String normalized = text.trim();
        if (allowedValues.stream().noneMatch(item -> item.equalsIgnoreCase(normalized))) {
            throw new IllegalArgumentException(errorMessage);
        }
        for (String item : allowedValues) {
            if (item.equalsIgnoreCase(normalized)) {
                return item;
            }
        }
        return normalized;
    }

    private String requireText(Object value, String errorMessage) {
        String text = asNullableString(value);
        if (!hasText(text)) {
            throw new IllegalArgumentException(errorMessage);
        }
        return text;
    }

    private String asString(Object value) {
        if (value == null) {
            return null;
        }
        return String.valueOf(value);
    }

    private String asNullableString(Object value) {
        String text = asString(value);
        if (text == null) {
            return null;
        }
        String trimmed = text.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private String blankToNull(String value) {
        return hasText(value) ? value : null;
    }

    private boolean hasText(String value) {
        return value != null && !value.isBlank();
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
        } catch (NumberFormatException ex) {
            return defaultValue;
        }
    }

    private String persistentId(String value) {
        String text = asNullableString(value);
        if (!hasText(text) || text.startsWith("tmp-")) {
            return UUID.randomUUID().toString();
        }
        return text;
    }
}
