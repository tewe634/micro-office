package com.microoffice.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.microoffice.dto.request.WorkflowFromTemplateRequest;
import com.microoffice.dto.request.WorkflowTemplateNodeSaveRequest;
import com.microoffice.dto.request.WorkflowTemplatePackageSaveRequest;
import com.microoffice.dto.response.WorkflowInstantiationResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.EmptyResultDataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
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
public class WorkflowTemplateService {
    private static final TypeReference<LinkedHashMap<String, Object>> MAP_TYPE = new TypeReference<>() {};
    private static final TypeReference<List<WorkflowTemplateNodeSaveRequest>> NODE_REQUEST_LIST_TYPE = new TypeReference<>() {};
    private static final Set<String> PACKAGE_STATUS = Set.of("ACTIVE", "DISABLED");
    private static final Set<String> RELATION_TYPES = Set.of("SEQUENCE", "PARALLEL");
    private static final Set<String> SUBJECT_TYPES = Set.of("CUSTOMER_COMPANY", "DAILY_CATEGORY");
    private static final Set<String> NODE_PAYLOAD_ALLOWED_KEYS = Set.of("nodes");
    private static final Set<String> PACKAGE_FIELDS_IN_NODE_PAYLOAD = Set.of(
        "name", "status", "sceneCategory", "scene_category", "sortOrder", "sort_order", "description", "tags", "meta", "version"
    );

    private final JdbcTemplate jdbc;
    private final ObjectMapper objectMapper;

    public List<Map<String, Object>> listPackages(String sceneCategory, String status) {
        List<Object> args = new ArrayList<>();
        StringBuilder sql = new StringBuilder(
            "SELECT id, name, scene_category, description, status, sort_order, tags, meta, created_at, created_by, updated_at, updated_by, version " +
                "FROM mo_workflow_recommendation_packages WHERE 1=1"
        );
        if (hasText(sceneCategory)) {
            sql.append(" AND scene_category = ?");
            args.add(sceneCategory.trim());
        }
        if (hasText(status)) {
            String normalized = normalizeStatus(status);
            sql.append(" AND status = ?");
            args.add(normalized);
        }
        sql.append(" ORDER BY sort_order, updated_at DESC, created_at DESC");

        List<Map<String, Object>> rows = jdbc.queryForList(sql.toString(), args.toArray());
        List<Map<String, Object>> result = new ArrayList<>();
        for (Map<String, Object> row : rows) {
            result.add(toPackageMap(row));
        }
        return result;
    }

    public Map<String, Object> getPackage(String id) {
        return loadPackageOrThrow(id);
    }

    @Transactional
    public Map<String, Object> createPackage(WorkflowTemplatePackageSaveRequest request, String userId) {
        String id = UUID.randomUUID().toString();
        jdbc.update(
            "INSERT INTO mo_workflow_recommendation_packages (id, name, scene_category, description, status, sort_order, tags, meta, created_by, updated_by) " +
                "VALUES (?, ?, ?, ?, 'DISABLED', ?, CAST(? AS jsonb), CAST(? AS jsonb), ?, ?)",
            id,
            requireText(request.getName(), "模板名称不能为空"),
            requireText(request.getSceneCategory(), "场景分类不能为空"),
            blankToNull(request.getDescription()),
            normalizeSortOrder(request.getSortOrder()),
            toJson(normalizeTags(request.getTags())),
            toJson(asMap(request.getMeta())),
            userId,
            userId
        );
        return loadPackageOrThrow(id);
    }

    @Transactional
    public Map<String, Object> updatePackageInfo(String id, WorkflowTemplatePackageSaveRequest request, String userId) {
        loadPackageOrThrow(id);
        jdbc.update(
            "UPDATE mo_workflow_recommendation_packages SET name = ?, scene_category = ?, description = ?, sort_order = ?, tags = CAST(? AS jsonb), meta = CAST(? AS jsonb), updated_at = NOW(), updated_by = ? WHERE id = ?",
            requireText(request.getName(), "模板名称不能为空"),
            requireText(request.getSceneCategory(), "场景分类不能为空"),
            blankToNull(request.getDescription()),
            normalizeSortOrder(request.getSortOrder()),
            toJson(normalizeTags(request.getTags())),
            toJson(asMap(request.getMeta())),
            userId,
            id
        );
        return loadPackageOrThrow(id);
    }

    @Transactional
    public Map<String, Object> updatePackageStatus(String id, String status, String userId) {
        String normalized = normalizeStatus(status);
        int updated = jdbc.update(
            "UPDATE mo_workflow_recommendation_packages SET status = ?, updated_at = NOW(), updated_by = ? WHERE id = ?",
            normalized,
            userId,
            id
        );
        if (updated == 0) {
            throw new ResponseStatusException(NOT_FOUND, "模板包不存在");
        }
        return loadPackageOrThrow(id);
    }

    @Transactional
    public Map<String, Object> copyPackage(String id, String userId) {
        Map<String, Object> source = loadPackageOrThrow(id);
        String copiedId = UUID.randomUUID().toString();
        String copiedName = asString(source.get("name")) + "（复制）";

        jdbc.update(
            "INSERT INTO mo_workflow_recommendation_packages (id, name, scene_category, description, status, sort_order, tags, meta, created_by, updated_by) " +
                "VALUES (?, ?, ?, ?, ?, ?, CAST(? AS jsonb), CAST(? AS jsonb), ?, ?)",
            copiedId,
            copiedName,
            asString(source.get("sceneCategory")),
            asString(source.get("description")),
            asString(source.get("status")),
            asInt(source.get("sortOrder"), 100),
            toJson(source.get("tags")),
            toJson(source.get("meta")),
            userId,
            userId
        );

        List<Map<String, Object>> nodes = listPackageNodes(id);
        Map<String, String> idMap = new LinkedHashMap<>();
        for (Map<String, Object> node : nodes) {
            idMap.put(asString(node.get("id")), UUID.randomUUID().toString());
        }
        for (Map<String, Object> node : nodes) {
            String oldId = asString(node.get("id"));
            String oldParent = asString(node.get("parentPackageNodeId"));
            jdbc.update(
                "INSERT INTO mo_workflow_recommendation_package_nodes (id, package_id, module_definition_id, parent_package_node_id, sort_order, display_name, hierarchy_level, relation_type, branch_group_key, branch_order, meta, created_by, updated_by) " +
                    "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CAST(? AS jsonb), ?, ?)",
                idMap.get(oldId),
                copiedId,
                asString(node.get("moduleDefinitionId")),
                hasText(oldParent) ? idMap.get(oldParent) : null,
                asInt(node.get("sortOrder"), 0),
                asString(node.get("displayName")),
                asInt(node.get("hierarchyLevel"), 0),
                asString(node.get("relationType")),
                asString(node.get("branchGroupKey")),
                node.get("branchOrder"),
                toJson(node.get("meta")),
                userId,
                userId
            );
        }
        return loadPackageOrThrow(copiedId);
    }

    public List<Map<String, Object>> listPackageNodes(String packageId) {
        ensurePackageExists(packageId);
        List<Map<String, Object>> rows = jdbc.queryForList(
            "SELECT n.id, n.package_id, n.module_definition_id, n.parent_package_node_id, n.sort_order, n.display_name, n.hierarchy_level, n.relation_type, n.branch_group_key, n.branch_order, n.meta, " +
                "m.code AS module_code, m.name AS module_name, m.node_type AS module_node_type, m.source_system AS module_source_system " +
                "FROM mo_workflow_recommendation_package_nodes n " +
                "JOIN mo_module_definitions m ON m.id = n.module_definition_id " +
                "WHERE n.package_id = ? " +
                "ORDER BY n.hierarchy_level, n.sort_order, n.id",
            packageId
        );
        List<Map<String, Object>> result = new ArrayList<>();
        for (Map<String, Object> row : rows) {
            result.add(toPackageNodeMap(row));
        }
        return result;
    }

    @Transactional
    public List<Map<String, Object>> saveNodes(String packageId, Map<String, Object> requestBody, String userId) {
        validateNodeSavePayload(requestBody);
        ensurePackageExists(packageId);
        List<WorkflowTemplateNodeSaveRequest> requestNodes = objectMapper.convertValue(requestBody.get("nodes"), NODE_REQUEST_LIST_TYPE);
        List<ValidatedTemplateNode> nodes = validateTemplateNodes(packageId, requestNodes);

        jdbc.update("DELETE FROM mo_workflow_recommendation_package_nodes WHERE package_id = ?", packageId);
        for (ValidatedTemplateNode node : nodes.stream().sorted(Comparator
            .comparingInt(ValidatedTemplateNode::hierarchyLevel)
            .thenComparingInt(ValidatedTemplateNode::sortOrder)
            .thenComparing(ValidatedTemplateNode::id)).toList()) {
            jdbc.update(
                "INSERT INTO mo_workflow_recommendation_package_nodes (id, package_id, module_definition_id, parent_package_node_id, sort_order, display_name, hierarchy_level, relation_type, branch_group_key, branch_order, meta, created_by, updated_by) " +
                    "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CAST(? AS jsonb), ?, ?)",
                node.id(),
                packageId,
                node.moduleDefinitionId(),
                node.parentPackageNodeId(),
                node.sortOrder(),
                node.displayName(),
                node.hierarchyLevel(),
                node.relationType(),
                node.branchGroupKey(),
                node.branchOrder(),
                toJson(node.meta()),
                userId,
                userId
            );
        }
        return listPackageNodes(packageId);
    }

    public List<Map<String, Object>> listModuleDefinitions(String nodeType, String roleKey, String positionKey) {
        StringBuilder sql = new StringBuilder(
            "SELECT id, source_module_id, code, name, source_system, node_type, is_active, version, role_key, position_key, created_at, updated_at " +
                "FROM mo_module_definitions WHERE is_active = TRUE"
        );
        List<Object> args = new ArrayList<>();
        if (hasText(nodeType)) {
            sql.append(" AND node_type = CAST(? AS mo_node_type)");
            args.add(nodeType.trim().toUpperCase(Locale.ROOT));
        }
        if (hasText(roleKey)) {
            sql.append(" AND role_key = ?");
            args.add(roleKey.trim().toUpperCase(Locale.ROOT));
        }
        if (hasText(positionKey)) {
            sql.append(" AND position_key = ?");
            args.add(positionKey.trim());
        }
        sql.append(" ORDER BY node_type, code, version DESC");

        List<Map<String, Object>> rows = jdbc.queryForList(sql.toString(), args.toArray());
        List<Map<String, Object>> result = new ArrayList<>();
        for (Map<String, Object> row : rows) {
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("id", asString(row.get("id")));
            item.put("sourceModuleId", asString(row.get("source_module_id")));
            item.put("code", asString(row.get("code")));
            item.put("name", asString(row.get("name")));
            item.put("sourceSystem", asString(row.get("source_system")));
            item.put("nodeType", asString(row.get("node_type")));
            item.put("isActive", Boolean.TRUE.equals(row.get("is_active")));
            item.put("version", asInt(row.get("version"), 1));
            item.put("roleKey", asString(row.get("role_key")));
            item.put("positionKey", asString(row.get("position_key")));
            item.put("createdAt", row.get("created_at"));
            item.put("updatedAt", row.get("updated_at"));
            result.add(item);
        }
        return result;
    }

    public List<Map<String, Object>> listModuleFields(String moduleDefinitionId) {
        ensureModuleDefinitionExists(moduleDefinitionId);
        List<Map<String, Object>> rows = jdbc.queryForList(
            "SELECT id, module_definition_id, field_key, label, data_type, required, field_scope, sort_order, schema_meta, created_at, updated_at " +
                "FROM mo_module_fields WHERE module_definition_id = ? ORDER BY field_scope, sort_order, field_key",
            moduleDefinitionId
        );
        List<Map<String, Object>> result = new ArrayList<>();
        for (Map<String, Object> row : rows) {
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("id", asString(row.get("id")));
            item.put("moduleDefinitionId", asString(row.get("module_definition_id")));
            item.put("fieldKey", asString(row.get("field_key")));
            item.put("label", asString(row.get("label")));
            item.put("dataType", asString(row.get("data_type")));
            item.put("required", Boolean.TRUE.equals(row.get("required")));
            item.put("fieldScope", asString(row.get("field_scope")));
            item.put("sortOrder", asInt(row.get("sort_order"), 100));
            item.put("schemaMeta", asMap(row.get("schema_meta")));
            item.put("createdAt", row.get("created_at"));
            item.put("updatedAt", row.get("updated_at"));
            result.add(item);
        }
        return result;
    }

    public List<Map<String, Object>> listRecommendations(String sceneCategory, String currentModuleDefinitionId, String currentNodeType) {
        List<Object> args = new ArrayList<>();
        StringBuilder sql = new StringBuilder(
            "SELECT r.id, r.scene_category, r.current_module_definition_id, r.current_node_type, r.recommended_module_definition_id, r.sort_order, r.rule_note, r.tags, " +
                "m.code AS recommended_code, m.name AS recommended_name, m.node_type AS recommended_node_type, m.source_system AS recommended_source_system " +
                "FROM mo_workflow_node_recommendation_rules r " +
                "JOIN mo_module_definitions m ON m.id = r.recommended_module_definition_id " +
                "WHERE r.is_active = TRUE AND m.is_active = TRUE"
        );
        if (hasText(sceneCategory)) {
            sql.append(" AND (r.scene_category = ? OR r.scene_category IS NULL)");
            args.add(sceneCategory.trim());
        }
        if (hasText(currentModuleDefinitionId)) {
            sql.append(" AND r.current_module_definition_id = ?");
            args.add(currentModuleDefinitionId.trim());
        } else if (hasText(currentNodeType)) {
            sql.append(" AND r.current_module_definition_id IS NULL AND r.current_node_type = CAST(? AS mo_node_type)");
            args.add(currentNodeType.trim().toUpperCase(Locale.ROOT));
        }
        sql.append(" ORDER BY r.sort_order, r.id");

        List<Map<String, Object>> rows = jdbc.queryForList(sql.toString(), args.toArray());
        List<Map<String, Object>> result = new ArrayList<>();
        for (Map<String, Object> row : rows) {
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("id", asString(row.get("id")));
            item.put("sceneCategory", asString(row.get("scene_category")));
            item.put("currentModuleDefinitionId", asString(row.get("current_module_definition_id")));
            item.put("currentNodeType", asString(row.get("current_node_type")));
            item.put("recommendedModuleDefinitionId", asString(row.get("recommended_module_definition_id")));
            item.put("recommendedCode", asString(row.get("recommended_code")));
            item.put("recommendedName", asString(row.get("recommended_name")));
            item.put("recommendedNodeType", asString(row.get("recommended_node_type")));
            item.put("recommendedSourceSystem", asString(row.get("recommended_source_system")));
            item.put("sortOrder", asInt(row.get("sort_order"), 100));
            item.put("ruleNote", asString(row.get("rule_note")));
            item.put("tags", asList(row.get("tags")));
            result.add(item);
        }
        return result;
    }

    @Transactional
    public WorkflowInstantiationResponse instantiateWorkflow(WorkflowFromTemplateRequest request, String userId) {
        String packageId = requireText(request.getTemplatePackageId(), "templatePackageId 不能为空");
        Map<String, Object> pkg = loadPackageOrThrow(packageId);
        if (!"ACTIVE".equals(asString(pkg.get("status")))) {
            throw new ResponseStatusException(BAD_REQUEST, "仅 ACTIVE 模板可实例化");
        }

        List<Map<String, Object>> packageNodes = listPackageNodes(packageId);
        if (packageNodes.isEmpty()) {
            throw new ResponseStatusException(BAD_REQUEST, "模板节点为空，无法实例化");
        }
        List<ValidatedTemplateNode> validatedNodes = validateTemplateNodes(
            packageId,
            packageNodes.stream().map(this::toNodeRequest).toList()
        );

        String subjectType = normalizeSubjectType(request.getBizContext().get("objectType"));
        String subjectId = requireText(request.getBizContext().get("objectId"), "bizContext.objectId 不能为空");
        if (!SUBJECT_TYPES.contains(subjectType)) {
            throw new ResponseStatusException(BAD_REQUEST, "bizContext.objectType 不支持，当前仅支持 CUSTOMER_COMPANY 或 DAILY_CATEGORY");
        }

        String workflowId = UUID.randomUUID().toString();
        Map<String, Object> workflowMeta = new LinkedHashMap<>();
        workflowMeta.put("templatePackageId", packageId);
        workflowMeta.put("templatePackageName", asString(pkg.get("name")));
        workflowMeta.put("sceneCategory", asString(pkg.get("sceneCategory")));
        workflowMeta.put("bizContext", request.getBizContext() == null ? Map.of() : request.getBizContext());

        jdbc.update(
            "INSERT INTO mo_workflows (id, name, status, layout_meta, meta, created_by, updated_by, subject_type, subject_id, customer_id) " +
                "VALUES (?, ?, 'PENDING'::mo_workflow_status, '{}'::jsonb, CAST(? AS jsonb), ?, ?, ?, ?, ?)",
            workflowId,
            asString(pkg.get("name")) + "实例",
            toJson(workflowMeta),
            userId,
            userId,
            subjectType,
            subjectId,
            "CUSTOMER_COMPANY".equals(subjectType) ? subjectId : null
        );

        Map<String, Map<String, Object>> moduleDefinitions = loadModuleDefinitionMapForNodes(validatedNodes);
        Map<String, FieldSnapshot> fieldSnapshots = loadFieldSnapshots(moduleDefinitions.keySet());

        Map<String, String> runtimeNodeIdByTemplate = new LinkedHashMap<>();
        int sequence = 0;
        for (ValidatedTemplateNode node : validatedNodes.stream().sorted(templateNodeComparator()).toList()) {
            String runtimeNodeId = UUID.randomUUID().toString();
            runtimeNodeIdByTemplate.put(node.id(), runtimeNodeId);
            Map<String, Object> module = moduleDefinitions.get(node.moduleDefinitionId());
            FieldSnapshot fieldSnapshot = fieldSnapshots.getOrDefault(node.moduleDefinitionId(), FieldSnapshot.empty());
            String status = sequence == 0 ? "IN_PROGRESS" : "NOT_STARTED";
            Map<String, Object> nodeMeta = new LinkedHashMap<>(node.meta());
            nodeMeta.put("templatePackageId", packageId);
            nodeMeta.put("templateNodeId", node.id());
            nodeMeta.put("templateRelationType", node.relationType());

            jdbc.update(
                "INSERT INTO mo_workflow_nodes (id, workflow_id, parent_node_id, name, code, type, status, module_source_system, module_definition_id, module_code, module_name_snapshot, input_schema_snapshot, output_schema_snapshot, sequence, meta, created_by, updated_by, parallel_group_key, parallel_order) " +
                    "VALUES (?, ?, ?, ?, ?, CAST(? AS mo_node_type), CAST(? AS mo_node_status), ?, ?, ?, ?, CAST(? AS jsonb), CAST(? AS jsonb), ?, CAST(? AS jsonb), ?, ?, ?, ?)",
                runtimeNodeId,
                workflowId,
                hasText(node.parentPackageNodeId()) ? runtimeNodeIdByTemplate.get(node.parentPackageNodeId()) : null,
                node.displayName(),
                buildRuntimeNodeCode(module, sequence),
                asString(module.get("node_type")),
                status,
                asString(module.get("source_system")),
                node.moduleDefinitionId(),
                asString(module.get("code")),
                asString(module.get("name")),
                toJson(fieldSnapshot.input()),
                toJson(fieldSnapshot.output()),
                sequence,
                toJson(nodeMeta),
                userId,
                userId,
                node.branchGroupKey(),
                node.branchOrder()
            );
            sequence += 1;
        }

        List<RuntimeEdgeSeed> edgeSeeds = buildRuntimeEdgeSeeds(validatedNodes);
        Set<String> dedup = new LinkedHashSet<>();
        int edgeCount = 0;
        for (RuntimeEdgeSeed seed : edgeSeeds) {
            String fromNodeId = runtimeNodeIdByTemplate.get(seed.fromTemplateNodeId());
            String toNodeId = runtimeNodeIdByTemplate.get(seed.toTemplateNodeId());
            if (!hasText(fromNodeId) || !hasText(toNodeId) || Objects.equals(fromNodeId, toNodeId)) {
                continue;
            }
            String dedupKey = fromNodeId + "->" + toNodeId;
            if (!dedup.add(dedupKey)) {
                continue;
            }
            jdbc.update(
                "INSERT INTO mo_workflow_edges (id, workflow_id, from_node_id, to_node_id, type, status, path_kind, path_points, created_by, updated_by) " +
                    "VALUES (?, ?, ?, ?, 'SEQUENCE'::mo_edge_type, 'NOT_STARTED'::mo_node_status, 'POLYLINE', '[]'::jsonb, ?, ?)",
                UUID.randomUUID().toString(),
                workflowId,
                fromNodeId,
                toNodeId,
                userId,
                userId
            );
            edgeCount += 1;
        }

        String startTemplateNodeId = validatedNodes.stream()
            .filter(node -> !hasText(node.parentPackageNodeId()))
            .sorted(templateNodeComparator())
            .map(ValidatedTemplateNode::id)
            .findFirst()
            .orElse(validatedNodes.get(0).id());
        String startNodeId = runtimeNodeIdByTemplate.get(startTemplateNodeId);
        String endNodeId = resolveEndNodeId(validatedNodes, runtimeNodeIdByTemplate, edgeSeeds);

        jdbc.update(
            "UPDATE mo_workflows SET status = 'ACTIVE'::mo_workflow_status, start_node_id = ?, current_node_id = ?, end_node_id = ?, updated_at = NOW(), updated_by = ? WHERE id = ?",
            startNodeId,
            startNodeId,
            endNodeId,
            userId,
            workflowId
        );
        jdbc.update(
            "INSERT INTO mo_workflow_members (id, workflow_id, user_id, source, joined_by, created_by, updated_by) VALUES (?, ?, ?, 'CREATOR', ?, ?, ?)",
            UUID.randomUUID().toString(),
            workflowId,
            userId,
            userId,
            userId,
            userId
        );

        return new WorkflowInstantiationResponse(workflowId, startNodeId, endNodeId, validatedNodes.size(), edgeCount);
    }

    private String resolveEndNodeId(List<ValidatedTemplateNode> nodes,
                                    Map<String, String> runtimeNodeIdByTemplate,
                                    List<RuntimeEdgeSeed> edgeSeeds) {
        Set<String> from = new LinkedHashSet<>();
        for (RuntimeEdgeSeed edge : edgeSeeds) {
            from.add(edge.fromTemplateNodeId());
        }
        return nodes.stream()
            .filter(node -> !from.contains(node.id()))
            .sorted(templateNodeComparator())
            .map(ValidatedTemplateNode::id)
            .reduce((first, second) -> second)
            .map(runtimeNodeIdByTemplate::get)
            .orElseGet(() -> runtimeNodeIdByTemplate.get(nodes.get(nodes.size() - 1).id()));
    }

    private List<RuntimeEdgeSeed> buildRuntimeEdgeSeeds(List<ValidatedTemplateNode> nodes) {
        List<RuntimeEdgeSeed> result = new ArrayList<>();
        Map<String, List<ValidatedTemplateNode>> byParent = new LinkedHashMap<>();
        for (ValidatedTemplateNode node : nodes) {
            byParent.computeIfAbsent(blankToNull(node.parentPackageNodeId()), key -> new ArrayList<>()).add(node);
        }

        for (Map.Entry<String, List<ValidatedTemplateNode>> entry : byParent.entrySet()) {
            String parent = entry.getKey();
            List<ValidatedTemplateNode> children = entry.getValue().stream().sorted(templateNodeComparator()).toList();
            if (children.isEmpty()) {
                continue;
            }
            if (!hasText(parent)) {
                for (int i = 1; i < children.size(); i++) {
                    result.add(new RuntimeEdgeSeed(children.get(i - 1).id(), children.get(i).id()));
                }
                continue;
            }

            List<ValidatedTemplateNode> sequenceChildren = children.stream()
                .filter(node -> "SEQUENCE".equals(node.relationType()))
                .toList();
            if (!sequenceChildren.isEmpty()) {
                result.add(new RuntimeEdgeSeed(parent, sequenceChildren.get(0).id()));
                for (int i = 1; i < sequenceChildren.size(); i++) {
                    result.add(new RuntimeEdgeSeed(sequenceChildren.get(i - 1).id(), sequenceChildren.get(i).id()));
                }
            }

            for (ValidatedTemplateNode parallelChild : children) {
                if ("PARALLEL".equals(parallelChild.relationType())) {
                    result.add(new RuntimeEdgeSeed(parent, parallelChild.id()));
                }
            }
        }
        return result;
    }

    private Comparator<ValidatedTemplateNode> templateNodeComparator() {
        return Comparator.comparingInt(ValidatedTemplateNode::hierarchyLevel)
            .thenComparingInt(ValidatedTemplateNode::sortOrder)
            .thenComparing(ValidatedTemplateNode::id);
    }

    private String buildRuntimeNodeCode(Map<String, Object> module, int sequence) {
        String code = asString(module.get("code"));
        if (!hasText(code)) {
            code = "NODE";
        }
        return code + "_" + String.format("%03d", sequence + 1);
    }

    private Map<String, Map<String, Object>> loadModuleDefinitionMapForNodes(Collection<ValidatedTemplateNode> nodes) {
        LinkedHashSet<String> moduleIds = new LinkedHashSet<>();
        for (ValidatedTemplateNode node : nodes) {
            moduleIds.add(node.moduleDefinitionId());
        }
        return loadModuleDefinitionMap(moduleIds);
    }

    private Map<String, Map<String, Object>> loadModuleDefinitionMap(Collection<String> moduleIds) {
        if (moduleIds.isEmpty()) {
            return Map.of();
        }
        LinkedHashSet<String> uniqueModuleIds = new LinkedHashSet<>();
        for (String moduleId : moduleIds) {
            if (hasText(moduleId)) {
                uniqueModuleIds.add(moduleId.trim());
            }
        }
        if (uniqueModuleIds.isEmpty()) {
            return Map.of();
        }
        List<Map<String, Object>> rows = jdbc.queryForList(
            "SELECT id, code, name, source_system, node_type, is_active FROM mo_module_definitions WHERE id = ANY(?::text[])",
            (Object) uniqueModuleIds.toArray(new String[0])
        );
        Map<String, Map<String, Object>> result = new LinkedHashMap<>();
        for (Map<String, Object> row : rows) {
            result.put(asString(row.get("id")), row);
        }
        if (result.size() != uniqueModuleIds.size()) {
            throw new ResponseStatusException(BAD_REQUEST, "存在无效的 moduleDefinitionId");
        }
        return result;
    }

    private Map<String, FieldSnapshot> loadFieldSnapshots(Collection<String> moduleIds) {
        if (moduleIds.isEmpty()) {
            return Map.of();
        }
        List<Map<String, Object>> rows = jdbc.queryForList(
            "SELECT module_definition_id, field_key, label, data_type, required, field_scope, sort_order, schema_meta " +
                "FROM mo_module_fields WHERE module_definition_id = ANY(?::text[]) ORDER BY module_definition_id, field_scope, sort_order, field_key",
            (Object) moduleIds.toArray(new String[0])
        );
        Map<String, List<Map<String, Object>>> input = new LinkedHashMap<>();
        Map<String, List<Map<String, Object>>> output = new LinkedHashMap<>();
        for (Map<String, Object> row : rows) {
            String moduleId = asString(row.get("module_definition_id"));
            Map<String, Object> field = new LinkedHashMap<>();
            field.put("fieldKey", asString(row.get("field_key")));
            field.put("label", asString(row.get("label")));
            field.put("dataType", asString(row.get("data_type")));
            field.put("required", Boolean.TRUE.equals(row.get("required")));
            field.put("sortOrder", asInt(row.get("sort_order"), 100));
            field.put("schemaMeta", asMap(row.get("schema_meta")));
            if ("INPUT".equals(asString(row.get("field_scope")))) {
                input.computeIfAbsent(moduleId, key -> new ArrayList<>()).add(field);
            } else {
                output.computeIfAbsent(moduleId, key -> new ArrayList<>()).add(field);
            }
        }
        Map<String, FieldSnapshot> result = new LinkedHashMap<>();
        for (String moduleId : moduleIds) {
            result.put(moduleId, new FieldSnapshot(
                input.getOrDefault(moduleId, List.of()),
                output.getOrDefault(moduleId, List.of())
            ));
        }
        return result;
    }

    private List<ValidatedTemplateNode> validateTemplateNodes(String packageId, List<WorkflowTemplateNodeSaveRequest> requestNodes) {
        if (requestNodes == null || requestNodes.isEmpty()) {
            throw new ResponseStatusException(BAD_REQUEST, "节点列表不能为空");
        }
        Map<String, Map<String, Object>> moduleDefinitions = loadModuleDefinitionMap(
            requestNodes.stream().map(WorkflowTemplateNodeSaveRequest::getModuleDefinitionId).filter(Objects::nonNull).toList()
        );

        LinkedHashMap<String, ValidatedTemplateNode> nodes = new LinkedHashMap<>();
        for (WorkflowTemplateNodeSaveRequest node : requestNodes) {
            String id = normalizeNodeId(node.getId());
            if (nodes.containsKey(id)) {
                throw new ResponseStatusException(BAD_REQUEST, "节点 ID 重复: " + id);
            }
            String moduleId = requireText(node.getModuleDefinitionId(), "moduleDefinitionId 不能为空");
            if (!moduleDefinitions.containsKey(moduleId)) {
                throw new ResponseStatusException(BAD_REQUEST, "节点绑定的模块不存在: " + moduleId);
            }
            Map<String, Object> module = moduleDefinitions.get(moduleId);
            if (!Boolean.TRUE.equals(module.get("is_active"))) {
                String moduleName = asString(module.get("name"));
                throw new ResponseStatusException(
                    BAD_REQUEST,
                    "节点功能已停用，无法绑定到模板节点: " + (hasText(moduleName) ? moduleName : moduleId)
                );
            }

            String relationType = normalizeRelationType(node.getRelationType());
            String branchGroupKey = blankToNull(node.getBranchGroupKey());
            Integer branchOrder = node.getBranchOrder();
            if ("PARALLEL".equals(relationType)) {
                if (!hasText(branchGroupKey) || branchOrder == null) {
                    throw new ResponseStatusException(BAD_REQUEST, "PARALLEL 节点必须提供 branchGroupKey 与 branchOrder");
                }
            } else {
                if (hasText(branchGroupKey) || branchOrder != null) {
                    throw new ResponseStatusException(BAD_REQUEST, "SEQUENCE 节点不能包含 branchGroupKey 或 branchOrder");
                }
                branchGroupKey = null;
                branchOrder = null;
            }
            if (branchOrder != null && branchOrder < 0) {
                throw new ResponseStatusException(BAD_REQUEST, "branchOrder 不能小于 0");
            }
            int sortOrder = normalizeSortOrder(node.getSortOrder());

            String parentId = blankToNull(node.getParentPackageNodeId());
            nodes.put(id, new ValidatedTemplateNode(
                id,
                packageId,
                moduleId,
                parentId,
                sortOrder,
                requireText(node.getDisplayName(), "displayName 不能为空"),
                Math.max(node.getHierarchyLevel() == null ? 0 : node.getHierarchyLevel(), 0),
                relationType,
                branchGroupKey,
                branchOrder,
                asMap(node.getMeta())
            ));
        }

        for (ValidatedTemplateNode node : nodes.values()) {
            if (hasText(node.parentPackageNodeId()) && !nodes.containsKey(node.parentPackageNodeId())) {
                throw new ResponseStatusException(BAD_REQUEST, "parentPackageNodeId 不存在于同一模板包: " + node.parentPackageNodeId());
            }
        }

        Map<String, Integer> recalculatedLevels = recalculateHierarchy(nodes.values());
        List<ValidatedTemplateNode> normalized = new ArrayList<>();
        for (ValidatedTemplateNode node : nodes.values()) {
            normalized.add(node.withHierarchyLevel(recalculatedLevels.getOrDefault(node.id(), 0)));
        }
        return normalized;
    }

    private Map<String, Integer> recalculateHierarchy(Collection<ValidatedTemplateNode> nodes) {
        Map<String, ValidatedTemplateNode> nodeById = new LinkedHashMap<>();
        Map<String, List<String>> children = new LinkedHashMap<>();
        ArrayDeque<String> queue = new ArrayDeque<>();
        for (ValidatedTemplateNode node : nodes) {
            nodeById.put(node.id(), node);
            children.computeIfAbsent(blankToNull(node.parentPackageNodeId()), key -> new ArrayList<>()).add(node.id());
            if (!hasText(node.parentPackageNodeId())) {
                queue.add(node.id());
            }
        }
        if (queue.isEmpty()) {
            throw new ResponseStatusException(BAD_REQUEST, "模板节点结构非法：至少需要一个根节点");
        }

        Map<String, Integer> levels = new LinkedHashMap<>();
        while (!queue.isEmpty()) {
            String nodeId = queue.removeFirst();
            ValidatedTemplateNode node = nodeById.get(nodeId);
            int level = hasText(node.parentPackageNodeId()) ? levels.getOrDefault(node.parentPackageNodeId(), 0) + 1 : 0;
            levels.put(nodeId, level);
            for (String child : children.getOrDefault(nodeId, List.of())) {
                if (levels.containsKey(child)) {
                    throw new ResponseStatusException(BAD_REQUEST, "模板节点结构非法：存在循环父子关系");
                }
                queue.add(child);
            }
        }
        if (levels.size() != nodes.size()) {
            throw new ResponseStatusException(BAD_REQUEST, "模板节点结构非法：存在不可达节点");
        }
        return levels;
    }

    private WorkflowTemplateNodeSaveRequest toNodeRequest(Map<String, Object> row) {
        WorkflowTemplateNodeSaveRequest request = new WorkflowTemplateNodeSaveRequest();
        request.setId(asString(row.get("id")));
        request.setModuleDefinitionId(asString(row.get("moduleDefinitionId")));
        request.setParentPackageNodeId(asString(row.get("parentPackageNodeId")));
        request.setSortOrder(asInt(row.get("sortOrder"), 0));
        request.setDisplayName(asString(row.get("displayName")));
        request.setHierarchyLevel(asInt(row.get("hierarchyLevel"), 0));
        request.setRelationType(asString(row.get("relationType")));
        request.setBranchGroupKey(asString(row.get("branchGroupKey")));
        request.setBranchOrder(row.get("branchOrder") == null ? null : asInt(row.get("branchOrder"), 0));
        request.setMeta(asMap(row.get("meta")));
        return request;
    }

    private String normalizeNodeId(String value) {
        String text = blankToNull(value);
        return hasText(text) ? text : UUID.randomUUID().toString();
    }

    private String normalizeSubjectType(Object value) {
        String text = requireText(value, "bizContext.objectType 不能为空").trim().toUpperCase(Locale.ROOT);
        return "CUSTOMER".equals(text) ? "CUSTOMER_COMPANY" : text;
    }

    private String normalizeRelationType(String relationType) {
        String text = hasText(relationType) ? relationType.trim().toUpperCase(Locale.ROOT) : "SEQUENCE";
        if (!RELATION_TYPES.contains(text)) {
            throw new ResponseStatusException(BAD_REQUEST, "relationType 仅支持 SEQUENCE 或 PARALLEL");
        }
        return text;
    }

    private String normalizeStatus(String status) {
        String text = requireText(status, "status 不能为空").trim().toUpperCase(Locale.ROOT);
        if (!PACKAGE_STATUS.contains(text)) {
            throw new ResponseStatusException(BAD_REQUEST, "status 仅支持 ACTIVE 或 DISABLED");
        }
        return text;
    }

    private int normalizeSortOrder(Integer sortOrder) {
        int value = sortOrder == null ? 100 : sortOrder;
        if (value < 0) {
            throw new ResponseStatusException(BAD_REQUEST, "sortOrder 不能小于 0");
        }
        return value;
    }

    private Map<String, Object> toPackageMap(Map<String, Object> row) {
        Map<String, Object> item = new LinkedHashMap<>();
        item.put("id", asString(row.get("id")));
        item.put("name", asString(row.get("name")));
        item.put("sceneCategory", asString(row.get("scene_category")));
        item.put("description", asString(row.get("description")));
        item.put("status", asString(row.get("status")));
        item.put("sortOrder", asInt(row.get("sort_order"), 100));
        item.put("tags", asList(row.get("tags")));
        item.put("meta", asMap(row.get("meta")));
        item.put("createdAt", row.get("created_at"));
        item.put("createdBy", asString(row.get("created_by")));
        item.put("updatedAt", row.get("updated_at"));
        item.put("updatedBy", asString(row.get("updated_by")));
        item.put("version", asInt(row.get("version"), 1));
        return item;
    }

    private void validateNodeSavePayload(Map<String, Object> requestBody) {
        if (requestBody == null) {
            throw new ResponseStatusException(BAD_REQUEST, "节点保存请求体必须为 { nodes: [...] }");
        }
        if (!requestBody.containsKey("nodes")) {
            throw new ResponseStatusException(BAD_REQUEST, "节点保存请求体必须包含 nodes 字段");
        }
        for (String key : requestBody.keySet()) {
            if (!NODE_PAYLOAD_ALLOWED_KEYS.contains(key)) {
                if (PACKAGE_FIELDS_IN_NODE_PAYLOAD.contains(key)) {
                    throw new ResponseStatusException(BAD_REQUEST, "节点保存接口仅允许 nodes 字段，禁止传入 package 字段: " + key);
                }
                throw new ResponseStatusException(BAD_REQUEST, "节点保存接口仅允许 nodes 字段，检测到非法字段: " + key);
            }
        }
        if (!(requestBody.get("nodes") instanceof List<?>)) {
            throw new ResponseStatusException(BAD_REQUEST, "nodes 必须为数组");
        }
    }

    private Map<String, Object> toPackageNodeMap(Map<String, Object> row) {
        Map<String, Object> item = new LinkedHashMap<>();
        item.put("id", asString(row.get("id")));
        item.put("packageId", asString(row.get("package_id")));
        item.put("moduleDefinitionId", asString(row.get("module_definition_id")));
        item.put("parentPackageNodeId", asString(row.get("parent_package_node_id")));
        item.put("sortOrder", asInt(row.get("sort_order"), 0));
        item.put("displayName", asString(row.get("display_name")));
        item.put("hierarchyLevel", asInt(row.get("hierarchy_level"), 0));
        item.put("relationType", asString(row.get("relation_type")));
        item.put("branchGroupKey", asString(row.get("branch_group_key")));
        item.put("branchOrder", row.get("branch_order"));
        item.put("meta", asMap(row.get("meta")));
        item.put("moduleCode", asString(row.get("module_code")));
        item.put("moduleName", asString(row.get("module_name")));
        item.put("moduleNodeType", asString(row.get("module_node_type")));
        item.put("moduleSourceSystem", asString(row.get("module_source_system")));
        return item;
    }

    private Map<String, Object> loadPackageOrThrow(String id) {
        try {
            Map<String, Object> row = jdbc.queryForMap(
                "SELECT id, name, scene_category, description, status, sort_order, tags, meta, created_at, created_by, updated_at, updated_by, version " +
                    "FROM mo_workflow_recommendation_packages WHERE id = ?",
                id
            );
            return toPackageMap(row);
        } catch (EmptyResultDataAccessException ex) {
            throw new ResponseStatusException(NOT_FOUND, "模板包不存在");
        }
    }

    private void ensurePackageExists(String packageId) {
        Integer count = jdbc.queryForObject(
            "SELECT COUNT(*) FROM mo_workflow_recommendation_packages WHERE id = ?",
            Integer.class,
            packageId
        );
        if (count == null || count == 0) {
            throw new ResponseStatusException(NOT_FOUND, "模板包不存在");
        }
    }

    private void ensureModuleDefinitionExists(String moduleDefinitionId) {
        Integer count = jdbc.queryForObject(
            "SELECT COUNT(*) FROM mo_module_definitions WHERE id = ?",
            Integer.class,
            moduleDefinitionId
        );
        if (count == null || count == 0) {
            throw new ResponseStatusException(NOT_FOUND, "模块定义不存在");
        }
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

    private List<Object> asList(Object value) {
        if (value == null) {
            return List.of();
        }
        if (value instanceof List<?> list) {
            return new ArrayList<>(list);
        }
        if (value instanceof Map<?, ?> map) {
            if (map.isEmpty()) {
                return List.of();
            }
            return new ArrayList<>(List.of(new LinkedHashMap<>(map)));
        }
        if (value instanceof String text) {
            if (text.isBlank()) {
                return List.of();
            }
            try {
                Object parsed = objectMapper.readValue(text, Object.class);
                return asList(parsed);
            } catch (Exception ex) {
                return new ArrayList<>(List.of(text));
            }
        }
        Object parsed = tryParseJsonLikeText(value);
        if (parsed != null) {
            return asList(parsed);
        }
        try {
            return objectMapper.convertValue(value, new TypeReference<List<Object>>() {});
        } catch (IllegalArgumentException ex) {
            return new ArrayList<>(List.of(value));
        }
    }

    private List<Object> normalizeTags(Object value) {
        return asList(value);
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

    private String toJson(Object value) {
        try {
            return objectMapper.writeValueAsString(value == null ? Map.of() : value);
        } catch (Exception ex) {
            throw new ResponseStatusException(BAD_REQUEST, "JSON 序列化失败");
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

    private record ValidatedTemplateNode(
        String id,
        String packageId,
        String moduleDefinitionId,
        String parentPackageNodeId,
        int sortOrder,
        String displayName,
        int hierarchyLevel,
        String relationType,
        String branchGroupKey,
        Integer branchOrder,
        Map<String, Object> meta
    ) {
        private ValidatedTemplateNode withHierarchyLevel(int newLevel) {
            return new ValidatedTemplateNode(
                id,
                packageId,
                moduleDefinitionId,
                parentPackageNodeId,
                sortOrder,
                displayName,
                newLevel,
                relationType,
                branchGroupKey,
                branchOrder,
                meta
            );
        }
    }

    private record RuntimeEdgeSeed(String fromTemplateNodeId, String toTemplateNodeId) {}

    private record FieldSnapshot(List<Map<String, Object>> input, List<Map<String, Object>> output) {
        private static FieldSnapshot empty() {
            return new FieldSnapshot(List.of(), List.of());
        }
    }
}
