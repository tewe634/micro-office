package com.microoffice.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class DailyEntryRuntimeService {
    private static final TypeReference<LinkedHashMap<String, Object>> MAP_TYPE = new TypeReference<>() {};

    private final JdbcTemplate jdbc;
    private final ObjectMapper objectMapper;
    private final DailyEntryBehaviorService dailyEntryBehaviorService;

    public List<Map<String, Object>> buildDailyList(Map<String, Object> runtimePayload) {
        String viewerId = asNullableString(asMap(runtimePayload.get("header")).get("id"));
        String viewerOrgId = loadViewerOrgId(viewerId);

        List<Map<String, Object>> categories = jdbc.queryForList(
            "SELECT id, code, name, sort_order, status, meta, version, created_at, created_by, updated_at, updated_by " +
                "FROM mo_daily_categories " +
                "WHERE status = 'ACTIVE' " +
                "ORDER BY sort_order, code, id"
        );
        if (categories.isEmpty()) {
            return List.of();
        }

        List<Map<String, Object>> targetRows = jdbc.queryForList(
            "SELECT daily_entry_id, target_type, target_id, status, sort_order " +
                "FROM mo_daily_entry_targets " +
                "WHERE status = 'ACTIVE' " +
                "ORDER BY daily_entry_id, sort_order, target_type, target_id"
        );
        Map<String, List<Map<String, Object>>> targetsByEntryId = targetRows.stream()
            .collect(Collectors.groupingBy(row -> asString(row.get("daily_entry_id")), LinkedHashMap::new, Collectors.toList()));
        Map<String, Map<String, Object>> behaviorsByEntryId = dailyEntryBehaviorService.loadRuntimeBehaviors(
            categories.stream().map(row -> asString(row.get("id"))).toList()
        );

        List<Map<String, Object>> result = new ArrayList<>();
        for (Map<String, Object> row : categories) {
            String dailyEntryId = asString(row.get("id"));
            List<Map<String, Object>> targets = targetsByEntryId.getOrDefault(dailyEntryId, List.of());
            if (!isVisibleToViewer(targets, viewerId, viewerOrgId)) {
                continue;
            }
            Map<String, Object> meta = asMap(row.get("meta"));
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("daily_entry_id", dailyEntryId);
            item.put("id", dailyEntryId);
            item.put("code", asString(row.get("code")));
            item.put("title", asString(row.get("name")));
            item.put("label", asString(row.get("name")));
            item.put("status", asString(row.get("status")));
            item.put("sortOrder", asInt(row.get("sort_order"), 0));
            item.put("hint", firstNonBlank(asNullableString(meta.get("description")), asNullableString(meta.get("hint"))));
            item.put("icon", asNullableString(meta.get("icon")));
            item.put("meta", meta);
            Map<String, Object> behavior = behaviorsByEntryId.get(dailyEntryId);
            if (behavior != null) {
                item.put("behavior", behavior);
            }
            result.add(item);
        }
        return result;
    }

    private boolean isVisibleToViewer(List<Map<String, Object>> targets, String viewerId, String viewerOrgId) {
        if (targets == null || targets.isEmpty()) {
            return true;
        }
        for (Map<String, Object> target : targets) {
            String targetType = asNullableString(target.get("target_type"));
            String targetId = asNullableString(target.get("target_id"));
            if ("USER".equalsIgnoreCase(targetType) && Objects.equals(targetId, viewerId)) {
                return true;
            }
            if ("ORG".equalsIgnoreCase(targetType) && Objects.equals(targetId, viewerOrgId)) {
                return true;
            }
        }
        return false;
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
