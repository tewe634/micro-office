package com.microoffice.controller;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.microoffice.dto.response.ApiResponse;
import com.microoffice.service.MenuPermissionService;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.EmptyResultDataAccessException;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

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
    private static final List<String> TEMPLATE_STATUS = List.of("DRAFT", "ACTIVE", "INACTIVE");
    private static final List<String> BLOCK_TEMPLATE_STATUS = List.of("DRAFT", "ACTIVE", "INACTIVE");
    private static final List<String> SECTION_TYPES = List.of("BLOCK");
    private static final List<String> DISPLAY_TYPES = List.of("STAT", "LIST", "CARD", "TEXT");
    private static final List<String> ACTION_TYPES = List.of("switch_subject", "open_workbench_session");
    private static final List<String> SUBJECT_TYPES = List.of("PERSON", "ORGANIZATION", "PRODUCT", "CUSTOMER_COMPANY", "SUPPLIER", "CARRIER", "BANK");
    private static final List<String> SESSION_TYPES = List.of("DAILY_ENTRY", "SUPPLIER", "CARRIER", "BANK", "PRODUCT", "CUSTOMER_COMPANY", "ORGANIZATION", "PERSON");
    private static final Pattern NON_CODE_PATTERN = Pattern.compile("[^A-Z0-9_]+");

    private final JdbcTemplate jdbc;
    private final MenuPermissionService menuPermissionService;
    private final ObjectMapper objectMapper;
    private final PortalRuntimeController portalRuntimeController;

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
        result.put("roleKeys", loadRoleKeyOptions());
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

    @GetMapping("/templates/{id}/preview")
    public ApiResponse<Map<String, Object>> previewTemplate(@PathVariable String id,
                                                            @RequestParam(required = false) String entityType,
                                                            @RequestParam(required = false) String entityId,
                                                            Authentication auth) {
        String currentUserId = requireAdmin(auth);
        Map<String, Object> template = loadTemplateDetail(id);
        String templateType = asString(template.get("templateType"));
        PreviewEntityRef previewEntity = resolvePreviewEntity(template, entityType, entityId);
        validatePreviewEntityMatchesTemplate(templateType, previewEntity.entityType());
        Map<String, Object> previewSnapshot = loadPreviewEntitySnapshot(previewEntity);

        if ("PERSON".equals(previewEntity.entityType())) {
            String requestedPositionId = asNullableString(template.get("positionId"));
            Map<String, Object> context = new LinkedHashMap<>();
            context.put("scope", "personal");
            context.put("previewMode", true);
            context.put("previewSource", previewEntity.source());
            if (hasText(requestedPositionId)) {
                context.put("positionId", requestedPositionId);
            }
            Map<String, Object> response = portalRuntimeController.resolveUserRuntimeResponse(
                currentUserId,
                previewEntity.entityId(),
                requestedPositionId,
                id,
                context,
                List.of()
            );
            Map<String, Object> portalContext = asMap(response.get("portalContext"));
            portalContext.put("previewMode", true);
            portalContext.put("previewSource", previewEntity.source());
            portalContext.put("previewEntityType", previewEntity.entityType());
            portalContext.put("previewEntityId", previewEntity.entityId());
            response.put("portalContext", portalContext);
            response.put("previewUser", previewSnapshot);
            applyPreviewEnvelope(response, previewEntity);
            return ApiResponse.ok(response);
        }

        return ApiResponse.ok(buildGenericPreviewResponse(template, previewEntity, previewSnapshot));
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
            "INSERT INTO mo_portal_templates (id, code, name, template_type, role_key, position_id, status, version, meta, created_by, updated_by) " +
                "VALUES (?, ?, ?, 'PERSON_ROLE', ?, ?, 'ACTIVE', 1, CAST(? AS jsonb), ?, ?)",
            templateId,
            templateCode,
            positionName + "门户模板",
            derivedRole,
            positionId,
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
        String roleKey = normalizeAllowed(body.get("roleKey"), loadRoleKeys(), true, "角色标识不合法");
        String status = normalizeAllowed(body.get("status"), TEMPLATE_STATUS, true, "模板状态不合法");
        Map<String, Object> meta = sanitizeTemplateMeta(asMap(body.get("meta")));
        int version = asInt(body.get("version"), 1);
        validatePreviewEntityForTemplate(templateType, meta);
        String positionId = resolveTemplatePositionId(body.get("positionId"), templateType, null);

        if (!"PERSON_ROLE".equals(templateType)) {
            roleKey = null;
        }
        if (!hasText(status)) {
            status = "DRAFT";
        }

        jdbc.update(
            "INSERT INTO mo_portal_templates (id, code, name, template_type, role_key, position_id, status, version, meta, created_by, updated_by) " +
                "VALUES (?, ?, ?, ?, ?, ?, ?, ?, CAST(? AS jsonb), ?, ?)",
            id,
            code,
            name,
            templateType,
            roleKey,
            positionId,
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
        Map<String, Object> existingTemplate = loadTemplateDetail(id);

        String code = requireText(body.get("code"), "模板编码不能为空");
        ensureCodeUnique(code, id);
        String name = requireText(body.get("name"), "模板名称不能为空");
        String templateType = normalizeAllowed(body.get("templateType"), TEMPLATE_TYPES, false, "模板类型不合法");
        String roleKey = normalizeAllowed(body.get("roleKey"), loadRoleKeys(), true, "角色标识不合法");
        String status = normalizeAllowed(body.get("status"), TEMPLATE_STATUS, true, "模板状态不合法");
        Map<String, Object> meta = sanitizeTemplateMeta(asMap(body.get("meta")));
        int version = asInt(body.get("version"), 1);
        validatePreviewEntityForTemplate(templateType, meta);
        String positionId = resolveTemplatePositionId(body.get("positionId"), templateType, asNullableString(existingTemplate.get("positionId")));

        if (!"PERSON_ROLE".equals(templateType)) {
            roleKey = null;
        }
        if (!hasText(status)) {
            status = "DRAFT";
        }

        jdbc.update(
            "UPDATE mo_portal_templates SET code = ?, name = ?, template_type = ?, role_key = ?, position_id = ?, status = ?, version = ?, meta = CAST(? AS jsonb), updated_at = NOW(), updated_by = ? WHERE id = ?",
            code,
            name,
            templateType,
            roleKey,
            positionId,
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
        menuPermissionService.requireMenu(currentUserId, "/admin/portal-templates");
        return currentUserId;
    }

    private Map<String, Object> resolvePreviewUser(String positionId, Map<String, Object> templateMeta) {
        List<Map<String, Object>> candidates = jdbc.queryForList(
            "SELECT candidate.user_id, candidate.user_name, candidate.position_id, candidate.position_name, candidate.matched_by FROM (" +
                "SELECT su.id AS user_id, su.name AS user_name, su.primary_position_id AS position_id, COALESCE(p.name, '') AS position_name, 'PRIMARY_POSITION' AS matched_by, 0 AS priority " +
                "FROM sys_user su " +
                "LEFT JOIN position p ON p.id = su.primary_position_id " +
                "WHERE su.primary_position_id = ? " +
                "UNION ALL " +
                "SELECT su.id AS user_id, su.name AS user_name, up.position_id AS position_id, COALESCE(p.name, '') AS position_name, 'USER_POSITION' AS matched_by, 1 AS priority " +
                "FROM user_position up " +
                "JOIN sys_user su ON su.id = up.user_id " +
                "LEFT JOIN position p ON p.id = up.position_id " +
                "WHERE up.position_id = ? AND COALESCE(su.primary_position_id, '') <> up.position_id" +
                ") candidate ORDER BY candidate.priority, candidate.user_name, candidate.user_id LIMIT 1",
            positionId,
            positionId
        );
        if (candidates.isEmpty()) {
            String positionName = asNullableString(templateMeta.get("positionName"));
            throw new IllegalArgumentException(hasText(positionName)
                ? "岗位「" + positionName + "」暂无可用预览用户"
                : "当前岗位暂无可用预览用户");
        }

        Map<String, Object> row = candidates.get(0);
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("userId", asString(row.get("user_id")));
        result.put("userName", asString(row.get("user_name")));
        result.put("positionId", asString(row.get("position_id")));
        result.put("positionName", hasText(asNullableString(row.get("position_name"))) ? asString(row.get("position_name")) : asString(templateMeta.get("positionName")));
        result.put("matchedBy", asString(row.get("matched_by")));
        return result;
    }

    private PreviewEntityRef resolvePreviewEntity(Map<String, Object> template, String queryEntityType, String queryEntityId) {
        String normalizedQueryType = asNullableString(queryEntityType);
        String normalizedQueryId = asNullableString(queryEntityId);
        if (hasText(normalizedQueryType) || hasText(normalizedQueryId)) {
            if (!hasText(normalizedQueryType) || !hasText(normalizedQueryId)) {
                throw new IllegalArgumentException("entityType 与 entityId 必须同时提供");
            }
            return new PreviewEntityRef(
                normalizeAllowed(normalizedQueryType, SUBJECT_TYPES, false, "预览主体类型不合法"),
                normalizedQueryId,
                "QUERY"
            );
        }

        PreviewEntityRef automatic = resolveAutomaticPreviewEntity(template);
        if (automatic != null) {
            return automatic;
        }

        Map<String, Object> previewEntity = asMap(asMap(template.get("meta")).get("previewEntity"));
        String fromMetaType = asNullableString(previewEntity.get("entityType"));
        String fromMetaId = asNullableString(previewEntity.get("entityId"));
        if (!hasText(fromMetaType) && !hasText(fromMetaId)) {
            throw new IllegalArgumentException("当前模板暂无可用预览主体，请先准备对应岗位用户或对象数据");
        }
        if (!hasText(fromMetaType) || !hasText(fromMetaId)) {
            throw new IllegalArgumentException("模板 meta.previewEntity 配置不完整，entityType 与 entityId 必须同时存在");
        }
        return new PreviewEntityRef(
            normalizeAllowed(fromMetaType, SUBJECT_TYPES, false, "预览主体类型不合法"),
            fromMetaId,
            "TEMPLATE_META"
        );
    }

    private PreviewEntityRef resolveAutomaticPreviewEntity(Map<String, Object> template) {
        String templateType = asString(template.get("templateType"));
        return switch (Objects.toString(templateType, "")) {
            case "PERSON_ROLE" -> resolveAutomaticPersonPreviewEntity(template);
            case "PRODUCT" -> resolveAutomaticPreviewEntityById("PRODUCT", loadFirstId(
                "SELECT id FROM product ORDER BY name, code, id LIMIT 1"
            ), "TEMPLATE_TYPE_SAMPLE");
            case "ORGANIZATION" -> resolveAutomaticPreviewEntityById("ORGANIZATION", loadFirstId(
                "SELECT id FROM organization ORDER BY sort_order, name, id LIMIT 1"
            ), "TEMPLATE_TYPE_SAMPLE");
            case "CUSTOMER_COMPANY" -> resolveAutomaticPreviewEntityById("CUSTOMER_COMPANY", loadFirstId(
                "SELECT id FROM external_object WHERE type = 'CUSTOMER' ORDER BY name, id LIMIT 1"
            ), "TEMPLATE_TYPE_SAMPLE");
            case "SUPPLIER" -> resolveAutomaticPreviewEntityById("SUPPLIER", loadFirstId(
                "SELECT id FROM external_object WHERE type = 'SUPPLIER' ORDER BY name, id LIMIT 1"
            ), "TEMPLATE_TYPE_SAMPLE");
            case "CARRIER" -> resolveAutomaticPreviewEntityById("CARRIER", loadFirstId(
                "SELECT id FROM external_object WHERE type = 'CARRIER' ORDER BY name, id LIMIT 1"
            ), "TEMPLATE_TYPE_SAMPLE");
            case "BANK" -> resolveAutomaticPreviewEntityById("BANK", loadFirstId(
                "SELECT id FROM external_object WHERE type = 'BANK' ORDER BY name, id LIMIT 1"
            ), "TEMPLATE_TYPE_SAMPLE");
            default -> null;
        };
    }

    private PreviewEntityRef resolveAutomaticPersonPreviewEntity(Map<String, Object> template) {
        Map<String, Object> templateMeta = asMap(template.get("meta"));
        String positionId = asNullableString(template.get("positionId"));
        if (hasText(positionId)) {
            Map<String, Object> previewUser = resolvePreviewUser(positionId, templateMeta);
            return new PreviewEntityRef("PERSON", asString(previewUser.get("userId")), "TEMPLATE_POSITION");
        }

        String roleKey = asNullableString(template.get("roleKey"));
        if (!hasText(roleKey)) {
            return null;
        }

        String previewUserId = loadFirstId(
            "SELECT su.id " +
                "FROM sys_user su " +
                "LEFT JOIN position p ON p.id = su.primary_position_id " +
                "WHERE UPPER(COALESCE(su.role, '')) = ? " +
                "ORDER BY CASE WHEN su.primary_position_id IS NULL THEN 1 ELSE 0 END, COALESCE(p.name, ''), su.name, su.id LIMIT 1",
            roleKey.trim().toUpperCase(Locale.ROOT)
        );
        return resolveAutomaticPreviewEntityById("PERSON", previewUserId, "TEMPLATE_ROLE");
    }

    private PreviewEntityRef resolveAutomaticPreviewEntityById(String entityType, String entityId, String source) {
        if (!hasText(entityId)) {
            return null;
        }
        return new PreviewEntityRef(entityType, entityId, source);
    }

    private void validatePreviewEntityMatchesTemplate(String templateType, String entityType) {
        String expected = expectedEntityTypeForTemplate(templateType);
        if (!Objects.equals(expected, entityType)) {
            throw new IllegalArgumentException("预览主体类型与模板类型不一致");
        }
    }

    private void validatePreviewEntityForTemplate(String templateType, Map<String, Object> meta) {
        Map<String, Object> safeMeta = meta == null ? new LinkedHashMap<>() : meta;
        Map<String, Object> previewEntity = asMap(safeMeta.get("previewEntity"));
        String entityType = asNullableString(previewEntity.get("entityType"));
        String entityId = asNullableString(previewEntity.get("entityId"));
        if (!hasText(entityType) && !hasText(entityId)) {
            return;
        }
        if (!hasText(entityType) || !hasText(entityId)) {
            throw new IllegalArgumentException("meta.previewEntity 必须同时包含 entityType 与 entityId");
        }

        String normalizedEntityType = normalizeAllowed(entityType, SUBJECT_TYPES, false, "meta.previewEntity.entityType 不合法");
        validatePreviewEntityMatchesTemplate(templateType, normalizedEntityType);

        Map<String, Object> normalized = new LinkedHashMap<>();
        normalized.put("entityType", normalizedEntityType);
        normalized.put("entityId", entityId);
        safeMeta.put("previewEntity", normalized);
    }

    private String expectedEntityTypeForTemplate(String templateType) {
        return switch (Objects.toString(templateType, "")) {
            case "PERSON_ROLE" -> "PERSON";
            case "PRODUCT" -> "PRODUCT";
            case "CUSTOMER_COMPANY" -> "CUSTOMER_COMPANY";
            case "SUPPLIER" -> "SUPPLIER";
            case "CARRIER" -> "CARRIER";
            case "BANK" -> "BANK";
            case "ORGANIZATION" -> "ORGANIZATION";
            default -> throw new IllegalArgumentException("模板类型不合法");
        };
    }

    private Map<String, Object> loadPreviewEntitySnapshot(PreviewEntityRef previewEntity) {
        try {
            return switch (previewEntity.entityType()) {
                case "PERSON" -> loadPersonPreviewSnapshot(previewEntity.entityId());
                case "PRODUCT" -> loadProductPreviewSnapshot(previewEntity.entityId());
                case "ORGANIZATION" -> loadOrganizationPreviewSnapshot(previewEntity.entityId());
                case "CUSTOMER_COMPANY" -> loadExternalObjectPreviewSnapshot(previewEntity.entityId(), "CUSTOMER");
                case "SUPPLIER" -> loadExternalObjectPreviewSnapshot(previewEntity.entityId(), "SUPPLIER");
                case "CARRIER" -> loadExternalObjectPreviewSnapshot(previewEntity.entityId(), "CARRIER");
                case "BANK" -> loadExternalObjectPreviewSnapshot(previewEntity.entityId(), "BANK");
                default -> throw new IllegalArgumentException("预览主体类型不合法");
            };
        } catch (EmptyResultDataAccessException ex) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "预览主体不存在");
        }
    }

    private Map<String, Object> loadPersonPreviewSnapshot(String userId) {
        Map<String, Object> row = jdbc.queryForMap(
            "SELECT su.id, su.name, su.email, su.phone, su.org_id, su.primary_position_id, su.role, su.emp_no, COALESCE(p.name, '') AS primary_position_name " +
                "FROM sys_user su " +
                "LEFT JOIN position p ON p.id = su.primary_position_id " +
                "WHERE su.id = ?",
            userId
        );
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("userId", asString(row.get("id")));
        result.put("userName", asString(row.get("name")));
        result.put("email", asString(row.get("email")));
        result.put("phone", asString(row.get("phone")));
        result.put("orgId", asString(row.get("org_id")));
        result.put("primaryPositionId", asString(row.get("primary_position_id")));
        result.put("positionName", asString(row.get("primary_position_name")));
        result.put("role", asString(row.get("role")));
        result.put("empNo", asString(row.get("emp_no")));
        return result;
    }

    private Map<String, Object> loadProductPreviewSnapshot(String productId) {
        Map<String, Object> row = jdbc.queryForMap(
            "SELECT id, name, code, category_code, product_line, parent_id FROM product WHERE id = ?",
            productId
        );
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("id", asString(row.get("id")));
        result.put("name", asString(row.get("name")));
        result.put("code", asString(row.get("code")));
        result.put("categoryCode", asString(row.get("category_code")));
        result.put("productLine", asString(row.get("product_line")));
        result.put("parentId", asString(row.get("parent_id")));
        return result;
    }

    private Map<String, Object> loadOrganizationPreviewSnapshot(String orgId) {
        Map<String, Object> row = jdbc.queryForMap(
            "SELECT id, name, parent_id, sort_order FROM organization WHERE id = ?",
            orgId
        );
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("id", asString(row.get("id")));
        result.put("name", asString(row.get("name")));
        result.put("parentId", asString(row.get("parent_id")));
        result.put("sortOrder", row.get("sort_order"));
        return result;
    }

    private Map<String, Object> loadExternalObjectPreviewSnapshot(String objectId, String expectedType) {
        Map<String, Object> row = jdbc.queryForMap(
            "SELECT id, name, type, owner_id, org_id, dept_id, contact, phone FROM external_object WHERE id = ?",
            objectId
        );
        String type = asString(row.get("type"));
        if (!Objects.equals(type, expectedType)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "预览主体不存在");
        }
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("id", asString(row.get("id")));
        result.put("name", asString(row.get("name")));
        result.put("type", type);
        result.put("ownerId", asString(row.get("owner_id")));
        result.put("orgId", asString(row.get("org_id")));
        result.put("deptId", asString(row.get("dept_id")));
        result.put("contact", asString(row.get("contact")));
        result.put("phone", asString(row.get("phone")));
        return result;
    }

    private Map<String, Object> buildGenericPreviewResponse(Map<String, Object> template,
                                                            PreviewEntityRef previewEntity,
                                                            Map<String, Object> previewSnapshot) {
        Map<String, Object> portalContext = new LinkedHashMap<>();
        portalContext.put("previewMode", true);
        portalContext.put("previewSource", previewEntity.source());
        portalContext.put("previewEntityType", previewEntity.entityType());
        portalContext.put("previewEntityId", previewEntity.entityId());
        portalContext.put("templateType", asString(template.get("templateType")));

        Map<String, Object> datasets = new LinkedHashMap<>();
        datasets.put("entity.base", previewSnapshot);
        datasets.put("preview.entity", previewSnapshot);
        datasets.put(datasetAliasForEntityType(previewEntity.entityType()), previewSnapshot);

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("templateId", asString(template.get("id")));
        response.put("templateCode", asString(template.get("code")));
        response.put("templateName", asString(template.get("name")));
        response.put("templateVersion", String.valueOf(template.get("version") == null ? 1 : template.get("version")));
        response.put("entityType", previewEntity.entityType());
        response.put("entityId", previewEntity.entityId());
        response.put("portalContext", portalContext);
        response.put("template", template);
        response.put("datasets", datasets);
        response.put("previewEntity", previewSnapshot);
        response.put("errors", List.of());
        applyPreviewEnvelope(response, previewEntity);
        return response;
    }

    private void applyPreviewEnvelope(Map<String, Object> response, PreviewEntityRef previewEntity) {
        Map<String, Object> templateWithBlocks = buildTemplateWithBlocks(asMap(response.get("template")));
        Map<String, Object> datasets = asMap(response.get("datasets"));
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("blocks", buildDataBlocks(templateWithBlocks, datasets));

        response.put("subject", buildPreviewSubject(previewEntity, response));
        response.put("template", templateWithBlocks);
        response.put("data", data);
        response.putIfAbsent("breadcrumbs", List.of());
    }

    private Map<String, Object> buildPreviewSubject(PreviewEntityRef previewEntity, Map<String, Object> response) {
        Map<String, Object> subject = new LinkedHashMap<>();
        subject.put("entityType", previewEntity.entityType());
        subject.put("entityId", previewEntity.entityId());
        subject.put("source", previewEntity.source());
        subject.put("templateType", asString(asMap(response.get("template")).get("templateType")));
        return subject;
    }

    private Map<String, Object> buildTemplateWithBlocks(Map<String, Object> template) {
        Map<String, Object> result = new LinkedHashMap<>(template);
        List<Map<String, Object>> sections = new ArrayList<>();
        for (Map<String, Object> section : asListOfMap(template.get("sections"))) {
            Map<String, Object> sectionCopy = new LinkedHashMap<>(section);
            sectionCopy.putIfAbsent("key", asString(section.get("code")));
            sectionCopy.putIfAbsent("title", asString(section.get("name")));
            List<Map<String, Object>> blocks = buildBlocksFromRefs(section);
            sectionCopy.put("blocks", blocks);
            sections.add(sectionCopy);
        }
        result.put("sections", sections);
        return result;
    }

    private List<Map<String, Object>> buildBlocksFromRefs(Map<String, Object> section) {
        List<Map<String, Object>> refs = asListOfMap(readField(section, "blockRefs", "block_refs"));
        List<Map<String, Object>> activeRefs = new ArrayList<>();
        for (Map<String, Object> ref : refs) {
            if (asBoolean(readField(ref, "enabled", "enabled"), true)) {
                activeRefs.add(ref);
            }
        }
        activeRefs.sort((a, b) -> Integer.compare(
            asInt(readField(a, "sortOrder", "sort_order"), 0),
            asInt(readField(b, "sortOrder", "sort_order"), 0)
        ));

        List<Map<String, Object>> blocks = new ArrayList<>();
        for (Map<String, Object> ref : activeRefs) {
            Map<String, Object> blockTemplate = asMap(readField(ref, "blockTemplate", "block_template"));
            String dataKey = asNullableString(readField(blockTemplate, "dataKey", "data_key"));
            String displayType = asNullableString(readField(blockTemplate, "displayType", "display_type"));
            if (!hasText(dataKey) || !hasText(displayType)) {
                throw new IllegalArgumentException("模板块引用数据不完整，请联系数据库线程修复 block refs backfill");
            }
            Map<String, Object> block = new LinkedHashMap<>();
            block.put("key", firstNonBlank(
                asNullableString(readField(blockTemplate, "code", "code")),
                asNullableString(readField(ref, "id", "id"))
            ));
            block.put("title", firstNonBlank(
                asNullableString(readField(blockTemplate, "label", "label")),
                asNullableString(readField(blockTemplate, "name", "name"))
            ));
            block.put("dataKey", dataKey);
            block.put("data_key", dataKey);
            block.put("displayType", displayType);
            block.put("display_type", displayType);
            List<Map<String, Object>> actions = normalizeActions(asListOfMap(readField(blockTemplate, "actions", "actions")));
            block.put("actions", actions);
            if (!actions.isEmpty()) {
                block.put("action", actions.get(0));
            }
            blocks.add(block);
        }
        return blocks;
    }

    private Map<String, Object> buildDataBlocks(Map<String, Object> template, Map<String, Object> datasets) {
        LinkedHashMap<String, Object> blocks = new LinkedHashMap<>();
        for (Map<String, Object> section : asListOfMap(template.get("sections"))) {
            for (Map<String, Object> block : asListOfMap(section.get("blocks"))) {
                String dataKey = firstNonBlank(asNullableString(block.get("data_key")), asNullableString(block.get("dataKey")));
                if (!hasText(dataKey) || blocks.containsKey(dataKey)) {
                    continue;
                }
                String displayType = asNullableString(firstNonBlank(asNullableString(block.get("display_type")), asNullableString(block.get("displayType"))));
                blocks.put(dataKey, normalizeBlockContainer(datasets.get(dataKey), displayType));
            }
        }
        return blocks;
    }

    private Map<String, Object> normalizeBlockContainer(Object value, String displayType) {
        return switch (Objects.toString(displayType, "").toUpperCase(Locale.ROOT)) {
            case "LIST" -> Map.of("items", normalizeListContainer(value, "items"));
            case "CARD" -> normalizeCardContainer(value);
            default -> Map.of("entries", normalizeListContainer(value, "entries"));
        };
    }

    private Map<String, Object> normalizeCardContainer(Object value) {
        List<Object> entries = normalizeListContainer(value, "entries");
        if (!entries.isEmpty()) {
            return Map.of("entries", entries);
        }
        List<Object> blocks = normalizeListContainer(value, "blocks");
        if (!blocks.isEmpty()) {
            return Map.of("blocks", blocks);
        }
        return Map.of("entries", List.of());
    }

    private List<Object> normalizeListContainer(Object source, String key) {
        if (source == null) {
            return List.of();
        }
        if (source instanceof List<?> list) {
            return sanitizeContainerEntries(list);
        }
        Map<String, Object> sourceMap = asMap(source);
        Object keyValue = sourceMap.get(key);
        if (keyValue instanceof List<?> list) {
            return sanitizeContainerEntries(list);
        }
        return List.of();
    }

    private List<Object> sanitizeContainerEntries(List<?> list) {
        List<Object> sanitized = new ArrayList<>();
        for (Object item : list) {
            if (item instanceof Map<?, ?> map) {
                Map<String, Object> entry = new LinkedHashMap<>();
                for (Map.Entry<?, ?> sourceEntry : map.entrySet()) {
                    entry.put(String.valueOf(sourceEntry.getKey()), sourceEntry.getValue());
                }
                Map<String, Object> action = normalizeAction(asMap(entry.get("action")));
                if (action.isEmpty()) {
                    entry.remove("action");
                } else {
                    entry.put("action", action);
                }
                List<Map<String, Object>> actions = normalizeActions(asListOfMap(entry.get("actions")));
                if (actions.isEmpty()) {
                    entry.remove("actions");
                } else {
                    entry.put("actions", actions);
                    if (!entry.containsKey("action")) {
                        entry.put("action", actions.get(0));
                    }
                }
                sanitized.add(entry);
                continue;
            }
            sanitized.add(item);
        }
        return sanitized;
    }

    private List<Map<String, Object>> normalizeActions(List<Map<String, Object>> actions) {
        List<Map<String, Object>> normalized = new ArrayList<>();
        for (Map<String, Object> action : actions) {
            Map<String, Object> candidate = normalizeAction(action);
            if (!candidate.isEmpty()) {
                normalized.add(candidate);
            }
        }
        return normalized;
    }

    private Map<String, Object> normalizeAction(Map<String, Object> action) {
        String actionType = asNullableString(action.get("actionType"));
        if (!hasText(actionType)) {
            return Map.of();
        }
        String normalizedType = actionType.trim();
        if (!ACTION_TYPES.contains(normalizedType)) {
            return Map.of();
        }

        if ("switch_subject".equals(normalizedType)) {
            if (!hasText(asNullableString(action.get("targetSubjectType"))) || !hasText(asNullableString(action.get("targetIdPath")))) {
                return Map.of();
            }
        }
        if ("open_workbench_session".equals(normalizedType)) {
            if (!hasText(asNullableString(action.get("sessionType")))) {
                return Map.of();
            }
        }

        Map<String, Object> normalized = new LinkedHashMap<>();
        normalized.put("actionType", normalizedType);
        if (hasText(asNullableString(action.get("targetSubjectType")))) {
            normalized.put("targetSubjectType", asString(action.get("targetSubjectType")));
        }
        if (hasText(asNullableString(action.get("targetIdPath")))) {
            normalized.put("targetIdPath", asString(action.get("targetIdPath")));
        }
        if (hasText(asNullableString(action.get("sessionType")))) {
            normalized.put("sessionType", asString(action.get("sessionType")));
        }
        Map<String, Object> meta = asMap(action.get("meta"));
        if (!meta.isEmpty()) {
            normalized.put("meta", meta);
        }
        return normalized;
    }

    private String datasetAliasForEntityType(String entityType) {
        return switch (Objects.toString(entityType, "")) {
            case "PRODUCT" -> "product.base";
            case "CUSTOMER_COMPANY" -> "customer.base";
            case "SUPPLIER" -> "supplier.base";
            case "CARRIER" -> "carrier.base";
            case "BANK" -> "bank.base";
            case "ORGANIZATION" -> "organization.base";
            case "PERSON" -> "user.base";
            default -> "entity.base";
        };
    }

    private List<Map<String, Object>> loadPositionTargets() {
        List<Map<String, Object>> rows = jdbc.queryForList(
            "SELECT p.id, p.name, p.code, COALESCE(p.default_role, '') AS default_role, " +
                "tpl.id AS template_id, tpl.name AS template_name, tpl.code AS template_code, tpl.role_key AS template_role_key, tpl.updated_at AS template_updated_at " +
                "FROM position p " +
                "LEFT JOIN LATERAL (" +
                "  SELECT t.id, t.name, t.code, t.role_key, t.updated_at " +
                "  FROM mo_portal_templates t " +
                "  WHERE t.template_type = 'PERSON_ROLE' AND t.position_id = p.id " +
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
                "WHERE template_type = 'PERSON_ROLE' AND status = 'ACTIVE' AND position_id IS NULL " +
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
                    "WHERE template_type = 'PERSON_ROLE' AND status = 'ACTIVE' AND role_key = ? AND position_id IS NULL " +
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
            "SELECT t.id, t.code, t.name, t.template_type, t.role_key, t.position_id, t.status, t.version, t.meta, t.created_at, t.updated_at, " +
                "COALESCE((SELECT COUNT(*) FROM mo_portal_template_sections s WHERE s.template_id = t.id), 0) AS section_count, " +
                "COALESCE((SELECT COUNT(*) FROM mo_portal_template_block_refs br WHERE br.template_id = t.id), 0) AS block_ref_count " +
                "FROM mo_portal_templates t " +
                "ORDER BY CASE WHEN t.position_id IS NOT NULL THEN 0 ELSE 1 END, COALESCE(t.meta ->> 'positionName', t.name), t.updated_at DESC, t.created_at DESC"
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
            item.put("blockRefCount", asInt(row.get("block_ref_count"), 0));
            item.put("positionId", asString(row.get("position_id")));
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
                "SELECT id, code, name, template_type, role_key, position_id, status, version, meta, created_at, created_by, updated_at, updated_by FROM mo_portal_templates WHERE id = ?",
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
        List<Map<String, Object>> blockRefRows = jdbc.queryForList(
            "SELECT br.id, br.template_id, br.section_id, br.block_template_id, br.sort_order, br.enabled, br.override_meta, br.created_at, br.created_by, br.updated_at, br.updated_by, " +
                "bt.code AS block_template_code, bt.name AS block_template_name, bt.status AS block_template_status, bt.display_type AS block_template_display_type, " +
                "bt.data_key AS block_template_data_key, bt.label AS block_template_label, bt.meta AS block_template_meta, bt.version AS block_template_version " +
                "FROM mo_portal_template_block_refs br " +
                "JOIN mo_portal_block_templates bt ON bt.id = br.block_template_id " +
                "WHERE br.template_id = ? ORDER BY br.section_id, br.sort_order, br.id",
            id
        );

        Map<String, List<Map<String, Object>>> blockTemplateActionsByTemplateId = loadBlockTemplateActionsByTemplateId(blockRefRows);
        Map<String, List<Map<String, Object>>> blockRefsBySectionId = new LinkedHashMap<>();
        for (Map<String, Object> row : blockRefRows) {
            String sectionId = asString(row.get("section_id"));
            blockRefsBySectionId.computeIfAbsent(sectionId, key -> new ArrayList<>()).add(
                toBlockRefMap(row, blockTemplateActionsByTemplateId.getOrDefault(asString(row.get("block_template_id")), List.of()))
            );
        }

        List<Map<String, Object>> sections = new ArrayList<>();
        for (Map<String, Object> row : sectionRows) {
            Map<String, Object> section = toSectionMap(row);
            section.put("blockRefs", blockRefsBySectionId.getOrDefault(asString(row.get("id")), List.of()));
            sections.add(section);
        }

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("id", asString(template.get("id")));
        result.put("code", asString(template.get("code")));
        result.put("name", asString(template.get("name")));
        result.put("templateType", asString(template.get("template_type")));
        result.put("roleKey", asString(template.get("role_key")));
        result.put("positionId", asString(template.get("position_id")));
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

    private Map<String, Object> toBlockRefMap(Map<String, Object> row, List<Map<String, Object>> blockTemplateActions) {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("id", asString(row.get("id")));
        result.put("templateId", asString(row.get("template_id")));
        result.put("sectionId", asString(row.get("section_id")));
        result.put("blockTemplateId", asString(row.get("block_template_id")));
        result.put("sortOrder", asInt(row.get("sort_order"), 0));
        result.put("enabled", Boolean.TRUE.equals(row.get("enabled")));
        result.put("overrideMeta", toJsonMap(row.get("override_meta")));
        result.put("createdAt", row.get("created_at"));
        result.put("createdBy", asString(row.get("created_by")));
        result.put("updatedAt", row.get("updated_at"));
        result.put("updatedBy", asString(row.get("updated_by")));

        Map<String, Object> blockTemplate = new LinkedHashMap<>();
        blockTemplate.put("id", asString(row.get("block_template_id")));
        blockTemplate.put("code", asString(row.get("block_template_code")));
        blockTemplate.put("name", asString(row.get("block_template_name")));
        blockTemplate.put("status", asString(row.get("block_template_status")));
        blockTemplate.put("displayType", asString(row.get("block_template_display_type")));
        blockTemplate.put("dataKey", asString(row.get("block_template_data_key")));
        blockTemplate.put("label", asString(row.get("block_template_label")));
        blockTemplate.put("meta", toJsonMap(row.get("block_template_meta")));
        blockTemplate.put("version", asInt(row.get("block_template_version"), 1));
        blockTemplate.put("actions", blockTemplateActions);
        result.put("blockTemplate", blockTemplate);
        return result;
    }

    private Map<String, List<Map<String, Object>>> loadBlockTemplateActionsByTemplateId(List<Map<String, Object>> blockRefRows) {
        Set<String> templateIds = new LinkedHashSet<>();
        for (Map<String, Object> row : blockRefRows) {
            String id = asString(row.get("block_template_id"));
            if (hasText(id)) {
                templateIds.add(id);
            }
        }
        Map<String, List<Map<String, Object>>> result = new LinkedHashMap<>();
        for (String templateId : templateIds) {
            List<Map<String, Object>> actionRows = jdbc.queryForList(
                "SELECT id, action_type, target_subject_type, target_id_path, session_type, sort_order, meta " +
                    "FROM mo_portal_block_template_actions WHERE block_template_id = ? ORDER BY sort_order, id",
                templateId
            );
            List<Map<String, Object>> actions = new ArrayList<>();
            for (Map<String, Object> row : actionRows) {
                Map<String, Object> action = new LinkedHashMap<>();
                action.put("id", asString(row.get("id")));
                action.put("actionType", asString(row.get("action_type")));
                action.put("targetSubjectType", asString(row.get("target_subject_type")));
                action.put("targetIdPath", asString(row.get("target_id_path")));
                action.put("sessionType", asString(row.get("session_type")));
                action.put("sortOrder", asInt(row.get("sort_order"), 0));
                action.put("meta", toJsonMap(row.get("meta")));
                actions.add(action);
            }
            result.put(templateId, actions);
        }
        return result;
    }

    private void saveTemplateSections(String templateId, List<Map<String, Object>> sections, String currentUserId) {
        jdbc.update("DELETE FROM mo_portal_template_sections WHERE template_id = ?", templateId);
        for (Map<String, Object> section : sections) {
            String sectionId = persistentId(asString(section.get("id")));
            if (!asListOfMap(readField(section, "items", "items")).isEmpty()) {
                throw new IllegalArgumentException("V1.1.7 起模板保存仅支持 blockRefs，items/actions 已下线，请走数据库迁移");
            }
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
            for (Map<String, Object> blockRef : asListOfMap(readField(section, "blockRefs", "block_refs"))) {
                rejectBlockRefOverrides(blockRef);
                String blockTemplateId = requireText(
                    firstNonBlank(
                        asNullableString(readField(blockRef, "blockTemplateId", "block_template_id")),
                        asNullableString(asMap(readField(blockRef, "blockTemplate", "block_template")).get("id"))
                    ),
                    "blockTemplateId 不能为空"
                );
                Map<String, Object> blockTemplate = requireActiveBlockTemplate(blockTemplateId);
                if (!"ACTIVE".equals(asString(blockTemplate.get("status")))) {
                    throw new IllegalArgumentException("仅允许引用 ACTIVE 块模板");
                }
                jdbc.update(
                    "INSERT INTO mo_portal_template_block_refs (id, template_id, section_id, block_template_id, sort_order, enabled, override_meta, created_by, updated_by) " +
                        "VALUES (?, ?, ?, ?, ?, ?, CAST(? AS jsonb), ?, ?)",
                    persistentId(asString(readField(blockRef, "id", "id"))),
                    templateId,
                    sectionId,
                    blockTemplateId,
                    asInt(readField(blockRef, "sortOrder", "sort_order"), 0),
                    asBoolean(readField(blockRef, "enabled", "enabled"), true),
                    toJson(asMap(readField(blockRef, "overrideMeta", "override_meta"))),
                    currentUserId,
                    currentUserId
                );
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
            "SELECT id FROM mo_portal_templates WHERE template_type = 'PERSON_ROLE' AND position_id = ? ORDER BY updated_at DESC, created_at DESC LIMIT 1",
            (rs, rowNum) -> rs.getString(1),
            positionId
        );
        return ids.isEmpty() ? null : ids.get(0);
    }

    private String loadFirstId(String sql, Object... args) {
        List<String> ids = jdbc.query(sql, (rs, rowNum) -> rs.getString(1), args);
        return ids.isEmpty() ? null : ids.get(0);
    }

    private Map<String, Object> sanitizeTemplateMeta(Map<String, Object> meta) {
        Map<String, Object> sanitized = new LinkedHashMap<>(meta == null ? Map.of() : meta);
        sanitized.remove("positionId");
        return sanitized;
    }

    private String resolveTemplatePositionId(Object requestedPositionId, String templateType, String existingPositionId) {
        if (!"PERSON_ROLE".equals(templateType)) {
            return null;
        }
        String positionId = asNullableString(requestedPositionId);
        if (hasText(positionId)) {
            return positionId;
        }
        return hasText(existingPositionId) ? existingPositionId : null;
    }

    private String recommendedRole(String defaultRole, String code, String name) {
        if (hasText(defaultRole)) {
            String normalized = defaultRole.trim().toUpperCase(Locale.ROOT);
            if (isKnownRoleKey(normalized)) {
                return normalized;
            }
        }
        String subject = (Objects.toString(code, "") + " " + Objects.toString(name, "")).toUpperCase(Locale.ROOT);
        if (subject.contains("SALES") || subject.contains("销售") || subject.contains("商务")) {
            return isKnownRoleKey("SALES") ? "SALES" : null;
        }
        if (subject.contains("FINANCE") || subject.contains("财务") || subject.contains("会计") || subject.contains("出纳") || subject.contains("审计")) {
            return isKnownRoleKey("FINANCE") ? "FINANCE" : null;
        }
        if (subject.contains("HR") || subject.contains("人事") || subject.contains("行政") || subject.contains("招聘")) {
            return isKnownRoleKey("HR") ? "HR" : null;
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
            List<Map<String, Object>> blockRefs = new ArrayList<>();
            for (Map<String, Object> blockRef : asListOfMap(readField(section, "blockRefs", "block_refs"))) {
                Map<String, Object> blockRefClone = new LinkedHashMap<>();
                blockRefClone.put("blockTemplateId", firstNonBlank(
                    asNullableString(readField(blockRef, "blockTemplateId", "block_template_id")),
                    asNullableString(asMap(readField(blockRef, "blockTemplate", "block_template")).get("id"))
                ));
                blockRefClone.put("sortOrder", readField(blockRef, "sortOrder", "sort_order"));
                blockRefClone.put("enabled", readField(blockRef, "enabled", "enabled"));
                blockRefClone.put("overrideMeta", asMap(readField(blockRef, "overrideMeta", "override_meta")));
                blockRefs.add(blockRefClone);
            }
            sectionClone.put("blockRefs", blockRefs);
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

    private Map<String, Object> requireActiveBlockTemplate(String blockTemplateId) {
        try {
            Map<String, Object> row = jdbc.queryForMap(
                "SELECT id, status FROM mo_portal_block_templates WHERE id = ?",
                blockTemplateId
            );
            String status = asString(row.get("status"));
            normalizeAllowed(status, BLOCK_TEMPLATE_STATUS, false, "块模板状态不合法");
            if (!"ACTIVE".equals(status)) {
                throw new IllegalArgumentException("块模板未启用，不能被引用");
            }
            return row;
        } catch (EmptyResultDataAccessException ex) {
            throw new IllegalArgumentException("引用的块模板不存在");
        }
    }

    private void rejectBlockRefOverrides(Map<String, Object> blockRef) {
        if (hasText(asNullableString(readField(blockRef, "displayType", "display_type")))
            || hasText(asNullableString(readField(blockRef, "dataKey", "data_key")))
            || readField(blockRef, "actions", "actions") != null) {
            throw new IllegalArgumentException("块引用不允许覆盖 displayType/dataKey/actions");
        }
    }

    private Object readField(Map<String, Object> source, String camelKey, String snakeKey) {
        if (source == null) {
            return null;
        }
        if (source.containsKey(camelKey)) {
            return source.get(camelKey);
        }
        return source.get(snakeKey);
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

    private List<String> loadRoleKeys() {
        return jdbc.query(
            "SELECT code FROM sys_role ORDER BY sort_order, code",
            (rs, rowNum) -> rs.getString("code")
        );
    }

    private List<Map<String, Object>> loadRoleKeyOptions() {
        List<Map<String, Object>> rows = jdbc.queryForList(
            "SELECT code, name FROM sys_role ORDER BY sort_order, code"
        );
        List<Map<String, Object>> result = new ArrayList<>();
        for (Map<String, Object> row : rows) {
            String code = asString(row.get("code"));
            if (!hasText(code)) {
                continue;
            }
            Map<String, Object> option = new LinkedHashMap<>();
            option.put("value", code);
            option.put("label", firstNonBlank(asNullableString(row.get("name")), code));
            result.add(option);
        }
        return result;
    }

    private boolean isKnownRoleKey(String roleKey) {
        if (!hasText(roleKey)) {
            return false;
        }
        return loadRoleKeys().contains(roleKey);
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

    private String firstNonBlank(String... values) {
        if (values == null) {
            return null;
        }
        for (String value : values) {
            if (hasText(value)) {
                return value;
            }
        }
        return null;
    }

    private boolean asBoolean(Object value, boolean defaultValue) {
        if (value == null) {
            return defaultValue;
        }
        if (value instanceof Boolean bool) {
            return bool;
        }
        return "true".equalsIgnoreCase(String.valueOf(value).trim());
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

    private record PreviewEntityRef(String entityType, String entityId, String source) {}
}
