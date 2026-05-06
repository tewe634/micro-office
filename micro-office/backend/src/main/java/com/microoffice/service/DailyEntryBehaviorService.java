package com.microoffice.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.EmptyResultDataAccessException;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class DailyEntryBehaviorService {
    private static final TypeReference<LinkedHashMap<String, Object>> MAP_TYPE = new TypeReference<>() {};
    private static final List<String> STATUS_OPTIONS = List.of("ACTIVE", "INACTIVE");
    private static final List<String> ACTION_TYPES = List.of("OPEN_WORKBENCH_SESSION");
    private static final List<String> SESSION_TYPES = List.of("DAILY_ENTRY");
    private static final List<String> EXECUTION_MODES = List.of("OPEN_EXISTING", "CREATE_SESSION");
    private static final List<String> INPUT_TYPES = List.of("TEXT", "TEXTAREA", "NUMBER", "SELECT");

    private final JdbcTemplate jdbc;
    private final ObjectMapper objectMapper;

    public Map<String, Object> getBehavior(String dailyEntryId) {
        Map<String, Object> entry = loadEntry(dailyEntryId);
        Map<String, Object> behavior = loadBehaviorRowNullable(dailyEntryId);
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("dailyEntry", toEntry(entry));
        result.put("behavior", behavior == null ? null : toBehavior(behavior, loadFields(asString(behavior.get("id")), false)));
        return result;
    }

    @Transactional
    public Map<String, Object> saveBehavior(String dailyEntryId, Map<String, Object> body, String userId) {
        loadEntry(dailyEntryId);
        Map<String, Object> normalized = normalizeBehavior(dailyEntryId, body == null ? Map.of() : body);
        Map<String, Object> existing = loadBehaviorRowNullable(dailyEntryId);
        String behaviorId = existing == null
            ? firstNonBlank(asNullableString(normalized.get("id")), UUID.randomUUID().toString())
            : asString(existing.get("id"));

        if (existing == null) {
            jdbc.update(
                "INSERT INTO mo_daily_entry_behaviors (id, daily_entry_id, action_type, session_type, execution_mode, status, " +
                    "requires_pre_action_form, pre_action_form_title, pre_action_form_submit_label, meta, version, created_by, updated_by) " +
                    "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CAST(? AS jsonb), ?, ?, ?)",
                behaviorId,
                dailyEntryId,
                normalized.get("actionType"),
                normalized.get("sessionType"),
                normalized.get("executionMode"),
                normalized.get("status"),
                normalized.get("requiresPreActionForm"),
                normalized.get("preActionFormTitle"),
                normalized.get("preActionFormSubmitLabel"),
                toJson(asMap(normalized.get("meta"))),
                normalized.get("version"),
                userId,
                userId
            );
        } else {
            jdbc.update(
                "UPDATE mo_daily_entry_behaviors SET action_type = ?, session_type = ?, execution_mode = ?, status = ?, " +
                    "requires_pre_action_form = ?, pre_action_form_title = ?, pre_action_form_submit_label = ?, meta = CAST(? AS jsonb), " +
                    "version = ?, updated_by = ?, updated_at = now() WHERE daily_entry_id = ?",
                normalized.get("actionType"),
                normalized.get("sessionType"),
                normalized.get("executionMode"),
                normalized.get("status"),
                normalized.get("requiresPreActionForm"),
                normalized.get("preActionFormTitle"),
                normalized.get("preActionFormSubmitLabel"),
                toJson(asMap(normalized.get("meta"))),
                normalized.get("version"),
                userId,
                dailyEntryId
            );
        }

        saveFields(behaviorId, asListOfMap(normalized.get("preActionFields")), userId);
        return getBehavior(dailyEntryId);
    }

    public Map<String, Object> loadRuntimeBehavior(String dailyEntryId) {
        Map<String, Object> row = loadBehaviorRowNullable(dailyEntryId);
        if (row == null || !"ACTIVE".equals(asString(row.get("status")))) {
            return null;
        }
        return toBehavior(row, loadFields(asString(row.get("id")), true));
    }

    public Map<String, Map<String, Object>> loadRuntimeBehaviors(List<String> dailyEntryIds) {
        Map<String, Map<String, Object>> result = new LinkedHashMap<>();
        if (dailyEntryIds == null || dailyEntryIds.isEmpty()) {
            return result;
        }
        for (String dailyEntryId : dailyEntryIds) {
            if (!hasText(dailyEntryId)) {
                continue;
            }
            Map<String, Object> behavior = loadRuntimeBehavior(dailyEntryId);
            if (behavior != null) {
                result.put(dailyEntryId, behavior);
            }
        }
        return result;
    }

    private Map<String, Object> normalizeBehavior(String dailyEntryId, Map<String, Object> body) {
        String actionType = normalizeAllowed(asNullableString(body.get("actionType")), ACTION_TYPES, true, "actionType 不合法");
        String sessionType = normalizeAllowed(asNullableString(body.get("sessionType")), SESSION_TYPES, true, "sessionType 不合法");
        String executionMode = normalizeAllowed(asNullableString(body.get("executionMode")), EXECUTION_MODES, true, "executionMode 不合法");
        String status = normalizeStatus(asNullableString(body.get("status")), true, "行为状态不合法，仅支持 ACTIVE 或 INACTIVE");
        boolean requiresPreActionForm = Boolean.TRUE.equals(body.get("requiresPreActionForm"));
        String preActionFormTitle = asNullableString(body.get("preActionFormTitle"));
        String preActionFormSubmitLabel = asNullableString(body.get("preActionFormSubmitLabel"));
        List<Map<String, Object>> fields = normalizeFields(asListOfMap(body.get("preActionFields")));

        if (!hasText(actionType)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "actionType 不能为空");
        }
        if (!hasText(sessionType)) {
            sessionType = "DAILY_ENTRY";
        }
        if (!hasText(executionMode)) {
            executionMode = "OPEN_EXISTING";
        }
        if (!hasText(status)) {
            status = "ACTIVE";
        }
        if (requiresPreActionForm) {
            if (!hasText(preActionFormTitle)) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "启用前置弹窗时，preActionFormTitle 不能为空");
            }
            if (fields.isEmpty()) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "启用前置弹窗时，preActionFields 至少需要一项");
            }
        }
        if ("CREATE_SESSION".equals(executionMode) && fields.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "CREATE_SESSION 至少需要一项 preActionFields");
        }

        Map<String, Object> normalized = new LinkedHashMap<>();
        normalized.put("id", asNullableString(body.get("id")));
        normalized.put("dailyEntryId", dailyEntryId);
        normalized.put("actionType", actionType);
        normalized.put("sessionType", sessionType);
        normalized.put("executionMode", executionMode);
        normalized.put("status", status);
        normalized.put("requiresPreActionForm", requiresPreActionForm);
        normalized.put("preActionFormTitle", preActionFormTitle);
        normalized.put("preActionFormSubmitLabel", hasText(preActionFormSubmitLabel) ? preActionFormSubmitLabel : "确定");
        normalized.put("preActionFields", fields);
        normalized.put("meta", asMap(body.get("meta")));
        normalized.put("version", positiveVersion(body.get("version")));
        return normalized;
    }

    private List<Map<String, Object>> normalizeFields(List<Map<String, Object>> fields) {
        if (fields == null) {
            return List.of();
        }
        List<Map<String, Object>> result = new ArrayList<>();
        Set<String> fieldKeys = new LinkedHashSet<>();
        int defaultSort = 10;
        for (Map<String, Object> field : fields) {
            String fieldKey = requireText(field.get("fieldKey"), "preActionFields[].fieldKey 不能为空");
            String label = requireText(field.get("label"), "preActionFields[].label 不能为空");
            String inputType = normalizeAllowed(asNullableString(field.get("inputType")), INPUT_TYPES, false, "preActionFields[].inputType 不合法");
            Integer maxLength = nullableInteger(field.get("maxLength"));
            if (maxLength != null && maxLength <= 0) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "preActionFields[].maxLength 必须大于 0");
            }
            if (!fieldKeys.add(fieldKey)) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "preActionFields[].fieldKey 不允许重复: " + fieldKey);
            }
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("id", asNullableString(field.get("id")));
            item.put("fieldKey", fieldKey);
            item.put("label", label);
            item.put("inputType", inputType);
            item.put("required", Boolean.TRUE.equals(field.get("required")));
            item.put("placeholder", asNullableString(field.get("placeholder")));
            item.put("defaultValue", asNullableString(field.get("defaultValue")));
            item.put("maxLength", maxLength);
            item.put("sortOrder", asInt(field.get("sortOrder"), defaultSort));
            item.put("status", normalizeStatus(asNullableString(field.get("status")), true, "字段状态不合法，仅支持 ACTIVE 或 INACTIVE"));
            item.put("meta", asMap(field.get("meta")));
            item.put("version", positiveVersion(field.get("version")));
            result.add(item);
            defaultSort += 10;
        }
        return result;
    }

    private void saveFields(String behaviorId, List<Map<String, Object>> fields, String userId) {
        jdbc.update("DELETE FROM mo_daily_entry_behavior_fields WHERE behavior_id = ?", behaviorId);
        for (Map<String, Object> field : fields) {
            jdbc.update(
                "INSERT INTO mo_daily_entry_behavior_fields (id, behavior_id, field_key, label, input_type, required, placeholder, default_value, max_length, sort_order, status, meta, version, created_by, updated_by) " +
                    "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CAST(? AS jsonb), ?, ?, ?)",
                firstNonBlank(asNullableString(field.get("id")), UUID.randomUUID().toString()),
                behaviorId,
                field.get("fieldKey"),
                field.get("label"),
                field.get("inputType"),
                field.get("required"),
                field.get("placeholder"),
                field.get("defaultValue"),
                field.get("maxLength"),
                field.get("sortOrder"),
                firstNonBlank(asNullableString(field.get("status")), "ACTIVE"),
                toJson(asMap(field.get("meta"))),
                field.get("version"),
                userId,
                userId
            );
        }
    }

    private List<Map<String, Object>> loadFields(String behaviorId, boolean activeOnly) {
        String sql = activeOnly
            ? "SELECT id, behavior_id, field_key, label, input_type, required, placeholder, default_value, max_length, sort_order, status, meta, version, created_at, created_by, updated_at, updated_by " +
                "FROM mo_daily_entry_behavior_fields WHERE behavior_id = ? AND status = 'ACTIVE' ORDER BY sort_order, id"
            : "SELECT id, behavior_id, field_key, label, input_type, required, placeholder, default_value, max_length, sort_order, status, meta, version, created_at, created_by, updated_at, updated_by " +
                "FROM mo_daily_entry_behavior_fields WHERE behavior_id = ? ORDER BY sort_order, id";
        List<Map<String, Object>> rows = jdbc.queryForList(sql, behaviorId);
        List<Map<String, Object>> result = new ArrayList<>();
        for (Map<String, Object> row : rows) {
            Map<String, Object> field = new LinkedHashMap<>();
            field.put("id", asString(row.get("id")));
            field.put("behaviorId", asString(row.get("behavior_id")));
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
            field.put("version", positiveVersion(row.get("version")));
            field.put("createdAt", row.get("created_at"));
            field.put("createdBy", asNullableString(row.get("created_by")));
            field.put("updatedAt", row.get("updated_at"));
            field.put("updatedBy", asNullableString(row.get("updated_by")));
            result.add(field);
        }
        return result;
    }

    private Map<String, Object> loadBehaviorRowNullable(String dailyEntryId) {
        try {
            return jdbc.queryForMap(
                "SELECT id, daily_entry_id, action_type, session_type, execution_mode, status, requires_pre_action_form, " +
                    "pre_action_form_title, pre_action_form_submit_label, meta, version, created_at, created_by, updated_at, updated_by " +
                    "FROM mo_daily_entry_behaviors WHERE daily_entry_id = ?",
                dailyEntryId
            );
        } catch (EmptyResultDataAccessException ex) {
            return null;
        }
    }

    private Map<String, Object> toBehavior(Map<String, Object> row, List<Map<String, Object>> fields) {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("id", asString(row.get("id")));
        result.put("dailyEntryId", asString(row.get("daily_entry_id")));
        result.put("actionType", asString(row.get("action_type")));
        result.put("sessionType", asString(row.get("session_type")));
        result.put("executionMode", asString(row.get("execution_mode")));
        result.put("status", asString(row.get("status")));
        result.put("requiresPreActionForm", Boolean.TRUE.equals(row.get("requires_pre_action_form")));
        result.put("preActionFormTitle", asNullableString(row.get("pre_action_form_title")));
        result.put("preActionFormSubmitLabel", asNullableString(row.get("pre_action_form_submit_label")));
        result.put("preActionFields", fields);
        if (!fields.isEmpty() || Boolean.TRUE.equals(row.get("requires_pre_action_form"))) {
            Map<String, Object> preActionForm = new LinkedHashMap<>();
            preActionForm.put("title", asNullableString(row.get("pre_action_form_title")));
            preActionForm.put("submitLabel", firstNonBlank(asNullableString(row.get("pre_action_form_submit_label")), "确定"));
            preActionForm.put("fields", fields);
            result.put("preActionForm", preActionForm);
        }
        result.put("meta", asMap(row.get("meta")));
        result.put("version", positiveVersion(row.get("version")));
        result.put("createdAt", row.get("created_at"));
        result.put("createdBy", asNullableString(row.get("created_by")));
        result.put("updatedAt", row.get("updated_at"));
        result.put("updatedBy", asNullableString(row.get("updated_by")));
        return result;
    }

    private Map<String, Object> toEntry(Map<String, Object> row) {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("id", asString(row.get("id")));
        result.put("code", asString(row.get("code")));
        result.put("name", asString(row.get("name")));
        result.put("status", asString(row.get("status")));
        result.put("sortOrder", asInt(row.get("sort_order"), 0));
        result.put("meta", asMap(row.get("meta")));
        result.put("version", positiveVersion(row.get("version")));
        result.put("createdAt", row.get("created_at"));
        result.put("createdBy", asNullableString(row.get("created_by")));
        result.put("updatedAt", row.get("updated_at"));
        result.put("updatedBy", asNullableString(row.get("updated_by")));
        return result;
    }

    private Map<String, Object> loadEntry(String dailyEntryId) {
        try {
            return jdbc.queryForMap(
                "SELECT id, code, name, status, sort_order, meta, version, created_at, created_by, updated_at, updated_by FROM mo_daily_categories WHERE id = ?",
                dailyEntryId
            );
        } catch (EmptyResultDataAccessException ex) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "日常条目不存在");
        }
    }

    private Map<String, Object> asMap(Object value) {
        if (value == null) {
            return new LinkedHashMap<>();
        }
        if (value instanceof Map<?, ?> map) {
            Map<String, Object> result = new LinkedHashMap<>();
            map.forEach((key, item) -> result.put(String.valueOf(key), item));
            return result;
        }
        return objectMapper.convertValue(value, MAP_TYPE);
    }

    @SuppressWarnings("unchecked")
    private List<Map<String, Object>> asListOfMap(Object value) {
        if (value == null) {
            return List.of();
        }
        if (value instanceof List<?> list) {
            return (List<Map<String, Object>>) list;
        }
        return List.of();
    }

    private String toJson(Map<String, Object> value) {
        try {
            return objectMapper.writeValueAsString(value == null ? Map.of() : value);
        } catch (JsonProcessingException ex) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "JSON 序列化失败");
        }
    }

    private String normalizeAllowed(String value, List<String> options, boolean allowBlank, String message) {
        if (!hasText(value)) {
            if (allowBlank) {
                return null;
            }
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, message);
        }
        String normalized = value.trim().toUpperCase(Locale.ROOT);
        if (!options.contains(normalized)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, message);
        }
        return normalized;
    }

    private String normalizeStatus(String value, boolean allowBlank, String message) {
        if (!hasText(value)) {
            if (allowBlank) {
                return null;
            }
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, message);
        }
        String normalized = value.trim().toUpperCase(Locale.ROOT);
        if ("DISABLED".equals(normalized)) {
            return "INACTIVE";
        }
        if (!STATUS_OPTIONS.contains(normalized)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, message);
        }
        return normalized;
    }

    private String requireText(Object value, String message) {
        String text = asNullableString(value);
        if (!hasText(text)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, message);
        }
        return text;
    }

    private Integer nullableInteger(Object value) {
        if (value == null) {
            return null;
        }
        if (value instanceof Number number) {
            return number.intValue();
        }
        try {
            return Integer.parseInt(String.valueOf(value));
        } catch (NumberFormatException ex) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "整数格式不合法");
        }
    }

    private int positiveVersion(Object value) {
        int version = value == null ? 1 : nullableInteger(value);
        if (version <= 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "version 必须大于 0");
        }
        return version;
    }

    private boolean hasText(String value) {
        return value != null && !value.isBlank();
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
}
