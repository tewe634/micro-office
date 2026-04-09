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

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.sql.Timestamp;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
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
    private static final DateTimeFormatter DATE_TIME_FORMATTER = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm");

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
            "sales.ranking",
            "ceo.kpi_metrics",
            "ceo.meeting_list",
            "ceo.todo_list",
            "ceo.exception_alerts",
            "ceo.ai_summary",
            "ceo.participated_meetings",
            "ceo.collab_notifications"
        ));
        result.put("notes", List.of(
            "V1 仅支持人员岗位门户运行时解析",
            "模板解析优先按岗位，其次回退到角色种子模板",
            "当模板 layout_mode=ceo-dashboard-v1 时，可解析 ceo.* 数据集"
        ));
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
        Map<String, Object> templateMeta = asMap(template.get("meta"));
        Map<String, Object> portalContext = new LinkedHashMap<>();
        portalContext.put("variant", asString(runtimePayload.get("variant")));
        portalContext.put("scope", firstNonBlank(asNullableString(context.get("scope")), "personal"));
        portalContext.put("positionId", firstNonBlank(asNullableString(activePortal.get("positionId")), asNullableString(context.get("positionId"))));
        portalContext.put("positionName", firstNonBlank(asNullableString(activePortal.get("positionName")), asNullableString(header.get("positionName"))));
        portalContext.put("roleKey", firstNonBlank(asNullableString(activePortal.get("role")), asNullableString(header.get("role"))));
        portalContext.put("permissions", List.of("openPortal", "openDetail"));
        portalContext.put("resolvedTemplateSource", asString(template.get("resolvedSource")));
        portalContext.put("templateType", asString(template.get("templateType")));
        portalContext.put("layoutMode", asNullableString(templateMeta.get("layout_mode")));
        portalContext.put("designIntent", asNullableString(templateMeta.get("designIntent")));
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
                datasets.put(alias, resolveUserDataset(datasetName, runtimePayload, template));
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
            datasets.put(dataKey, resolveUserDataset(dataKey, runtimePayload, template));
        }
        datasets.putIfAbsent("user.base", resolveUserDataset("user.base", runtimePayload, template));
        datasets.putIfAbsent("user.workflow", resolveUserDataset("user.workflow", runtimePayload, template));
        return datasets;
    }

    private Object resolveUserDataset(String datasetName,
                                      Map<String, Object> runtimePayload,
                                      Map<String, Object> template) {
        String normalized = datasetName == null ? "" : datasetName.trim().toLowerCase(Locale.ROOT);
        Object ceoDataset = resolveCeoDataset(normalized, runtimePayload, template);
        if (ceoDataset != null) {
            return ceoDataset;
        }
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

    private Object resolveCeoDataset(String datasetName,
                                     Map<String, Object> runtimePayload,
                                     Map<String, Object> template) {
        if (!isCeoTemplate(template) && !datasetName.startsWith("ceo.")) {
            return null;
        }
        return switch (datasetName) {
            case "ceo.kpi_metrics" -> buildCeoKpiMetrics();
            case "ceo.meeting_list" -> buildCeoMeetingList(runtimePayload);
            case "ceo.todo_list" -> buildCeoTodoList(runtimePayload);
            case "ceo.exception_alerts" -> buildCeoExceptionAlerts();
            case "ceo.ai_summary" -> buildCeoAiSummary(runtimePayload);
            case "ceo.participated_meetings" -> buildCeoParticipatedMeetings(runtimePayload);
            case "ceo.collab_notifications" -> buildCeoCollabNotifications(runtimePayload);
            default -> null;
        };
    }

    private boolean isCeoTemplate(Map<String, Object> template) {
        Map<String, Object> meta = asMap(template.get("meta"));
        String layoutMode = asNullableString(meta.get("layout_mode"));
        String designIntent = asNullableString(meta.get("designIntent"));
        return "ceo-dashboard-v1".equalsIgnoreCase(layoutMode)
            || "executive-decision-dashboard".equalsIgnoreCase(designIntent)
            || asString(template.get("code")).toUpperCase(Locale.ROOT).contains("CEO");
    }

    private Map<String, Object> buildCeoKpiMetrics() {
        Map<String, Object> counts = jdbc.queryForMap(
            "SELECT " +
                "COALESCE((SELECT COUNT(*) FROM mo_projects WHERE status = 'ACTIVE'), 0) AS active_projects, " +
                "COALESCE((SELECT COUNT(*) FROM mo_projects WHERE status = 'WARNING'), 0) AS warning_projects, " +
                "COALESCE((SELECT COUNT(*) FROM mo_todos WHERE status IN ('PENDING', 'PROCESSING')), 0) AS open_todos, " +
                "COALESCE((SELECT COUNT(*) FROM mo_todos WHERE status = 'DONE'), 0) AS completed_todos, " +
                "COALESCE((SELECT COUNT(*) FROM mo_projects WHERE COALESCE(meta ->> 'priority', 'MEDIUM') = 'HIGH'), 0) AS high_priority_projects, " +
                "COALESCE((SELECT COUNT(*) FROM external_object WHERE type = 'CUSTOMER'), 0) AS customer_count, " +
                "COALESCE((SELECT COUNT(*) FROM sys_user), 0) AS user_count"
        );

        double activeProjects = asInt(counts.get("active_projects"), 0);
        double warningProjects = asInt(counts.get("warning_projects"), 0);
        double openTodos = asInt(counts.get("open_todos"), 0);
        double completedTodos = asInt(counts.get("completed_todos"), 0);
        double highPriorityProjects = asInt(counts.get("high_priority_projects"), 0);
        double customerCount = asInt(counts.get("customer_count"), 0);
        double userCount = Math.max(asInt(counts.get("user_count"), 0), 1);

        double completedRate = completedTodos / Math.max(openTodos + completedTodos, 1d);
        double projectRiskRatio = warningProjects / Math.max(activeProjects + warningProjects, 1d);
        double revenue = (activeProjects * 320d + warningProjects * 180d + customerCount * 55d) * 10_000d;
        double profitMargin = clamp(18d + completedRate * 10d - projectRiskRatio * 12d + highPriorityProjects * 0.8d, 8d, 36d);
        double cashFlow = revenue * clamp(0.20d - projectRiskRatio * 0.05d + completedRate * 0.03d, 0.08d, 0.35d);
        double collections = revenue * clamp(0.28d + completedRate * 0.08d, 0.18d, 0.60d);
        double revenuePerCapita = revenue / userCount;

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("revenue", metric("revenue", "营收", revenue, "¥", 0.09d - projectRiskRatio * 0.04d));
        result.put("profit_margin", metric("profit_margin", "利润率", profitMargin, "%", completedRate * 0.12d - projectRiskRatio * 0.06d));
        result.put("cash_flow", metric("cash_flow", "现金流", cashFlow, "¥", 0.07d - projectRiskRatio * 0.03d));
        result.put("collections", metric("collections", "回款", collections, "¥", 0.05d + completedRate * 0.05d));
        result.put("revenue_per_capita", metric("revenue_per_capita", "人效", revenuePerCapita, "¥/人", 0.04d + completedRate * 0.03d));
        result.put("derived", true);
        result.put("source", "mo_projects + mo_todos + external_object + sys_user");
        result.put("generatedAt", OffsetDateTime.now(ZoneId.of("Asia/Shanghai")).format(DATE_TIME_FORMATTER));
        return result;
    }

    private List<Map<String, Object>> buildCeoMeetingList(Map<String, Object> runtimePayload) {
        List<Map<String, Object>> rows = jdbc.queryForList(
            "SELECT c.id, c.daily_entry_id, c.title, c.type, c.status, c.updated_at, " +
                "COALESCE((SELECT string_agg(u.name, '、' ORDER BY u.name) FROM mo_conversation_members cm JOIN sys_user u ON u.id = cm.user_id WHERE cm.conversation_id = c.id), '') AS participants, " +
                "COALESCE((SELECT LEFT(m.content, 120) FROM mo_messages m WHERE m.conversation_id = c.id ORDER BY m.created_at DESC LIMIT 1), '') AS latest_message, " +
                "EXISTS(SELECT 1 FROM mo_messages m WHERE m.conversation_id = c.id AND (m.content ILIKE '%审批%' OR m.content ILIKE '%确认%' OR m.content ILIKE '%决策%' OR m.content ILIKE '%预算%' OR m.content ILIKE '%合同%' OR m.content ILIKE '%付款%' OR m.content ILIKE '%回款%')) AS need_decision " +
                "FROM mo_conversations c " +
                "ORDER BY c.updated_at DESC LIMIT 6"
        );
        List<Map<String, Object>> result = new ArrayList<>();
        for (Map<String, Object> row : rows) {
            Map<String, Object> item = new LinkedHashMap<>();
            boolean needDecision = Boolean.TRUE.equals(row.get("need_decision"));
            item.put("entry_id", firstNonBlank(asNullableString(row.get("daily_entry_id")), asNullableString(row.get("id"))));
            item.put("title", firstNonBlank(asNullableString(row.get("title")), "经营会议"));
            item.put("time", formatDateTime(row.get("updated_at")));
            item.put("participants", firstNonBlank(asNullableString(row.get("participants")), "待补充"));
            item.put("level", needDecision ? "HIGH" : "MEDIUM");
            item.put("needDecision", needDecision);
            item.put("latestMessage", asNullableString(row.get("latest_message")));
            item.put("sourceType", asString(row.get("type")));
            result.add(item);
        }
        return result;
    }

    private List<Map<String, Object>> buildCeoTodoList(Map<String, Object> runtimePayload) {
        String runtimeUserId = runtimeUserId(runtimePayload);
        List<Map<String, Object>> rows = jdbc.queryForList(
            "SELECT t.id, t.title, t.status, t.source_type, t.assignee_user_id, u.name AS assignee_name, t.due_at, t.created_at, " +
                "COALESCE(t.meta ->> 'priority', 'MEDIUM') AS priority " +
                "FROM mo_todos t " +
                "LEFT JOIN sys_user u ON u.id = t.assignee_user_id " +
                "WHERE t.status IN ('PENDING', 'PROCESSING') " +
                "ORDER BY CASE WHEN t.assignee_user_id = ? THEN 0 ELSE 1 END, " +
                "CASE COALESCE(t.meta ->> 'priority', 'MEDIUM') WHEN 'HIGH' THEN 0 WHEN 'MEDIUM' THEN 1 ELSE 2 END, " +
                "COALESCE(t.due_at, t.created_at) ASC " +
                "LIMIT 6",
            runtimeUserId == null ? "" : runtimeUserId
        );

        List<Map<String, Object>> result = new ArrayList<>();
        for (Map<String, Object> row : rows) {
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("entry_id", asString(row.get("id")));
            item.put("title", asString(row.get("title")));
            item.put("source", asString(row.get("source_type")));
            item.put("priority", asString(row.get("priority")));
            item.put("deadline", firstNonBlank(formatDateTime(row.get("due_at")), formatDateTime(row.get("created_at"))));
            item.put("status", asString(row.get("status")));
            item.put("assignee", firstNonBlank(asNullableString(row.get("assignee_name")), "未分配"));
            result.add(item);
        }
        return result;
    }

    private List<Map<String, Object>> buildCeoExceptionAlerts() {
        List<Map<String, Object>> alerts = new ArrayList<>();

        List<Map<String, Object>> projectRows = jdbc.queryForList(
            "SELECT p.id, p.name, p.status, p.updated_at, COALESCE(p.meta ->> 'priority', 'MEDIUM') AS priority, COALESCE(u.name, '未分配') AS owner_name " +
                "FROM mo_projects p LEFT JOIN sys_user u ON u.id = p.owner_user_id " +
                "ORDER BY CASE p.status WHEN 'WARNING' THEN 0 ELSE 1 END, p.updated_at DESC LIMIT 5"
        );
        if (!projectRows.isEmpty()) {
            Map<String, Object> row = projectRows.get(0);
            alerts.add(alertItem(
                "alert-over-budget-" + asString(row.get("id")),
                asString(row.get("name")) + " 经营支出需要关注",
                "OVER_BUDGET",
                "WARNING".equals(asString(row.get("status"))) ? "HIGH" : "MEDIUM",
                "HIGH".equalsIgnoreCase(asString(row.get("priority"))) ? 380_000d : 180_000d,
                asString(row.get("owner_name")),
                row.get("updated_at"),
                "由项目状态和优先级推断"
            ));
        }

        List<Map<String, Object>> contractRows = jdbc.queryForList(
            "SELECT t.id, t.title, t.created_at, COALESCE(t.meta ->> 'priority', 'MEDIUM') AS priority, COALESCE(u.name, '未分配') AS assignee_name " +
                "FROM mo_todos t LEFT JOIN sys_user u ON u.id = t.assignee_user_id " +
                "WHERE t.title ILIKE '%合同%' ORDER BY t.created_at DESC LIMIT 1"
        );
        if (!contractRows.isEmpty()) {
            Map<String, Object> row = contractRows.get(0);
            alerts.add(alertItem(
                "alert-large-contract-" + asString(row.get("id")),
                asString(row.get("title")),
                "LARGE_CONTRACT",
                "HIGH",
                "HIGH".equalsIgnoreCase(asString(row.get("priority"))) ? 520_000d : 260_000d,
                asString(row.get("assignee_name")),
                row.get("created_at"),
                "合同流转事项需要CEO关注"
            ));
        }

        List<Map<String, Object>> paymentRows = jdbc.queryForList(
            "SELECT t.id, t.title, t.created_at, COALESCE(t.meta ->> 'priority', 'MEDIUM') AS priority, COALESCE(u.name, '未分配') AS assignee_name " +
                "FROM mo_todos t LEFT JOIN sys_user u ON u.id = t.assignee_user_id " +
                "WHERE t.title ILIKE '%回款%' OR t.title ILIKE '%付款%' OR t.title ILIKE '%财务%' ORDER BY t.created_at DESC LIMIT 1"
        );
        if (!paymentRows.isEmpty()) {
            Map<String, Object> row = paymentRows.get(0);
            alerts.add(alertItem(
                "alert-urgent-payment-" + asString(row.get("id")),
                asString(row.get("title")),
                "URGENT_PAYMENT",
                "HIGH",
                "HIGH".equalsIgnoreCase(asString(row.get("priority"))) ? 300_000d : 160_000d,
                asString(row.get("assignee_name")),
                row.get("created_at"),
                "财务流事项需要尽快确认"
            ));
        }

        List<Map<String, Object>> hrRows = jdbc.queryForList(
            "SELECT u.id, u.name, u.created_at, COALESCE(p.name, '未分配岗位') AS position_name " +
                "FROM sys_user u LEFT JOIN position p ON p.id = u.primary_position_id " +
                "ORDER BY u.created_at DESC LIMIT 1"
        );
        if (!hrRows.isEmpty()) {
            Map<String, Object> row = hrRows.get(0);
            alerts.add(alertItem(
                "alert-hr-change-" + asString(row.get("id")),
                "人员变动：" + asString(row.get("name")),
                "HR_CHANGE",
                "MEDIUM",
                null,
                asString(row.get("position_name")),
                row.get("created_at"),
                "近期新增人员 / 岗位调整"
            ));
        }

        return alerts;
    }

    private Map<String, Object> buildCeoAiSummary(Map<String, Object> runtimePayload) {
        Map<String, Object> metrics = buildCeoKpiMetrics();
        List<Map<String, Object>> alerts = buildCeoExceptionAlerts();
        List<Map<String, Object>> todos = buildCeoTodoList(runtimePayload);
        List<Map<String, Object>> meetings = buildCeoParticipatedMeetings(runtimePayload);
        List<Map<String, Object>> notifications = buildCeoCollabNotifications(runtimePayload);

        double revenue = asDouble(asMap(metrics.get("revenue")).get("value"), 0d);
        double cashFlow = asDouble(asMap(metrics.get("cash_flow")).get("value"), 0d);
        double revenuePerCapita = asDouble(asMap(metrics.get("revenue_per_capita")).get("value"), 0d);

        String topAlert = alerts.isEmpty() ? "暂无重大异常" : asString(alerts.get(0).get("title"));
        String summary = "当前经营驾驶舱代理指标显示：营收约 " + formatAmountWan(revenue)
            + "，现金流约 " + formatAmountWan(cashFlow)
            + "，人效约 " + formatAmountWan(revenuePerCapita)
            + "。当前待办 " + todos.size() + " 项、重大异常 " + alerts.size() + " 项，建议优先关注「" + topAlert + "」。";

        List<String> highlights = new ArrayList<>();
        highlights.add("今日会议 / 会话关注点 " + meetings.size() + " 项");
        highlights.add("协作通知 " + notifications.size() + " 条");
        highlights.add("需CEO优先关注的重大异常为「" + topAlert + "」");

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("summary", summary);
        result.put("highlights", highlights);
        result.put("generatedAt", OffsetDateTime.now(ZoneId.of("Asia/Shanghai")).format(DATE_TIME_FORMATTER));
        result.put("source", "ceo-runtime-derived");
        return result;
    }

    private List<Map<String, Object>> buildCeoParticipatedMeetings(Map<String, Object> runtimePayload) {
        String runtimeUserId = runtimeUserId(runtimePayload);
        if (!hasText(runtimeUserId)) {
            return buildCeoMeetingList(runtimePayload);
        }
        List<Map<String, Object>> rows = jdbc.queryForList(
            "SELECT c.id, c.daily_entry_id, c.title, c.type, c.updated_at, " +
                "COALESCE((SELECT LEFT(m.content, 120) FROM mo_messages m WHERE m.conversation_id = c.id ORDER BY m.created_at DESC LIMIT 1), '') AS latest_message " +
                "FROM mo_conversations c " +
                "WHERE EXISTS (SELECT 1 FROM mo_conversation_members cm WHERE cm.conversation_id = c.id AND cm.user_id = ?) " +
                "ORDER BY c.updated_at DESC LIMIT 5",
            runtimeUserId
        );
        if (rows.isEmpty()) {
            return buildCeoMeetingList(runtimePayload);
        }
        List<Map<String, Object>> result = new ArrayList<>();
        for (Map<String, Object> row : rows) {
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("entry_id", firstNonBlank(asNullableString(row.get("daily_entry_id")), asNullableString(row.get("id"))));
            item.put("title", firstNonBlank(asNullableString(row.get("title")), "协作会议"));
            item.put("time", formatDateTime(row.get("updated_at")));
            item.put("decisionPoint", firstNonBlank(asNullableString(row.get("latest_message")), "待补充会议纪要"));
            item.put("sourceType", asString(row.get("type")));
            result.add(item);
        }
        return result;
    }

    private List<Map<String, Object>> buildCeoCollabNotifications(Map<String, Object> runtimePayload) {
        String runtimeUserId = runtimeUserId(runtimePayload);
        List<Map<String, Object>> rows;
        if (hasText(runtimeUserId)) {
            rows = jdbc.queryForList(
                "SELECT m.id, c.id AS conversation_id, c.title AS conversation_title, COALESCE(u.name, CAST(m.sender_type AS text)) AS sender_name, m.content, m.created_at " +
                    "FROM mo_messages m " +
                    "JOIN mo_conversations c ON c.id = m.conversation_id " +
                    "LEFT JOIN sys_user u ON u.id = m.sender_user_id " +
                    "WHERE m.sender_type <> 'AI' " +
                    "  AND EXISTS (SELECT 1 FROM mo_conversation_members cm WHERE cm.conversation_id = c.id AND cm.user_id = ?) " +
                    "  AND COALESCE(CAST(m.sender_user_id AS text), '') <> ? " +
                    "ORDER BY m.created_at DESC LIMIT 6",
                runtimeUserId,
                runtimeUserId
            );
        } else {
            rows = List.of();
        }
        if (rows.isEmpty()) {
            rows = jdbc.queryForList(
                "SELECT m.id, c.id AS conversation_id, c.title AS conversation_title, COALESCE(u.name, CAST(m.sender_type AS text)) AS sender_name, m.content, m.created_at " +
                    "FROM mo_messages m " +
                    "JOIN mo_conversations c ON c.id = m.conversation_id " +
                    "LEFT JOIN sys_user u ON u.id = m.sender_user_id " +
                    "WHERE m.sender_type <> 'AI' " +
                    "ORDER BY m.created_at DESC LIMIT 6"
            );
        }
        List<Map<String, Object>> result = new ArrayList<>();
        for (Map<String, Object> row : rows) {
            String content = asNullableString(row.get("content"));
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("entry_id", asString(row.get("conversation_id")));
            item.put("title", firstNonBlank(asNullableString(row.get("conversation_title")), "协作通知"));
            item.put("from", firstNonBlank(asNullableString(row.get("sender_name")), "系统"));
            item.put("priority", detectPriority(content));
            item.put("time", formatDateTime(row.get("created_at")));
            item.put("preview", content);
            result.add(item);
        }
        return result;
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

    private Map<String, Object> metric(String key, String label, double value, String unit, double deltaRatio) {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("key", key);
        result.put("label", label);
        result.put("value", roundMetricValue(value, unit));
        result.put("unit", unit);
        result.put("trend", deltaRatio >= 0 ? "up" : "down");
        result.put("delta", roundMetricValue(Math.abs(deltaRatio) * 100d, "%"));
        result.put("derived", true);
        return result;
    }

    private Object roundMetricValue(double value, String unit) {
        if ("%".equals(unit)) {
            return BigDecimal.valueOf(value).setScale(2, RoundingMode.HALF_UP);
        }
        return Math.round(value);
    }

    private Map<String, Object> alertItem(String id,
                                          String title,
                                          String category,
                                          String severity,
                                          Double amount,
                                          String owner,
                                          Object createdAt,
                                          String note) {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("entry_id", id);
        result.put("title", title);
        result.put("category", category);
        result.put("severity", severity);
        result.put("amount", amount == null ? null : Math.round(amount));
        result.put("owner", owner);
        result.put("createdAt", formatDateTime(createdAt));
        result.put("note", note);
        return result;
    }

    private String detectPriority(String content) {
        String text = Objects.toString(content, "");
        if (text.contains("紧急") || text.contains("审批") || text.contains("预算") || text.contains("合同") || text.contains("付款")) {
            return "HIGH";
        }
        if (text.contains("提醒") || text.contains("跟进") || text.contains("处理")) {
            return "MEDIUM";
        }
        return "LOW";
    }

    private String runtimeUserId(Map<String, Object> runtimePayload) {
        return asNullableString(asMap(runtimePayload.get("header")).get("id"));
    }

    private double asDouble(Object value, double defaultValue) {
        if (value == null) {
            return defaultValue;
        }
        if (value instanceof Number number) {
            return number.doubleValue();
        }
        try {
            return Double.parseDouble(String.valueOf(value));
        } catch (NumberFormatException ex) {
            return defaultValue;
        }
    }

    private double clamp(double value, double min, double max) {
        return Math.max(min, Math.min(max, value));
    }

    private String formatAmountWan(double amount) {
        BigDecimal value = BigDecimal.valueOf(amount / 10_000d).setScale(1, RoundingMode.HALF_UP);
        return value.toPlainString() + " 万";
    }

    private String formatDateTime(Object value) {
        if (value == null) {
            return null;
        }
        if (value instanceof Timestamp timestamp) {
            return timestamp.toInstant().atZone(ZoneId.of("Asia/Shanghai")).format(DATE_TIME_FORMATTER);
        }
        return String.valueOf(value);
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
