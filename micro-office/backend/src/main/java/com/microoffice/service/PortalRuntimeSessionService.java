package com.microoffice.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.EmptyResultDataAccessException;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Objects;

@Service
@RequiredArgsConstructor
public class PortalRuntimeSessionService {
    private static final TypeReference<LinkedHashMap<String, Object>> MAP_TYPE = new TypeReference<>() {};

    private final JdbcTemplate jdbc;
    private final ObjectMapper objectMapper;

    public Map<String, Object> openWorkbenchSession(String viewerId, Map<String, Object> body) {
        String sessionType = requireText(body.get("sessionType"), "sessionType 不能为空").trim().toUpperCase();
        if (!"DAILY_ENTRY".equals(sessionType)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "当前仅支持 DAILY_ENTRY 会话打开");
        }
        return resolveDailyEntrySession(viewerId, body);
    }

    private Map<String, Object> resolveDailyEntrySession(String viewerId, Map<String, Object> body) {
        String externalDailyEntryId = firstNonBlank(
            asNullableString(body.get("targetId")),
            asNullableString(body.get("dailyEntryId")),
            asNullableString(body.get("externalDailyEntryId"))
        );
        if (!hasText(externalDailyEntryId)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "DAILY_ENTRY 必须提供 targetId");
        }

        Map<String, Object> policy = loadPolicy(externalDailyEntryId);
        String strategy = requireText(policy.get("session_resolve_strategy"), "DAILY_ENTRY 策略缺失").trim().toUpperCase();
        Map<String, Object> binding = switch (strategy) {
            case "BY_ENTRY_ONLY" -> loadBindingByEntryOnly(externalDailyEntryId);
            case "BY_ENTRY_AND_USER" -> loadBindingByEntryAndUser(externalDailyEntryId, viewerId);
            default -> throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "不支持的 DAILY_ENTRY 策略: " + strategy);
        };

        Map<String, Object> session = loadSession(asString(binding.get("session_id")));
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("sessionType", "DAILY_ENTRY");
        result.put("targetId", externalDailyEntryId);
        result.put("sessionId", asString(binding.get("session_id")));
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
        return result;
    }

    private Map<String, Object> loadPolicy(String externalDailyEntryId) {
        try {
            return jdbc.queryForMap(
                "SELECT id, daily_entry_id, entry_code, entry_name, session_resolve_strategy, provider_key, status, meta " +
                    "FROM mo_daily_entry_chat_policies " +
                    "WHERE daily_entry_id = ? AND status = 'ACTIVE' " +
                    "ORDER BY updated_at DESC, created_at DESC LIMIT 1",
                externalDailyEntryId
            );
        } catch (EmptyResultDataAccessException ex) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "未找到 DAILY_ENTRY 会话策略: " + externalDailyEntryId);
        }
    }

    private Map<String, Object> loadBindingByEntryOnly(String externalDailyEntryId) {
        try {
            return jdbc.queryForMap(
                "SELECT id, daily_entry_id, user_id, session_id, binding_scope, status, meta " +
                    "FROM mo_daily_entry_session_bindings " +
                    "WHERE daily_entry_id = ? AND binding_scope = 'SHARED' AND status = 'ACTIVE' " +
                    "ORDER BY updated_at DESC, created_at DESC LIMIT 1",
                externalDailyEntryId
            );
        } catch (EmptyResultDataAccessException ex) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "未找到 DAILY_ENTRY 统一会话绑定: " + externalDailyEntryId);
        }
    }

    private Map<String, Object> loadBindingByEntryAndUser(String externalDailyEntryId, String viewerId) {
        try {
            return jdbc.queryForMap(
                "SELECT id, daily_entry_id, user_id, session_id, binding_scope, status, meta " +
                    "FROM mo_daily_entry_session_bindings " +
                    "WHERE daily_entry_id = ? AND user_id = ? AND binding_scope = 'PERSONAL' AND status = 'ACTIVE' " +
                    "ORDER BY updated_at DESC, created_at DESC LIMIT 1",
                externalDailyEntryId,
                viewerId
            );
        } catch (EmptyResultDataAccessException ex) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "未找到 DAILY_ENTRY 个人会话绑定: " + externalDailyEntryId);
        }
    }

    private Map<String, Object> loadSession(String sessionId) {
        try {
            return jdbc.queryForMap(
                "SELECT id, title, status, type, meta FROM mo_conversations WHERE id = ?",
                sessionId
            );
        } catch (EmptyResultDataAccessException ex) {
            Map<String, Object> result = new LinkedHashMap<>();
            result.put("id", sessionId);
            return result;
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
        String text = Objects.toString(value, "").trim();
        if (text.isEmpty()) {
            return new LinkedHashMap<>();
        }
        try {
            return objectMapper.readValue(text, MAP_TYPE);
        } catch (Exception ex) {
            Map<String, Object> result = new LinkedHashMap<>();
            result.put("raw", value);
            return result;
        }
    }

    private String requireText(Object value, String message) {
        String text = asNullableString(value);
        if (!hasText(text)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, message);
        }
        return text;
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

    private boolean hasText(String value) {
        return value != null && !value.isBlank();
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
