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
public class PortalRuntimeSessionService {
    private static final TypeReference<LinkedHashMap<String, Object>> MAP_TYPE = new TypeReference<>() {};
    private static final List<String> FORM_INPUT_TYPES = List.of("TEXT", "TEXTAREA", "NUMBER", "SELECT");

    private final JdbcTemplate jdbc;
    private final ObjectMapper objectMapper;
    private final DailyEntryBehaviorService dailyEntryBehaviorService;

    @Transactional
    public Map<String, Object> openWorkbenchSession(String viewerId, Map<String, Object> body) {
        Map<String, Object> safeBody = body == null ? new LinkedHashMap<>() : new LinkedHashMap<>(body);
        String dailyEntryId = requireDailyEntryId(safeBody);
        String sessionType = resolveSessionType(safeBody, dailyEntryId);
        if (!"DAILY_ENTRY".equals(sessionType)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "当前仅支持 DAILY_ENTRY 会话打开");
        }

        Map<String, Object> behavior = dailyEntryBehaviorService.loadRuntimeBehavior(dailyEntryId);
        Map<String, Object> actionParams = extractActionParams(safeBody);
        if (behavior != null) {
            actionParams = validateBehaviorActionParams(behavior, actionParams);
            String actionType = requireText(behavior.get("actionType"), "日常条目行为配置缺失 actionType").trim().toUpperCase(Locale.ROOT);
            if (!"OPEN_WORKBENCH_SESSION".equals(actionType)) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "不支持的日常条目动作类型: " + actionType);
            }
            String executionMode = firstNonBlank(asNullableString(behavior.get("executionMode")), "OPEN_EXISTING");
            if ("CREATE_SESSION".equals(executionMode)) {
                return createDailyEntrySession(viewerId, dailyEntryId, safeBody, behavior, actionParams);
            }
        }
        return resolveDailyEntrySession(viewerId, dailyEntryId, behavior);
    }

    private String resolveSessionType(Map<String, Object> body, String dailyEntryId) {
        String sessionType = asNullableString(body.get("sessionType"));
        if (hasText(sessionType)) {
            return sessionType.trim().toUpperCase(Locale.ROOT);
        }
        Map<String, Object> behavior = dailyEntryBehaviorService.loadRuntimeBehavior(dailyEntryId);
        if (behavior != null && hasText(asNullableString(behavior.get("sessionType")))) {
            return asNullableString(behavior.get("sessionType")).trim().toUpperCase(Locale.ROOT);
        }
        return "DAILY_ENTRY";
    }

    private Map<String, Object> resolveDailyEntrySession(String viewerId,
                                                         String dailyEntryId,
                                                         Map<String, Object> behavior) {
        Map<String, Object> policy = loadPolicy(dailyEntryId);
        String strategy = requireText(policy.get("session_resolve_strategy"), "DAILY_ENTRY 策略缺失").trim().toUpperCase(Locale.ROOT);
        Map<String, Object> binding = switch (strategy) {
            case "BY_ENTRY_ONLY" -> loadBindingByEntryOnly(dailyEntryId);
            case "BY_ENTRY_AND_USER" -> loadBindingByEntryAndUser(dailyEntryId, viewerId);
            default -> throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "不支持的 DAILY_ENTRY 策略: " + strategy);
        };

        Map<String, Object> session = loadSession(asString(binding.get("session_id")));
        Map<String, Object> result = buildSessionResult("OPEN_EXISTING_SESSION", "DAILY_ENTRY", dailyEntryId, session);
        result.put("sessionResolveStrategy", strategy);
        result.put("bindingScope", asString(binding.get("binding_scope")));
        result.put("providerKey", asString(policy.get("provider_key")));
        result.put("policyId", asString(policy.get("id")));
        result.put("bindingId", asString(binding.get("id")));
        result.put("entryCode", asString(policy.get("entry_code")));
        result.put("entryName", asString(policy.get("entry_name")));
        result.put("sessionTitle", firstNonBlank(asNullableString(session.get("title")), asNullableString(policy.get("entry_name"))));
        result.put("sessionStatus", asNullableString(session.get("status")));
        result.put("sessionMeta", asMap(session.get("meta")));
        result.put("policyMeta", asMap(policy.get("meta")));
        if (behavior != null) {
            result.put("behaviorId", asString(behavior.get("id")));
        }
        return result;
    }

    private Map<String, Object> createDailyEntrySession(String viewerId,
                                                        String dailyEntryId,
                                                        Map<String, Object> body,
                                                        Map<String, Object> behavior,
                                                        Map<String, Object> actionParams) {
        Map<String, Object> dailyEntry = loadDailyEntry(dailyEntryId);
        String sessionTitle = requireSessionTitle(actionParams);
        Map<String, Object> sessionMeta = buildCreatedSessionMeta(body, behavior, actionParams, dailyEntry);
        String sessionId = insertConversation(viewerId, dailyEntryId, sessionTitle, sessionMeta);
        ensureViewerMembership(sessionId, viewerId);

        Map<String, Object> session = loadSession(sessionId);
        Map<String, Object> result = buildSessionResult("CREATED_SESSION", "DAILY_ENTRY", dailyEntryId, session);
        result.put("behaviorId", asString(behavior.get("id")));
        result.put("entryCode", asString(dailyEntry.get("code")));
        result.put("entryName", asString(dailyEntry.get("name")));
        result.put("sessionTitle", firstNonBlank(asNullableString(session.get("title")), sessionTitle));
        result.put("sessionStatus", firstNonBlank(asNullableString(session.get("status")), "ACTIVE"));
        result.put("sessionMeta", asMap(session.get("meta")));
        result.put("actionParams", actionParams);
        return result;
    }

    private Map<String, Object> buildSessionResult(String actionResultType,
                                                   String sessionType,
                                                   String targetId,
                                                   Map<String, Object> session) {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("actionResultType", actionResultType);
        result.put("sessionType", sessionType);
        result.put("targetId", targetId);
        result.put("sessionId", asString(session.get("id")));
        return result;
    }

    private Map<String, Object> validateBehaviorActionParams(Map<String, Object> behavior, Map<String, Object> actionParams) {
        Map<String, Object> safeParams = actionParams == null ? new LinkedHashMap<>() : new LinkedHashMap<>(actionParams);
        boolean requiresForm = Boolean.TRUE.equals(behavior.get("requiresPreActionForm"));
        List<Map<String, Object>> fields = asListOfMap(behavior.get("preActionFields"));
        if (!requiresForm && fields.isEmpty()) {
            return safeParams;
        }

        Set<String> allowedFieldKeys = new LinkedHashSet<>();
        for (Map<String, Object> field : fields) {
            String fieldKey = requireText(field.get("fieldKey"), "条目行为字段配置不完整");
            String inputType = requireText(field.get("inputType"), "条目行为字段配置不完整").trim().toUpperCase(Locale.ROOT);
            if (!FORM_INPUT_TYPES.contains(inputType)) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "不支持的条目行为字段类型: " + inputType);
            }
            allowedFieldKeys.add(fieldKey);
            String value = asNullableString(safeParams.get(fieldKey));
            if (!hasText(value) && hasText(asNullableString(field.get("defaultValue")))) {
                safeParams.put(fieldKey, asNullableString(field.get("defaultValue")));
                value = asNullableString(safeParams.get(fieldKey));
            }
            if (Boolean.TRUE.equals(field.get("required")) && !hasText(value)) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "缺少必填动作参数: " + fieldKey);
            }
            Integer maxLength = nullableInteger(field.get("maxLength"));
            if (maxLength != null && hasText(value) && value.length() > maxLength) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "动作参数超长: " + fieldKey);
            }
        }
        for (String key : new ArrayList<>(safeParams.keySet())) {
            if (!allowedFieldKeys.contains(key)) {
                safeParams.remove(key);
            }
        }
        return safeParams;
    }

    private Map<String, Object> extractActionParams(Map<String, Object> body) {
        Object raw = firstNonBlankValue(body.get("actionParams"), body.get("formData"), body.get("params"));
        return asMap(raw);
    }

    private String requireDailyEntryId(Map<String, Object> body) {
        String dailyEntryId = firstNonBlank(
            asNullableString(body.get("targetId")),
            asNullableString(body.get("dailyEntryId")),
            asNullableString(body.get("externalDailyEntryId"))
        );
        if (!hasText(dailyEntryId)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "DAILY_ENTRY 必须提供 targetId");
        }
        return dailyEntryId;
    }

    private String requireSessionTitle(Map<String, Object> actionParams) {
        return requireText(firstNonBlank(
            asNullableString(actionParams.get("session_title")),
            asNullableString(actionParams.get("group_topic"))
        ), "session_title 不能为空");
    }

    private Map<String, Object> buildCreatedSessionMeta(Map<String, Object> body,
                                                        Map<String, Object> behavior,
                                                        Map<String, Object> actionParams,
                                                        Map<String, Object> dailyEntry) {
        Map<String, Object> meta = new LinkedHashMap<>();
        meta.put("createdFrom", "daily_entry_behavior");
        meta.put("dailyEntryId", asString(dailyEntry.get("id")));
        meta.put("dailyEntryCode", asString(dailyEntry.get("code")));
        meta.put("dailyEntryName", asString(dailyEntry.get("name")));
        meta.put("behaviorId", asString(behavior.get("id")));
        meta.put("actionType", asString(behavior.get("actionType")));
        meta.put("executionMode", asString(behavior.get("executionMode")));
        meta.put("actionParams", actionParams);
        Map<String, Object> behaviorMeta = asMap(behavior.get("meta"));
        if (!behaviorMeta.isEmpty()) {
            meta.put("behaviorMeta", behaviorMeta);
        }
        Map<String, Object> sourceContext = asMap(body.get("context"));
        if (!sourceContext.isEmpty()) {
            meta.put("sourceContext", sourceContext);
        }
        return meta;
    }

    private Map<String, Object> loadDailyEntry(String dailyEntryId) {
        try {
            return jdbc.queryForMap(
                "SELECT id, code, name, status, meta FROM mo_daily_categories WHERE id = ?",
                dailyEntryId
            );
        } catch (EmptyResultDataAccessException ex) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "日常条目不存在: " + dailyEntryId);
        }
    }

    private Map<String, Object> loadPolicy(String dailyEntryId) {
        try {
            return jdbc.queryForMap(
                "SELECT id, daily_entry_id, entry_code, entry_name, session_resolve_strategy, provider_key, status, meta " +
                    "FROM mo_daily_entry_chat_policies WHERE daily_entry_id = ? AND status = 'ACTIVE'",
                dailyEntryId
            );
        } catch (EmptyResultDataAccessException ex) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "聊天策略不存在，请先保存聊天策略");
        }
    }

    private Map<String, Object> loadBindingByEntryOnly(String dailyEntryId) {
        try {
            return jdbc.queryForMap(
                "SELECT id, daily_entry_id, user_id, session_id, binding_scope, status, meta " +
                    "FROM mo_daily_entry_session_bindings " +
                    "WHERE daily_entry_id = ? AND binding_scope = 'SHARED' AND status = 'ACTIVE' ORDER BY updated_at DESC, created_at DESC LIMIT 1",
                dailyEntryId
            );
        } catch (EmptyResultDataAccessException ex) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "未找到共享会话绑定");
        }
    }

    private Map<String, Object> loadBindingByEntryAndUser(String dailyEntryId, String viewerId) {
        try {
            return jdbc.queryForMap(
                "SELECT id, daily_entry_id, user_id, session_id, binding_scope, status, meta " +
                    "FROM mo_daily_entry_session_bindings " +
                    "WHERE daily_entry_id = ? AND binding_scope = 'PERSONAL' AND user_id = ? AND status = 'ACTIVE' " +
                    "ORDER BY updated_at DESC, created_at DESC LIMIT 1",
                dailyEntryId,
                viewerId
            );
        } catch (EmptyResultDataAccessException ex) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "未找到个人会话绑定");
        }
    }

    private Map<String, Object> loadSession(String sessionId) {
        try {
            return jdbc.queryForMap(
                "SELECT id, title, status, meta FROM mo_conversations WHERE id = ?",
                sessionId
            );
        } catch (EmptyResultDataAccessException ex) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "会话不存在: " + sessionId);
        }
    }

    private String insertConversation(String viewerId, String dailyEntryId, String title, Map<String, Object> meta) {
        String conversationId = UUID.randomUUID().toString();
        Set<String> columns = loadTableColumns("mo_conversations");
        if (columns.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "mo_conversations 表不存在");
        }
        List<String> columnList = new ArrayList<>();
        List<Object> params = new ArrayList<>();
        StringBuilder values = new StringBuilder();

        appendInsertValue(columnList, params, values, "id", conversationId);
        appendInsertValue(columnList, params, values, "daily_entry_id", dailyEntryId, columns);
        appendInsertValue(columnList, params, values, "title", title, columns);
        appendInsertValue(columnList, params, values, "type", "DAILY_ENTRY", columns);
        appendInsertValue(columnList, params, values, "status", "ACTIVE", columns);
        appendInsertValue(columnList, params, values, "meta", toJson(meta), columns);
        appendInsertValue(columnList, params, values, "organization_id", loadViewerOrgId(viewerId), columns);
        appendInsertValue(columnList, params, values, "project_id", null, columns);
        appendInsertValue(columnList, params, values, "created_by", viewerId, columns);
        appendInsertValue(columnList, params, values, "updated_by", viewerId, columns);
        appendInsertValue(columnList, params, values, "version", 1, columns);

        jdbc.update(
            "INSERT INTO mo_conversations (" + String.join(", ", columnList) + ") VALUES (" + values + ")",
            params.toArray()
        );
        return conversationId;
    }

    private void ensureViewerMembership(String sessionId, String viewerId) {
        if (!hasText(viewerId)) {
            return;
        }
        Set<String> columns = loadTableColumns("mo_conversation_members");
        if (columns.isEmpty() || !columns.contains("conversation_id") || !columns.contains("user_id")) {
            return;
        }
        Integer count = jdbc.queryForObject(
            "SELECT COUNT(*) FROM mo_conversation_members WHERE conversation_id = ? AND user_id = ?",
            Integer.class,
            sessionId,
            viewerId
        );
        if (count != null && count > 0) {
            return;
        }

        List<String> columnList = new ArrayList<>();
        List<Object> params = new ArrayList<>();
        StringBuilder values = new StringBuilder();
        appendInsertValue(columnList, params, values, "conversation_id", sessionId);
        appendInsertValue(columnList, params, values, "user_id", viewerId);
        appendInsertValue(columnList, params, values, "role", "MEMBER", columns);
        appendInsertValue(columnList, params, values, "member_role", "MEMBER", columns);
        appendInsertValue(columnList, params, values, "status", "ACTIVE", columns);
        appendInsertValue(columnList, params, values, "meta", toJson(Map.of("joinedFrom", "daily_entry_behavior")), columns);
        appendInsertValue(columnList, params, values, "created_by", viewerId, columns);
        appendInsertValue(columnList, params, values, "updated_by", viewerId, columns);
        appendInsertValue(columnList, params, values, "version", 1, columns);
        if (columns.contains("id")) {
            appendInsertValue(columnList, params, values, "id", UUID.randomUUID().toString(), columns);
        }

        jdbc.update(
            "INSERT INTO mo_conversation_members (" + String.join(", ", columnList) + ") VALUES (" + values + ")",
            params.toArray()
        );
    }

    private void appendInsertValue(List<String> columns,
                                   List<Object> params,
                                   StringBuilder values,
                                   String column,
                                   Object value) {
        columns.add(column);
        if (!values.isEmpty()) {
            values.append(", ");
        }
        values.append("?");
        params.add(value);
    }

    private void appendInsertValue(List<String> columns,
                                   List<Object> params,
                                   StringBuilder values,
                                   String column,
                                   Object value,
                                   Set<String> availableColumns) {
        if (availableColumns.contains(column)) {
            appendInsertValue(columns, params, values, column, value);
        }
    }

    private Set<String> loadTableColumns(String tableName) {
        return new LinkedHashSet<>(jdbc.queryForList(
            "SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = ?",
            String.class,
            tableName
        ));
    }

    private String loadViewerOrgId(String viewerId) {
        if (!hasText(viewerId)) {
            return null;
        }
        List<String> values = jdbc.queryForList(
            "SELECT org_id FROM sys_user WHERE id = ?",
            String.class,
            viewerId
        );
        return values.isEmpty() ? null : asNullableString(values.get(0));
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

    private Object firstNonBlankValue(Object... values) {
        if (values == null) {
            return null;
        }
        for (Object value : values) {
            if (value == null) {
                continue;
            }
            if (value instanceof String stringValue) {
                if (hasText(stringValue)) {
                    return stringValue;
                }
                continue;
            }
            return value;
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
        try {
            return Integer.parseInt(String.valueOf(value));
        } catch (NumberFormatException ex) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "整数格式不合法");
        }
    }

    private String requireText(Object value, String message) {
        String text = asNullableString(value);
        if (!hasText(text)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, message);
        }
        return text;
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
}
