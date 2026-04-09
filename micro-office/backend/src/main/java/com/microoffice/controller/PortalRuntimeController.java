package com.microoffice.controller;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.microoffice.dto.response.ApiResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.EmptyResultDataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;

@RestController
@RequestMapping("/api/portal-runtime")
@RequiredArgsConstructor
public class PortalRuntimeController {
    private static final TypeReference<LinkedHashMap<String, Object>> MAP_TYPE = new TypeReference<>() {};
    private static final TypeReference<List<Map<String, Object>>> LIST_OF_MAP_TYPE = new TypeReference<>() {};

    private final PortalController portalController;
    private final JdbcTemplate jdbc;
    private final ObjectMapper objectMapper;

    @PostMapping("/resolve")
    public ApiResponse<Map<String, Object>> resolve(@RequestBody Map<String, Object> body, Authentication auth) {
        String viewerId = (String) auth.getPrincipal();
        String entityType = normalizeEntityType(body.get("entityType"));
        if (!"user".equals(entityType)) {
            throw new IllegalArgumentException("当前仅支持人员岗位门户运行时解析");
        }

        String entityId = requireText(body.get("entityId"), "entityId 不能为空");
        Map<String, Object> context = asMap(body.get("context"));
        String requestedPositionId = asNullableString(context.get("positionId"));

        Map<String, Object> runtimePayload = portalController.resolveUserPortalRuntime(viewerId, entityId, requestedPositionId);
        Map<String, Object> template = resolveUserTemplate(body, context, runtimePayload);
        Map<String, Object> datasets = buildUserDatasets(runtimePayload, template, asListOfMap(body.get("contracts")));

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("templateId", asString(template.get("id")));
        response.put("templateCode", asString(template.get("code")));
        response.put("templateName", asString(template.get("name")));
        response.put("templateVersion", String.valueOf(template.get("version") == null ? 1 : template.get("version")));
        response.put("entityType", "user");
        response.put("entityId", entityId);
        response.put("portalContext", buildPortalContext(context, runtimePayload, template));
        response.put("template", template);
        response.put("datasets", datasets);
        response.put("errors", List.of());
        return ApiResponse.ok(response);
    }

    @GetMapping("/capabilities")
    public ApiResponse<Map<String, Object>> capabilities() {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("entityTypes", List.of("user"));
        result.put("templateTypes", List.of("PERSON_ROLE"));
        result.put("datasetAliases", List.of(
            "basic_info",
            "todo_list",
            "customer_list",
            "daily_list",
            "relation_graph",
            "aiwarn_list",
            "user.base",
            "user.workflow",
            "sales.summary",
            "sales.customers",
            "sales.products",
            "sales.ranking"
        ));
        result.put("notes", List.of("V1 仅支持人员岗位门户运行时解析", "模板解析优先按岗位，其次回退到角色种子模板"));
        return ApiResponse.ok(result);
    }

    private Map<String, Object> resolveUserTemplate(Map<String, Object> body,
                                                    Map<String, Object> context,
                                                    Map<String, Object> runtimePayload) {
        String templateId = asNullableString(body.get("templateId"));
        if (hasText(templateId)) {
            Map<String, Object> template = loadTemplateDetail(templateId);
            template.put("resolvedSource", "EXPLICIT_TEMPLATE_ID");
            return template;
        }

        Map<String, Object> activePortal = asMap(runtimePayload.get("activePortal"));
        Map<String, Object> header = asMap(runtimePayload.get("header"));
        String positionId = firstNonBlank(
            asNullableString(context.get("positionId")),
            asNullableString(activePortal.get("positionId")),
            asNullableString(asMap(header.get("activePosition")).get("positionId")),
            asNullableString(header.get("primaryPositionId"))
        );
        if (hasText(positionId)) {
            Map<String, Object> template = loadFirstTemplate(
                "SELECT id FROM mo_portal_templates WHERE template_type = 'PERSON_ROLE' AND status = 'ACTIVE' AND COALESCE(meta ->> 'positionId', '') = ? ORDER BY updated_at DESC, created_at DESC LIMIT 1",
                positionId
            );
            if (template != null) {
                template.put("resolvedSource", "POSITION");
                return template;
            }
        }

        String roleKey = firstNonBlank(
            asNullableString(activePortal.get("role")),
            asNullableString(header.get("role")),
            asNullableString(context.get("roleKey"))
        );
        if (hasText(roleKey)) {
            Map<String, Object> template = loadFirstTemplate(
                "SELECT id FROM mo_portal_templates WHERE template_type = 'PERSON_ROLE' AND status = 'ACTIVE' AND role_key = ? AND COALESCE(meta ->> 'positionId', '') = '' ORDER BY updated_at DESC, created_at DESC LIMIT 1",
                roleKey.toUpperCase(Locale.ROOT)
            );
            if (template != null) {
                template.put("resolvedSource", "ROLE_FALLBACK");
                return template;
            }
        }

        throw new IllegalArgumentException("未找到匹配的岗位门户模板，请先为该岗位生成模板");
    }

    private Map<String, Object> loadFirstTemplate(String sql, Object... args) {
        try {
            Map<String, Object> row = jdbc.queryForMap(sql, args);
            return loadTemplateDetail(asString(row.get("id")));
        } catch (EmptyResultDataAccessException ex) {
            return null;
        }
    }

    private Map<String, Object> buildPortalContext(Map<String, Object> context,
                                                   Map<String, Object> runtimePayload,
                                                   Map<String, Object> template) {
        Map<String, Object> header = asMap(runtimePayload.get("header"));
        Map<String, Object> activePortal = asMap(runtimePayload.get("activePortal"));
        Map<String, Object> portalContext = new LinkedHashMap<>();
        portalContext.put("variant", asString(runtimePayload.get("variant")));
        portalContext.put("scope", firstNonBlank(asNullableString(context.get("scope")), "personal"));
        portalContext.put("positionId", firstNonBlank(asNullableString(activePortal.get("positionId")), asNullableString(context.get("positionId"))));
        portalContext.put("positionName", firstNonBlank(asNullableString(activePortal.get("positionName")), asNullableString(header.get("positionName"))));
        portalContext.put("roleKey", firstNonBlank(asNullableString(activePortal.get("role")), asNullableString(header.get("role"))));
        portalContext.put("permissions", List.of("openPortal", "openDetail"));
        portalContext.put("resolvedTemplateSource", asString(template.get("resolvedSource")));
        portalContext.put("templateType", asString(template.get("templateType")));
        return portalContext;
    }

    private Map<String, Object> buildUserDatasets(Map<String, Object> runtimePayload,
                                                  Map<String, Object> template,
                                                  List<Map<String, Object>> contracts) {
        Map<String, Object> datasets = new LinkedHashMap<>();
        if (!contracts.isEmpty()) {
            for (Map<String, Object> contract : contracts) {
                String alias = firstNonBlank(asNullableString(contract.get("alias")), asNullableString(contract.get("dataset")));
                String datasetName = firstNonBlank(asNullableString(contract.get("dataset")), alias);
                if (!hasText(alias) || !hasText(datasetName)) {
                    continue;
                }
                datasets.put(alias, resolveUserDataset(datasetName, runtimePayload));
            }
            return datasets;
        }

        Set<String> dataKeys = new LinkedHashSet<>();
        for (Map<String, Object> section : asListOfMap(template.get("sections"))) {
            for (Map<String, Object> item : asListOfMap(section.get("items"))) {
                String dataKey = asNullableString(item.get("dataKey"));
                if (hasText(dataKey)) {
                    dataKeys.add(dataKey);
                }
            }
        }
        if (dataKeys.isEmpty()) {
            dataKeys.addAll(List.of("basic_info", "todo_list", "customer_list", "daily_list", "relation_graph", "aiwarn_list"));
        }
        for (String dataKey : dataKeys) {
            datasets.put(dataKey, resolveUserDataset(dataKey, runtimePayload));
        }
        datasets.putIfAbsent("user.base", resolveUserDataset("user.base", runtimePayload));
        datasets.putIfAbsent("user.workflow", resolveUserDataset("user.workflow", runtimePayload));
        return datasets;
    }

    private Object resolveUserDataset(String datasetName, Map<String, Object> runtimePayload) {
        String normalized = datasetName == null ? "" : datasetName.trim().toLowerCase(Locale.ROOT);
        return switch (normalized) {
            case "basic_info", "user.base" -> asMap(runtimePayload.get("header"));
            case "todo_list", "user.workflow" -> asListOfMap(runtimePayload.get("workItems"));
            case "customer_list", "sales.customers" -> {
                List<Map<String, Object>> customers = asListOfMap(runtimePayload.get("customerPerformance"));
                if (customers.isEmpty()) {
                    customers = asListOfMap(runtimePayload.get("relatedCustomers"));
                }
                yield customers;
            }
            case "daily_list" -> buildDailyEntries(runtimePayload);
            case "relation_graph" -> buildRelationGraph(runtimePayload);
            case "aiwarn_list" -> buildAiWarnings(runtimePayload);
            case "sales.summary" -> buildSummaryDataset(runtimePayload);
            case "sales.products" -> asListOfMap(runtimePayload.get("relatedProducts"));
            case "sales.ranking" -> asListOfMap(runtimePayload.get("salesRanking"));
            default -> null;
        };
    }

    private List<Map<String, Object>> buildDailyEntries(Map<String, Object> runtimePayload) {
        List<Map<String, Object>> source = asListOfMap(runtimePayload.get("salesActionCards"));
        if (source.isEmpty()) {
            source = asListOfMap(runtimePayload.get("summaryCards"));
        }
        List<Map<String, Object>> result = new ArrayList<>();
        int index = 0;
        for (Map<String, Object> item : source) {
            Map<String, Object> row = new LinkedHashMap<>();
            String entryId = firstNonBlank(asNullableString(item.get("id")), asNullableString(item.get("key")), "daily-entry-" + index);
            row.put("daily_entry_id", entryId);
            row.put("id", entryId);
            row.put("title", firstNonBlank(asNullableString(item.get("label")), asNullableString(item.get("title")), "快捷入口"));
            row.put("label", firstNonBlank(asNullableString(item.get("label")), asNullableString(item.get("title")), "快捷入口"));
            row.put("value", item.get("value"));
            row.put("suffix", item.get("suffix"));
            row.put("hint", firstNonBlank(asNullableString(item.get("description")), asNullableString(item.get("tone"))));
            result.add(row);
            index += 1;
        }
        return result;
    }

    private Map<String, Object> buildRelationGraph(Map<String, Object> runtimePayload) {
        Map<String, Object> header = asMap(runtimePayload.get("header"));
        List<Map<String, Object>> ranking = asListOfMap(runtimePayload.get("salesRanking"));
        List<Map<String, Object>> nodes = new ArrayList<>();
        List<Map<String, Object>> edges = new ArrayList<>();

        String selfId = asNullableString(header.get("id"));
        if (hasText(selfId)) {
            Map<String, Object> selfNode = new LinkedHashMap<>();
            selfNode.put("id", "person-" + selfId);
            selfNode.put("person_id", selfId);
            selfNode.put("name", asString(header.get("name")));
            selfNode.put("node_type", "PERSON");
            selfNode.put("role", asString(header.get("role")));
            selfNode.put("positionName", asString(header.get("positionName")));
            nodes.add(selfNode);
        }

        String orgName = asNullableString(header.get("orgName"));
        if (hasText(orgName)) {
            Map<String, Object> orgNode = new LinkedHashMap<>();
            orgNode.put("id", "org-" + orgName);
            orgNode.put("organization_id", "org-" + orgName);
            orgNode.put("name", orgName);
            orgNode.put("node_type", "ORGANIZATION");
            nodes.add(orgNode);

            if (hasText(selfId)) {
                Map<String, Object> edge = new LinkedHashMap<>();
                edge.put("from", "person-" + selfId);
                edge.put("to", "org-" + orgName);
                edge.put("label", "隶属");
                edges.add(edge);
            }
        }

        int index = 0;
        for (Map<String, Object> rankRow : ranking) {
            String personId = asNullableString(rankRow.get("userId"));
            if (!hasText(personId) || Objects.equals(personId, selfId)) {
                continue;
            }
            Map<String, Object> node = new LinkedHashMap<>();
            node.put("id", "person-" + personId);
            node.put("person_id", personId);
            node.put("name", firstNonBlank(asNullableString(rankRow.get("userName")), asNullableString(rankRow.get("name")), "协作人员" + (index + 1)));
            node.put("node_type", "PERSON");
            node.put("rank", rankRow.get("rank"));
            nodes.add(node);

            if (hasText(selfId)) {
                Map<String, Object> edge = new LinkedHashMap<>();
                edge.put("from", "person-" + selfId);
                edge.put("to", "person-" + personId);
                edge.put("label", "协作");
                edges.add(edge);
            }
            index += 1;
            if (index >= 5) {
                break;
            }
        }

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("nodes", nodes);
        result.put("edges", edges);
        return result;
    }

    private List<Map<String, Object>> buildAiWarnings(Map<String, Object> runtimePayload) {
        Map<String, Object> workSummary = asMap(runtimePayload.get("workSummary"));
        List<Map<String, Object>> ranking = asListOfMap(runtimePayload.get("salesRanking"));
        List<Map<String, Object>> customers = asListOfMap(runtimePayload.get("customerPerformance"));
        List<Map<String, Object>> result = new ArrayList<>();

        int todo = asInt(workSummary.get("todo"), 0);
        if (todo > 0) {
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("id", "warn-todo");
            item.put("level", todo >= 4 ? "HIGH" : "MEDIUM");
            item.put("title", "待办事项需要跟进");
            item.put("content", "当前仍有 " + todo + " 项待办，建议优先清理高优任务。");
            result.add(item);
        }

        if (!ranking.isEmpty()) {
            Map<String, Object> first = ranking.get(0);
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("id", "warn-ranking");
            item.put("level", "INFO");
            item.put("title", "销售排名参考");
            item.put("content", firstNonBlank(asNullableString(first.get("userName")), "当前可参考销售排行表现，便于安排协作节奏。"));
            result.add(item);
        }

        if (customers.size() < 3) {
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("id", "warn-customers");
            item.put("level", "MEDIUM");
            item.put("title", "客户覆盖偏少");
            item.put("content", "当前关联客户较少，可考虑补充重点客户跟进节奏。");
            result.add(item);
        }

        return result;
    }

    private Map<String, Object> buildSummaryDataset(Map<String, Object> runtimePayload) {
        List<Map<String, Object>> cards = asListOfMap(runtimePayload.get("summaryCards"));
        Map<String, Object> result = new LinkedHashMap<>();
        for (Map<String, Object> card : cards) {
            String key = firstNonBlank(asNullableString(card.get("key")), asNullableString(card.get("label")));
            if (!hasText(key)) {
                continue;
            }
            result.put(key, card);
        }
        return result;
    }

    private Map<String, Object> loadTemplateDetail(String id) {
        Map<String, Object> template;
        try {
            template = jdbc.queryForMap(
                "SELECT id, code, name, template_type, role_key, status, version, meta, created_at, updated_at FROM mo_portal_templates WHERE id = ?",
                id
            );
        } catch (EmptyResultDataAccessException ex) {
            throw new IllegalArgumentException("模板不存在");
        }

        List<Map<String, Object>> sectionRows = jdbc.queryForList(
            "SELECT id, template_id, code, name, section_type, sort_order, meta FROM mo_portal_template_sections WHERE template_id = ? ORDER BY sort_order, code, id",
            id
        );
        List<Map<String, Object>> itemRows = jdbc.queryForList(
            "SELECT id, template_id, section_id, item_key, label, data_key, display_type, sort_order, meta FROM mo_portal_template_items WHERE template_id = ? ORDER BY section_id, sort_order, item_key, id",
            id
        );
        List<Map<String, Object>> actionRows = jdbc.queryForList(
            "SELECT id, template_id, item_id, action_type, target_subject_type, target_id_path, session_type, meta FROM mo_portal_template_item_actions WHERE template_id = ? ORDER BY item_id, action_type, id",
            id
        );

        Map<String, List<Map<String, Object>>> actionsByItemId = new LinkedHashMap<>();
        for (Map<String, Object> row : actionRows) {
            String itemId = asString(row.get("item_id"));
            actionsByItemId.computeIfAbsent(itemId, key -> new ArrayList<>()).add(toActionMap(row));
        }

        Map<String, List<Map<String, Object>>> itemsBySectionId = new LinkedHashMap<>();
        for (Map<String, Object> row : itemRows) {
            String sectionId = asString(row.get("section_id"));
            Map<String, Object> item = toItemMap(row);
            item.put("actions", actionsByItemId.getOrDefault(asString(row.get("id")), List.of()));
            itemsBySectionId.computeIfAbsent(sectionId, key -> new ArrayList<>()).add(item);
        }

        List<Map<String, Object>> sections = new ArrayList<>();
        for (Map<String, Object> row : sectionRows) {
            Map<String, Object> section = toSectionMap(row);
            section.put("items", itemsBySectionId.getOrDefault(asString(row.get("id")), List.of()));
            sections.add(section);
        }

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("id", asString(template.get("id")));
        result.put("code", asString(template.get("code")));
        result.put("name", asString(template.get("name")));
        result.put("templateType", asString(template.get("template_type")));
        result.put("roleKey", asString(template.get("role_key")));
        result.put("status", asString(template.get("status")));
        result.put("version", asInt(template.get("version"), 1));
        result.put("meta", asMap(template.get("meta")));
        result.put("createdAt", template.get("created_at"));
        result.put("updatedAt", template.get("updated_at"));
        result.put("sections", sections);
        return result;
    }

    private Map<String, Object> toSectionMap(Map<String, Object> row) {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("id", asString(row.get("id")));
        result.put("templateId", asString(row.get("template_id")));
        result.put("code", asString(row.get("code")));
        result.put("name", asString(row.get("name")));
        result.put("sectionType", asString(row.get("section_type")));
        result.put("sortOrder", asInt(row.get("sort_order"), 0));
        result.put("meta", asMap(row.get("meta")));
        return result;
    }

    private Map<String, Object> toItemMap(Map<String, Object> row) {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("id", asString(row.get("id")));
        result.put("templateId", asString(row.get("template_id")));
        result.put("sectionId", asString(row.get("section_id")));
        result.put("itemKey", asString(row.get("item_key")));
        result.put("label", asString(row.get("label")));
        result.put("dataKey", asString(row.get("data_key")));
        result.put("displayType", asString(row.get("display_type")));
        result.put("sortOrder", asInt(row.get("sort_order"), 0));
        result.put("meta", asMap(row.get("meta")));
        return result;
    }

    private Map<String, Object> toActionMap(Map<String, Object> row) {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("id", asString(row.get("id")));
        result.put("templateId", asString(row.get("template_id")));
        result.put("itemId", asString(row.get("item_id")));
        result.put("actionType", asString(row.get("action_type")));
        result.put("targetSubjectType", asString(row.get("target_subject_type")));
        result.put("targetIdPath", asString(row.get("target_id_path")));
        result.put("sessionType", asString(row.get("session_type")));
        result.put("meta", asMap(row.get("meta")));
        return result;
    }

    private String normalizeEntityType(Object value) {
        String text = requireText(value, "entityType 不能为空").trim().toLowerCase(Locale.ROOT);
        if ("person".equals(text)) {
            return "user";
        }
        return text;
    }

    private String requireText(Object value, String message) {
        String text = asNullableString(value);
        if (!hasText(text)) {
            throw new IllegalArgumentException(message);
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
            throw new ResponseStatusException(org.springframework.http.HttpStatus.BAD_REQUEST, "JSON 内容格式不合法");
        }
    }

    private List<Map<String, Object>> asListOfMap(Object value) {
        if (value == null) {
            return List.of();
        }
        if (value instanceof List<?> list) {
            List<Map<String, Object>> result = new ArrayList<>();
            for (Object item : list) {
                result.add(asMap(item));
            }
            return result;
        }
        return objectMapper.convertValue(value, LIST_OF_MAP_TYPE);
    }
}
