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
import java.util.regex.Pattern;

@Service
@RequiredArgsConstructor
public class DailyEntryAdminService {
    private static final TypeReference<LinkedHashMap<String, Object>> MAP_TYPE = new TypeReference<>() {};
    private static final List<String> STATUS_OPTIONS = List.of("ACTIVE", "INACTIVE");
    private static final List<String> TARGET_TYPES = List.of("ORG", "USER");
    private static final Pattern NON_CODE_PATTERN = Pattern.compile("[^A-Z0-9_]+");
    private static final Pattern NON_ID_PATTERN = Pattern.compile("[^a-z0-9_]+");

    private final JdbcTemplate jdbc;
    private final ObjectMapper objectMapper;

    public List<Map<String, Object>> listEntries(String status, String keyword) {
        String normalizedStatus = normalizeStatus(status, true, "条目状态不合法，仅支持 ACTIVE 或 INACTIVE");
        String normalizedKeyword = blankToNull(keyword);
        List<Map<String, Object>> rows;
        if (hasText(normalizedStatus) && hasText(normalizedKeyword)) {
            String pattern = "%" + normalizedKeyword + "%";
            rows = jdbc.queryForList(
                "SELECT c.id, c.code, c.name, c.sort_order, c.status, c.meta, c.version, c.created_at, c.created_by, c.updated_at, c.updated_by, " +
                    "COALESCE((SELECT COUNT(*) FROM mo_daily_entry_targets t WHERE t.daily_entry_id = c.id AND t.status = 'ACTIVE'), 0) AS active_target_count, " +
                    "EXISTS(SELECT 1 FROM mo_daily_entry_chat_policies p WHERE p.daily_entry_id = c.id) AS has_chat_policy " +
                    "FROM mo_daily_categories c " +
                    "WHERE c.status = ? AND (c.code ILIKE ? OR c.name ILIKE ?) " +
                    "ORDER BY c.sort_order, c.code, c.id",
                normalizedStatus,
                pattern,
                pattern
            );
        } else if (hasText(normalizedStatus)) {
            rows = jdbc.queryForList(
                "SELECT c.id, c.code, c.name, c.sort_order, c.status, c.meta, c.version, c.created_at, c.created_by, c.updated_at, c.updated_by, " +
                    "COALESCE((SELECT COUNT(*) FROM mo_daily_entry_targets t WHERE t.daily_entry_id = c.id AND t.status = 'ACTIVE'), 0) AS active_target_count, " +
                    "EXISTS(SELECT 1 FROM mo_daily_entry_chat_policies p WHERE p.daily_entry_id = c.id) AS has_chat_policy " +
                    "FROM mo_daily_categories c " +
                    "WHERE c.status = ? ORDER BY c.sort_order, c.code, c.id",
                normalizedStatus
            );
        } else if (hasText(normalizedKeyword)) {
            String pattern = "%" + normalizedKeyword + "%";
            rows = jdbc.queryForList(
                "SELECT c.id, c.code, c.name, c.sort_order, c.status, c.meta, c.version, c.created_at, c.created_by, c.updated_at, c.updated_by, " +
                    "COALESCE((SELECT COUNT(*) FROM mo_daily_entry_targets t WHERE t.daily_entry_id = c.id AND t.status = 'ACTIVE'), 0) AS active_target_count, " +
                    "EXISTS(SELECT 1 FROM mo_daily_entry_chat_policies p WHERE p.daily_entry_id = c.id) AS has_chat_policy " +
                    "FROM mo_daily_categories c " +
                    "WHERE c.code ILIKE ? OR c.name ILIKE ? " +
                    "ORDER BY c.sort_order, c.code, c.id",
                pattern,
                pattern
            );
        } else {
            rows = jdbc.queryForList(
                "SELECT c.id, c.code, c.name, c.sort_order, c.status, c.meta, c.version, c.created_at, c.created_by, c.updated_at, c.updated_by, " +
                    "COALESCE((SELECT COUNT(*) FROM mo_daily_entry_targets t WHERE t.daily_entry_id = c.id AND t.status = 'ACTIVE'), 0) AS active_target_count, " +
                    "EXISTS(SELECT 1 FROM mo_daily_entry_chat_policies p WHERE p.daily_entry_id = c.id) AS has_chat_policy " +
                    "FROM mo_daily_categories c ORDER BY c.sort_order, c.code, c.id"
            );
        }
        List<Map<String, Object>> result = new ArrayList<>();
        for (Map<String, Object> row : rows) {
            Map<String, Object> item = toEntry(row);
            item.put("activeTargetCount", asInt(row.get("active_target_count"), 0));
            item.put("hasChatPolicy", Boolean.TRUE.equals(row.get("has_chat_policy")));
            result.add(item);
        }
        return result;
    }

    public Map<String, Object> getEntry(String id) {
        return toEntry(loadEntryRow(id));
    }

    @Transactional
    public Map<String, Object> createEntry(Map<String, Object> body, String userId) {
        String code = sanitizeCode(requireText(body.get("code"), "条目编码不能为空"));
        ensureCodeUnique(code, null);
        String id = sanitizeId(firstNonBlank(asNullableString(body.get("id")), code.toLowerCase(Locale.ROOT)));
        ensureIdUnique(id);
        String name = requireText(body.get("name"), "条目名称不能为空");
        String status = normalizeStatus(asNullableString(body.get("status")), true, "条目状态不合法，仅支持 ACTIVE 或 INACTIVE");
        int sortOrder = asInt(body.get("sortOrder"), 0);
        int version = positiveVersion(body.get("version"));
        Map<String, Object> meta = asMap(body.get("meta"));

        jdbc.update(
            "INSERT INTO mo_daily_categories (id, code, name, sort_order, status, meta, version, created_by, updated_by) " +
                "VALUES (?, ?, ?, ?, ?, CAST(? AS jsonb), ?, ?, ?)",
            id,
            code,
            name,
            sortOrder,
            hasText(status) ? status : "ACTIVE",
            toJson(meta),
            version,
            userId,
            userId
        );
        return getEntry(id);
    }

    @Transactional
    public Map<String, Object> updateEntry(String id, Map<String, Object> body, String userId) {
        loadEntryRow(id);
        String code = sanitizeCode(requireText(body.get("code"), "条目编码不能为空"));
        ensureCodeUnique(code, id);
        String name = requireText(body.get("name"), "条目名称不能为空");
        String status = normalizeStatus(asNullableString(body.get("status")), true, "条目状态不合法，仅支持 ACTIVE 或 INACTIVE");
        int sortOrder = asInt(body.get("sortOrder"), 0);
        int version = positiveVersion(body.get("version"));
        Map<String, Object> meta = asMap(body.get("meta"));

        jdbc.update(
            "UPDATE mo_daily_categories SET code = ?, name = ?, sort_order = ?, status = ?, meta = CAST(? AS jsonb), version = ?, updated_by = ?, updated_at = now() WHERE id = ?",
            code,
            name,
            sortOrder,
            hasText(status) ? status : "ACTIVE",
            toJson(meta),
            version,
            userId,
            id
        );
        return getEntry(id);
    }

    @Transactional
    public Map<String, Object> updateEntryStatus(String id, String status, String userId) {
        loadEntryRow(id);
        String normalizedStatus = normalizeStatus(status, false, "条目状态不合法，仅支持 ACTIVE 或 INACTIVE");
        jdbc.update(
            "UPDATE mo_daily_categories SET status = ?, updated_by = ?, updated_at = now() WHERE id = ?",
            normalizedStatus,
            userId,
            id
        );
        return getEntry(id);
    }

    public List<Map<String, Object>> listTargets(String dailyEntryId) {
        loadEntryRow(dailyEntryId);
        List<Map<String, Object>> rows = jdbc.queryForList(
            "SELECT id, daily_entry_id, target_type, target_id, status, sort_order, created_at, created_by, updated_at, updated_by, version " +
                "FROM mo_daily_entry_targets WHERE daily_entry_id = ? ORDER BY sort_order, target_type, target_id, id",
            dailyEntryId
        );
        List<Map<String, Object>> result = new ArrayList<>();
        for (Map<String, Object> row : rows) {
            result.add(toTarget(row));
        }
        return result;
    }

    @Transactional
    public List<Map<String, Object>> saveTargets(String dailyEntryId, List<Map<String, Object>> targets, String userId) {
        loadEntryRow(dailyEntryId);
        List<Map<String, Object>> normalizedTargets = normalizeTargets(dailyEntryId, targets);
        jdbc.update("DELETE FROM mo_daily_entry_targets WHERE daily_entry_id = ?", dailyEntryId);
        for (Map<String, Object> target : normalizedTargets) {
            jdbc.update(
                "INSERT INTO mo_daily_entry_targets (id, daily_entry_id, target_type, target_id, status, sort_order, created_by, updated_by, version) " +
                    "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
                target.get("id"),
                dailyEntryId,
                target.get("targetType"),
                target.get("targetId"),
                target.get("status"),
                target.get("sortOrder"),
                userId,
                userId,
                target.get("version")
            );
        }
        return listTargets(dailyEntryId);
    }

    private List<Map<String, Object>> normalizeTargets(String dailyEntryId, List<Map<String, Object>> targets) {
        if (targets == null) {
            return List.of();
        }
        List<Map<String, Object>> result = new ArrayList<>();
        Set<String> dedup = new LinkedHashSet<>();
        for (Map<String, Object> target : targets) {
            String targetType = normalizeAllowed(asNullableString(target.get("targetType")), TARGET_TYPES, false, "targetType 不合法");
            String targetId = requireText(target.get("targetId"), "targetId 不能为空");
            String status = normalizeStatus(asNullableString(target.get("status")), true, "目标状态不合法，仅支持 ACTIVE 或 INACTIVE");
            int sortOrder = asInt(target.get("sortOrder"), 0);
            int version = positiveVersion(target.get("version"));
            String dedupKey = targetType + "#" + targetId;
            if (!dedup.add(dedupKey)) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "目标范围重复: " + dedupKey);
            }
            Map<String, Object> normalized = new LinkedHashMap<>();
            normalized.put("id", firstNonBlank(asNullableString(target.get("id")), UUID.randomUUID().toString()));
            normalized.put("dailyEntryId", dailyEntryId);
            normalized.put("targetType", targetType);
            normalized.put("targetId", targetId);
            normalized.put("status", hasText(status) ? status : "ACTIVE");
            normalized.put("sortOrder", sortOrder);
            normalized.put("version", version);
            result.add(normalized);
        }
        return result;
    }

    private Map<String, Object> loadEntryRow(String id) {
        try {
            return jdbc.queryForMap(
                "SELECT id, code, name, sort_order, status, meta, version, created_at, created_by, updated_at, updated_by FROM mo_daily_categories WHERE id = ?",
                id
            );
        } catch (EmptyResultDataAccessException ex) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "日常条目不存在");
        }
    }

    private void ensureCodeUnique(String code, String currentId) {
        List<String> ids = jdbc.queryForList(
            "SELECT id FROM mo_daily_categories WHERE UPPER(code) = ?",
            String.class,
            code.toUpperCase(Locale.ROOT)
        );
        for (String id : ids) {
            if (!Objects.equals(id, currentId)) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "条目编码已存在");
            }
        }
    }

    private void ensureIdUnique(String id) {
        List<String> ids = jdbc.queryForList("SELECT id FROM mo_daily_categories WHERE id = ?", String.class, id);
        if (!ids.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "条目 ID 已存在");
        }
    }

    private Map<String, Object> toEntry(Map<String, Object> row) {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("id", asString(row.get("id")));
        result.put("code", asString(row.get("code")));
        result.put("name", asString(row.get("name")));
        result.put("sortOrder", asInt(row.get("sort_order"), 0));
        result.put("status", asString(row.get("status")));
        result.put("meta", asMap(row.get("meta")));
        result.put("version", positiveVersion(row.get("version")));
        result.put("createdAt", row.get("created_at"));
        result.put("createdBy", asNullableString(row.get("created_by")));
        result.put("updatedAt", row.get("updated_at"));
        result.put("updatedBy", asNullableString(row.get("updated_by")));
        return result;
    }

    private Map<String, Object> toTarget(Map<String, Object> row) {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("id", asString(row.get("id")));
        result.put("dailyEntryId", asString(row.get("daily_entry_id")));
        result.put("targetType", asString(row.get("target_type")));
        result.put("targetId", asString(row.get("target_id")));
        result.put("status", asString(row.get("status")));
        result.put("sortOrder", asInt(row.get("sort_order"), 0));
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

    private String sanitizeCode(String raw) {
        String normalized = NON_CODE_PATTERN.matcher(raw.trim().toUpperCase(Locale.ROOT)).replaceAll("_");
        normalized = normalized.replaceAll("_+", "_").replaceAll("^_|_$", "");
        if (!hasText(normalized)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "条目编码仅支持字母、数字、下划线");
        }
        return normalized;
    }

    private String sanitizeId(String raw) {
        String normalized = NON_ID_PATTERN.matcher(raw.trim().toLowerCase(Locale.ROOT)).replaceAll("_");
        normalized = normalized.replaceAll("_+", "_").replaceAll("^_|_$", "");
        if (!hasText(normalized)) {
            return UUID.randomUUID().toString();
        }
        return normalized;
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

    private String blankToNull(String value) {
        return hasText(value) ? value.trim() : null;
    }

    private int positiveVersion(Object value) {
        int version = asInt(value, 1);
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
