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
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import java.util.regex.Pattern;

@RestController
@RequestMapping("/api/admin/portal-block-templates")
@RequiredArgsConstructor
public class PortalBlockTemplateAdminController {
    private static final TypeReference<LinkedHashMap<String, Object>> MAP_TYPE = new TypeReference<>() {};
    private static final TypeReference<List<Map<String, Object>>> LIST_OF_MAP_TYPE = new TypeReference<>() {};
    private static final List<String> STATUS_OPTIONS = List.of("DRAFT", "ACTIVE", "INACTIVE");
    private static final List<String> DISPLAY_TYPES = List.of("STAT", "LIST", "CARD", "TEXT");
    private static final List<String> ACTION_TYPES = List.of("switch_subject", "open_workbench_session");
    private static final List<String> SUBJECT_TYPES = List.of("PERSON", "ORGANIZATION", "PRODUCT", "CUSTOMER_COMPANY", "SUPPLIER", "CARRIER", "BANK");
    private static final List<String> SESSION_TYPES = List.of("DAILY_ENTRY", "SUPPLIER", "CARRIER", "BANK", "PRODUCT", "CUSTOMER_COMPANY", "ORGANIZATION", "PERSON");
    private static final List<String> INPUT_TYPES = List.of("TEXT", "TEXTAREA", "NUMBER", "SELECT");
    private static final Pattern NON_CODE_PATTERN = Pattern.compile("[^A-Z0-9_]+");

    private final JdbcTemplate jdbc;
    private final MenuPermissionService menuPermissionService;
    private final ObjectMapper objectMapper;

    @GetMapping
    public ApiResponse<List<Map<String, Object>>> list(@RequestParam(required = false) String status,
                                                       @RequestParam(required = false) String keyword,
                                                       Authentication auth) {
        requireAdmin(auth);
        String normalizedStatus = normalizeAllowed(status, STATUS_OPTIONS, true, "块模板状态不合法");
        String normalizedKeyword = blankToNull(keyword);
        List<Map<String, Object>> rows;
        if (hasText(normalizedStatus) && hasText(normalizedKeyword)) {
            String pattern = "%" + normalizedKeyword.trim() + "%";
            rows = jdbc.queryForList(
                "SELECT bt.id, bt.code, bt.name, bt.status, bt.display_type, bt.data_key, bt.label, bt.meta, bt.version, bt.created_at, bt.created_by, bt.updated_at, bt.updated_by, " +
                    "COALESCE((SELECT COUNT(*) FROM mo_portal_template_block_refs br WHERE br.block_template_id = bt.id), 0) AS reference_count " +
                    "FROM mo_portal_block_templates bt " +
                    "WHERE bt.status = ? " +
                    "AND (bt.code ILIKE ? OR bt.name ILIKE ? OR bt.label ILIKE ? OR bt.data_key ILIKE ?) " +
                    "ORDER BY bt.updated_at DESC, bt.created_at DESC",
                normalizedStatus,
                pattern,
                pattern,
                pattern,
                pattern
            );
        } else if (hasText(normalizedStatus)) {
            rows = jdbc.queryForList(
                "SELECT bt.id, bt.code, bt.name, bt.status, bt.display_type, bt.data_key, bt.label, bt.meta, bt.version, bt.created_at, bt.created_by, bt.updated_at, bt.updated_by, " +
                    "COALESCE((SELECT COUNT(*) FROM mo_portal_template_block_refs br WHERE br.block_template_id = bt.id), 0) AS reference_count " +
                    "FROM mo_portal_block_templates bt WHERE bt.status = ? ORDER BY bt.updated_at DESC, bt.created_at DESC",
                normalizedStatus
            );
        } else if (hasText(normalizedKeyword)) {
            String pattern = "%" + normalizedKeyword.trim() + "%";
            rows = jdbc.queryForList(
                "SELECT bt.id, bt.code, bt.name, bt.status, bt.display_type, bt.data_key, bt.label, bt.meta, bt.version, bt.created_at, bt.created_by, bt.updated_at, bt.updated_by, " +
                    "COALESCE((SELECT COUNT(*) FROM mo_portal_template_block_refs br WHERE br.block_template_id = bt.id), 0) AS reference_count " +
                    "FROM mo_portal_block_templates bt " +
                    "WHERE bt.code ILIKE ? OR bt.name ILIKE ? OR bt.label ILIKE ? OR bt.data_key ILIKE ? " +
                    "ORDER BY bt.updated_at DESC, bt.created_at DESC",
                pattern,
                pattern,
                pattern,
                pattern
            );
        } else {
            rows = jdbc.queryForList(
                "SELECT bt.id, bt.code, bt.name, bt.status, bt.display_type, bt.data_key, bt.label, bt.meta, bt.version, bt.created_at, bt.created_by, bt.updated_at, bt.updated_by, " +
                    "COALESCE((SELECT COUNT(*) FROM mo_portal_template_block_refs br WHERE br.block_template_id = bt.id), 0) AS reference_count " +
                    "FROM mo_portal_block_templates bt ORDER BY bt.updated_at DESC, bt.created_at DESC"
            );
        }
        List<Map<String, Object>> result = new ArrayList<>();
        for (Map<String, Object> row : rows) {
            Map<String, Object> item = toBlockTemplateListItem(row);
            item.put("referenceCount", asInt(row.get("reference_count"), 0));
            result.add(item);
        }
        return ApiResponse.ok(result);
    }

    @GetMapping("/{id}")
    public ApiResponse<Map<String, Object>> detail(@PathVariable String id, Authentication auth) {
        requireAdmin(auth);
        return ApiResponse.ok(loadBlockTemplateDetail(id));
    }

    @PostMapping
    @Transactional
    public ApiResponse<Map<String, Object>> create(@RequestBody Map<String, Object> body, Authentication auth) {
        String currentUserId = requireAdmin(auth);
        String id = persistentId(readText(body, "id", "id"));
        String code = sanitizeCode(requireText(readText(body, "code", "code"), "块模板编码不能为空"));
        ensureCodeUnique(code, null);
        String name = requireText(readText(body, "name", "name"), "块模板名称不能为空");
        String status = normalizeAllowed(readText(body, "status", "status"), STATUS_OPTIONS, true, "块模板状态不合法");
        String displayType = normalizeAllowed(readText(body, "displayType", "display_type"), DISPLAY_TYPES, false, "展示类型不合法");
        String dataKey = requireText(readText(body, "dataKey", "data_key"), "dataKey 不能为空");
        String label = requireText(readText(body, "label", "label"), "label 不能为空");
        int version = asInt(firstNonBlank(readText(body, "version", "version"), "1"), 1);
        Map<String, Object> meta = asMap(readValue(body, "meta", "meta"));
        meta.putIfAbsent("scopeType", "PORTAL_BLOCK");
        List<Map<String, Object>> actions = normalizeActions(asListOfMap(readValue(body, "actions", "actions")));

        jdbc.update(
            "INSERT INTO mo_portal_block_templates (id, code, name, status, display_type, data_key, label, meta, version, created_by, updated_by) " +
                "VALUES (?, ?, ?, ?, ?, ?, ?, CAST(? AS jsonb), ?, ?, ?)",
            id,
            code,
            name,
            hasText(status) ? status : "DRAFT",
            displayType,
            dataKey,
            label,
            toJson(meta),
            version,
            currentUserId,
            currentUserId
        );
        saveTemplateActions(id, actions, currentUserId);
        return ApiResponse.ok(loadBlockTemplateDetail(id));
    }

    @PutMapping("/{id}")
    @Transactional
    public ApiResponse<Map<String, Object>> update(@PathVariable String id, @RequestBody Map<String, Object> body, Authentication auth) {
        String currentUserId = requireAdmin(auth);
        loadBlockTemplateRow(id);

        String code = sanitizeCode(requireText(readText(body, "code", "code"), "块模板编码不能为空"));
        ensureCodeUnique(code, id);
        String name = requireText(readText(body, "name", "name"), "块模板名称不能为空");
        String status = normalizeAllowed(readText(body, "status", "status"), STATUS_OPTIONS, true, "块模板状态不合法");
        String displayType = normalizeAllowed(readText(body, "displayType", "display_type"), DISPLAY_TYPES, false, "展示类型不合法");
        String dataKey = requireText(readText(body, "dataKey", "data_key"), "dataKey 不能为空");
        String label = requireText(readText(body, "label", "label"), "label 不能为空");
        int version = asInt(firstNonBlank(readText(body, "version", "version"), "1"), 1);
        Map<String, Object> meta = asMap(readValue(body, "meta", "meta"));
        meta.putIfAbsent("scopeType", "PORTAL_BLOCK");
        List<Map<String, Object>> actions = normalizeActions(asListOfMap(readValue(body, "actions", "actions")));

        jdbc.update(
            "UPDATE mo_portal_block_templates SET code = ?, name = ?, status = ?, display_type = ?, data_key = ?, label = ?, meta = CAST(? AS jsonb), version = ?, updated_by = ?, updated_at = now() WHERE id = ?",
            code,
            name,
            hasText(status) ? status : "DRAFT",
            displayType,
            dataKey,
            label,
            toJson(meta),
            version,
            currentUserId,
            id
        );
        saveTemplateActions(id, actions, currentUserId);
        return ApiResponse.ok(loadBlockTemplateDetail(id));
    }

    @PutMapping("/{id}/status")
    @Transactional
    public ApiResponse<Map<String, Object>> changeStatus(@PathVariable String id, @RequestBody Map<String, Object> body, Authentication auth) {
        String currentUserId = requireAdmin(auth);
        loadBlockTemplateRow(id);
        String status = normalizeAllowed(readText(body, "status", "status"), STATUS_OPTIONS, false, "块模板状态不合法");
        jdbc.update(
            "UPDATE mo_portal_block_templates SET status = ?, updated_by = ?, updated_at = now() WHERE id = ?",
            status,
            currentUserId,
            id
        );
        return ApiResponse.ok(loadBlockTemplateDetail(id));
    }

    @PostMapping("/{id}/copy")
    @Transactional
    public ApiResponse<Map<String, Object>> copy(@PathVariable String id, @RequestBody(required = false) Map<String, Object> body, Authentication auth) {
        String currentUserId = requireAdmin(auth);
        Map<String, Object> source = loadBlockTemplateDetail(id);
        Map<String, Object> safeBody = body == null ? Map.of() : body;
        String requestedCode = sanitizeCode(asNullableString(readValue(safeBody, "code", "code")));
        String code = hasText(requestedCode) ? requestedCode : buildCopyCode(asString(source.get("code")));
        ensureCodeUnique(code, null);
        String name = firstNonBlank(
            asNullableString(readValue(safeBody, "name", "name")),
            asString(source.get("name")) + " - 副本"
        );
        String newId = UUID.randomUUID().toString();
        jdbc.update(
            "INSERT INTO mo_portal_block_templates (id, code, name, status, display_type, data_key, label, meta, version, created_by, updated_by) " +
                "VALUES (?, ?, ?, ?, ?, ?, ?, CAST(? AS jsonb), ?, ?, ?)",
            newId,
            code,
            name,
            "DRAFT",
            asString(source.get("displayType")),
            asString(source.get("dataKey")),
            asString(source.get("label")),
            toJson(asMap(source.get("meta"))),
            asInt(source.get("version"), 1),
            currentUserId,
            currentUserId
        );
        saveTemplateActions(newId, asListOfMap(source.get("actions")), currentUserId);
        return ApiResponse.ok(loadBlockTemplateDetail(newId));
    }

    @GetMapping("/{id}/references")
    public ApiResponse<List<Map<String, Object>>> references(@PathVariable String id, Authentication auth) {
        requireAdmin(auth);
        loadBlockTemplateRow(id);
        List<Map<String, Object>> rows = jdbc.queryForList(
            "SELECT br.id, br.template_id, t.code AS template_code, t.name AS template_name, " +
                "br.section_id, s.code AS section_code, s.name AS section_name, br.sort_order, br.enabled, br.updated_at " +
                "FROM mo_portal_template_block_refs br " +
                "JOIN mo_portal_templates t ON t.id = br.template_id " +
                "JOIN mo_portal_template_sections s ON s.id = br.section_id " +
                "WHERE br.block_template_id = ? " +
                "ORDER BY t.name, s.sort_order, br.sort_order, br.id",
            id
        );
        List<Map<String, Object>> result = new ArrayList<>();
        for (Map<String, Object> row : rows) {
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("id", asString(row.get("id")));
            item.put("templateId", asString(row.get("template_id")));
            item.put("templateCode", asString(row.get("template_code")));
            item.put("templateName", asString(row.get("template_name")));
            item.put("sectionId", asString(row.get("section_id")));
            item.put("sectionCode", asString(row.get("section_code")));
            item.put("sectionName", asString(row.get("section_name")));
            item.put("sortOrder", asInt(row.get("sort_order"), 0));
            item.put("enabled", Boolean.TRUE.equals(row.get("enabled")));
            item.put("updatedAt", row.get("updated_at"));
            result.add(item);
        }
        return ApiResponse.ok(result);
    }

    @DeleteMapping("/{id}")
    @Transactional
    public ApiResponse<Void> delete(@PathVariable String id, Authentication auth) {
        requireAdmin(auth);
        loadBlockTemplateRow(id);
        Integer refCount = jdbc.queryForObject(
            "SELECT COUNT(*) FROM mo_portal_template_block_refs WHERE block_template_id = ?",
            Integer.class,
            id
        );
        if (refCount != null && refCount > 0) {
            throw new IllegalArgumentException("块模板已被页面模板引用，无法删除");
        }
        jdbc.update("DELETE FROM mo_portal_block_templates WHERE id = ?", id);
        return ApiResponse.ok(null);
    }

    private String requireAdmin(Authentication auth) {
        String currentUserId = (String) auth.getPrincipal();
        menuPermissionService.requireMenu(currentUserId, "/admin/portal-block-templates");
        return currentUserId;
    }

    private Map<String, Object> loadBlockTemplateDetail(String id) {
        Map<String, Object> row = loadBlockTemplateRow(id);
        Map<String, Object> result = toBlockTemplateMap(row);
        result.put("actions", loadTemplateActions(id));
        return result;
    }

    private Map<String, Object> loadBlockTemplateRow(String id) {
        try {
            return jdbc.queryForMap(
                "SELECT id, code, name, status, display_type, data_key, label, meta, version, created_at, created_by, updated_at, updated_by " +
                    "FROM mo_portal_block_templates WHERE id = ?",
                id
            );
        } catch (EmptyResultDataAccessException ex) {
            throw new IllegalArgumentException("块模板不存在");
        }
    }

    private Map<String, Object> toBlockTemplateMap(Map<String, Object> row) {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("id", asString(row.get("id")));
        result.put("code", asString(row.get("code")));
        result.put("name", asString(row.get("name")));
        result.put("status", asString(row.get("status")));
        result.put("displayType", asString(row.get("display_type")));
        result.put("dataKey", asString(row.get("data_key")));
        result.put("label", asString(row.get("label")));
        result.put("meta", asMap(row.get("meta")));
        result.put("version", asInt(row.get("version"), 1));
        result.put("createdAt", row.get("created_at"));
        result.put("createdBy", asString(row.get("created_by")));
        result.put("updatedAt", row.get("updated_at"));
        result.put("updatedBy", asString(row.get("updated_by")));
        return result;
    }

    private Map<String, Object> toBlockTemplateListItem(Map<String, Object> row) {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("id", asString(row.get("id")));
        result.put("name", asString(row.get("name")));
        result.put("status", asString(row.get("status")));
        result.put("displayType", asString(row.get("display_type")));
        result.put("dataKey", asString(row.get("data_key")));
        result.put("label", asString(row.get("label")));
        return result;
    }

    private List<Map<String, Object>> loadTemplateActions(String blockTemplateId) {
        Map<String, List<Map<String, Object>>> formFieldsByActionId = loadActionFormFieldsByActionIds(List.of(blockTemplateId), true);
        List<Map<String, Object>> rows = jdbc.queryForList(
            "SELECT id, block_template_id, action_type, target_subject_type, target_id_path, session_type, " +
                "requires_pre_action_form, pre_action_form_title, pre_action_form_submit_label, " +
                "sort_order, meta, created_at, created_by, updated_at, updated_by " +
                "FROM mo_portal_block_template_actions WHERE block_template_id = ? ORDER BY sort_order, id",
            blockTemplateId
        );
        List<Map<String, Object>> result = new ArrayList<>();
        for (Map<String, Object> row : rows) {
            Map<String, Object> action = new LinkedHashMap<>();
            action.put("id", asString(row.get("id")));
            action.put("blockTemplateId", asString(row.get("block_template_id")));
            action.put("actionType", asString(row.get("action_type")));
            action.put("targetSubjectType", asString(row.get("target_subject_type")));
            action.put("targetIdPath", asString(row.get("target_id_path")));
            action.put("sessionType", asString(row.get("session_type")));
            action.put("requiresPreActionForm", Boolean.TRUE.equals(row.get("requires_pre_action_form")));
            action.put("preActionFormTitle", asNullableString(row.get("pre_action_form_title")));
            action.put("preActionFormSubmitLabel", asNullableString(row.get("pre_action_form_submit_label")));
            action.put("sortOrder", asInt(row.get("sort_order"), 0));
            action.put("meta", asMap(row.get("meta")));
            List<Map<String, Object>> formFields = formFieldsByActionId.getOrDefault(asString(row.get("id")), List.of());
            if (!formFields.isEmpty() || Boolean.TRUE.equals(row.get("requires_pre_action_form"))) {
                action.put("preActionFields", formFields);
                action.put("preActionFormFields", formFields);
                Map<String, Object> preActionForm = new LinkedHashMap<>();
                preActionForm.put("title", asNullableString(row.get("pre_action_form_title")));
                preActionForm.put("submitLabel", asNullableString(row.get("pre_action_form_submit_label")));
                preActionForm.put("fields", formFields);
                action.put("preActionForm", preActionForm);
            }
            action.put("createdAt", row.get("created_at"));
            action.put("createdBy", asString(row.get("created_by")));
            action.put("updatedAt", row.get("updated_at"));
            action.put("updatedBy", asString(row.get("updated_by")));
            result.add(action);
        }
        return result;
    }

    private void saveTemplateActions(String blockTemplateId, List<Map<String, Object>> actions, String currentUserId) {
        jdbc.update("DELETE FROM mo_portal_block_template_actions WHERE block_template_id = ?", blockTemplateId);
        int defaultSort = 10;
        for (Map<String, Object> action : actions) {
            String actionId = persistentId(asString(action.get("id")));
            jdbc.update(
                "INSERT INTO mo_portal_block_template_actions (id, block_template_id, action_type, target_subject_type, target_id_path, session_type, " +
                    "requires_pre_action_form, pre_action_form_title, pre_action_form_submit_label, sort_order, meta, created_by, updated_by) " +
                    "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CAST(? AS jsonb), ?, ?)",
                actionId,
                blockTemplateId,
                normalizeAllowed(action.get("actionType"), ACTION_TYPES, false, "动作类型不合法"),
                asNullableString(action.get("targetSubjectType")),
                asNullableString(action.get("targetIdPath")),
                asNullableString(action.get("sessionType")),
                Boolean.TRUE.equals(action.get("requiresPreActionForm")),
                asNullableString(action.get("preActionFormTitle")),
                asNullableString(action.get("preActionFormSubmitLabel")),
                asInt(action.get("sortOrder"), defaultSort),
                toJson(asMap(action.get("meta"))),
                currentUserId,
                currentUserId
            );
            saveActionFormFields(actionId, asListOfMap(firstNonBlankValue(
                action.get("preActionFields"),
                action.get("preActionFormFields")
            )), currentUserId);
            defaultSort += 10;
        }
    }

    private List<Map<String, Object>> normalizeActions(List<Map<String, Object>> actions) {
        List<Map<String, Object>> result = new ArrayList<>();
        for (Map<String, Object> action : actions) {
            String actionType = normalizeAllowed(action.get("actionType"), ACTION_TYPES, false, "动作类型不合法");
            if ("switch_subject".equals(actionType)) {
                normalizeAllowed(action.get("targetSubjectType"), SUBJECT_TYPES, false, "targetSubjectType 不合法");
                requireText(action.get("targetIdPath"), "targetIdPath 不能为空");
            }
            if ("open_workbench_session".equals(actionType)) {
                normalizeAllowed(action.get("sessionType"), SESSION_TYPES, false, "sessionType 不合法");
            }
            boolean requiresPreActionForm = Boolean.TRUE.equals(action.get("requiresPreActionForm"));
            Map<String, Object> preActionForm = asMap(action.get("preActionForm"));
            String preActionFormTitle = asNullableString(firstNonBlank(
                asNullableString(action.get("preActionFormTitle")),
                asNullableString(preActionForm.get("title"))
            ));
            String preActionFormSubmitLabel = asNullableString(firstNonBlank(
                asNullableString(action.get("preActionFormSubmitLabel")),
                asNullableString(preActionForm.get("submitLabel"))
            ));
            List<Map<String, Object>> preActionFormFields = normalizeActionFormFields(asListOfMap(firstNonBlankValue(
                action.get("preActionFields"),
                action.get("preActionFormFields"),
                preActionForm.get("fields")
            )));
            if (requiresPreActionForm) {
                if (!hasText(preActionFormTitle)) {
                    throw new IllegalArgumentException("启用前置弹窗时，preActionForm.title 不能为空");
                }
                if (preActionFormFields.isEmpty()) {
                    throw new IllegalArgumentException("启用前置弹窗时，preActionForm.fields 至少需要一项");
                }
            }
            Map<String, Object> normalized = new LinkedHashMap<>();
            normalized.put("id", asString(action.get("id")));
            normalized.put("actionType", actionType);
            normalized.put("targetSubjectType", asNullableString(action.get("targetSubjectType")));
            normalized.put("targetIdPath", asNullableString(action.get("targetIdPath")));
            normalized.put("sessionType", asNullableString(action.get("sessionType")));
            normalized.put("requiresPreActionForm", requiresPreActionForm);
            normalized.put("preActionFormTitle", preActionFormTitle);
            normalized.put("preActionFormSubmitLabel", hasText(preActionFormSubmitLabel) ? preActionFormSubmitLabel : "确定");
            normalized.put("preActionFields", preActionFormFields);
            normalized.put("preActionFormFields", preActionFormFields);
            normalized.put("sortOrder", asInt(action.get("sortOrder"), 0));
            normalized.put("meta", asMap(action.get("meta")));
            result.add(normalized);
        }
        return result;
    }

    private void saveActionFormFields(String actionId, List<Map<String, Object>> fields, String currentUserId) {
        jdbc.update("DELETE FROM mo_portal_block_template_action_form_fields WHERE action_id = ?", actionId);
        int defaultSort = 10;
        for (Map<String, Object> field : fields) {
            jdbc.update(
                "INSERT INTO mo_portal_block_template_action_form_fields (id, action_id, field_key, label, input_type, required, placeholder, default_value, max_length, sort_order, status, meta, created_by, updated_by) " +
                    "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CAST(? AS jsonb), ?, ?)",
                persistentId(asString(field.get("id"))),
                actionId,
                asString(field.get("fieldKey")),
                asString(field.get("label")),
                asString(field.get("inputType")),
                Boolean.TRUE.equals(field.get("required")),
                asNullableString(field.get("placeholder")),
                asNullableString(field.get("defaultValue")),
                nullableInteger(field.get("maxLength")),
                asInt(field.get("sortOrder"), defaultSort),
                asString(field.get("status")),
                toJson(asMap(field.get("meta"))),
                currentUserId,
                currentUserId
            );
            defaultSort += 10;
        }
    }

    private Map<String, List<Map<String, Object>>> loadActionFormFieldsByActionIds(List<String> ids, boolean loadByBlockTemplate) {
        Map<String, List<Map<String, Object>>> result = new LinkedHashMap<>();
        if (ids == null || ids.isEmpty()) {
            return result;
        }
        List<Map<String, Object>> rows = jdbc.queryForList(
            loadByBlockTemplate
                ? "SELECT f.id, f.action_id, f.field_key, f.label, f.input_type, f.required, f.placeholder, f.default_value, f.max_length, f.sort_order, f.status, f.meta " +
                    "FROM mo_portal_block_template_action_form_fields f " +
                    "JOIN mo_portal_block_template_actions a ON a.id = f.action_id " +
                    "WHERE a.block_template_id = ? AND f.status = 'ACTIVE' ORDER BY f.action_id, f.sort_order, f.id"
                : "SELECT id, action_id, field_key, label, input_type, required, placeholder, default_value, max_length, sort_order, status, meta " +
                    "FROM mo_portal_block_template_action_form_fields WHERE action_id = ? AND status = 'ACTIVE' ORDER BY action_id, sort_order, id",
            ids.get(0)
        );
        for (Map<String, Object> row : rows) {
            Map<String, Object> field = new LinkedHashMap<>();
            field.put("id", asString(row.get("id")));
            field.put("fieldKey", asString(row.get("field_key")));
            field.put("label", asString(row.get("label")));
            field.put("inputType", asString(row.get("input_type")));
            field.put("required", Boolean.TRUE.equals(row.get("required")));
            field.put("placeholder", asNullableString(row.get("placeholder")));
            field.put("defaultValue", asNullableString(row.get("default_value")));
            field.put("maxLength", nullableInteger(row.get("max_length")));
            field.put("sortOrder", asInt(row.get("sort_order"), 0));
            field.put("status", asString(row.get("status")));
            field.put("meta", asMap(row.get("meta")));
            result.computeIfAbsent(asString(row.get("action_id")), key -> new ArrayList<>()).add(field);
        }
        return result;
    }

    private List<Map<String, Object>> normalizeActionFormFields(List<Map<String, Object>> fields) {
        List<Map<String, Object>> normalized = new ArrayList<>();
        int dedupSort = 0;
        List<String> fieldKeys = new ArrayList<>();
        for (Map<String, Object> field : fields) {
            String fieldKey = requireText(field.get("fieldKey"), "preActionForm.fields[].fieldKey 不能为空");
            String label = requireText(field.get("label"), "preActionForm.fields[].label 不能为空");
            String inputType = normalizeAllowed(asNullableString(field.get("inputType")), INPUT_TYPES, false, "preActionForm.fields[].inputType 不合法");
            Integer maxLength = nullableInteger(field.get("maxLength"));
            if (maxLength != null && maxLength <= 0) {
                throw new IllegalArgumentException("preActionForm.fields[].maxLength 必须大于 0");
            }
            if (fieldKeys.contains(fieldKey)) {
                throw new IllegalArgumentException("preActionForm.fields[].fieldKey 不允许重复: " + fieldKey);
            }
            fieldKeys.add(fieldKey);
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("id", asString(field.get("id")));
            item.put("fieldKey", fieldKey);
            item.put("label", label);
            item.put("inputType", inputType);
            item.put("required", Boolean.TRUE.equals(field.get("required")));
            item.put("placeholder", asNullableString(field.get("placeholder")));
            item.put("defaultValue", asNullableString(field.get("defaultValue")));
            item.put("maxLength", maxLength);
            item.put("sortOrder", asInt(field.get("sortOrder"), dedupSort));
            item.put("status", hasText(asNullableString(field.get("status"))) ? asNullableString(field.get("status")).trim().toUpperCase(Locale.ROOT) : "ACTIVE");
            item.put("meta", asMap(field.get("meta")));
            normalized.add(item);
            dedupSort += 10;
        }
        return normalized;
    }
    private void ensureCodeUnique(String code, String ignoreId) {
        Integer count;
        if (hasText(ignoreId)) {
            count = jdbc.queryForObject("SELECT COUNT(*) FROM mo_portal_block_templates WHERE code = ? AND id <> ?", Integer.class, code, ignoreId);
        } else {
            count = jdbc.queryForObject("SELECT COUNT(*) FROM mo_portal_block_templates WHERE code = ?", Integer.class, code);
        }
        if (count != null && count > 0) {
            throw new IllegalArgumentException("块模板编码已存在");
        }
    }

    private String buildCopyCode(String sourceCode) {
        String base = sanitizeCode(sourceCode) + "_COPY";
        String candidate = base;
        int index = 2;
        while (Boolean.TRUE.equals(jdbc.queryForObject(
            "SELECT EXISTS(SELECT 1 FROM mo_portal_block_templates WHERE code = ?)",
            Boolean.class,
            candidate
        ))) {
            candidate = base + "_" + index;
            index += 1;
        }
        return candidate;
    }

    private String sanitizeCode(String value) {
        String upper = Objects.toString(value, "").toUpperCase(Locale.ROOT);
        String normalized = NON_CODE_PATTERN.matcher(upper).replaceAll("_");
        return normalized.replaceAll("_+", "_").replaceAll("^_+|_+$", "");
    }

    private Object firstNonBlankValue(Object... values) {
        if (values == null) {
            return null;
        }
        for (Object value : values) {
            if (value instanceof String text) {
                if (hasText(text)) {
                    return text;
                }
                continue;
            }
            if (value != null) {
                return value;
            }
        }
        return null;
    }

    private Integer nullableInteger(Object value) {
        if (value == null) {
            return null;
        }
        if (value instanceof Number number) {
            return number.intValue();
        }
        String text = asNullableString(value);
        if (!hasText(text)) {
            return null;
        }
        return Integer.parseInt(text);
    }

    private Object readValue(Map<String, Object> body, String camelKey, String snakeKey) {
        if (body.containsKey(camelKey)) {
            return body.get(camelKey);
        }
        return body.get(snakeKey);
    }

    private String readText(Map<String, Object> body, String camelKey, String snakeKey) {
        return asNullableString(readValue(body, camelKey, snakeKey));
    }

    private String blankToNull(String value) {
        return hasText(value) ? value.trim() : null;
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
        for (String item : allowedValues) {
            if (item.equalsIgnoreCase(normalized)) {
                return item;
            }
        }
        throw new IllegalArgumentException(errorMessage);
    }

    private String requireText(Object value, String errorMessage) {
        String text = asNullableString(value);
        if (!hasText(text)) {
            throw new IllegalArgumentException(errorMessage);
        }
        return text;
    }

    private String asString(Object value) {
        return value == null ? null : String.valueOf(value);
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

    private boolean hasText(String value) {
        return value != null && !value.isBlank();
    }

    private String persistentId(String value) {
        String text = asNullableString(value);
        if (!hasText(text) || text.startsWith("tmp-")) {
            return UUID.randomUUID().toString();
        }
        return text;
    }
}
