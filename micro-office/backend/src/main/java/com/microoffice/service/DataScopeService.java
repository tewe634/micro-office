package com.microoffice.service;

import com.microoffice.entity.SysUser;
import com.microoffice.enums.PortalScope;
import com.microoffice.mapper.SysUserMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;

@Service
@RequiredArgsConstructor
public class DataScopeService {
    private static final List<String> LEADER_KEYWORDS = List.of(
        "负责人", "总经理", "总监", "经理", "主管", "主任", "部长", "厂长", "组长", "科长"
    );
    private static final String SALES_SYSTEM_NAME = "销售体系";

    private final JdbcTemplate jdbc;
    private final SysUserMapper userMapper;

    public boolean isGlobalAdmin(String userId) {
        SysUser user = userMapper.selectById(userId);
        if (user == null) {
            return false;
        }
        return "ADMIN".equals(user.getRole()) || "SYS_ADMIN".equals(user.getRole());
    }

    public List<String> getScopeOrgIds(String userId) {
        SysUser user = userMapper.selectById(userId);
        if (user == null || user.getOrgId() == null) {
            return List.of();
        }

        Integer isRoot = jdbc.queryForObject(
            "SELECT COUNT(*) FROM organization WHERE id = ? AND parent_id IS NULL",
            Integer.class,
            user.getOrgId()
        );

        if (isRoot != null && isRoot > 0) {
            return jdbc.queryForList(
                "SELECT id FROM organization WHERE id = ? OR parent_id = ? ORDER BY sort_order, id",
                String.class,
                user.getOrgId(),
                user.getOrgId()
            );
        }

        return jdbc.queryForList(
            "WITH RECURSIVE sub AS (" +
                "SELECT id FROM organization WHERE id = ? " +
                "UNION ALL " +
                "SELECT o.id FROM organization o JOIN sub s ON o.parent_id = s.id" +
            ") SELECT id FROM sub",
            String.class,
            user.getOrgId()
        );
    }

    public List<String> getVisibleOrgIds(String userId) {
        if (isGlobalAdmin(userId)) {
            return jdbc.queryForList("SELECT id FROM organization", String.class);
        }
        return new ArrayList<>(getScopeOrgIds(userId));
    }

    public SalesPortalScope resolveSalesPortalScope(String userId, String requestedScopeKey) {
        SysUser user = userMapper.selectById(userId);
        if (user == null) {
            return SalesPortalScope.empty();
        }

        PortalScope requestedScope = PortalScope.fromKey(requestedScopeKey);
        if (requestedScopeKey != null && !requestedScopeKey.isBlank() && requestedScope == null) {
            throw new IllegalArgumentException("不支持的 scope: " + requestedScopeKey);
        }

        Map<String, OrgNode> orgNodes = loadOrgNodes();
        String salesSystemOrgId = findOrgIdByName(orgNodes.values(), SALES_SYSTEM_NAME);
        String businessRootOrgId = findBusinessRootOrgId(user.getOrgId(), salesSystemOrgId, orgNodes);
        boolean salesHierarchyMember = isSameOrDescendant(user.getOrgId(), salesSystemOrgId, orgNodes);
        boolean globalAdmin = isGlobalAdmin(userId);
        boolean leaderCandidate = globalAdmin || isLeaderCandidate(userId);

        List<ScopeOption> options = new ArrayList<>();
        options.add(buildScopeOption(
            PortalScope.PERSONAL,
            user.getOrgId(),
            orgNodes,
            "仅本人负责或参与的销售数据"
        ));
        if (leaderCandidate && salesHierarchyMember && user.getOrgId() != null) {
            options.add(buildScopeOption(
                PortalScope.DEPARTMENT,
                user.getOrgId(),
                orgNodes,
                "当前部门及下级部门的销售数据"
            ));
        }
        if (leaderCandidate && businessRootOrgId != null && Objects.equals(user.getOrgId(), businessRootOrgId)) {
            options.add(buildScopeOption(
                PortalScope.BUSINESS,
                businessRootOrgId,
                orgNodes,
                "当前业务部范围内的销售数据"
            ));
        }
        if (salesSystemOrgId != null && ((leaderCandidate && Objects.equals(user.getOrgId(), salesSystemOrgId)) || globalAdmin)) {
            options.add(buildScopeOption(
                PortalScope.SYSTEM,
                salesSystemOrgId,
                orgNodes,
                "销售体系内全部销售数据"
            ));
        }

        List<ScopeOption> distinctOptions = deduplicateOptions(options);
        ScopeOption fallbackScope = distinctOptions.stream()
            .filter(option -> PortalScope.SYSTEM == option.scope())
            .findFirst()
            .or(() -> distinctOptions.stream().filter(option -> PortalScope.BUSINESS == option.scope()).findFirst())
            .or(() -> distinctOptions.stream().filter(option -> PortalScope.DEPARTMENT == option.scope()).findFirst())
            .or(() -> distinctOptions.stream().filter(option -> PortalScope.PERSONAL == option.scope()).findFirst())
            .orElse(buildScopeOption(PortalScope.PERSONAL, user.getOrgId(), orgNodes, "仅本人负责或参与的销售数据"));
        ScopeOption activeScope = distinctOptions.stream()
            .filter(option -> option.scope() == requestedScope)
            .findFirst()
            .orElse(fallbackScope);

        List<String> scopeOrgIds = switch (activeScope.scope()) {
            case PERSONAL -> user.getOrgId() == null ? List.of() : List.of(user.getOrgId());
            case DEPARTMENT -> collectSubtreeOrgIds(user.getOrgId(), orgNodes);
            case BUSINESS -> collectSubtreeOrgIds(businessRootOrgId, orgNodes);
            case SYSTEM -> collectSubtreeOrgIds(salesSystemOrgId, orgNodes);
        };
        List<String> scopeUserIds = activeScope.scope() == PortalScope.PERSONAL
            ? List.of(userId)
            : loadUserIdsByOrgIds(scopeOrgIds);

        return new SalesPortalScope(
            distinctOptions,
            activeScope,
            scopeOrgIds,
            scopeUserIds,
            user.getOrgId(),
            businessRootOrgId,
            salesSystemOrgId,
            salesHierarchyMember,
            leaderCandidate
        );
    }

    public boolean isLeaderCandidate(String userId) {
        List<Map<String, Object>> rows = jdbc.queryForList(
            "SELECT p.name, p.code, p.level " +
                "FROM position p " +
                "JOIN (" +
                "  SELECT primary_position_id AS position_id FROM sys_user WHERE id = ? AND primary_position_id IS NOT NULL " +
                "  UNION " +
                "  SELECT position_id FROM user_position WHERE user_id = ?" +
                ") positions ON positions.position_id = p.id",
            userId,
            userId
        );
        for (Map<String, Object> row : rows) {
            Integer level = row.get("level") instanceof Number number ? number.intValue() : null;
            if (level != null && level <= 3) {
                return true;
            }
            String combined = (valueOf(row.get("name")) + " " + valueOf(row.get("code"))).trim();
            for (String keyword : LEADER_KEYWORDS) {
                if (combined.contains(keyword)) {
                    return true;
                }
            }
        }
        return false;
    }

    private List<ScopeOption> deduplicateOptions(List<ScopeOption> options) {
        LinkedHashMap<PortalScope, ScopeOption> deduped = new LinkedHashMap<>();
        for (ScopeOption option : options) {
            deduped.putIfAbsent(option.scope(), option);
        }
        return new ArrayList<>(deduped.values());
    }

    private ScopeOption buildScopeOption(PortalScope scope, String orgId, Map<String, OrgNode> orgNodes, String description) {
        OrgNode node = orgId == null ? null : orgNodes.get(orgId);
        return new ScopeOption(
            scope,
            scope.getKey(),
            scope.getLabel(),
            orgId,
            node == null ? null : node.name(),
            description
        );
    }

    private Map<String, OrgNode> loadOrgNodes() {
        LinkedHashMap<String, OrgNode> nodes = new LinkedHashMap<>();
        List<OrgNode> rows = jdbc.query(
            "SELECT id, name, parent_id FROM organization ORDER BY sort_order, id",
            (rs, rowNum) -> new OrgNode(rs.getString("id"), rs.getString("name"), rs.getString("parent_id"))
        );
        for (OrgNode node : rows) {
            nodes.put(node.id(), node);
        }
        return nodes;
    }

    private String findOrgIdByName(Collection<OrgNode> nodes, String name) {
        for (OrgNode node : nodes) {
            if (Objects.equals(node.name(), name)) {
                return node.id();
            }
        }
        return null;
    }

    private String findBusinessRootOrgId(String userOrgId, String salesSystemOrgId, Map<String, OrgNode> orgNodes) {
        String currentId = userOrgId;
        while (currentId != null) {
            OrgNode node = orgNodes.get(currentId);
            if (node == null) {
                return null;
            }
            if (Objects.equals(node.parentId(), salesSystemOrgId)) {
                return node.id();
            }
            currentId = node.parentId();
        }
        return null;
    }

    private boolean isSameOrDescendant(String nodeId, String ancestorId, Map<String, OrgNode> orgNodes) {
        if (nodeId == null || ancestorId == null) {
            return false;
        }
        String currentId = nodeId;
        while (currentId != null) {
            if (Objects.equals(currentId, ancestorId)) {
                return true;
            }
            OrgNode node = orgNodes.get(currentId);
            currentId = node == null ? null : node.parentId();
        }
        return false;
    }

    private List<String> collectSubtreeOrgIds(String rootId, Map<String, OrgNode> orgNodes) {
        if (rootId == null || !orgNodes.containsKey(rootId)) {
            return List.of();
        }
        Map<String, List<String>> children = new LinkedHashMap<>();
        for (OrgNode node : orgNodes.values()) {
            children.computeIfAbsent(node.parentId(), key -> new ArrayList<>()).add(node.id());
        }
        LinkedHashSet<String> ids = new LinkedHashSet<>();
        ArrayDeque<String> queue = new ArrayDeque<>();
        queue.add(rootId);
        while (!queue.isEmpty()) {
            String currentId = queue.removeFirst();
            if (!ids.add(currentId)) {
                continue;
            }
            for (String childId : children.getOrDefault(currentId, List.of())) {
                queue.addLast(childId);
            }
        }
        return new ArrayList<>(ids);
    }

    private List<String> loadUserIdsByOrgIds(List<String> orgIds) {
        if (orgIds == null || orgIds.isEmpty()) {
            return List.of();
        }
        return jdbc.queryForList(
            "SELECT id FROM sys_user WHERE org_id = ANY(?::varchar[]) ORDER BY name, id",
            String.class,
            (Object) orgIds.toArray(new String[0])
        );
    }

    private String valueOf(Object value) {
        return value == null ? "" : String.valueOf(value);
    }

    private record OrgNode(String id, String name, String parentId) {}

    public record ScopeOption(
        PortalScope scope,
        String key,
        String label,
        String orgId,
        String orgName,
        String description
    ) {}

    public record SalesPortalScope(
        List<ScopeOption> scopeOptions,
        ScopeOption activeScope,
        List<String> scopeOrgIds,
        List<String> scopeUserIds,
        String userOrgId,
        String businessRootOrgId,
        String salesSystemOrgId,
        boolean salesHierarchyMember,
        boolean leaderCandidate
    ) {
        public static SalesPortalScope empty() {
            ScopeOption personal = new ScopeOption(
                PortalScope.PERSONAL,
                PortalScope.PERSONAL.getKey(),
                PortalScope.PERSONAL.getLabel(),
                null,
                null,
                "仅本人负责或参与的销售数据"
            );
            return new SalesPortalScope(
                List.of(personal),
                personal,
                List.of(),
                List.of(),
                null,
                null,
                null,
                false,
                false
            );
        }
    }
}
