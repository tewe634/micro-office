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
import java.util.Objects;
import java.util.Set;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class DailyEntryChatAdminService {
    private static final TypeReference<LinkedHashMap<String, Object>> MAP_TYPE = new TypeReference<>() {};
    private static final List<String> STATUS_OPTIONS = List.of("ACTIVE", "INACTIVE");
    private static final List<String> STRATEGY_OPTIONS = List.of("BY_ENTRY_ONLY", "BY_ENTRY_AND_USER");
    private static final List<String> BINDING_SCOPE_OPTIONS = List.of("SHARED", "PERSONAL");

    private final JdbcTemplate jdbc;
    private final ObjectMapper objectMapper;

    public List<Map<String, Object>> listPolicies(String status, String keyword) {
        String normalizedStatus = normalizeStatus(status, true, "聊天策略状态不合法，仅支持 ACTIVE 或 INACTIVE");
        String normalizedKeyword = blankToNull(keyword);
        List<Map<String, Object>> rows;
        if (hasText(normalizedStatus) && hasText(normalizedKeyword)) {
            String pattern = "%" + normalizedKeyword + "%";
            rows = jdbc.queryForList(
                "SELECT c.id AS daily_entry_id, c.code AS daily_entry_code, c.name AS daily_entry_name, c.status AS daily_entry_status, " +
                    "p.id AS policy_id, p.entry_code, p.entry_name, p.session_resolve_strategy, p.provider_key, p.status AS policy_status, p.meta, p.version, p.created_at, p.created_by, p.updated_at, p.updated_by, " +
                    "COALESCE((SELECT COUNT(*) FROM mo_daily_entry_session_bindings b WHERE b.daily_entry_id = c.id AND b.status = 'ACTIVE'), 0) AS active_binding_count " +
                    "FROM mo_daily_categories c " +
                    "LEFT JOIN mo_daily_entry_chat_policies p ON p.daily_entry_id = c.id " +
                    "WHERE p.status = ? AND (c.code ILIKE ? OR c.name ILIKE ? OR COALESCE(p.entry_code, '') ILIKE ? OR COALESCE(p.entry_name, '') ILIKE ?) " +
                    "ORDER BY c.sort_order, c.code, c.id",
                normalizedStatus, pattern, pattern, pattern, pattern
            );
        } else if (hasText(normalizedStatus)) {
            rows = jdbc.queryForList(
                "SELECT c.id AS daily_entry_id, c.code AS daily_entry_code, c.name AS daily_entry_name, c.status AS daily_entry_status, " +
                    "p.id AS policy_id, p.entry_code, p.entry_name, p.session_resolve_strategy, p.provider_key, p.status AS policy_status, p.meta, p.version, p.created_at, p.created_by, p.updated_at, p.updated_by, " +
                    "COALESCE((SELECT COUNT(*) FROM mo_daily_entry_session_bindings b WHERE b.daily_entry_id = c.id AND b.status = 'ACTIVE'), 0) AS active_binding_count " +
                    "FROM mo_daily_categories c " +
                    "LEFT JOIN mo_daily_entry_chat_policies p ON p.daily_entry_id = c.id " +
                    "WHERE p.status = ? ORDER BY c.sort_order, c.code, c.id",
                normalizedStatus
            );
        } else if (hasText(normalizedKeyword)) {
            String pattern = "%" + normalizedKeyword + "%";
            rows = jdbc.queryForList(
                "SELECT c.id AS daily_entry_id, c.code AS daily_entry_code, c.name AS daily_entry_name, c.status AS daily_entry_status, " +
                    "p.id AS policy_id, p.entry_code, p.entry_name, p.session_resolve_strategy, p.provider_key, p.status AS policy_status, p.meta, p.version, p.created_at, p.created_by, p.updated_at, p.updated_by, " +
                    "COALESCE((SELECT COUNT(*) FROM mo_daily_entry_session_bindings b WHERE b.daily_entry_id = c.id AND b.status = 'ACTIVE'), 0) AS active_binding_count " +
                    "FROM mo_daily_categories c " +
                    "LEFT JOIN mo_daily_entry_chat_policies p ON p.daily_entry_id = c.id " +
                    "WHERE c.code ILIKE ? OR c.name ILIKE ? OR COALESCE(p.entry_code, '') ILIKE ? OR COALESCE(p.entry_name, '') ILIKE ? " +
                    "ORDER BY c.sort_order, c.code, c.id",
                pattern, pattern, pattern, pattern
            );
        } else {
            rows = jdbc.queryForList(
                "SELECT c.id AS daily_entry_id, c.code AS daily_entry_code, c.name AS daily_entry_name, c.status AS daily_entry_status, " +
                    "p.id AS policy_id, p.entry_code, p.entry_name, p.session_resolve_strategy, p.provider_key, p.status AS policy_status, p.meta, p.version, p.created_at, p.created_by, p.updated_at, p.updated_by, " +
                    "COALESCE((SELECT COUNT(*) FROM mo_daily_entry_session_bindings b WHERE b.daily_entry_id = c.id AND b.status = 'ACTIVE'), 0) AS active_binding_count " +
                    "FROM mo_daily_categories c " +
                    "LEFT JOIN mo_daily_entry_chat_policies p ON p.daily_entry_id = c.id " +
                    "ORDER BY c.sort_order, c.code, c.id"
            );
        }
        List<Map<String, Object>> result = new ArrayList<>();
        for (Map<String, Object> row : rows) {
            result.add(toPolicyEnvelope(row));
        }
        return result;
    }

    public Map<String, Object> getPolicy(String dailyEntryId) {
        Map<String, Object> entry = loadEntry(dailyEntryId);
        Map<String, Object> policy = loadPolicyRowNullable(dailyEntryId);
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("dailyEntry", entry);
        result.put("policy", policy == null ? null : toPolicy(policy));
        return result;
    }

    @Transactional
    public Map<String, Object> savePolicy(String dailyEntryId, Map<String, Object> body, String userId) {
        Map<String, Object> entry = loadEntry(dailyEntryId);
        String entryCode = firstNonBlank(asNullableString(body.get("entryCode")), asString(entry.get("code")));
        String entryName = firstNonBlank(asNullableString(body.get("entryName")), asString(entry.get("name")));
        String strategy = normalizeAllowed(asNullableString(body.get("sessionResolveStrategy")), STRATEGY_OPTIONS, false, "sessionResolveStrategy 不合法");
        String providerKey = requireText(body.get("providerKey"), "providerKey 不能为空");
        String status = normalizeStatus(asNullableString(body.get("status")), true, "策略状态不合法，仅支持 ACTIVE 或 INACTIVE");
        int version = positiveVersion(body.get("version"));
        Map<String, Object> meta = asMap(body.get("meta"));
        Map<String, Object> existing = loadPolicyRowNullable(dailyEntryId);
        if (existing == null) {
            jdbc.update(
                "INSERT INTO mo_daily_entry_chat_policies (id, daily_entry_id, entry_code, entry_name, session_resolve_strategy, provider_key, status, meta, version, created_by, updated_by) " +
                    "VALUES (?, ?, ?, ?, ?, ?, ?, CAST(? AS jsonb), ?, ?, ?)",
                firstNonBlank(asNullableString(body.get("id")), UUID.randomUUID().toString()),
                dailyEntryId,
                entryCode,
                entryName,
                strategy,
                providerKey,
                hasText(status) ? status : "ACTIVE",
                toJson(meta),
                version,
                userId,
                userId
            );
        } else {
            jdbc.update(
                "UPDATE mo_daily_entry_chat_policies SET entry_code = ?, entry_name = ?, session_resolve_strategy = ?, provider_key = ?, status = ?, meta = CAST(? AS jsonb), version = ?, updated_by = ?, updated_at = now() WHERE daily_entry_id = ?",
                entryCode,
                entryName,
                strategy,
                providerKey,
                hasText(status) ? status : "ACTIVE",
                toJson(meta),
                version,
                userId,
                dailyEntryId
            );
        }
        return getPolicy(dailyEntryId);
    }

    public List<Map<String, Object>> listSessionBindings(String dailyEntryId) {
        loadEntry(dailyEntryId);
        List<Map<String, Object>> rows = jdbc.queryForList(
            "SELECT id, daily_entry_id, user_id, session_id, binding_scope, status, meta, version, created_at, created_by, updated_at, updated_by " +
                "FROM mo_daily_entry_session_bindings WHERE daily_entry_id = ? ORDER BY binding_scope, user_id NULLS FIRST, id",
            dailyEntryId
        );
        List<Map<String, Object>> result = new ArrayList<>();
        for (Map<String, Object> row : rows) {
            result.add(toBinding(row));
        }
        return result;
    }

    @Transactional
    public List<Map<String, Object>> saveSessionBindings(String dailyEntryId, List<Map<String, Object>> bindings, String userId) {
        loadPolicyRow(dailyEntryId);
        List<Map<String, Object>> normalized = normalizeBindings(dailyEntryId, bindings);
        jdbc.update("DELETE FROM mo_daily_entry_session_bindings WHERE daily_entry_id = ?", dailyEntryId);
        for (Map<String, Object> binding : normalized) {
            jdbc.update(
                "INSERT INTO mo_daily_entry_session_bindings (id, daily_entry_id, user_id, session_id, binding_scope, status, meta, version, created_by, updated_by) " +
                    "VALUES (?, ?, ?, ?, ?, ?, CAST(? AS jsonb), ?, ?, ?)",
                binding.get("id"),
                dailyEntryId,
                binding.get("userId"),
                binding.get("sessionId"),
                binding.get("bindingScope"),
                binding.get("status"),
                toJson(asMap(binding.get("meta"))),
                binding.get("version"),
                userId,
                userId
            );
        }
        return listSessionBindings(dailyEntryId);
    }

    private List<Map<String, Object>> normalizeBindings(String dailyEntryId, List<Map<String, Object>> bindings) {
        if (bindings == null) {
            return List.of();
        }
        List<Map<String, Object>> result = new ArrayList<>();
        Set<String> dedup = new LinkedHashSet<>();
        boolean sharedExists = false;
        for (Map<String, Object> binding : bindings) {
            String bindingScope = normalizeAllowed(asNullableString(binding.get("bindingScope")), BINDING_SCOPE_OPTIONS, false, "bindingScope 不合法");
            String sessionId = requireText(binding.get("sessionId"), "sessionId 不能为空");
            String status = normalizeStatus(asNullableString(binding.get("status")), true, "绑定状态不合法，仅支持 ACTIVE 或 INACTIVE");
            int version = positiveVersion(binding.get("version"));
            String userId = asNullableString(binding.get("userId"));
            if ("SHARED".equals(bindingScope)) {
                if (hasText(userId)) {
                    throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "SHARED 绑定不允许携带 userId");
                }
                if (sharedExists) {
                    throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "SHARED 绑定只允许一条");
                }
                sharedExists = true;
            }
            if ("PERSONAL".equals(bindingScope) && !hasText(userId)) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "PERSONAL 绑定必须提供 userId");
            }
            String dedupKey = bindingScope + "#" + firstNonBlank(userId, "");
            if (!dedup.add(dedupKey)) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "会话绑定重复: " + dedupKey);
            }
            Map<String, Object> normalized = new LinkedHashMap<>();
            normalized.put("id", firstNonBlank(asNullableString(binding.get("id")), UUID.randomUUID().toString()));
            normalized.put("externalDailyEntryId", dailyEntryId);
            normalized.put("userId", userId);
            normalized.put("sessionId", sessionId);
            normalized.put("bindingScope", bindingScope);
            normalized.put("status", hasText(status) ? status : "ACTIVE");
            normalized.put("meta", asMap(binding.get("meta")));
            normalized.put("version", version);
            result.add(normalized);
        }
        return result;
    }

    private Map<String, Object> loadEntry(String dailyEntryId) {
        try {
            Map<String, Object> row = jdbc.queryForMap(
                "SELECT id, code, name, sort_order, status, meta, version, created_at, created_by, updated_at, updated_by FROM mo_daily_categories WHERE id = ?",
                dailyEntryId
            );
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
        } catch (EmptyResultDataAccessException ex) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "日常条目不存在");
        }
    }

    private Map<String, Object> loadPolicyRow(String dailyEntryId) {
        Map<String, Object> row = loadPolicyRowNullable(dailyEntryId);
        if (row == null) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "聊天策略不存在，请先保存聊天策略");
        }
        return row;
    }

    private Map<String, Object> loadPolicyRowNullable(String dailyEntryId) {
        try {
            return jdbc.queryForMap(
                "SELECT id, daily_entry_id, entry_code, entry_name, session_resolve_strategy, provider_key, status, meta, version, created_at, created_by, updated_at, updated_by " +
                    "FROM mo_daily_entry_chat_policies WHERE daily_entry_id = ?",
                dailyEntryId
            );
        } catch (EmptyResultDataAccessException ex) {
            return null;
        }
    }

    private Map<String, Object> toPolicyEnvelope(Map<String, Object> row) {
        Map<String, Object> result = new LinkedHashMap<>();
        Map<String, Object> dailyEntry = new LinkedHashMap<>();
        dailyEntry.put("id", asString(row.get("daily_entry_id")));
        dailyEntry.put("code", asString(row.get("daily_entry_code")));
        dailyEntry.put("name", asString(row.get("daily_entry_name")));
        dailyEntry.put("status", asString(row.get("daily_entry_status")));
        result.put("dailyEntry", dailyEntry);
        if (row.get("policy_id") == null) {
            result.put("policy", null);
            result.put("activeBindingCount", asInt(row.get("active_binding_count"), 0));
            return result;
        }
        result.put("policy", toPolicy(row));
        result.put("activeBindingCount", asInt(row.get("active_binding_count"), 0));
        return result;
    }

    private Map<String, Object> toPolicy(Map<String, Object> row) {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("id", asString(row.get("id")) == null ? asString(row.get("policy_id")) : asString(row.get("id")));
        result.put("dailyEntryId", firstNonBlank(asNullableString(row.get("daily_entry_id")), asNullableString(row.get("external_daily_entry_id"))));
        result.put("entryCode", firstNonBlank(asNullableString(row.get("entry_code")), asNullableString(row.get("daily_entry_code"))));
        result.put("entryName", firstNonBlank(asNullableString(row.get("entry_name")), asNullableString(row.get("daily_entry_name"))));
        result.put("sessionResolveStrategy", asString(row.get("session_resolve_strategy")));
        result.put("providerKey", asString(row.get("provider_key")));
        result.put("status", firstNonBlank(asNullableString(row.get("status")), asNullableString(row.get("policy_status"))));
        result.put("meta", asMap(row.get("meta")));
        result.put("version", positiveVersion(row.get("version")));
        result.put("createdAt", row.get("created_at"));
        result.put("createdBy", asNullableString(row.get("created_by")));
        result.put("updatedAt", row.get("updated_at"));
        result.put("updatedBy", asNullableString(row.get("updated_by")));
        return result;
    }

    private Map<String, Object> toBinding(Map<String, Object> row) {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("id", asString(row.get("id")));
        result.put("dailyEntryId", firstNonBlank(asNullableString(row.get("daily_entry_id")), asNullableString(row.get("external_daily_entry_id"))));
        result.put("userId", asNullableString(row.get("user_id")));
        result.put("sessionId", asString(row.get("session_id")));
        result.put("bindingScope", asString(row.get("binding_scope")));
        result.put("status", asString(row.get("status")));
        result.put("meta", asMap(row.get("meta")));
        result.put("version", positiveVersion(row.get("version")));
        result.put("createdAt", row.get("created_at"));
        result.put("createdBy", asNullableString(row.get("created_by")));
        result.put("updatedAt", row.get("updated_at"));
        result.put("updatedBy", asNullableString(row.get("updated_by")));
        return result;
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

    private int positiveVersion(Object value) {
        int version = asInt(value, 1);
        if (version <= 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "version 必须大于 0");
        }
        return version;
    }

    private String blankToNull(String value) {
        return hasText(value) ? value.trim() : null;
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
