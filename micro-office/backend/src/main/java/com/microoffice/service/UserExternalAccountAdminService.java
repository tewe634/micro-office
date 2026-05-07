package com.microoffice.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DataIntegrityViolationException;
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
public class UserExternalAccountAdminService {
    private static final TypeReference<LinkedHashMap<String, Object>> MAP_TYPE = new TypeReference<>() {};
    private static final List<String> STATUS_OPTIONS = List.of("ACTIVE", "UNBOUND");
    private static final List<String> PROVIDER_OPTIONS = List.of("DINGTALK");

    private final JdbcTemplate jdbc;
    private final ObjectMapper objectMapper;

    public List<Map<String, Object>> listAccounts(String provider, String status, String keyword) {
        ensureSchemaReady();
        String normalizedProvider = normalizeAllowed(asNullableString(provider), PROVIDER_OPTIONS, true, "provider 不合法，仅支持 DINGTALK");
        String normalizedStatus = normalizeAllowed(asNullableString(status), STATUS_OPTIONS, true, "status 不合法，仅支持 ACTIVE 或 UNBOUND");
        String normalizedKeyword = blankToNull(keyword);

        StringBuilder sql = new StringBuilder(
            "SELECT a.id, a.user_id, su.name AS user_name, su.emp_no, su.org_id, o.name AS org_name, " +
                "su.primary_position_id, p.name AS primary_position_name, " +
                "COALESCE(ep.extra_position_names, '') AS extra_position_names, " +
                "a.provider, a.corp_id, a.external_user_id, a.status, a.bound_at, a.meta, a.version, a.created_at, a.created_by, a.updated_at, a.updated_by " +
                "FROM mo_user_external_accounts a " +
                "JOIN sys_user su ON su.id = a.user_id " +
                "LEFT JOIN organization o ON o.id = su.org_id " +
                "LEFT JOIN position p ON p.id = su.primary_position_id " +
                "LEFT JOIN (" +
                "  SELECT up.user_id, COALESCE(string_agg(DISTINCT p2.name, '、') FILTER (WHERE p2.name IS NOT NULL), '') AS extra_position_names " +
                "  FROM user_position up " +
                "  LEFT JOIN position p2 ON p2.id = up.position_id " +
                "  GROUP BY up.user_id" +
                ") ep ON ep.user_id = su.id " +
                "WHERE 1 = 1"
        );
        List<Object> params = new ArrayList<>();
        if (hasText(normalizedProvider)) {
            sql.append(" AND a.provider = ?");
            params.add(normalizedProvider);
        }
        if (hasText(normalizedStatus)) {
            sql.append(" AND a.status = ?");
            params.add(normalizedStatus);
        }
        if (hasText(normalizedKeyword)) {
            String pattern = "%" + normalizedKeyword + "%";
            sql.append(" AND (su.name ILIKE ? OR COALESCE(su.emp_no, '') ILIKE ? OR COALESCE(o.name, '') ILIKE ? OR a.corp_id ILIKE ? OR a.external_user_id ILIKE ?)");
            params.add(pattern);
            params.add(pattern);
            params.add(pattern);
            params.add(pattern);
            params.add(pattern);
        }
        sql.append(" ORDER BY su.name, a.provider, a.corp_id, a.created_at, a.id");

        List<Map<String, Object>> rows = jdbc.queryForList(sql.toString(), params.toArray());
        List<Map<String, Object>> result = new ArrayList<>();
        for (Map<String, Object> row : rows) {
            result.add(toListItem(row));
        }
        return result;
    }

    public Map<String, Object> getUserAccounts(String userId) {
        ensureSchemaReady();
        Map<String, Object> user = loadUser(userId);
        List<Map<String, Object>> rows = jdbc.queryForList(
            "SELECT id, user_id, provider, corp_id, external_user_id, status, bound_at, meta, version, created_at, created_by, updated_at, updated_by " +
                "FROM mo_user_external_accounts WHERE user_id = ? ORDER BY provider, corp_id, created_at, id",
            userId
        );
        List<Map<String, Object>> accounts = new ArrayList<>();
        for (Map<String, Object> row : rows) {
            accounts.add(toAccount(row, false));
        }
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("user", user);
        result.put("accounts", accounts);
        return result;
    }

    @Transactional
    public Map<String, Object> saveAccount(String userId, Map<String, Object> body, String operatorId) {
        ensureSchemaReady();
        loadUser(userId);
        Map<String, Object> normalized = normalizeBody(userId, body);
        Map<String, Object> target = resolveExistingAccount(userId, normalized);

        ensureExternalAccountAvailable(userId, normalized, target == null ? null : asString(target.get("id")));
        ensureUserProviderCorpAvailable(userId, normalized, target == null ? null : asString(target.get("id")));

        try {
            if (target == null) {
                insertAccount(normalized, operatorId);
            } else {
                updateAccount(asString(target.get("id")), normalized, operatorId);
            }
        } catch (DataIntegrityViolationException ex) {
            throw translateConstraintViolation(userId, normalized, target == null ? null : asString(target.get("id")), ex);
        }

        return getUserAccounts(userId);
    }

    @Transactional
    public Map<String, Object> unbindAccount(String userId, Map<String, Object> body, String operatorId) {
        ensureSchemaReady();
        loadUser(userId);
        Map<String, Object> target = resolveUnbindTarget(userId, body == null ? Map.of() : body);
        jdbc.update(
            "UPDATE mo_user_external_accounts SET status = 'UNBOUND', updated_at = now(), updated_by = ? WHERE id = ?",
            operatorId,
            asString(target.get("id"))
        );
        return getUserAccounts(userId);
    }

    private Map<String, Object> normalizeBody(String userId, Map<String, Object> body) {
        Map<String, Object> safeBody = body == null ? Map.of() : body;
        if (safeBody.containsKey("positionId") || safeBody.containsKey("position_id")) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "外部账号绑定仅支持 userId 语义，不支持 positionId");
        }
        String provider = normalizeAllowed(asNullableString(safeBody.get("provider")), PROVIDER_OPTIONS, false, "provider 不合法，仅支持 DINGTALK");
        String corpId = requireText(safeBody.get("corpId"), "corpId 不能为空");
        String externalUserId = requireText(safeBody.get("externalUserId"), "externalUserId 不能为空");
        String status = normalizeAllowed(asNullableString(safeBody.get("status")), STATUS_OPTIONS, true, "status 不合法，仅支持 ACTIVE 或 UNBOUND");

        Map<String, Object> normalized = new LinkedHashMap<>();
        normalized.put("id", asNullableString(safeBody.get("id")));
        normalized.put("userId", userId);
        normalized.put("provider", provider);
        normalized.put("corpId", corpId);
        normalized.put("externalUserId", externalUserId);
        normalized.put("status", hasText(status) ? status : "ACTIVE");
        normalized.put("boundAt", safeBody.get("boundAt"));
        normalized.put("meta", asMap(safeBody.get("meta")));
        normalized.put("version", positiveVersion(safeBody.get("version")));
        return normalized;
    }

    private Map<String, Object> resolveExistingAccount(String userId, Map<String, Object> normalized) {
        String requestedId = asNullableString(normalized.get("id"));
        if (hasText(requestedId)) {
            Map<String, Object> row = loadAccountById(requestedId);
            if (!Objects.equals(userId, asString(row.get("user_id")))) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "绑定记录不属于当前用户");
            }
            return row;
        }
        List<Map<String, Object>> rows = jdbc.queryForList(
            "SELECT id, user_id, provider, corp_id, external_user_id, status, bound_at, meta, version, created_at, created_by, updated_at, updated_by " +
                "FROM mo_user_external_accounts WHERE user_id = ? AND provider = ? AND corp_id = ? ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST, id DESC LIMIT 1",
            userId,
            normalized.get("provider"),
            normalized.get("corpId")
        );
        return rows.isEmpty() ? null : rows.get(0);
    }

    private void insertAccount(Map<String, Object> normalized, String operatorId) {
        Map<String, String> columnTypes = loadTableColumnTypes("mo_user_external_accounts");
        List<String> insertColumns = new ArrayList<>();
        List<Object> params = new ArrayList<>();
        StringBuilder values = new StringBuilder();
        appendInsertValue(insertColumns, params, values, "id", firstNonBlank(asNullableString(normalized.get("id")), UUID.randomUUID().toString()), columnTypes);
        appendInsertValue(insertColumns, params, values, "user_id", normalized.get("userId"), columnTypes);
        appendInsertValue(insertColumns, params, values, "provider", normalized.get("provider"), columnTypes);
        appendInsertValue(insertColumns, params, values, "corp_id", normalized.get("corpId"), columnTypes);
        appendInsertValue(insertColumns, params, values, "external_user_id", normalized.get("externalUserId"), columnTypes);
        appendInsertValue(insertColumns, params, values, "status", normalized.get("status"), columnTypes);
        appendInsertValue(insertColumns, params, values, "bound_at", normalizedBoundAt(normalized.get("boundAt"), "ACTIVE".equals(normalized.get("status"))), columnTypes);
        appendInsertValue(insertColumns, params, values, "meta", toJson(asMap(normalized.get("meta"))), columnTypes);
        appendInsertValue(insertColumns, params, values, "version", normalized.get("version"), columnTypes);
        appendInsertValue(insertColumns, params, values, "created_by", operatorId, columnTypes);
        appendInsertValue(insertColumns, params, values, "updated_by", operatorId, columnTypes);
        jdbc.update(
            "INSERT INTO mo_user_external_accounts (" + String.join(", ", insertColumns) + ") VALUES (" + values + ")",
            params.toArray()
        );
    }

    private void updateAccount(String id, Map<String, Object> normalized, String operatorId) {
        Map<String, String> columnTypes = loadTableColumnTypes("mo_user_external_accounts");
        StringBuilder sql = new StringBuilder("UPDATE mo_user_external_accounts SET provider = ?, corp_id = ?, external_user_id = ?, status = ?");
        List<Object> params = new ArrayList<>();
        params.add(normalized.get("provider"));
        params.add(normalized.get("corpId"));
        params.add(normalized.get("externalUserId"));
        params.add(normalized.get("status"));
        if (columnTypes.containsKey("bound_at")) {
            sql.append(", bound_at = ?");
            params.add(normalizedBoundAt(normalized.get("boundAt"), "ACTIVE".equals(normalized.get("status"))));
        }
        if (columnTypes.containsKey("meta")) {
            sql.append(", meta = ").append(metaColumnPlaceholder(columnTypes.get("meta")));
            params.add(toJson(asMap(normalized.get("meta"))));
        }
        if (columnTypes.containsKey("version")) {
            sql.append(", version = ?");
            params.add(normalized.get("version"));
        }
        if (columnTypes.containsKey("updated_by")) {
            sql.append(", updated_by = ?");
            params.add(operatorId);
        }
        sql.append(", updated_at = now() WHERE id = ?");
        params.add(id);
        jdbc.update(sql.toString(), params.toArray());
    }

    private Map<String, Object> resolveUnbindTarget(String userId, Map<String, Object> body) {
        String id = asNullableString(body.get("id"));
        if (hasText(id)) {
            Map<String, Object> row = loadAccountById(id);
            if (!Objects.equals(userId, asString(row.get("user_id")))) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "绑定记录不属于当前用户");
            }
            return row;
        }
        String provider = normalizeAllowed(asNullableString(body.get("provider")), PROVIDER_OPTIONS, false, "provider 不合法，仅支持 DINGTALK");
        String corpId = requireText(body.get("corpId"), "解绑时必须提供 id，或 provider + corpId");
        List<Map<String, Object>> rows = jdbc.queryForList(
            "SELECT id, user_id, provider, corp_id, external_user_id, status, bound_at, meta, version, created_at, created_by, updated_at, updated_by " +
                "FROM mo_user_external_accounts WHERE user_id = ? AND provider = ? AND corp_id = ? ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST, id DESC LIMIT 1",
            userId,
            provider,
            corpId
        );
        if (rows.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "用户外部账号绑定不存在");
        }
        return rows.get(0);
    }

    private void ensureExternalAccountAvailable(String userId, Map<String, Object> normalized, String currentId) {
        List<Map<String, Object>> rows = jdbc.queryForList(
            "SELECT id, user_id FROM mo_user_external_accounts WHERE provider = ? AND corp_id = ? AND external_user_id = ?",
            normalized.get("provider"),
            normalized.get("corpId"),
            normalized.get("externalUserId")
        );
        for (Map<String, Object> row : rows) {
            String rowId = asString(row.get("id"));
            String rowUserId = asString(row.get("user_id"));
            if (!Objects.equals(rowId, currentId) && !Objects.equals(rowUserId, userId)) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "该外部账号已绑定其他用户");
            }
        }
    }

    private void ensureUserProviderCorpAvailable(String userId, Map<String, Object> normalized, String currentId) {
        List<Map<String, Object>> rows = jdbc.queryForList(
            "SELECT id FROM mo_user_external_accounts WHERE user_id = ? AND provider = ? AND corp_id = ?",
            userId,
            normalized.get("provider"),
            normalized.get("corpId")
        );
        for (Map<String, Object> row : rows) {
            String rowId = asString(row.get("id"));
            if (!Objects.equals(rowId, currentId)) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "当前用户在该平台企业下已存在绑定");
            }
        }
    }

    private ResponseStatusException translateConstraintViolation(String userId,
                                                                 Map<String, Object> normalized,
                                                                 String currentId,
                                                                 DataIntegrityViolationException ex) {
        try {
            ensureExternalAccountAvailable(userId, normalized, currentId);
            ensureUserProviderCorpAvailable(userId, normalized, currentId);
        } catch (ResponseStatusException conflict) {
            return conflict;
        }
        return new ResponseStatusException(HttpStatus.BAD_REQUEST, "外部账号绑定保存失败，存在约束冲突", ex);
    }

    private Map<String, Object> loadUser(String userId) {
        try {
            Map<String, Object> row = jdbc.queryForMap(
                "SELECT su.id, su.name, su.emp_no, su.org_id, o.name AS org_name, su.primary_position_id, p.name AS primary_position_name, " +
                    "COALESCE(ep.extra_position_names, '') AS extra_position_names " +
                    "FROM sys_user su " +
                    "LEFT JOIN organization o ON o.id = su.org_id " +
                    "LEFT JOIN position p ON p.id = su.primary_position_id " +
                    "LEFT JOIN (" +
                    "  SELECT up.user_id, COALESCE(string_agg(DISTINCT p2.name, '、') FILTER (WHERE p2.name IS NOT NULL), '') AS extra_position_names " +
                    "  FROM user_position up " +
                    "  LEFT JOIN position p2 ON p2.id = up.position_id " +
                    "  GROUP BY up.user_id" +
                    ") ep ON ep.user_id = su.id " +
                    "WHERE su.id = ?",
                userId
            );
            return toUserSummary(row);
        } catch (EmptyResultDataAccessException ex) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "用户不存在");
        }
    }

    private Map<String, Object> loadAccountById(String id) {
        try {
            return jdbc.queryForMap(
                "SELECT id, user_id, provider, corp_id, external_user_id, status, bound_at, meta, version, created_at, created_by, updated_at, updated_by " +
                    "FROM mo_user_external_accounts WHERE id = ?",
                id
            );
        } catch (EmptyResultDataAccessException ex) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "用户外部账号绑定不存在");
        }
    }

    private void ensureSchemaReady() {
        Set<String> columns = loadTableColumns("mo_user_external_accounts");
        if (columns.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "数据库缺少 mo_user_external_accounts，请先完成 V1.1.15 数据库准备");
        }
        List<String> requiredColumns = List.of(
            "id",
            "user_id",
            "provider",
            "corp_id",
            "external_user_id",
            "status",
            "bound_at",
            "meta",
            "version",
            "created_at",
            "created_by",
            "updated_at",
            "updated_by"
        );
        for (String column : requiredColumns) {
            if (!columns.contains(column)) {
                throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "数据库未完成 V1.1.15 数据库准备：mo_user_external_accounts 缺少 " + column);
            }
        }
    }

    private Set<String> loadTableColumns(String tableName) {
        return new LinkedHashSet<>(jdbc.queryForList(
            "SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = ?",
            String.class,
            tableName
        ));
    }

    private Map<String, String> loadTableColumnTypes(String tableName) {
        List<Map<String, Object>> rows = jdbc.queryForList(
            "SELECT column_name, udt_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = ?",
            tableName
        );
        Map<String, String> result = new LinkedHashMap<>();
        for (Map<String, Object> row : rows) {
            result.put(asString(row.get("column_name")), asNullableString(row.get("udt_name")));
        }
        return result;
    }

    private Map<String, Object> toListItem(Map<String, Object> row) {
        Map<String, Object> result = toAccount(row, true);
        result.put("userId", asString(row.get("user_id")));
        result.put("userName", asNullableString(row.get("user_name")));
        result.put("empNo", asNullableString(row.get("emp_no")));
        result.put("orgId", asNullableString(row.get("org_id")));
        result.put("orgName", asNullableString(row.get("org_name")));
        result.put("primaryPositionId", asNullableString(row.get("primary_position_id")));
        result.put("primaryPositionName", asNullableString(row.get("primary_position_name")));
        result.put("extraPositionNames", splitPositionNames(asNullableString(row.get("extra_position_names"))));
        return result;
    }

    private Map<String, Object> toAccount(Map<String, Object> row, boolean maskExternalUserId) {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("id", asString(row.get("id")));
        result.put("userId", asString(row.get("user_id")));
        result.put("provider", asString(row.get("provider")));
        result.put("corpId", asNullableString(row.get("corp_id")));
        String externalUserId = asNullableString(row.get("external_user_id"));
        result.put("externalUserId", maskExternalUserId ? maskExternalUserId(externalUserId) : externalUserId);
        result.put("status", asString(row.get("status")));
        result.put("boundAt", row.get("bound_at"));
        result.put("meta", asMap(row.get("meta")));
        result.put("version", positiveVersion(row.get("version")));
        result.put("createdAt", row.get("created_at"));
        result.put("createdBy", asNullableString(row.get("created_by")));
        result.put("updatedAt", row.get("updated_at"));
        result.put("updatedBy", asNullableString(row.get("updated_by")));
        return result;
    }

    private Map<String, Object> toUserSummary(Map<String, Object> row) {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("id", asString(row.get("id")));
        result.put("name", asNullableString(row.get("name")));
        result.put("empNo", asNullableString(row.get("emp_no")));
        result.put("orgId", asNullableString(row.get("org_id")));
        result.put("orgName", asNullableString(row.get("org_name")));
        result.put("primaryPositionId", asNullableString(row.get("primary_position_id")));
        result.put("primaryPositionName", asNullableString(row.get("primary_position_name")));
        result.put("extraPositionNames", splitPositionNames(asNullableString(row.get("extra_position_names"))));
        return result;
    }

    private List<String> splitPositionNames(String text) {
        if (!hasText(text)) {
            return List.of();
        }
        String[] parts = text.split("、");
        List<String> result = new ArrayList<>();
        for (String part : parts) {
            String item = blankToNull(part);
            if (item != null) {
                result.add(item);
            }
        }
        return result;
    }

    private String maskExternalUserId(String externalUserId) {
        if (!hasText(externalUserId)) {
            return externalUserId;
        }
        if (externalUserId.length() <= 4) {
            return "****";
        }
        return externalUserId.substring(0, 2) + "****" + externalUserId.substring(externalUserId.length() - 2);
    }

    private Object normalizedBoundAt(Object boundAt, boolean active) {
        if (!active) {
            return boundAt;
        }
        return boundAt == null ? jdbc.queryForObject("SELECT now()", Object.class) : boundAt;
    }

    private String toJson(Map<String, Object> value) {
        try {
            return objectMapper.writeValueAsString(value == null ? Map.of() : value);
        } catch (JsonProcessingException ex) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "JSON 序列化失败");
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
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "JSON 内容格式不合法");
        }
    }

    private void appendInsertValue(List<String> columns,
                                   List<Object> params,
                                   StringBuilder values,
                                   String column,
                                   Object value,
                                   Map<String, String> availableColumns) {
        if (!availableColumns.containsKey(column)) {
            return;
        }
        columns.add(column);
        if (!values.isEmpty()) {
            values.append(", ");
        }
        if ("meta".equals(column)) {
            values.append(metaColumnPlaceholder(availableColumns.get(column)));
        } else {
            values.append("?");
        }
        params.add(value);
    }

    private String metaColumnPlaceholder(String udtName) {
        if ("jsonb".equalsIgnoreCase(udtName)) {
            return "CAST(? AS jsonb)";
        }
        if ("json".equalsIgnoreCase(udtName)) {
            return "CAST(? AS json)";
        }
        return "?";
    }

    private String normalizeAllowed(String value, List<String> allowed, boolean allowBlank, String message) {
        String text = asNullableString(value);
        if (text == null) {
            if (allowBlank) {
                return null;
            }
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, message);
        }
        String normalized = text.trim().toUpperCase(Locale.ROOT);
        if (!allowed.contains(normalized)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, message);
        }
        return normalized;
    }

    private String requireText(Object value, String message) {
        String text = blankToNull(asNullableString(value));
        if (text == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, message);
        }
        return text;
    }

    private boolean hasText(String value) {
        return value != null && !value.trim().isEmpty();
    }

    private String blankToNull(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private String asString(Object value) {
        return String.valueOf(value);
    }

    private String asNullableString(Object value) {
        if (value == null) {
            return null;
        }
        String text = String.valueOf(value);
        return text.isBlank() ? null : text;
    }

    private Integer positiveVersion(Object value) {
        if (value == null) {
            return 1;
        }
        int version;
        if (value instanceof Number number) {
            version = number.intValue();
        } else {
            try {
                version = Integer.parseInt(String.valueOf(value));
            } catch (NumberFormatException ex) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "version 必须是正整数");
            }
        }
        if (version <= 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "version 必须是正整数");
        }
        return version;
    }

    private String firstNonBlank(String left, String right) {
        return hasText(left) ? left : right;
    }
}
