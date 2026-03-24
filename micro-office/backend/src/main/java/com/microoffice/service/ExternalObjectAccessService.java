package com.microoffice.service;

import com.microoffice.entity.ExternalObject;
import com.microoffice.entity.SysUser;
import com.microoffice.mapper.SysUserMapper;
import lombok.Getter;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.util.Collection;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class ExternalObjectAccessService {
    private static final List<String> LEADER_KEYWORDS = List.of(
        "负责人", "总经理", "总监", "经理", "主管", "主任", "部长", "厂长", "组长", "科长"
    );

    private final JdbcTemplate jdbc;
    private final SysUserMapper userMapper;

    public AccessContext buildContext(String userId) {
        SysUser viewer = userMapper.selectById(userId);
        String viewerOrgId = viewer == null ? null : viewer.getOrgId();
        return new AccessContext(userId, viewerOrgId, isLeaderCandidate(userId), loadOrgParentMap());
    }

    public boolean canAccess(ExternalObject obj, AccessContext ctx, Collection<String> scopeOrgIds) {
        if (obj == null || ctx == null) {
            return false;
        }
        Collection<String> scopedOrgIds = scopeOrgIds == null ? List.of() : scopeOrgIds;
        if (hasText(obj.getOwnerId())) {
            if (obj.getOwnerId().equals(ctx.getUserId())) {
                return true;
            }
            if (!ctx.isLeaderCandidate() || !hasText(ctx.getViewerOrgId())) {
                return false;
            }
            String ownerOrgId = getUserOrgId(obj.getOwnerId(), ctx);
            return hasText(ownerOrgId) && scopedOrgIds.contains(ownerOrgId);
        }
        if (!hasText(ctx.getViewerOrgId())) {
            return false;
        }
        return matchesScopedOrg(obj.getOrgId(), scopedOrgIds, ctx.getOrgParentMap())
            || matchesScopedOrg(obj.getDeptId(), scopedOrgIds, ctx.getOrgParentMap());
    }

    private String getUserOrgId(String userId, AccessContext ctx) {
        if (!hasText(userId)) {
            return null;
        }
        if (ctx.getUserOrgCache().containsKey(userId)) {
            return ctx.getUserOrgCache().get(userId);
        }
        SysUser user = userMapper.selectById(userId);
        String orgId = user == null ? null : user.getOrgId();
        ctx.getUserOrgCache().put(userId, orgId);
        return orgId;
    }

    private boolean isLeaderCandidate(String userId) {
        List<Map<String, Object>> rows = jdbc.queryForList(
            "SELECT su.role, p.name AS primary_position_name, " +
                "COALESCE(string_agg(DISTINCT p2.name, '、') FILTER (WHERE p2.name IS NOT NULL), '') AS extra_position_names " +
            "FROM sys_user su " +
            "LEFT JOIN position p ON p.id = su.primary_position_id " +
            "LEFT JOIN user_position up ON up.user_id = su.id " +
            "LEFT JOIN position p2 ON p2.id = up.position_id " +
            "WHERE su.id = ? " +
            "GROUP BY su.id, su.role, p.name",
            userId
        );
        if (rows.isEmpty()) {
            return false;
        }
        Map<String, Object> row = rows.get(0);
        String role = asString(row.get("role"));
        if ("ADMIN".equals(role) || "SYS_ADMIN".equals(role)) {
            return true;
        }
        String combined = String.format(
            "%s %s",
            asString(row.get("primary_position_name")) == null ? "" : asString(row.get("primary_position_name")),
            asString(row.get("extra_position_names")) == null ? "" : asString(row.get("extra_position_names"))
        );
        for (String keyword : LEADER_KEYWORDS) {
            if (combined.contains(keyword)) {
                return true;
            }
        }
        return false;
    }

    private Map<String, String> loadOrgParentMap() {
        Map<String, String> parentMap = new HashMap<>();
        jdbc.query("SELECT id, parent_id FROM organization", rs -> {
            parentMap.put(rs.getString("id"), rs.getString("parent_id"));
        });
        return parentMap;
    }

    private boolean isSameOrDescendant(String nodeId, String ancestorId, Map<String, String> parentMap) {
        if (!hasText(nodeId) || !hasText(ancestorId)) {
            return false;
        }
        String current = nodeId;
        while (hasText(current)) {
            if (current.equals(ancestorId)) {
                return true;
            }
            current = parentMap.get(current);
        }
        return false;
    }

    private boolean matchesScopedOrg(String targetOrgId, Collection<String> scopeOrgIds, Map<String, String> parentMap) {
        if (!hasText(targetOrgId) || scopeOrgIds == null || scopeOrgIds.isEmpty()) {
            return false;
        }
        for (String scopeOrgId : scopeOrgIds) {
            if (isSameOrDescendant(scopeOrgId, targetOrgId, parentMap)) {
                return true;
            }
        }
        return false;
    }

    private boolean hasText(String value) {
        return value != null && !value.isBlank();
    }

    private String asString(Object value) {
        return value == null ? null : String.valueOf(value);
    }

    @Getter
    public static class AccessContext {
        private final String userId;
        private final String viewerOrgId;
        private final boolean leaderCandidate;
        private final Map<String, String> orgParentMap;
        private final Map<String, String> userOrgCache = new HashMap<>();

        private AccessContext(String userId, String viewerOrgId, boolean leaderCandidate, Map<String, String> orgParentMap) {
            this.userId = userId;
            this.viewerOrgId = viewerOrgId;
            this.leaderCandidate = leaderCandidate;
            this.orgParentMap = orgParentMap;
            this.userOrgCache.put(userId, viewerOrgId);
        }
    }
}
