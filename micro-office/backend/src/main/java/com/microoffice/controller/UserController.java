package com.microoffice.controller;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.microoffice.dto.response.ApiResponse;
import com.microoffice.entity.SysUser;
import com.microoffice.mapper.SysUserMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;
import java.util.*;

@RestController
@RequestMapping("/api/users")
@RequiredArgsConstructor
public class UserController {
    private final SysUserMapper userMapper;
    private final PasswordEncoder passwordEncoder;
    private final JdbcTemplate jdbc;

    @GetMapping("/me/lookups")
    public ApiResponse<Map<String, Object>> lookups() {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("orgs", jdbc.queryForList("SELECT id, name, parent_id FROM organization ORDER BY sort_order, id"));
        result.put("users", jdbc.queryForList("SELECT id, name, org_id FROM sys_user ORDER BY id"));
        result.put("roles", jdbc.queryForList("SELECT code, name FROM sys_role ORDER BY sort_order"));
        return ApiResponse.ok(result);
    }

    @GetMapping("/me")
    public ApiResponse<Map<String, Object>> me() {
        String userId = (String) org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        SysUser u = userMapper.selectById(userId);
        if (u == null) throw new RuntimeException("用户不存在");
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", u.getId()); m.put("name", u.getName()); m.put("email", u.getEmail());
        m.put("role", u.getRole()); m.put("orgId", u.getOrgId()); m.put("primaryPositionId", u.getPrimaryPositionId());

        List<String> userMenus = jdbc.queryForList(
            "SELECT menu_key FROM user_menu_permission WHERE user_id = ? ORDER BY menu_key", String.class, userId);
        if (userMenus.isEmpty()) {
            userMenus = jdbc.queryForList(
                "SELECT menu_key FROM role_menu_permission WHERE role = ? ORDER BY menu_key", String.class, u.getRole());
        }
        m.put("menus", userMenus);
        m.put("homePath", resolveHomePath(userMenus));
        m.put("hasCustomMenus", !jdbc.queryForList("SELECT 1 FROM user_menu_permission WHERE user_id = ? LIMIT 1", userId).isEmpty());

        List<String> userObjTypes = jdbc.queryForList(
            "SELECT object_type FROM user_object_type WHERE user_id = ? ORDER BY object_type", String.class, userId);
        List<String> objectTypes;
        if (!userObjTypes.isEmpty()) {
            objectTypes = userObjTypes;
        } else {
            objectTypes = jdbc.queryForList(
                "SELECT DISTINCT object_type FROM position_object_type WHERE position_id IN " +
                "(SELECT ? UNION SELECT position_id FROM user_position WHERE user_id = ?)",
                String.class, u.getPrimaryPositionId(), userId);
        }
        m.put("objectTypes", objectTypes);
        m.put("hasCustomObjectTypes", !userObjTypes.isEmpty());
        return ApiResponse.ok(m);
    }

    @GetMapping
    public ApiResponse<List<Map<String, Object>>> list(@RequestParam(required = false) String orgId) {
        List<SysUser> users;
        if (orgId != null) {
            Integer isRoot = jdbc.queryForObject(
                "SELECT COUNT(*) FROM organization WHERE id = ? AND parent_id IS NULL", Integer.class, orgId);
            if (isRoot != null && isRoot > 0) {
                // 总经办：只查直属
                users = userMapper.selectList(new LambdaQueryWrapper<SysUser>().eq(SysUser::getOrgId, orgId));
            } else {
                // 递归查本节点及所有子组织的人员
                List<String> orgIds = jdbc.queryForList(
                    "WITH RECURSIVE sub AS (SELECT id FROM organization WHERE id = ? " +
                    "UNION ALL SELECT o.id FROM organization o JOIN sub s ON o.parent_id = s.id) " +
                    "SELECT id FROM sub", String.class, orgId);
                java.util.Set<String> userIds = new java.util.LinkedHashSet<>(
                    jdbc.queryForList("SELECT id FROM sys_user WHERE org_id = ANY(?::varchar[])",
                        String.class, (Object) orgIds.toArray(new String[0])));
                // 确定附加哪些负责人（手机号）
                java.util.List<String> extraPhones = new java.util.ArrayList<>();
                extraPhones.add("13305713391"); // 杨筱辉（所有体系都加）
                // 找当前节点所属顶级体系名称
                String topName = jdbc.queryForObject(
                    "WITH RECURSIVE path AS (" +
                    "  SELECT id, name, parent_id FROM organization WHERE id = ?" +
                    "  UNION ALL SELECT o.id, o.name, o.parent_id FROM organization o JOIN path p ON o.id = p.parent_id" +
                    ") SELECT name FROM path WHERE parent_id=(SELECT id FROM organization WHERE parent_id IS NULL) LIMIT 1",
                    String.class, orgId);
                if ("管理体系".equals(topName)) {
                    extraPhones.add("13958118773"); // 王舟珍
                } else if ("销售体系".equals(topName)) {
                    // 找当前节点所属业务部（或自身就是业务部）
                    String bizName = null;
                    try {
                        bizName = jdbc.queryForObject(
                            "WITH RECURSIVE path AS (" +
                            "  SELECT id, name, parent_id FROM organization WHERE id = ?" +
                            "  UNION ALL SELECT o.id, o.name, o.parent_id FROM organization o JOIN path p ON o.id = p.parent_id" +
                            ") SELECT name FROM path WHERE parent_id=(SELECT id FROM organization WHERE name='销售体系') LIMIT 1",
                            String.class, orgId);
                    } catch (Exception ignored) {}
                    if ("业务一部".equals(bizName)) extraPhones.add("13588806597");
                    else if ("业务二部".equals(bizName)) extraPhones.add("13906507118");
                    else if ("业务三部".equals(bizName)) extraPhones.add("13306506051");
                    // 销售体系本身：加三个大区负责人
                    else { extraPhones.add("13588806597"); extraPhones.add("13906507118"); extraPhones.add("13306506051"); }
                }
                // 附加负责人 ID
                userIds.addAll(jdbc.queryForList(
                    "SELECT id FROM sys_user WHERE phone = ANY(?::varchar[])",
                    String.class, (Object) extraPhones.toArray(new String[0])));
                users = userMapper.selectList(new LambdaQueryWrapper<SysUser>().in(SysUser::getId, new java.util.ArrayList<>(userIds)));
            }
        } else {
            users = userMapper.selectList(null);
        }
        // 按工号数字部分排序
        users.sort((a, b) -> {
            int na = a.getEmpNo() != null ? Integer.parseInt(a.getEmpNo().replaceAll("[^0-9]", "")) : 0;
            int nb = b.getEmpNo() != null ? Integer.parseInt(b.getEmpNo().replaceAll("[^0-9]", "")) : 0;
            return Integer.compare(na, nb);
        });
        List<Map<String, Object>> result = new ArrayList<>();
        for (SysUser u : users) {
            u.setPasswordHash(null);
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", u.getId()); m.put("name", u.getName()); m.put("email", u.getEmail());
            m.put("phone", u.getPhone()); m.put("orgId", u.getOrgId());
            m.put("empNo", u.getEmpNo());
            m.put("primaryPositionId", u.getPrimaryPositionId());
            m.put("role", u.getRole());
            m.put("hiredAt", u.getHiredAt()); m.put("createdAt", u.getCreatedAt());
            List<String> extraPositions = jdbc.queryForList(
                "SELECT position_id FROM user_position WHERE user_id = ?", String.class, u.getId());
            m.put("extraPositionIds", extraPositions);
            result.add(m);
        }
        return ApiResponse.ok(result);
    }

    @GetMapping("/{id}")
    public ApiResponse<SysUser> get(@PathVariable String id) {
        SysUser u = userMapper.selectById(id);
        if (u != null) u.setPasswordHash(null);
        return ApiResponse.ok(u);
    }

    @PostMapping
    public ApiResponse<Map<String, Object>> create(@RequestBody Map<String, Object> body) {
        SysUser u = new SysUser();
        u.setName((String) body.get("name"));
        u.setEmail((String) body.get("email"));
        u.setPhone((String) body.get("phone"));
        String pwd = body.get("password") != null ? (String) body.get("password") : "123456";
        u.setPasswordHash(passwordEncoder.encode(pwd));
        u.setOrgId(body.get("orgId") != null ? body.get("orgId").toString() : null);
        u.setPrimaryPositionId(body.get("primaryPositionId") != null ? body.get("primaryPositionId").toString() : null);
        u.setRole(body.get("role") != null ? (String) body.get("role") : deriveRole(u.getPrimaryPositionId(), u.getOrgId()));
        userMapper.insert(u);
        saveExtraPositions(u.getId(), body);
        Map<String, Object> res = new LinkedHashMap<>();
        res.put("id", u.getId()); res.put("name", u.getName());
        return ApiResponse.ok(res);
    }

    @PutMapping("/{id}")
    public ApiResponse<Void> update(@PathVariable String id, @RequestBody Map<String, Object> body) {
        SysUser u = userMapper.selectById(id);
        if (u == null) throw new RuntimeException("用户不存在");
        if (body.containsKey("name")) u.setName((String) body.get("name"));
        if (body.containsKey("phone")) u.setPhone((String) body.get("phone"));
        if (body.containsKey("orgId")) u.setOrgId(body.get("orgId") != null ? body.get("orgId").toString() : null);
        if (body.containsKey("primaryPositionId")) u.setPrimaryPositionId(body.get("primaryPositionId") != null ? body.get("primaryPositionId").toString() : null);
        if (body.containsKey("role")) {
            u.setRole((String) body.get("role"));
        } else if (body.containsKey("primaryPositionId") || body.containsKey("orgId")) {
            u.setRole(deriveRole(u.getPrimaryPositionId(), u.getOrgId()));
        }
        if (body.containsKey("password") && body.get("password") != null && !((String) body.get("password")).isBlank()) {
            u.setPasswordHash(passwordEncoder.encode((String) body.get("password")));
        }
        userMapper.updateById(u);
        if (body.containsKey("extraPositionIds")) {
            saveExtraPositions(id, body);
        }
        return ApiResponse.ok(null);
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Void> delete(@PathVariable String id) {
        jdbc.update("DELETE FROM user_position WHERE user_id = ?", id);
        userMapper.deleteById(id);
        return ApiResponse.ok(null);
    }

    private void saveExtraPositions(String userId, Map<String, Object> body) {
        jdbc.update("DELETE FROM user_position WHERE user_id = ?", userId);
        Object ep = body.get("extraPositionIds");
        if (ep instanceof List<?> list) {
            for (Object pid : list) {
                jdbc.update("INSERT INTO user_position (user_id, position_id) VALUES (?, ?)", userId, pid.toString());
            }
        }
    }

    private String deriveRole(String positionId, String orgId) {
        String posRole = null;
        if (positionId != null) {
            posRole = jdbc.queryForObject("SELECT default_role FROM position WHERE id = ?", String.class, positionId);
        }
        if (posRole != null && !"STAFF".equals(posRole)) return posRole;
        if (orgId != null) {
            String orgRole = jdbc.queryForObject("SELECT default_role FROM organization WHERE id = ?", String.class, orgId);
            if (orgRole != null) return orgRole;
        }
        return posRole != null ? posRole : "STAFF";
    }

    private String resolveHomePath(List<String> menus) {
        List<String> order = List.of("/org", "/users", "/objects", "/products", "/admin/permissions");
        for (String path : order) {
            if (menus.contains(path) || ("/admin/permissions".equals(path) && menus.contains("/admin"))) {
                return path;
            }
        }
        return "/objects";
    }
}
