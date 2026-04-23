package com.microoffice.service;

import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.microoffice.dto.request.WorkflowNodeBehaviorSaveRequest;
import com.microoffice.dto.request.WorkflowNodeFeatureBindingValidateRequest;
import com.microoffice.dto.request.WorkflowNodeFeatureSaveRequest;
import com.microoffice.dto.request.WorkflowNodeFieldSaveRequest;
import com.microoffice.dto.request.WorkflowNodeFieldsSaveRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.EmptyResultDataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
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

import static org.springframework.http.HttpStatus.BAD_REQUEST;
import static org.springframework.http.HttpStatus.NOT_FOUND;

@Service
@RequiredArgsConstructor
public class WorkflowNodeFeatureService {
    private static final Set<String> STATUS_SET = Set.of("ACTIVE", "DISABLED");
    private static final Set<String> FIELD_SCOPE_SET = Set.of("INPUT", "OUTPUT");
    private static final Set<String> FIELD_DATA_TYPES = Set.of(
        "string", "text", "number", "boolean", "date", "datetime", "list", "json"
    );
    private static final TypeReference<LinkedHashMap<String, Object>> MAP_TYPE = new TypeReference<>() {};

    private final JdbcTemplate jdbc;
    private final ObjectMapper objectMapper;

    public Page<Map<String, Object>> listFeatures(long current,
                                                  long size,
                                                  String status,
                                                  String nodeType,
                                                  String keyword,
                                                  String positionKey,
                                                  String roleKey) {
        long normalizedCurrent = normalizeCurrent(current);
        long normalizedSize = normalizePageSize(size);

        List<Object> args = new ArrayList<>();
        StringBuilder where = new StringBuilder(" WHERE 1=1");
        if (hasText(status)) {
            where.append(" AND d.is_active = ?");
            args.add("ACTIVE".equals(normalizeStatus(status)));
        }
        if (hasText(nodeType)) {
            where.append(" AND d.node_type = CAST(? AS mo_node_type)");
            args.add(nodeType.trim().toUpperCase(Locale.ROOT));
        }
        if (hasText(keyword)) {
            where.append(" AND (d.code ILIKE ? OR d.name ILIKE ?)");
            String key = "%" + keyword.trim() + "%";
            args.add(key);
            args.add(key);
        }
        if (hasText(positionKey)) {
            where.append(" AND d.position_key = ?");
            args.add(positionKey.trim());
        }
        if (hasText(roleKey)) {
            where.append(" AND d.role_key = ?");
            args.add(roleKey.trim().toUpperCase(Locale.ROOT));
        }

        Number totalNumber = jdbc.queryForObject(
            "SELECT COUNT(*) FROM mo_module_definitions d" + where,
            Number.class,
            args.toArray()
        );
        long total = totalNumber == null ? 0L : totalNumber.longValue();
        Page<Map<String, Object>> page = new Page<>(normalizedCurrent, normalizedSize, total);
        if (total <= 0) {
            page.setRecords(List.of());
            return page;
        }

        List<Object> queryArgs = new ArrayList<>(args);
        queryArgs.add(normalizedSize);
        queryArgs.add((normalizedCurrent - 1) * normalizedSize);
        List<Map<String, Object>> rows = jdbc.queryForList(
            "SELECT d.id, d.source_module_id, d.code, d.name, d.source_system, d.node_type, d.is_active, d.version, d.created_at, d.created_by, d.updated_at, d.updated_by, d.role_key, d.position_key, " +
                "wm.id AS behavior_module_id, wm.version AS behavior_version " +
                "FROM mo_module_definitions d " +
                "LEFT JOIN mo_workflow_module_definitions wm ON wm.id = d.id" +
                where +
                " ORDER BY d.updated_at DESC, d.created_at DESC LIMIT ? OFFSET ?",
            queryArgs.toArray()
        );
        List<Map<String, Object>> result = new ArrayList<>();
        for (Map<String, Object> row : rows) {
            Map<String, Object> item = toFeatureMap(row);
            item.put("hasBehaviorConfig", row.get("behavior_module_id") != null);
            item.put("behaviorConfigVersion", asInt(row.get("behavior_version"), 0));
            result.add(item);
        }
        page.setRecords(result);
        return page;
    }

    public Map<String, Object> getFeature(String id) {
        return loadFeatureOrThrow(id);
    }

    @Transactional
    public Map<String, Object> createFeature(WorkflowNodeFeatureSaveRequest request, String userId) {
        String code = normalizeCode(request.getCode());
        int version = normalizeVersion(request.getVersion());
        ensureCodeVersionUnique(code, version, null);
        ensureWorkflowModuleCodeUnique(code, null);

        String roleKey = normalizeRoleKey(request.getRoleKey());
        validateRoleKeyIfPresent(roleKey);

        String id = "mod_" + UUID.randomUUID().toString().replace("-", "");
        jdbc.update(
            "INSERT INTO mo_module_definitions (id, source_module_id, code, name, source_system, node_type, is_active, version, role_key, position_key, created_by, updated_by) " +
                "VALUES (?, ?, ?, ?, ?, CAST(? AS mo_node_type), FALSE, ?, ?, ?, ?, ?)",
            id,
            blankToNull(request.getSourceModuleId()),
            code,
            requireText(request.getName(), "name 不能为空"),
            normalizeSourceSystem(request.getSourceSystem()),
            normalizeNodeType(request.getNodeType()),
            version,
            roleKey,
            blankToNull(request.getPositionKey()),
            userId,
            userId
        );
        return loadFeatureOrThrow(id);
    }

    @Transactional
    public Map<String, Object> updateFeature(String id, WorkflowNodeFeatureSaveRequest request, String userId) {
        Map<String, Object> existing = loadFeatureOrThrow(id);
        String code = normalizeCode(request.getCode());
        int version = normalizeVersion(request.getVersion());

        ensureCodeVersionUnique(code, version, id);
        if (!Objects.equals(code, asString(existing.get("code")))) {
            ensureWorkflowModuleCodeUnique(code, id);
        }

        String roleKey = normalizeRoleKey(request.getRoleKey());
        validateRoleKeyIfPresent(roleKey);

        jdbc.update(
            "UPDATE mo_module_definitions SET source_module_id = ?, code = ?, name = ?, source_system = ?, node_type = CAST(? AS mo_node_type), version = ?, role_key = ?, position_key = ?, updated_at = NOW(), updated_by = ? WHERE id = ?",
            blankToNull(request.getSourceModuleId()),
            code,
            requireText(request.getName(), "name 不能为空"),
            normalizeSourceSystem(request.getSourceSystem()),
            normalizeNodeType(request.getNodeType()),
            version,
            roleKey,
            blankToNull(request.getPositionKey()),
            userId,
            id
        );
        syncBehaviorCarrierHead(id, userId);
        return loadFeatureOrThrow(id);
    }

    @Transactional
    public Map<String, Object> updateFeatureStatus(String id, String status, String userId) {
        boolean active = "ACTIVE".equals(normalizeStatus(status));
        int updated = jdbc.update(
            "UPDATE mo_module_definitions SET is_active = ?, updated_at = NOW(), updated_by = ? WHERE id = ?",
            active,
            userId,
            id
        );
        if (updated == 0) {
            throw new ResponseStatusException(NOT_FOUND, "节点功能不存在");
        }
        jdbc.update(
            "UPDATE mo_workflow_module_definitions SET status = ?, updated_at = NOW(), updated_by = ? WHERE id = ?",
            active ? "ACTIVE" : "DISABLED",
            userId,
            id
        );
        return loadFeatureOrThrow(id);
    }

    @Transactional
    public Map<String, Object> copyFeature(String id, String userId) {
        Map<String, Object> source = loadFeatureOrThrow(id);
        String sourceCode = asString(source.get("code"));
        String copiedCode = generateCopiedCode(sourceCode);
        int sourceVersion = asInt(source.get("version"), 1);
        ensureCodeVersionUnique(copiedCode, sourceVersion, null);
        ensureWorkflowModuleCodeUnique(copiedCode, null);

        String copiedId = "mod_" + UUID.randomUUID().toString().replace("-", "");
        jdbc.update(
            "INSERT INTO mo_module_definitions (id, source_module_id, code, name, source_system, node_type, is_active, version, role_key, position_key, created_by, updated_by) " +
                "VALUES (?, ?, ?, ?, ?, CAST(? AS mo_node_type), FALSE, ?, ?, ?, ?, ?)",
            copiedId,
            blankToNull(asString(source.get("sourceModuleId"))),
            copiedCode,
            asString(source.get("name")) + "（复制）",
            asString(source.get("sourceSystem")),
            asString(source.get("nodeType")),
            sourceVersion,
            asString(source.get("roleKey")),
            asString(source.get("positionKey")),
            userId,
            userId
        );

        List<Map<String, Object>> fields = listFields(id);
        for (Map<String, Object> field : fields) {
            Map<String, Object> schemaMeta = asMap(field.get("schemaMeta"));
            Object defaultValue = schemaMeta.get("defaultValue");
            jdbc.update(
                "INSERT INTO mo_module_fields (id, module_definition_id, field_key, label, data_type, required, field_scope, sort_order, schema_meta, created_by, updated_by) " +
                    "VALUES (?, ?, ?, ?, ?, ?, ?, ?, CAST(? AS jsonb), ?, ?)",
                UUID.randomUUID().toString(),
                copiedId,
                asString(field.get("fieldKey")),
                asString(field.get("label")),
                normalizeFieldDataType(asString(field.get("dataType"))),
                Boolean.TRUE.equals(field.get("required")),
                normalizeFieldScope(asString(field.get("fieldScope"))),
                asInt(field.get("sortOrder"), 100),
                toJson(normalizeSchemaMeta(schemaMeta, defaultValue)),
                userId,
                userId
            );
        }

        Map<String, Object> sourceBehavior = loadBehaviorConfig(id);
        if (!sourceBehavior.isEmpty()) {
            saveBehaviorConfig(copiedId, sourceBehavior, userId);
        }

        return loadFeatureOrThrow(copiedId);
    }

    public List<Map<String, Object>> listFields(String featureId) {
        ensureFeatureExists(featureId);
        List<Map<String, Object>> rows = jdbc.queryForList(
            "SELECT id, module_definition_id, field_key, label, data_type, required, field_scope, sort_order, schema_meta, created_at, updated_at " +
                "FROM mo_module_fields WHERE module_definition_id = ? ORDER BY field_scope, sort_order, field_key, id",
            featureId
        );
        List<Map<String, Object>> result = new ArrayList<>();
        for (Map<String, Object> row : rows) {
            Map<String, Object> schemaMeta = asMap(row.get("schema_meta"));
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("id", asString(row.get("id")));
            item.put("moduleDefinitionId", asString(row.get("module_definition_id")));
            item.put("fieldKey", asString(row.get("field_key")));
            item.put("label", asString(row.get("label")));
            item.put("dataType", asString(row.get("data_type")));
            item.put("required", Boolean.TRUE.equals(row.get("required")));
            item.put("fieldScope", asString(row.get("field_scope")));
            item.put("sortOrder", asInt(row.get("sort_order"), 100));
            item.put("defaultValue", schemaMeta.get("defaultValue"));
            item.put("schemaMeta", schemaMeta);
            item.put("createdAt", row.get("created_at"));
            item.put("updatedAt", row.get("updated_at"));
            result.add(item);
        }
        return result;
    }

    @Transactional
    public List<Map<String, Object>> saveFields(String featureId, WorkflowNodeFieldsSaveRequest request, String userId) {
        ensureFeatureExists(featureId);
        List<WorkflowNodeFieldSaveRequest> fields = request == null ? List.of() : request.getFields();
        validateFieldContracts(fields);

        jdbc.update("DELETE FROM mo_module_fields WHERE module_definition_id = ?", featureId);
        for (WorkflowNodeFieldSaveRequest field : fields) {
            String id = hasText(field.getId()) ? field.getId().trim() : UUID.randomUUID().toString();
            String scope = normalizeFieldScope(field.getFieldScope());
            String dataType = normalizeFieldDataType(field.getDataType());
            Object defaultValue = field.getDefaultValue();
            validateDefaultValueType(dataType, defaultValue);
            Map<String, Object> schemaMeta = normalizeSchemaMeta(asMap(field.getSchemaMeta()), defaultValue);

            jdbc.update(
                "INSERT INTO mo_module_fields (id, module_definition_id, field_key, label, data_type, required, field_scope, sort_order, schema_meta, created_by, updated_by) " +
                    "VALUES (?, ?, ?, ?, ?, ?, ?, ?, CAST(? AS jsonb), ?, ?)",
                id,
                featureId,
                requireText(field.getFieldKey(), "fieldKey 不能为空"),
                requireText(field.getLabel(), "label 不能为空"),
                dataType,
                Boolean.TRUE.equals(field.getRequired()),
                scope,
                normalizeSortOrder(field.getSortOrder()),
                toJson(schemaMeta),
                userId,
                userId
            );
        }
        return listFields(featureId);
    }

    public Map<String, Object> getBehaviors(String featureId, String positionKey, String roleKey) {
        ensureFeatureExists(featureId);
        Map<String, Object> behavior = loadBehaviorConfig(featureId);
        if (behavior.isEmpty()) {
            behavior = defaultBehavior();
        }
        Map<String, Object> resolved = resolveAssignment(behavior, positionKey, roleKey);
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("moduleDefinitionId", featureId);
        result.put("behavior", behavior);
        result.put("resolvedAssignment", resolved);
        result.put("resolutionChain", List.of("POSITION", "ROLE", "DEFAULT"));
        return result;
    }

    @Transactional
    public Map<String, Object> saveBehaviors(String featureId, WorkflowNodeBehaviorSaveRequest request, String userId) {
        ensureFeatureExists(featureId);
        Map<String, Object> behavior = normalizeBehavior(request);
        saveBehaviorConfig(featureId, behavior, userId);
        return getBehaviors(featureId, null, null);
    }

    public Map<String, Object> getReferences(String featureId) {
        ensureFeatureExists(featureId);
        List<Map<String, Object>> rows = jdbc.queryForList(
            "SELECT p.id AS package_id, p.name AS package_name, p.status AS package_status, " +
                "n.id AS node_id, n.display_name, n.relation_type, n.parent_package_node_id, n.branch_group_key, n.branch_order, n.sort_order " +
                "FROM mo_workflow_recommendation_package_nodes n " +
                "JOIN mo_workflow_recommendation_packages p ON p.id = n.package_id " +
                "WHERE n.module_definition_id = ? " +
                "ORDER BY p.updated_at DESC, p.created_at DESC, n.hierarchy_level, n.sort_order, n.id",
            featureId
        );
        List<Map<String, Object>> items = new ArrayList<>();
        for (Map<String, Object> row : rows) {
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("templatePackageId", asString(row.get("package_id")));
            item.put("templatePackageName", asString(row.get("package_name")));
            item.put("templatePackageStatus", asString(row.get("package_status")));
            item.put("templateNodeId", asString(row.get("node_id")));
            item.put("displayName", asString(row.get("display_name")));
            item.put("relationType", asString(row.get("relation_type")));
            item.put("parentPackageNodeId", asString(row.get("parent_package_node_id")));
            item.put("branchGroupKey", asString(row.get("branch_group_key")));
            item.put("branchOrder", row.get("branch_order"));
            item.put("sortOrder", asInt(row.get("sort_order"), 0));
            items.add(item);
        }
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("moduleDefinitionId", featureId);
        result.put("referenceCount", items.size());
        result.put("items", items);
        return result;
    }

    public Map<String, Object> validateTemplateBindings(WorkflowNodeFeatureBindingValidateRequest request) {
        List<String> incoming = request == null ? List.of() : request.getModuleDefinitionIds();
        LinkedHashSet<String> ids = new LinkedHashSet<>();
        for (String id : incoming) {
            if (hasText(id)) {
                ids.add(id.trim());
            }
        }
        if (ids.isEmpty()) {
            return Map.of("valid", true, "invalidItems", List.of());
        }

        List<Map<String, Object>> rows = jdbc.queryForList(
            "SELECT id, code, name, is_active FROM mo_module_definitions WHERE id = ANY(?::text[])",
            (Object) ids.toArray(new String[0])
        );
        Map<String, Map<String, Object>> moduleMap = new LinkedHashMap<>();
        for (Map<String, Object> row : rows) {
            moduleMap.put(asString(row.get("id")), row);
        }

        Map<String, List<Map<String, Object>>> refs = loadReferencesByModuleIds(ids);
        List<Map<String, Object>> invalid = new ArrayList<>();
        for (String moduleId : ids) {
            Map<String, Object> module = moduleMap.get(moduleId);
            if (module == null) {
                Map<String, Object> item = new LinkedHashMap<>();
                item.put("moduleDefinitionId", moduleId);
                item.put("status", "MISSING");
                item.put("message", "节点功能不存在: " + moduleId);
                item.put("references", List.of());
                invalid.add(item);
                continue;
            }
            if (!Boolean.TRUE.equals(module.get("is_active"))) {
                List<Map<String, Object>> refItems = refs.getOrDefault(moduleId, List.of());
                Map<String, Object> item = new LinkedHashMap<>();
                item.put("moduleDefinitionId", moduleId);
                item.put("code", asString(module.get("code")));
                item.put("name", asString(module.get("name")));
                item.put("status", "DISABLED");
                item.put("message", "节点功能已停用，模板无法绑定: " + asString(module.get("name")));
                item.put("references", refItems);
                invalid.add(item);
            }
        }
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("valid", invalid.isEmpty());
        result.put("invalidItems", invalid);
        return result;
    }

    private Map<String, Object> loadFeatureOrThrow(String id) {
        try {
            Map<String, Object> row = jdbc.queryForMap(
                "SELECT id, source_module_id, code, name, source_system, node_type, is_active, version, created_at, created_by, updated_at, updated_by, role_key, position_key " +
                    "FROM mo_module_definitions WHERE id = ?",
                id
            );
            return toFeatureMap(row);
        } catch (EmptyResultDataAccessException ex) {
            throw new ResponseStatusException(NOT_FOUND, "节点功能不存在");
        }
    }

    private Map<String, Object> toFeatureMap(Map<String, Object> row) {
        Map<String, Object> item = new LinkedHashMap<>();
        item.put("id", asString(row.get("id")));
        item.put("sourceModuleId", asString(row.get("source_module_id")));
        item.put("code", asString(row.get("code")));
        item.put("name", asString(row.get("name")));
        item.put("sourceSystem", asString(row.get("source_system")));
        item.put("nodeType", asString(row.get("node_type")));
        item.put("status", Boolean.TRUE.equals(row.get("is_active")) ? "ACTIVE" : "DISABLED");
        item.put("version", asInt(row.get("version"), 1));
        item.put("positionKey", asString(row.get("position_key")));
        item.put("roleKey", asString(row.get("role_key")));
        item.put("createdAt", row.get("created_at"));
        item.put("createdBy", asString(row.get("created_by")));
        item.put("updatedAt", row.get("updated_at"));
        item.put("updatedBy", asString(row.get("updated_by")));
        return item;
    }

    private void validateFieldContracts(List<WorkflowNodeFieldSaveRequest> fields) {
        if (fields == null) {
            return;
        }
        LinkedHashSet<String> uniqueByScope = new LinkedHashSet<>();
        for (WorkflowNodeFieldSaveRequest field : fields) {
            String scope = normalizeFieldScope(field.getFieldScope());
            String key = requireText(field.getFieldKey(), "fieldKey 不能为空");
            String dataType = normalizeFieldDataType(field.getDataType());

            String dedupKey = scope + "|" + key;
            if (!uniqueByScope.add(dedupKey)) {
                throw new ResponseStatusException(BAD_REQUEST, "字段键重复: " + dedupKey);
            }
            requireText(field.getLabel(), "label 不能为空");
            normalizeSortOrder(field.getSortOrder());
            validateDefaultValueType(dataType, field.getDefaultValue());
            asMap(field.getSchemaMeta());
        }
    }

    private void validateDefaultValueType(String dataType, Object defaultValue) {
        if (defaultValue == null) {
            return;
        }
        switch (dataType) {
            case "number" -> {
                if (!(defaultValue instanceof Number)) {
                    throw new ResponseStatusException(BAD_REQUEST, "defaultValue 类型不匹配，number 需为数字");
                }
            }
            case "boolean" -> {
                if (!(defaultValue instanceof Boolean)) {
                    throw new ResponseStatusException(BAD_REQUEST, "defaultValue 类型不匹配，boolean 需为布尔值");
                }
            }
            case "list" -> {
                if (!(defaultValue instanceof Collection<?>)) {
                    throw new ResponseStatusException(BAD_REQUEST, "defaultValue 类型不匹配，list 需为数组");
                }
            }
            case "json" -> {
                if (!(defaultValue instanceof Map<?, ?> || defaultValue instanceof Collection<?>)) {
                    throw new ResponseStatusException(BAD_REQUEST, "defaultValue 类型不匹配，json 需为对象或数组");
                }
            }
            default -> {
                if (!(defaultValue instanceof String)) {
                    throw new ResponseStatusException(BAD_REQUEST, "defaultValue 类型不匹配，" + dataType + " 需为字符串");
                }
            }
        }
    }

    private Map<String, Object> normalizeBehavior(WorkflowNodeBehaviorSaveRequest request) {
        WorkflowNodeBehaviorSaveRequest body = request == null ? new WorkflowNodeBehaviorSaveRequest() : request;
        Map<String, Object> assignment = asMap(body.getAssignment());
        Map<String, Object> sla = asMap(body.getSla());
        List<String> actionPermissions = normalizeStringList(body.getActionPermissions());
        Map<String, Object> triggers = asMap(body.getTriggers());

        Map<String, Object> positionBindings = toRuleMap(assignment.get("positionBindings"), "assignment.positionBindings");
        Map<String, Object> roleBindings = toRuleMap(assignment.get("roleBindings"), "assignment.roleBindings");
        List<String> defaultAssignees = normalizeStringList(assignment.get("defaultAssignees"));
        assignment.put("positionBindings", positionBindings);
        assignment.put("roleBindings", roleBindings);
        assignment.put("defaultAssignees", defaultAssignees);
        assignment.put("strategy", "POSITION_FIRST_ROLE_FALLBACK");

        Object slaMinutes = sla.get("slaMinutes");
        if (slaMinutes != null && !(slaMinutes instanceof Number)) {
            throw new ResponseStatusException(BAD_REQUEST, "sla.slaMinutes 必须是数字");
        }
        if (slaMinutes instanceof Number number && number.intValue() < 0) {
            throw new ResponseStatusException(BAD_REQUEST, "sla.slaMinutes 不能小于 0");
        }

        Map<String, Object> behavior = new LinkedHashMap<>();
        behavior.put("assignment", assignment);
        behavior.put("sla", sla);
        behavior.put("actionPermissions", actionPermissions);
        behavior.put("triggers", triggers);
        return behavior;
    }

    private Map<String, Object> resolveAssignment(Map<String, Object> behavior, String positionKey, String roleKey) {
        Map<String, Object> assignment = asMap(behavior.get("assignment"));
        Map<String, Object> positionBindings = asMap(assignment.get("positionBindings"));
        Map<String, Object> roleBindings = asMap(assignment.get("roleBindings"));
        List<String> defaultAssignees = normalizeStringList(assignment.get("defaultAssignees"));

        Map<String, Object> resolved = new LinkedHashMap<>();
        String normalizedPositionKey = blankToNull(positionKey);
        String normalizedRoleKey = normalizeRoleKey(roleKey);

        if (hasText(normalizedPositionKey) && positionBindings.containsKey(normalizedPositionKey)) {
            resolved.put("hitLevel", "POSITION");
            resolved.put("hitKey", normalizedPositionKey);
            resolved.put("rule", asMap(positionBindings.get(normalizedPositionKey)));
            resolved.put("assignees", normalizeStringList(asMap(positionBindings.get(normalizedPositionKey)).get("assignees")));
            return resolved;
        }

        if (hasText(normalizedRoleKey) && roleBindings.containsKey(normalizedRoleKey)) {
            resolved.put("hitLevel", "ROLE");
            resolved.put("hitKey", normalizedRoleKey);
            resolved.put("rule", asMap(roleBindings.get(normalizedRoleKey)));
            resolved.put("assignees", normalizeStringList(asMap(roleBindings.get(normalizedRoleKey)).get("assignees")));
            return resolved;
        }

        resolved.put("hitLevel", "DEFAULT");
        resolved.put("hitKey", null);
        resolved.put("rule", Map.of("assignees", defaultAssignees));
        resolved.put("assignees", defaultAssignees);
        return resolved;
    }

    private Map<String, Object> defaultBehavior() {
        Map<String, Object> assignment = new LinkedHashMap<>();
        assignment.put("strategy", "POSITION_FIRST_ROLE_FALLBACK");
        assignment.put("positionBindings", new LinkedHashMap<>());
        assignment.put("roleBindings", new LinkedHashMap<>());
        assignment.put("defaultAssignees", List.of());

        Map<String, Object> behavior = new LinkedHashMap<>();
        behavior.put("assignment", assignment);
        behavior.put("sla", new LinkedHashMap<>());
        behavior.put("actionPermissions", List.of());
        behavior.put("triggers", new LinkedHashMap<>());
        return behavior;
    }

    private Map<String, Object> toRuleMap(Object value, String fieldPath) {
        Map<String, Object> raw = asMap(value);
        Map<String, Object> normalized = new LinkedHashMap<>();
        for (Map.Entry<String, Object> entry : raw.entrySet()) {
            String key = blankToNull(entry.getKey());
            if (!hasText(key)) {
                throw new ResponseStatusException(BAD_REQUEST, fieldPath + " 存在空键");
            }
            Map<String, Object> rule = asMap(entry.getValue());
            rule.put("assignees", normalizeStringList(rule.get("assignees")));
            normalized.put(key, rule);
        }
        return normalized;
    }

    private Map<String, Object> loadBehaviorConfig(String featureId) {
        try {
            Map<String, Object> row = jdbc.queryForMap(
                "SELECT meta FROM mo_workflow_module_definitions WHERE id = ?",
                featureId
            );
            Map<String, Object> meta = asMap(row.get("meta"));
            return asMap(meta.get("behaviorConfig"));
        } catch (EmptyResultDataAccessException ex) {
            return Map.of();
        }
    }

    private void saveBehaviorConfig(String featureId, Map<String, Object> behavior, String userId) {
        Map<String, Object> feature = loadFeatureOrThrow(featureId);
        Map<String, Object> existingMeta = Map.of();
        try {
            Map<String, Object> row = jdbc.queryForMap(
                "SELECT meta FROM mo_workflow_module_definitions WHERE id = ?",
                featureId
            );
            existingMeta = asMap(row.get("meta"));
        } catch (EmptyResultDataAccessException ignored) {
            existingMeta = new LinkedHashMap<>();
        }
        Map<String, Object> mergedMeta = new LinkedHashMap<>(existingMeta);
        mergedMeta.put("behaviorConfig", behavior);

        jdbc.update(
            "INSERT INTO mo_workflow_module_definitions (id, code, name, source_system, node_type, status, sort_order, meta, created_by, updated_by) " +
                "VALUES (?, ?, ?, ?, CAST(? AS mo_node_type), ?, ?, CAST(? AS jsonb), ?, ?) " +
                "ON CONFLICT (id) DO UPDATE SET code = EXCLUDED.code, name = EXCLUDED.name, source_system = EXCLUDED.source_system, node_type = EXCLUDED.node_type, status = EXCLUDED.status, sort_order = EXCLUDED.sort_order, meta = EXCLUDED.meta, updated_at = NOW(), updated_by = EXCLUDED.updated_by",
            featureId,
            asString(feature.get("code")),
            asString(feature.get("name")),
            asString(feature.get("sourceSystem")),
            asString(feature.get("nodeType")),
            asString(feature.get("status")),
            100,
            toJson(mergedMeta),
            userId,
            userId
        );
    }

    private void syncBehaviorCarrierHead(String featureId, String userId) {
        Map<String, Object> feature = loadFeatureOrThrow(featureId);
        jdbc.update(
            "UPDATE mo_workflow_module_definitions SET code = ?, name = ?, source_system = ?, node_type = CAST(? AS mo_node_type), status = ?, updated_at = NOW(), updated_by = ? WHERE id = ?",
            asString(feature.get("code")),
            asString(feature.get("name")),
            asString(feature.get("sourceSystem")),
            asString(feature.get("nodeType")),
            asString(feature.get("status")),
            userId,
            featureId
        );
    }

    private Map<String, List<Map<String, Object>>> loadReferencesByModuleIds(Collection<String> moduleIds) {
        if (moduleIds.isEmpty()) {
            return Map.of();
        }
        List<Map<String, Object>> rows = jdbc.queryForList(
            "SELECT n.module_definition_id, p.id AS package_id, p.name AS package_name, p.status AS package_status, n.id AS node_id, n.display_name " +
                "FROM mo_workflow_recommendation_package_nodes n " +
                "JOIN mo_workflow_recommendation_packages p ON p.id = n.package_id " +
                "WHERE n.module_definition_id = ANY(?::text[]) " +
                "ORDER BY p.updated_at DESC, n.sort_order, n.id",
            (Object) moduleIds.toArray(new String[0])
        );
        Map<String, List<Map<String, Object>>> refs = new LinkedHashMap<>();
        for (Map<String, Object> row : rows) {
            String moduleId = asString(row.get("module_definition_id"));
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("templatePackageId", asString(row.get("package_id")));
            item.put("templatePackageName", asString(row.get("package_name")));
            item.put("templatePackageStatus", asString(row.get("package_status")));
            item.put("templateNodeId", asString(row.get("node_id")));
            item.put("displayName", asString(row.get("display_name")));
            refs.computeIfAbsent(moduleId, key -> new ArrayList<>()).add(item);
        }
        return refs;
    }

    private void ensureFeatureExists(String featureId) {
        Integer count = jdbc.queryForObject(
            "SELECT COUNT(*) FROM mo_module_definitions WHERE id = ?",
            Integer.class,
            featureId
        );
        if (count == null || count == 0) {
            throw new ResponseStatusException(NOT_FOUND, "节点功能不存在");
        }
    }

    private void ensureCodeVersionUnique(String code, int version, String excludeId) {
        List<Object> args = new ArrayList<>();
        StringBuilder sql = new StringBuilder("SELECT COUNT(*) FROM mo_module_definitions WHERE code = ? AND version = ?");
        args.add(code);
        args.add(version);
        if (hasText(excludeId)) {
            sql.append(" AND id <> ?");
            args.add(excludeId);
        }
        Integer count = jdbc.queryForObject(sql.toString(), Integer.class, args.toArray());
        if (count != null && count > 0) {
            throw new ResponseStatusException(BAD_REQUEST, "节点功能 code + version 已存在");
        }
    }

    private void ensureWorkflowModuleCodeUnique(String code, String excludeId) {
        List<Object> args = new ArrayList<>();
        StringBuilder sql = new StringBuilder("SELECT COUNT(*) FROM mo_workflow_module_definitions WHERE code = ?");
        args.add(code);
        if (hasText(excludeId)) {
            sql.append(" AND id <> ?");
            args.add(excludeId);
        }
        Integer count = jdbc.queryForObject(sql.toString(), Integer.class, args.toArray());
        if (count != null && count > 0) {
            throw new ResponseStatusException(BAD_REQUEST, "节点功能 code 与历史模块定义冲突，请更换 code");
        }
    }

    private void validateRoleKeyIfPresent(String roleKey) {
        if (!hasText(roleKey)) {
            return;
        }
        Integer count = jdbc.queryForObject(
            "SELECT COUNT(*) FROM sys_role WHERE code = ?",
            Integer.class,
            roleKey
        );
        if (count == null || count == 0) {
            throw new ResponseStatusException(BAD_REQUEST, "roleKey 不存在于 sys_role: " + roleKey);
        }
    }

    private String normalizeCode(String code) {
        String text = requireText(code, "code 不能为空").toUpperCase(Locale.ROOT);
        if (!text.matches("[A-Z0-9_]+")) {
            throw new ResponseStatusException(BAD_REQUEST, "code 仅支持大写字母、数字、下划线");
        }
        return text;
    }

    private String generateCopiedCode(String sourceCode) {
        String base = normalizeCode(sourceCode) + "_COPY";
        for (int i = 1; i <= 99; i++) {
            String candidate = base + "_" + i;
            Integer countA = jdbc.queryForObject(
                "SELECT COUNT(*) FROM mo_module_definitions WHERE code = ?",
                Integer.class,
                candidate
            );
            Integer countB = jdbc.queryForObject(
                "SELECT COUNT(*) FROM mo_workflow_module_definitions WHERE code = ?",
                Integer.class,
                candidate
            );
            if ((countA == null || countA == 0) && (countB == null || countB == 0)) {
                return candidate;
            }
        }
        return base + "_" + UUID.randomUUID().toString().replace("-", "").substring(0, 8).toUpperCase(Locale.ROOT);
    }

    private String normalizeSourceSystem(String sourceSystem) {
        return hasText(sourceSystem) ? sourceSystem.trim().toUpperCase(Locale.ROOT) : "MICRO_OFFICE";
    }

    private String normalizeNodeType(String nodeType) {
        return requireText(nodeType, "nodeType 不能为空").trim().toUpperCase(Locale.ROOT);
    }

    private long normalizeCurrent(long value) {
        return value <= 0 ? 1 : value;
    }

    private long normalizePageSize(long value) {
        if (value <= 0) {
            return 20;
        }
        return Math.min(value, 200);
    }

    private int normalizeVersion(Integer version) {
        int value = version == null ? 1 : version;
        if (value <= 0) {
            throw new ResponseStatusException(BAD_REQUEST, "version 必须大于 0");
        }
        return value;
    }

    private int normalizeSortOrder(Integer sortOrder) {
        int value = sortOrder == null ? 100 : sortOrder;
        if (value < 0) {
            throw new ResponseStatusException(BAD_REQUEST, "sortOrder 不能小于 0");
        }
        return value;
    }

    private String normalizeStatus(String status) {
        String text = requireText(status, "status 不能为空").trim().toUpperCase(Locale.ROOT);
        if (!STATUS_SET.contains(text)) {
            throw new ResponseStatusException(BAD_REQUEST, "status 仅支持 ACTIVE 或 DISABLED");
        }
        return text;
    }

    private String normalizeFieldScope(String scope) {
        String text = requireText(scope, "fieldScope 不能为空").trim().toUpperCase(Locale.ROOT);
        if (!FIELD_SCOPE_SET.contains(text)) {
            throw new ResponseStatusException(BAD_REQUEST, "fieldScope 仅支持 INPUT 或 OUTPUT");
        }
        return text;
    }

    private String normalizeFieldDataType(String dataType) {
        String text = requireText(dataType, "dataType 不能为空").trim().toLowerCase(Locale.ROOT);
        if (!FIELD_DATA_TYPES.contains(text)) {
            throw new ResponseStatusException(BAD_REQUEST, "dataType 不支持: " + text);
        }
        return text;
    }

    private String normalizeRoleKey(String roleKey) {
        return hasText(roleKey) ? roleKey.trim().toUpperCase(Locale.ROOT) : null;
    }

    private String requireText(String value, String message) {
        if (!hasText(value)) {
            throw new ResponseStatusException(BAD_REQUEST, message);
        }
        return value.trim();
    }

    private boolean hasText(String value) {
        return value != null && !value.isBlank();
    }

    private String blankToNull(String value) {
        if (!hasText(value)) {
            return null;
        }
        return value.trim();
    }

    private int asInt(Object value, int fallback) {
        if (value == null) {
            return fallback;
        }
        if (value instanceof Number number) {
            return number.intValue();
        }
        try {
            return Integer.parseInt(String.valueOf(value));
        } catch (NumberFormatException ex) {
            return fallback;
        }
    }

    private String asString(Object value) {
        return value == null ? null : String.valueOf(value);
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> asMap(Object value) {
        if (value == null) {
            return new LinkedHashMap<>();
        }
        if (value instanceof Map<?, ?> map) {
            Map<String, Object> result = new LinkedHashMap<>();
            map.forEach((k, v) -> result.put(String.valueOf(k), v));
            return result;
        }
        if (value instanceof String text) {
            if (text.isBlank()) {
                return new LinkedHashMap<>();
            }
            try {
                return objectMapper.readValue(text, MAP_TYPE);
            } catch (Exception ex) {
                throw new ResponseStatusException(BAD_REQUEST, "JSON 内容格式不合法");
            }
        }
        Object parsed = tryParseJsonLikeText(value);
        if (parsed != null) {
            return asMap(parsed);
        }
        return objectMapper.convertValue(value, MAP_TYPE);
    }

    private Object tryParseJsonLikeText(Object value) {
        if (value == null || value instanceof Map<?, ?> || value instanceof List<?> || value instanceof String) {
            return null;
        }
        String text = asString(value);
        if (!hasText(text)) {
            return null;
        }
        String trimmed = text.trim();
        if (!(trimmed.startsWith("{") || trimmed.startsWith("["))) {
            return null;
        }
        try {
            return objectMapper.readValue(trimmed, Object.class);
        } catch (Exception ex) {
            return null;
        }
    }

    private List<String> normalizeStringList(Object value) {
        if (value == null) {
            return List.of();
        }
        List<?> raw;
        if (value instanceof List<?> list) {
            raw = list;
        } else {
            raw = objectMapper.convertValue(value, new TypeReference<List<Object>>() {});
        }
        List<String> result = new ArrayList<>();
        for (Object item : raw) {
            String text = blankToNull(asString(item));
            if (hasText(text)) {
                result.add(text);
            }
        }
        return result;
    }

    private Map<String, Object> normalizeSchemaMeta(Map<String, Object> schemaMeta, Object defaultValue) {
        Map<String, Object> result = new LinkedHashMap<>(schemaMeta == null ? Map.of() : schemaMeta);
        if (defaultValue == null) {
            result.remove("defaultValue");
        } else {
            result.put("defaultValue", defaultValue);
        }
        return result;
    }

    private String toJson(Object value) {
        try {
            return objectMapper.writeValueAsString(value == null ? Map.of() : value);
        } catch (Exception ex) {
            throw new ResponseStatusException(BAD_REQUEST, "JSON 序列化失败");
        }
    }
}
