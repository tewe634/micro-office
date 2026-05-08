package com.microoffice.service;

import com.microoffice.dto.request.WorkflowFromTemplateRequest;
import com.microoffice.dto.request.WorkflowTemplateFieldDefinitionSaveRequest;
import com.microoffice.dto.request.WorkflowTemplateNodeFieldConfigSaveRequest;
import com.microoffice.dto.request.WorkflowTemplateNodeRecommendationSaveRequest;
import com.microoffice.dto.request.WorkflowTemplateNodeSaveRequest;
import com.microoffice.dto.request.WorkflowTemplateNodesSaveRequest;
import com.microoffice.dto.request.WorkflowTemplatePackageSaveRequest;
import com.microoffice.dto.response.WorkflowInstantiationResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.EmptyResultDataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.regex.Pattern;

import static org.springframework.http.HttpStatus.BAD_REQUEST;
import static org.springframework.http.HttpStatus.FORBIDDEN;
import static org.springframework.http.HttpStatus.GONE;
import static org.springframework.http.HttpStatus.NOT_FOUND;

@Service
@RequiredArgsConstructor
public class WorkflowTemplateService {
    private static final Set<String> TEMPLATE_STATUS = Set.of("ACTIVE", "DISABLED");
    private static final Set<String> FIELD_TYPES = Set.of(
        "string", "text", "number", "boolean", "date", "datetime", "list", "json"
    );
    private static final Pattern FIELD_KEY_PATTERN = Pattern.compile("^[a-z][a-z0-9_]*$");

    private final JdbcTemplate jdbc;

    public List<Map<String, Object>> listPackages(String positionId, String applicableSubjectType, String status) {
        List<Object> args = new ArrayList<>();
        StringBuilder sql = new StringBuilder(
            "SELECT p.id, p.name, p.code, p.position_id, p.applicable_subject_type, p.description, p.status, p.sort_order, " +
                "p.allow_create_as_normal, p.allow_create_as_subflow, p.created_at, p.created_by, p.updated_at, p.updated_by, p.version " +
                "FROM mo_workflow_recommendation_packages p WHERE 1=1"
        );
        if (hasText(positionId)) {
            String normalizedPositionId = normalizePositionId(positionId);
            sql.append(" AND EXISTS (SELECT 1 FROM mo_workflow_recommendation_package_positions pp WHERE pp.package_id = p.id AND pp.position_id = ?)");
            args.add(normalizedPositionId);
        }
        if (hasText(applicableSubjectType)) {
            sql.append(" AND p.applicable_subject_type = ?");
            args.add(applicableSubjectType.trim().toUpperCase(Locale.ROOT));
        }
        if (hasText(status)) {
            sql.append(" AND p.status = ?");
            args.add(normalizeStatus(status));
        }
        sql.append(" ORDER BY p.sort_order, p.updated_at DESC, p.created_at DESC");
        return enrichPackagePositionBindings(jdbc.queryForList(sql.toString(), args.toArray()).stream().map(this::toPackageMap).toList());
    }

    public Map<String, Object> getPackage(String id) {
        return loadPackageOrThrow(id);
    }

    public List<Map<String, Object>> listTemplatePositions() {
        List<Map<String, Object>> rows = jdbc.queryForList(
            "SELECT id, name, code FROM position ORDER BY sort_order NULLS LAST, name, id"
        );
        List<Map<String, Object>> result = new ArrayList<>();
        for (Map<String, Object> row : rows) {
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("id", asString(row.get("id")));
            item.put("name", asString(row.get("name")));
            item.put("code", asString(row.get("code")));
            result.add(item);
        }
        return result;
    }

    @Transactional
    public Map<String, Object> createPackage(WorkflowTemplatePackageSaveRequest request, String userId) {
        requireRequest(request);
        String id = UUID.randomUUID().toString();
        int version = normalizeVersion(request.getVersion());
        String code = normalizeTemplateCode(request.getCode());
        ensureTemplateCodeVersionUnique(code, version, null);
        List<String> positionIds = normalizePositionIds(request);
        String primaryPositionId = positionIds.isEmpty() ? null : positionIds.get(0);

        jdbc.update(
            "INSERT INTO mo_workflow_recommendation_packages (" +
                "id, name, code, position_id, applicable_subject_type, description, status, sort_order, allow_create_as_normal, allow_create_as_subflow, version, created_by, updated_by" +
            ") VALUES (?, ?, ?, ?, ?, ?, 'DISABLED', ?, ?, ?, ?, ?, ?)",
            id,
            requireText(request.getName(), "模板名称不能为空"),
            code,
            primaryPositionId,
            normalizeApplicableSubjectType(request.getApplicableSubjectType()),
            blankToNull(request.getDescription()),
            normalizeSortOrder(request.getSortOrder()),
            defaultTrue(request.getAllowCreateAsNormal()),
            defaultFalse(request.getAllowCreateAsSubflow()),
            version,
            userId,
            userId
        );
        replacePackagePositionBindings(id, positionIds, userId);
        return loadPackageOrThrow(id);
    }

    @Transactional
    public Map<String, Object> updatePackageInfo(String id, WorkflowTemplatePackageSaveRequest request, String userId) {
        requireRequest(request);
        loadPackageOrThrow(id);
        int version = normalizeVersion(request.getVersion());
        String code = normalizeTemplateCode(request.getCode());
        ensureTemplateCodeVersionUnique(code, version, id);
        List<String> positionIds = normalizePositionIds(request);
        String primaryPositionId = positionIds.isEmpty() ? null : positionIds.get(0);

        jdbc.update(
            "UPDATE mo_workflow_recommendation_packages " +
                "SET name = ?, code = ?, position_id = ?, applicable_subject_type = ?, description = ?, sort_order = ?, " +
                "allow_create_as_normal = ?, allow_create_as_subflow = ?, version = ?, updated_at = NOW(), updated_by = ? " +
                "WHERE id = ?",
            requireText(request.getName(), "模板名称不能为空"),
            code,
            primaryPositionId,
            normalizeApplicableSubjectType(request.getApplicableSubjectType()),
            blankToNull(request.getDescription()),
            normalizeSortOrder(request.getSortOrder()),
            defaultTrue(request.getAllowCreateAsNormal()),
            defaultFalse(request.getAllowCreateAsSubflow()),
            version,
            userId,
            id
        );
        replacePackagePositionBindings(id, positionIds, userId);
        return loadPackageOrThrow(id);
    }

    @Transactional
    public Map<String, Object> updatePackageStatus(String id, String status, String userId) {
        int updated = jdbc.update(
            "UPDATE mo_workflow_recommendation_packages SET status = ?, updated_at = NOW(), updated_by = ? WHERE id = ?",
            normalizeStatus(status),
            userId,
            id
        );
        if (updated == 0) {
            throw new ResponseStatusException(NOT_FOUND, "工作流模板不存在");
        }
        return loadPackageOrThrow(id);
    }

    @Transactional
    public Map<String, Object> deletePackage(String id, String userId) {
        Map<String, Object> source = loadPackageOrThrow(id);
        int deleted = jdbc.update("DELETE FROM mo_workflow_recommendation_packages WHERE id = ?", id);
        if (deleted == 0) {
            throw new ResponseStatusException(NOT_FOUND, "工作流模板不存在");
        }
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("id", id);
        result.put("name", asString(source.get("name")));
        result.put("deletedBy", userId);
        return result;
    }

    @Transactional
    public Map<String, Object> copyPackage(String id, String userId) {
        Map<String, Object> source = loadPackageOrThrow(id);
        String copiedId = UUID.randomUUID().toString();
        String copiedCode = generateCopiedTemplateCode(asString(source.get("code")), asInt(source.get("version"), 1));
        List<String> sourcePositionIds = asStringList(source.get("positionIds"));

        jdbc.update(
            "INSERT INTO mo_workflow_recommendation_packages (" +
                "id, name, code, position_id, applicable_subject_type, description, status, sort_order, allow_create_as_normal, allow_create_as_subflow, version, created_by, updated_by" +
            ") VALUES (?, ?, ?, ?, ?, ?, 'DISABLED', ?, ?, ?, ?, ?, ?)",
            copiedId,
            asString(source.get("name")) + "（复制）",
            copiedCode,
            sourcePositionIds.isEmpty() ? null : sourcePositionIds.get(0),
            asString(source.get("applicableSubjectType")),
            asString(source.get("description")),
            asInt(source.get("sortOrder"), 100),
            asBoolean(source.get("allowCreateAsNormal"), true),
            asBoolean(source.get("allowCreateAsSubflow"), false),
            asInt(source.get("version"), 1),
            userId,
            userId
        );
        replacePackagePositionBindings(copiedId, sourcePositionIds, userId);

        List<Map<String, Object>> sourceNodes = listPackageNodes(id);
        Map<String, String> nodeIdMap = new LinkedHashMap<>();
        for (Map<String, Object> node : sourceNodes) {
            nodeIdMap.put(asString(node.get("id")), UUID.randomUUID().toString());
        }

        for (Map<String, Object> node : sourceNodes) {
            String newNodeId = nodeIdMap.get(asString(node.get("id")));
            jdbc.update(
                "INSERT INTO mo_workflow_recommendation_package_nodes (" +
                    "id, package_id, module_definition_id, parent_package_node_id, sort_order, display_name, hierarchy_level, relation_type, branch_group_key, branch_order, " +
                    "code, node_type, is_main_path, allow_append_next_node, allow_derive_subflow, version, meta, created_by, updated_by" +
                ") VALUES (?, ?, NULL, NULL, ?, ?, 0, 'SEQUENCE', NULL, NULL, ?, ?, ?, ?, ?, ?, '{}'::jsonb, ?, ?)",
                newNodeId,
                copiedId,
                asInt(node.get("sequence"), 1),
                requireText(node.get("name"), "节点名称不能为空"),
                requireText(node.get("code"), "节点编码不能为空"),
                requireText(node.get("nodeType"), "节点类型不能为空"),
                asBoolean(node.get("isMainPath"), true),
                asBoolean(node.get("allowAppendNextNode"), false),
                asBoolean(node.get("allowDeriveSubflow"), false),
                asInt(node.get("version"), 1),
                userId,
                userId
            );

            for (Map<String, Object> field : asMapList(node.get("inputFields"))) {
                jdbc.update(
                    "INSERT INTO mo_workflow_template_node_input_fields (" +
                        "id, node_template_id, field_key, display_name, display_order, required, read_only, created_by, updated_by" +
                    ") VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
                    UUID.randomUUID().toString(),
                    newNodeId,
                    asString(field.get("fieldKey")),
                    blankToNull(asString(field.get("displayName"))),
                    asInt(field.get("displayOrder"), 100),
                    asBoolean(field.get("required"), false),
                    asBoolean(field.get("readOnly"), false),
                    userId,
                    userId
                );
            }

            for (Map<String, Object> field : asMapList(node.get("outputFields"))) {
                jdbc.update(
                    "INSERT INTO mo_workflow_template_node_output_fields (" +
                        "id, node_template_id, field_key, display_name, display_order, required, allow_write_back_parent, created_by, updated_by" +
                    ") VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
                    UUID.randomUUID().toString(),
                    newNodeId,
                    asString(field.get("fieldKey")),
                    blankToNull(asString(field.get("displayName"))),
                    asInt(field.get("displayOrder"), 100),
                    asBoolean(field.get("required"), false),
                    asBoolean(field.get("allowWriteBackParent"), false),
                    userId,
                    userId
                );
            }

            for (Map<String, Object> recommendation : asMapList(node.get("recommendedTemplates"))) {
                jdbc.update(
                    "INSERT INTO mo_workflow_template_node_recommendations (" +
                        "id, current_node_template_id, recommended_workflow_template_id, reason, display_order, enabled, created_by, updated_by" +
                    ") VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                    UUID.randomUUID().toString(),
                    newNodeId,
                    asString(recommendation.get("recommendedWorkflowTemplateId")),
                    blankToNull(asString(recommendation.get("reason"))),
                    asInt(recommendation.get("displayOrder"), 100),
                    asBoolean(recommendation.get("enabled"), true),
                    userId,
                    userId
                );
            }
        }

        return loadPackageOrThrow(copiedId);
    }

    public List<Map<String, Object>> listPackageNodes(String packageId) {
        ensurePackageExists(packageId);
        List<Map<String, Object>> rows = jdbc.queryForList(
            "SELECT id, package_id, display_name, code, node_type, sort_order, is_main_path, allow_append_next_node, allow_derive_subflow, version " +
                "FROM mo_workflow_recommendation_package_nodes " +
                "WHERE package_id = ? ORDER BY sort_order, id",
            packageId
        );
        List<Map<String, Object>> nodes = new ArrayList<>();
        List<String> nodeIds = new ArrayList<>();
        for (Map<String, Object> row : rows) {
            Map<String, Object> item = toTemplateNodeMap(row);
            nodes.add(item);
            nodeIds.add(asString(row.get("id")));
        }
        Map<String, List<Map<String, Object>>> inputFieldMap = loadNodeFieldConfigMap(nodeIds, true);
        Map<String, List<Map<String, Object>>> outputFieldMap = loadNodeFieldConfigMap(nodeIds, false);
        Map<String, List<Map<String, Object>>> recommendationMap = loadNodeRecommendationMap(nodeIds);
        for (Map<String, Object> node : nodes) {
            String nodeId = asString(node.get("id"));
            node.put("inputFields", inputFieldMap.getOrDefault(nodeId, List.of()));
            node.put("outputFields", outputFieldMap.getOrDefault(nodeId, List.of()));
            node.put("recommendedTemplates", recommendationMap.getOrDefault(nodeId, List.of()));
        }
        return nodes;
    }

    @Transactional
    public List<Map<String, Object>> saveNodes(String packageId, WorkflowTemplateNodesSaveRequest request, String userId) {
        ensurePackageExists(packageId);
        List<ValidatedTemplateNode> nodes = validateTemplateNodes(packageId, request == null ? List.of() : request.getNodes());
        jdbc.update("DELETE FROM mo_workflow_recommendation_package_nodes WHERE package_id = ?", packageId);

        for (ValidatedTemplateNode node : nodes.stream().sorted(Comparator.comparingInt(ValidatedTemplateNode::sequence)).toList()) {
            jdbc.update(
                "INSERT INTO mo_workflow_recommendation_package_nodes (" +
                    "id, package_id, module_definition_id, parent_package_node_id, sort_order, display_name, hierarchy_level, relation_type, branch_group_key, branch_order, " +
                    "code, node_type, is_main_path, allow_append_next_node, allow_derive_subflow, version, meta, created_by, updated_by" +
                ") VALUES (?, ?, NULL, NULL, ?, ?, 0, 'SEQUENCE', NULL, NULL, ?, ?, ?, ?, ?, ?, '{}'::jsonb, ?, ?)",
                node.id(),
                packageId,
                node.sequence(),
                node.name(),
                node.code(),
                node.nodeType(),
                node.isMainPath(),
                node.allowAppendNextNode(),
                node.allowDeriveSubflow(),
                node.version(),
                userId,
                userId
            );

            for (ValidatedNodeFieldConfig field : node.inputFields()) {
                jdbc.update(
                    "INSERT INTO mo_workflow_template_node_input_fields (" +
                        "id, node_template_id, field_key, display_name, display_order, required, read_only, created_by, updated_by" +
                    ") VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
                    UUID.randomUUID().toString(),
                    node.id(),
                    field.fieldKey(),
                    field.displayName(),
                    field.displayOrder(),
                    field.required(),
                    field.readOnly(),
                    userId,
                    userId
                );
            }

            for (ValidatedNodeFieldConfig field : node.outputFields()) {
                jdbc.update(
                    "INSERT INTO mo_workflow_template_node_output_fields (" +
                        "id, node_template_id, field_key, display_name, display_order, required, allow_write_back_parent, created_by, updated_by" +
                    ") VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
                    UUID.randomUUID().toString(),
                    node.id(),
                    field.fieldKey(),
                    field.displayName(),
                    field.displayOrder(),
                    field.required(),
                    field.allowWriteBackParent(),
                    userId,
                    userId
                );
            }

            for (ValidatedNodeRecommendation recommendation : node.recommendedTemplates()) {
                jdbc.update(
                    "INSERT INTO mo_workflow_template_node_recommendations (" +
                        "id, current_node_template_id, recommended_workflow_template_id, reason, display_order, enabled, created_by, updated_by" +
                    ") VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                    UUID.randomUUID().toString(),
                    node.id(),
                    recommendation.recommendedWorkflowTemplateId(),
                    recommendation.reason(),
                    recommendation.displayOrder(),
                    recommendation.enabled(),
                    userId,
                    userId
                );
            }
        }
        return listPackageNodes(packageId);
    }

    public List<Map<String, Object>> listFieldDefinitions(Boolean enabled, String keyword) {
        List<Object> args = new ArrayList<>();
        StringBuilder sql = new StringBuilder(
            "SELECT id, field_key, name, field_type, description, enabled, sensitive, group_key, display_order, created_at, updated_at " +
                "FROM mo_workflow_template_field_definitions WHERE 1=1"
        );
        if (enabled != null) {
            sql.append(" AND enabled = ?");
            args.add(enabled);
        }
        if (hasText(keyword)) {
            sql.append(" AND (field_key ILIKE ? OR name ILIKE ? OR COALESCE(description, '') ILIKE ?)");
            String like = "%" + keyword.trim() + "%";
            args.add(like);
            args.add(like);
            args.add(like);
        }
        sql.append(" ORDER BY display_order, field_key");
        List<Map<String, Object>> rows = jdbc.queryForList(sql.toString(), args.toArray());
        List<Map<String, Object>> result = new ArrayList<>();
        for (Map<String, Object> row : rows) {
            result.add(toFieldDefinitionMap(row));
        }
        return result;
    }

    @Transactional
    public Map<String, Object> createFieldDefinition(WorkflowTemplateFieldDefinitionSaveRequest request, String userId) {
        requireFieldDefinitionRequest(request);
        String fieldKey = normalizeFieldKey(request.getFieldKey());
        ensureFieldKeyUnique(fieldKey, null);
        String id = UUID.randomUUID().toString();
        jdbc.update(
            "INSERT INTO mo_workflow_template_field_definitions (" +
                "id, field_key, name, field_type, description, enabled, sensitive, group_key, display_order, created_by, updated_by" +
            ") VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            id,
            fieldKey,
            requireText(request.getName(), "字段名称不能为空"),
            normalizeFieldType(request.getFieldType()),
            blankToNull(request.getDescription()),
            defaultTrue(request.getEnabled()),
            defaultFalse(request.getSensitive()),
            blankToNull(request.getGroupKey()),
            normalizeSortOrder(request.getDisplayOrder()),
            userId,
            userId
        );
        return loadFieldDefinitionOrThrow(fieldKey);
    }

    @Transactional
    public Map<String, Object> updateFieldDefinition(String fieldKey, WorkflowTemplateFieldDefinitionSaveRequest request, String userId) {
        requireFieldDefinitionRequest(request);
        String normalizedFieldKey = normalizeFieldKey(fieldKey);
        String bodyFieldKey = request.getFieldKey() == null ? normalizedFieldKey : normalizeFieldKey(request.getFieldKey());
        if (!normalizedFieldKey.equals(bodyFieldKey)) {
            throw new ResponseStatusException(BAD_REQUEST, "fieldKey 一旦创建后不支持直接修改");
        }
        int updated = jdbc.update(
            "UPDATE mo_workflow_template_field_definitions " +
                "SET name = ?, field_type = ?, description = ?, enabled = ?, sensitive = ?, group_key = ?, display_order = ?, updated_at = NOW(), updated_by = ? " +
                "WHERE field_key = ?",
            requireText(request.getName(), "字段名称不能为空"),
            normalizeFieldType(request.getFieldType()),
            blankToNull(request.getDescription()),
            defaultTrue(request.getEnabled()),
            defaultFalse(request.getSensitive()),
            blankToNull(request.getGroupKey()),
            normalizeSortOrder(request.getDisplayOrder()),
            userId,
            normalizedFieldKey
        );
        if (updated == 0) {
            throw new ResponseStatusException(NOT_FOUND, "全局字段定义不存在");
        }
        return loadFieldDefinitionOrThrow(normalizedFieldKey);
    }

    @Transactional
    public Map<String, Object> deleteFieldDefinition(String fieldKey, String userId) {
        String normalizedFieldKey = normalizeFieldKey(fieldKey);
        Map<String, Object> source = loadFieldDefinitionOrThrow(normalizedFieldKey);
        int references = countFieldReferences(normalizedFieldKey);
        if (references > 0) {
            throw new ResponseStatusException(BAD_REQUEST, "字段已被节点输入/输出配置引用，无法删除");
        }
        int deleted = jdbc.update("DELETE FROM mo_workflow_template_field_definitions WHERE field_key = ?", normalizedFieldKey);
        if (deleted == 0) {
            throw new ResponseStatusException(NOT_FOUND, "全局字段定义不存在");
        }
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("fieldKey", normalizedFieldKey);
        result.put("name", asString(source.get("name")));
        result.put("deletedBy", userId);
        return result;
    }

    public List<Map<String, Object>> listAvailablePackages(String userId, String requestedPositionId) {
        Set<String> userPositionIds = resolveUserPositionIds(userId);
        String normalizedRequestedPositionId = normalizePositionId(requestedPositionId);
        if (hasText(normalizedRequestedPositionId) && !userPositionIds.contains(normalizedRequestedPositionId)) {
            throw new ResponseStatusException(FORBIDDEN, "当前用户无权查看该岗位下的工作流模板");
        }

        List<Object> args = new ArrayList<>();
        StringBuilder sql = new StringBuilder(
            "SELECT p.id, p.name, p.code, p.position_id, p.applicable_subject_type, p.description, p.status, p.sort_order, " +
                "p.allow_create_as_normal, p.allow_create_as_subflow, p.created_at, p.created_by, p.updated_at, p.updated_by, p.version " +
                "FROM mo_workflow_recommendation_packages p " +
                "WHERE p.status = 'ACTIVE' AND p.allow_create_as_normal = TRUE"
        );
        if (hasText(normalizedRequestedPositionId)) {
            sql.append(" AND (NOT EXISTS (SELECT 1 FROM mo_workflow_recommendation_package_positions pp WHERE pp.package_id = p.id) " +
                "OR EXISTS (SELECT 1 FROM mo_workflow_recommendation_package_positions pp WHERE pp.package_id = p.id AND pp.position_id = ?))");
            args.add(normalizedRequestedPositionId);
        } else if (!userPositionIds.isEmpty()) {
            sql.append(" AND (NOT EXISTS (SELECT 1 FROM mo_workflow_recommendation_package_positions pp WHERE pp.package_id = p.id) " +
                "OR EXISTS (SELECT 1 FROM mo_workflow_recommendation_package_positions pp WHERE pp.package_id = p.id AND pp.position_id IN (");
            appendPlaceholders(sql, userPositionIds.size());
            sql.append(")))");
            args.addAll(userPositionIds);
        } else {
            sql.append(" AND NOT EXISTS (SELECT 1 FROM mo_workflow_recommendation_package_positions pp WHERE pp.package_id = p.id)");
        }
        sql.append(" ORDER BY p.sort_order, p.updated_at DESC, p.created_at DESC");
        return enrichPackagePositionBindings(jdbc.queryForList(sql.toString(), args.toArray()).stream().map(this::toPackageMap).toList());
    }

    public WorkflowInstantiationResponse instantiateWorkflow(WorkflowFromTemplateRequest request, String userId) {
        throw new ResponseStatusException(GONE, "当前版本不再由模板管理模块直接创建运行时工作流实例");
    }

    private List<ValidatedTemplateNode> validateTemplateNodes(String packageId, List<WorkflowTemplateNodeSaveRequest> requestNodes) {
        if (requestNodes == null || requestNodes.isEmpty()) {
            throw new ResponseStatusException(BAD_REQUEST, "模板节点列表不能为空");
        }

        LinkedHashSet<String> referencedFieldKeys = new LinkedHashSet<>();
        LinkedHashSet<String> recommendedTemplateIds = new LinkedHashSet<>();
        for (WorkflowTemplateNodeSaveRequest node : requestNodes) {
            for (WorkflowTemplateNodeFieldConfigSaveRequest field : defaultList(node.getInputFields())) {
                referencedFieldKeys.add(normalizeFieldKey(field.getFieldKey()));
            }
            for (WorkflowTemplateNodeFieldConfigSaveRequest field : defaultList(node.getOutputFields())) {
                referencedFieldKeys.add(normalizeFieldKey(field.getFieldKey()));
            }
            for (WorkflowTemplateNodeRecommendationSaveRequest recommendation : defaultList(node.getRecommendedTemplates())) {
                if (hasText(recommendation.getRecommendedWorkflowTemplateId())) {
                    recommendedTemplateIds.add(recommendation.getRecommendedWorkflowTemplateId().trim());
                }
            }
        }

        Map<String, Map<String, Object>> fieldDefinitionMap = loadFieldDefinitionsByKeys(referencedFieldKeys);
        ensureRecommendedTemplatesExist(recommendedTemplateIds);

        LinkedHashMap<String, ValidatedTemplateNode> validated = new LinkedHashMap<>();
        LinkedHashSet<String> codeSet = new LinkedHashSet<>();
        LinkedHashSet<Integer> sequenceSet = new LinkedHashSet<>();

        int fallbackSequence = 1;
        for (WorkflowTemplateNodeSaveRequest node : requestNodes) {
            String id = normalizeNodeId(node.getId());
            if (validated.containsKey(id)) {
                throw new ResponseStatusException(BAD_REQUEST, "节点 ID 重复: " + id);
            }
            String code = normalizeNodeCode(node.getCode());
            if (!codeSet.add(code)) {
                throw new ResponseStatusException(BAD_REQUEST, "节点编码重复: " + code);
            }
            int sequence = node.getSequence() == null ? fallbackSequence : normalizePositiveInt(node.getSequence(), "sequence 不能小于 1");
            fallbackSequence = sequence + 1;
            if (!sequenceSet.add(sequence)) {
                throw new ResponseStatusException(BAD_REQUEST, "节点顺序 sequence 不能重复: " + sequence);
            }

            validated.put(id, new ValidatedTemplateNode(
                id,
                packageId,
                requireText(node.getName(), "节点名称不能为空"),
                code,
                normalizeNodeType(node.getNodeType()),
                sequence,
                node.getIsMainPath() == null || Boolean.TRUE.equals(node.getIsMainPath()),
                defaultFalse(node.getAllowAppendNextNode()),
                defaultFalse(node.getAllowDeriveSubflow()),
                validateNodeFieldConfigs(defaultList(node.getInputFields()), fieldDefinitionMap, true),
                validateNodeFieldConfigs(defaultList(node.getOutputFields()), fieldDefinitionMap, false),
                validateNodeRecommendations(packageId, defaultList(node.getRecommendedTemplates())),
                normalizeVersion(node.getVersion())
            ));
        }

        return new ArrayList<>(validated.values());
    }

    private List<ValidatedNodeFieldConfig> validateNodeFieldConfigs(List<WorkflowTemplateNodeFieldConfigSaveRequest> fields,
                                                                   Map<String, Map<String, Object>> fieldDefinitionMap,
                                                                   boolean inputScope) {
        LinkedHashSet<String> dedup = new LinkedHashSet<>();
        List<ValidatedNodeFieldConfig> result = new ArrayList<>();
        int fallbackOrder = 100;
        for (WorkflowTemplateNodeFieldConfigSaveRequest field : fields) {
            String fieldKey = normalizeFieldKey(field.getFieldKey());
            if (!dedup.add(fieldKey)) {
                throw new ResponseStatusException(BAD_REQUEST, "同一节点内字段键重复: " + fieldKey);
            }
            if (!fieldDefinitionMap.containsKey(fieldKey)) {
                throw new ResponseStatusException(BAD_REQUEST, "全局字段定义不存在: " + fieldKey);
            }
            int displayOrder = field.getDisplayOrder() == null ? fallbackOrder : normalizeSortOrder(field.getDisplayOrder());
            fallbackOrder = displayOrder + 1;
            result.add(new ValidatedNodeFieldConfig(
                fieldKey,
                blankToNull(field.getDisplayName()),
                displayOrder,
                defaultFalse(field.getRequired()),
                inputScope && defaultFalse(field.getReadOnly()),
                !inputScope && defaultFalse(field.getAllowWriteBackParent())
            ));
        }
        return result;
    }

    private List<ValidatedNodeRecommendation> validateNodeRecommendations(String packageId,
                                                                          List<WorkflowTemplateNodeRecommendationSaveRequest> recommendations) {
        LinkedHashSet<String> dedup = new LinkedHashSet<>();
        List<ValidatedNodeRecommendation> result = new ArrayList<>();
        int fallbackOrder = 100;
        for (WorkflowTemplateNodeRecommendationSaveRequest recommendation : recommendations) {
            String recommendedTemplateId = requireText(
                recommendation.getRecommendedWorkflowTemplateId(),
                "recommendedWorkflowTemplateId 不能为空"
            );
            if (packageId.equals(recommendedTemplateId)) {
                throw new ResponseStatusException(BAD_REQUEST, "不能将当前模板本身配置为推荐模板");
            }
            if (!dedup.add(recommendedTemplateId)) {
                throw new ResponseStatusException(BAD_REQUEST, "同一节点内推荐模板重复: " + recommendedTemplateId);
            }
            int displayOrder = recommendation.getDisplayOrder() == null ? fallbackOrder : normalizeSortOrder(recommendation.getDisplayOrder());
            fallbackOrder = displayOrder + 1;
            result.add(new ValidatedNodeRecommendation(
                recommendedTemplateId,
                blankToNull(recommendation.getReason()),
                displayOrder,
                recommendation.getEnabled() == null || Boolean.TRUE.equals(recommendation.getEnabled())
            ));
        }
        return result;
    }

    private Map<String, List<Map<String, Object>>> loadNodeFieldConfigMap(List<String> nodeIds, boolean inputScope) {
        if (nodeIds.isEmpty()) {
            return Map.of();
        }
        String table = inputScope ? "mo_workflow_template_node_input_fields" : "mo_workflow_template_node_output_fields";
        StringBuilder sql = new StringBuilder(
            "SELECT node_template_id, field_key, display_name, display_order, required, "
        );
        sql.append(inputScope ? "read_only" : "allow_write_back_parent");
        sql.append(" FROM ").append(table).append(" WHERE node_template_id IN (");
        appendPlaceholders(sql, nodeIds.size());
        sql.append(") ORDER BY node_template_id, display_order, field_key");

        List<Map<String, Object>> rows = jdbc.queryForList(sql.toString(), nodeIds.toArray());
        Map<String, List<Map<String, Object>>> result = new LinkedHashMap<>();
        for (Map<String, Object> row : rows) {
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("fieldKey", asString(row.get("field_key")));
            item.put("displayName", asString(row.get("display_name")));
            item.put("displayOrder", asInt(row.get("display_order"), 100));
            item.put("required", Boolean.TRUE.equals(row.get("required")));
            if (inputScope) {
                item.put("readOnly", Boolean.TRUE.equals(row.get("read_only")));
            } else {
                item.put("allowWriteBackParent", Boolean.TRUE.equals(row.get("allow_write_back_parent")));
            }
            result.computeIfAbsent(asString(row.get("node_template_id")), ignored -> new ArrayList<>()).add(item);
        }
        return result;
    }

    private Map<String, List<Map<String, Object>>> loadNodeRecommendationMap(List<String> nodeIds) {
        if (nodeIds.isEmpty()) {
            return Map.of();
        }
        StringBuilder sql = new StringBuilder(
            "SELECT r.current_node_template_id, r.recommended_workflow_template_id, r.reason, r.display_order, r.enabled, " +
                "p.name AS template_name, p.code AS template_code, p.status AS template_status " +
                "FROM mo_workflow_template_node_recommendations r " +
                "JOIN mo_workflow_recommendation_packages p ON p.id = r.recommended_workflow_template_id " +
                "WHERE r.current_node_template_id IN ("
        );
        appendPlaceholders(sql, nodeIds.size());
        sql.append(") ORDER BY r.current_node_template_id, r.display_order, r.recommended_workflow_template_id");

        List<Map<String, Object>> rows = jdbc.queryForList(sql.toString(), nodeIds.toArray());
        Map<String, List<Map<String, Object>>> result = new LinkedHashMap<>();
        for (Map<String, Object> row : rows) {
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("recommendedWorkflowTemplateId", asString(row.get("recommended_workflow_template_id")));
            item.put("recommendedWorkflowTemplateName", asString(row.get("template_name")));
            item.put("recommendedWorkflowTemplateCode", asString(row.get("template_code")));
            item.put("recommendedWorkflowTemplateStatus", asString(row.get("template_status")));
            item.put("reason", asString(row.get("reason")));
            item.put("displayOrder", asInt(row.get("display_order"), 100));
            item.put("enabled", Boolean.TRUE.equals(row.get("enabled")));
            result.computeIfAbsent(asString(row.get("current_node_template_id")), ignored -> new ArrayList<>()).add(item);
        }
        return result;
    }

    private Map<String, Map<String, Object>> loadFieldDefinitionsByKeys(Collection<String> fieldKeys) {
        if (fieldKeys == null || fieldKeys.isEmpty()) {
            return Map.of();
        }
        List<String> normalized = fieldKeys.stream().filter(this::hasText).map(String::trim).distinct().toList();
        if (normalized.isEmpty()) {
            return Map.of();
        }
        StringBuilder sql = new StringBuilder(
            "SELECT id, field_key, name, field_type, description, enabled, sensitive, group_key, display_order, created_at, updated_at " +
                "FROM mo_workflow_template_field_definitions WHERE field_key IN ("
        );
        appendPlaceholders(sql, normalized.size());
        sql.append(")");
        Map<String, Map<String, Object>> result = new LinkedHashMap<>();
        for (Map<String, Object> row : jdbc.queryForList(sql.toString(), normalized.toArray())) {
            result.put(asString(row.get("field_key")), toFieldDefinitionMap(row));
        }
        return result;
    }

    private void ensureRecommendedTemplatesExist(Collection<String> templateIds) {
        if (templateIds == null || templateIds.isEmpty()) {
            return;
        }
        List<String> ids = templateIds.stream().filter(this::hasText).map(String::trim).distinct().toList();
        if (ids.isEmpty()) {
            return;
        }
        StringBuilder sql = new StringBuilder("SELECT id FROM mo_workflow_recommendation_packages WHERE id IN (");
        appendPlaceholders(sql, ids.size());
        sql.append(")");
        Set<String> existingIds = new LinkedHashSet<>(jdbc.queryForList(sql.toString(), String.class, ids.toArray()));
        for (String id : ids) {
            if (!existingIds.contains(id)) {
                throw new ResponseStatusException(BAD_REQUEST, "推荐工作流模板不存在: " + id);
            }
        }
    }

    private Map<String, Object> loadPackageOrThrow(String id) {
        try {
            Map<String, Object> row = jdbc.queryForMap(
                "SELECT id, name, code, position_id, applicable_subject_type, description, status, sort_order, " +
                    "allow_create_as_normal, allow_create_as_subflow, created_at, created_by, updated_at, updated_by, version " +
                    "FROM mo_workflow_recommendation_packages WHERE id = ?",
                id
            );
            return enrichPackagePositionBindings(List.of(toPackageMap(row))).get(0);
        } catch (EmptyResultDataAccessException ex) {
            throw new ResponseStatusException(NOT_FOUND, "工作流模板不存在");
        }
    }

    private Map<String, Object> loadFieldDefinitionOrThrow(String fieldKey) {
        try {
            return toFieldDefinitionMap(jdbc.queryForMap(
                "SELECT id, field_key, name, field_type, description, enabled, sensitive, group_key, display_order, created_at, updated_at " +
                    "FROM mo_workflow_template_field_definitions WHERE field_key = ?",
                fieldKey
            ));
        } catch (EmptyResultDataAccessException ex) {
            throw new ResponseStatusException(NOT_FOUND, "全局字段定义不存在");
        }
    }

    private Map<String, Object> toPackageMap(Map<String, Object> row) {
        Map<String, Object> item = new LinkedHashMap<>();
        item.put("id", asString(row.get("id")));
        item.put("name", asString(row.get("name")));
        item.put("code", asString(row.get("code")));
        item.put("positionId", asString(row.get("position_id")));
        item.put("positionName", null);
        item.put("positionIds", List.of());
        item.put("positionNames", List.of());
        item.put("applicableSubjectType", asString(row.get("applicable_subject_type")));
        item.put("description", asString(row.get("description")));
        item.put("status", asString(row.get("status")));
        item.put("sortOrder", asInt(row.get("sort_order"), 100));
        item.put("allowCreateAsNormal", Boolean.TRUE.equals(row.get("allow_create_as_normal")));
        item.put("allowCreateAsSubflow", Boolean.TRUE.equals(row.get("allow_create_as_subflow")));
        item.put("version", asInt(row.get("version"), 1));
        item.put("createdAt", row.get("created_at"));
        item.put("createdBy", asString(row.get("created_by")));
        item.put("updatedAt", row.get("updated_at"));
        item.put("updatedBy", asString(row.get("updated_by")));
        return item;
    }

    private Map<String, Object> toTemplateNodeMap(Map<String, Object> row) {
        Map<String, Object> item = new LinkedHashMap<>();
        item.put("id", asString(row.get("id")));
        item.put("templateId", asString(row.get("package_id")));
        item.put("name", asString(row.get("display_name")));
        item.put("code", asString(row.get("code")));
        item.put("nodeType", asString(row.get("node_type")));
        item.put("sequence", asInt(row.get("sort_order"), 1));
        item.put("isMainPath", Boolean.TRUE.equals(row.get("is_main_path")));
        item.put("allowAppendNextNode", Boolean.TRUE.equals(row.get("allow_append_next_node")));
        item.put("allowDeriveSubflow", Boolean.TRUE.equals(row.get("allow_derive_subflow")));
        item.put("version", asInt(row.get("version"), 1));
        return item;
    }

    private Map<String, Object> toFieldDefinitionMap(Map<String, Object> row) {
        Map<String, Object> item = new LinkedHashMap<>();
        item.put("id", asString(row.get("id")));
        item.put("fieldKey", asString(row.get("field_key")));
        item.put("name", asString(row.get("name")));
        item.put("fieldType", asString(row.get("field_type")));
        item.put("description", asString(row.get("description")));
        item.put("enabled", Boolean.TRUE.equals(row.get("enabled")));
        item.put("sensitive", Boolean.TRUE.equals(row.get("sensitive")));
        item.put("groupKey", asString(row.get("group_key")));
        item.put("displayOrder", asInt(row.get("display_order"), 100));
        item.put("createdAt", row.get("created_at"));
        item.put("updatedAt", row.get("updated_at"));
        return item;
    }

    private void ensurePackageExists(String packageId) {
        Integer count = jdbc.queryForObject(
            "SELECT COUNT(*) FROM mo_workflow_recommendation_packages WHERE id = ?",
            Integer.class,
            packageId
        );
        if (count == null || count == 0) {
            throw new ResponseStatusException(NOT_FOUND, "工作流模板不存在");
        }
    }

    private void requireRequest(Object request) {
        if (request == null) {
            throw new ResponseStatusException(BAD_REQUEST, "请求体不能为空");
        }
    }

    private void requireFieldDefinitionRequest(WorkflowTemplateFieldDefinitionSaveRequest request) {
        if (request == null) {
            throw new ResponseStatusException(BAD_REQUEST, "字段定义请求体不能为空");
        }
    }

    private void ensureTemplateCodeVersionUnique(String code, int version, String excludeId) {
        StringBuilder sql = new StringBuilder("SELECT COUNT(*) FROM mo_workflow_recommendation_packages WHERE code = ? AND version = ?");
        List<Object> args = new ArrayList<>();
        args.add(code);
        args.add(version);
        if (hasText(excludeId)) {
            sql.append(" AND id <> ?");
            args.add(excludeId);
        }
        Integer count = jdbc.queryForObject(sql.toString(), Integer.class, args.toArray());
        if (count != null && count > 0) {
            throw new ResponseStatusException(BAD_REQUEST, "工作流模板编码与版本组合已存在");
        }
    }

    private void ensureFieldKeyUnique(String fieldKey, String excludeFieldKey) {
        StringBuilder sql = new StringBuilder("SELECT COUNT(*) FROM mo_workflow_template_field_definitions WHERE field_key = ?");
        List<Object> args = new ArrayList<>();
        args.add(fieldKey);
        if (hasText(excludeFieldKey)) {
            sql.append(" AND field_key <> ?");
            args.add(excludeFieldKey);
        }
        Integer count = jdbc.queryForObject(sql.toString(), Integer.class, args.toArray());
        if (count != null && count > 0) {
            throw new ResponseStatusException(BAD_REQUEST, "字段 key 已存在: " + fieldKey);
        }
    }

    private int countFieldReferences(String fieldKey) {
        Integer inputCount = jdbc.queryForObject(
            "SELECT COUNT(*) FROM mo_workflow_template_node_input_fields WHERE field_key = ?",
            Integer.class,
            fieldKey
        );
        Integer outputCount = jdbc.queryForObject(
            "SELECT COUNT(*) FROM mo_workflow_template_node_output_fields WHERE field_key = ?",
            Integer.class,
            fieldKey
        );
        return (inputCount == null ? 0 : inputCount) + (outputCount == null ? 0 : outputCount);
    }

    private List<String> normalizePositionIds(WorkflowTemplatePackageSaveRequest request) {
        LinkedHashSet<String> positionIds = new LinkedHashSet<>();
        if (request == null) {
            return List.of();
        }
        for (String raw : defaultList(request.getPositionIds())) {
            String normalized = normalizePositionId(raw);
            if (hasText(normalized)) {
                positionIds.add(normalized);
            }
        }
        String singlePositionId = normalizePositionId(request.getPositionId());
        if (hasText(singlePositionId)) {
            positionIds.add(singlePositionId);
        }
        return new ArrayList<>(positionIds);
    }

    private String normalizePositionId(String positionId) {
        String normalized = blankToNull(positionId);
        if (!hasText(normalized)) {
            return null;
        }
        validatePositionExists(normalized);
        return normalized;
    }

    private void validatePositionExists(String positionId) {
        Integer count = jdbc.queryForObject(
            "SELECT COUNT(*) FROM position WHERE id = ?",
            Integer.class,
            positionId
        );
        if (count == null || count == 0) {
            throw new ResponseStatusException(BAD_REQUEST, "关联岗位不存在");
        }
    }

    private void replacePackagePositionBindings(String packageId, List<String> positionIds, String userId) {
        jdbc.update("DELETE FROM mo_workflow_recommendation_package_positions WHERE package_id = ?", packageId);
        int sortOrder = 0;
        for (String positionId : positionIds) {
            jdbc.update(
                "INSERT INTO mo_workflow_recommendation_package_positions (package_id, position_id, sort_order, created_by, updated_by) VALUES (?, ?, ?, ?, ?)",
                packageId,
                positionId,
                sortOrder,
                userId,
                userId
            );
            sortOrder += 1;
        }
    }

    private List<Map<String, Object>> enrichPackagePositionBindings(List<Map<String, Object>> packages) {
        if (packages == null || packages.isEmpty()) {
            return packages == null ? List.of() : packages;
        }
        List<String> packageIds = packages.stream()
            .map(item -> asString(item.get("id")))
            .filter(this::hasText)
            .distinct()
            .toList();
        if (packageIds.isEmpty()) {
            return packages;
        }
        StringBuilder sql = new StringBuilder(
            "SELECT pp.package_id, pp.position_id, pos.name AS position_name " +
                "FROM mo_workflow_recommendation_package_positions pp " +
                "LEFT JOIN position pos ON pos.id = pp.position_id WHERE pp.package_id IN ("
        );
        appendPlaceholders(sql, packageIds.size());
        sql.append(") ORDER BY pp.package_id, pp.sort_order, pos.sort_order NULLS LAST, pos.name, pp.position_id");

        Map<String, List<String>> positionIdsByPackage = new LinkedHashMap<>();
        Map<String, List<String>> positionNamesByPackage = new LinkedHashMap<>();
        List<Map<String, Object>> bindingRows = jdbc.queryForList(sql.toString(), packageIds.toArray());
        for (Map<String, Object> row : bindingRows) {
            String packageId = asString(row.get("package_id"));
            String positionId = asString(row.get("position_id"));
            String positionName = hasText(asString(row.get("position_name"))) ? asString(row.get("position_name")) : positionId;
            if (!hasText(packageId) || !hasText(positionId)) {
                continue;
            }
            positionIdsByPackage.computeIfAbsent(packageId, ignored -> new ArrayList<>()).add(positionId);
            positionNamesByPackage.computeIfAbsent(packageId, ignored -> new ArrayList<>()).add(positionName);
        }

        for (Map<String, Object> item : packages) {
            String packageId = asString(item.get("id"));
            List<String> positionIds = new ArrayList<>(positionIdsByPackage.getOrDefault(packageId, List.of()));
            List<String> positionNames = new ArrayList<>(positionNamesByPackage.getOrDefault(packageId, List.of()));
            if (positionIds.isEmpty() && hasText(asString(item.get("positionId")))) {
                positionIds.add(asString(item.get("positionId")));
            }
            item.put("positionIds", positionIds);
            item.put("positionNames", positionNames);
            item.put("positionId", positionIds.isEmpty() ? null : positionIds.get(0));
            item.put("positionName", positionNames.isEmpty() ? null : String.join("、", positionNames));
        }
        return packages;
    }

    private Set<String> resolveUserPositionIds(String userId) {
        List<String> rows = jdbc.queryForList(
            "SELECT DISTINCT position_id FROM (" +
                "SELECT primary_position_id AS position_id FROM sys_user WHERE id = ? AND primary_position_id IS NOT NULL " +
                "UNION ALL " +
                "SELECT position_id FROM user_position WHERE user_id = ?" +
            ") positions WHERE position_id IS NOT NULL",
            String.class,
            userId,
            userId
        );
        return new LinkedHashSet<>(rows);
    }

    private String normalizeStatus(String status) {
        String text = requireText(status, "status 不能为空").trim().toUpperCase(Locale.ROOT);
        if (!TEMPLATE_STATUS.contains(text)) {
            throw new ResponseStatusException(BAD_REQUEST, "status 仅支持 ACTIVE 或 DISABLED");
        }
        return text;
    }

    private String normalizeTemplateCode(String code) {
        String normalized = requireText(code, "模板编码不能为空").trim().toUpperCase(Locale.ROOT);
        if (normalized.length() > 64) {
            throw new ResponseStatusException(BAD_REQUEST, "模板编码长度不能超过 64");
        }
        return normalized;
    }

    private String generateCopiedTemplateCode(String baseCode, int version) {
        String normalizedBase = normalizeTemplateCode(baseCode);
        for (int index = 1; index < 1000; index += 1) {
            String candidate = normalizedBase + "_COPY" + (index == 1 ? "" : "_" + index);
            StringBuilder sql = new StringBuilder("SELECT COUNT(*) FROM mo_workflow_recommendation_packages WHERE code = ? AND version = ?");
            Integer count = jdbc.queryForObject(sql.toString(), Integer.class, candidate, version);
            if (count == null || count == 0) {
                return candidate;
            }
        }
        throw new ResponseStatusException(BAD_REQUEST, "无法为复制模板生成唯一编码");
    }

    private String normalizeApplicableSubjectType(String value) {
        String normalized = blankToNull(value);
        return normalized == null ? null : normalized.toUpperCase(Locale.ROOT);
    }

    private String normalizeNodeId(String value) {
        String normalized = blankToNull(value);
        return hasText(normalized) ? normalized : UUID.randomUUID().toString();
    }

    private String normalizeNodeCode(String value) {
        String normalized = requireText(value, "节点编码不能为空").trim().toUpperCase(Locale.ROOT);
        if (normalized.length() > 64) {
            throw new ResponseStatusException(BAD_REQUEST, "节点编码长度不能超过 64");
        }
        return normalized;
    }

    private String normalizeNodeType(String value) {
        String normalized = requireText(value, "节点类型不能为空").trim().toUpperCase(Locale.ROOT);
        if (normalized.length() > 64) {
            throw new ResponseStatusException(BAD_REQUEST, "节点类型长度不能超过 64");
        }
        return normalized;
    }

    private String normalizeFieldKey(String value) {
        String normalized = requireText(value, "fieldKey 不能为空").trim();
        if (!FIELD_KEY_PATTERN.matcher(normalized).matches()) {
            throw new ResponseStatusException(BAD_REQUEST, "fieldKey 仅支持小写字母、数字与下划线，且必须字母开头");
        }
        return normalized;
    }

    private String normalizeFieldType(String value) {
        String normalized = requireText(value, "fieldType 不能为空").trim().toLowerCase(Locale.ROOT);
        if (!FIELD_TYPES.contains(normalized)) {
            throw new ResponseStatusException(BAD_REQUEST, "fieldType 不支持: " + normalized);
        }
        return normalized;
    }

    private int normalizeVersion(Integer value) {
        int version = value == null ? 1 : value;
        if (version <= 0) {
            throw new ResponseStatusException(BAD_REQUEST, "version 必须大于 0");
        }
        return version;
    }

    private int normalizeSortOrder(Integer value) {
        int sortOrder = value == null ? 100 : value;
        if (sortOrder < 0) {
            throw new ResponseStatusException(BAD_REQUEST, "排序值不能小于 0");
        }
        return sortOrder;
    }

    private int normalizePositiveInt(Integer value, String message) {
        int normalized = value == null ? 1 : value;
        if (normalized <= 0) {
            throw new ResponseStatusException(BAD_REQUEST, message);
        }
        return normalized;
    }

    private String requireText(Object value, String message) {
        String text = asString(value);
        if (text == null || text.isBlank()) {
            throw new ResponseStatusException(BAD_REQUEST, message);
        }
        return text.trim();
    }

    private String blankToNull(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private boolean hasText(String value) {
        return value != null && !value.isBlank();
    }

    private boolean defaultTrue(Boolean value) {
        return value == null || Boolean.TRUE.equals(value);
    }

    private boolean defaultFalse(Boolean value) {
        return value != null && value;
    }

    private boolean asBoolean(Object value, boolean fallback) {
        if (value == null) {
            return fallback;
        }
        if (value instanceof Boolean bool) {
            return bool;
        }
        return Boolean.parseBoolean(String.valueOf(value));
    }

    private void appendPlaceholders(StringBuilder sql, int count) {
        for (int i = 0; i < count; i += 1) {
            if (i > 0) {
                sql.append(", ");
            }
            sql.append("?");
        }
    }

    private String asString(Object value) {
        return value == null ? null : String.valueOf(value);
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

    private List<String> asStringList(Object value) {
        List<String> result = new ArrayList<>();
        if (value instanceof List<?> list) {
            for (Object item : list) {
                String text = blankToNull(asString(item));
                if (hasText(text)) {
                    result.add(text);
                }
            }
        }
        return result;
    }

    @SuppressWarnings("unchecked")
    private List<Map<String, Object>> asMapList(Object value) {
        if (!(value instanceof List<?> list)) {
            return List.of();
        }
        List<Map<String, Object>> result = new ArrayList<>();
        for (Object item : list) {
            if (item instanceof Map<?, ?> map) {
                Map<String, Object> converted = new LinkedHashMap<>();
                map.forEach((key, itemValue) -> converted.put(String.valueOf(key), itemValue));
                result.add(converted);
            }
        }
        return result;
    }

    private <T> List<T> defaultList(List<T> value) {
        return value == null ? List.of() : value;
    }

    private record ValidatedTemplateNode(
        String id,
        String packageId,
        String name,
        String code,
        String nodeType,
        int sequence,
        boolean isMainPath,
        boolean allowAppendNextNode,
        boolean allowDeriveSubflow,
        List<ValidatedNodeFieldConfig> inputFields,
        List<ValidatedNodeFieldConfig> outputFields,
        List<ValidatedNodeRecommendation> recommendedTemplates,
        int version
    ) {
    }

    private record ValidatedNodeFieldConfig(
        String fieldKey,
        String displayName,
        int displayOrder,
        boolean required,
        boolean readOnly,
        boolean allowWriteBackParent
    ) {
    }

    private record ValidatedNodeRecommendation(
        String recommendedWorkflowTemplateId,
        String reason,
        int displayOrder,
        boolean enabled
    ) {
    }
}
