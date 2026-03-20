package com.microoffice.controller;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.microoffice.dto.response.ApiResponse;
import com.microoffice.entity.SysUser;
import com.microoffice.mapper.SysUserMapper;
import com.microoffice.service.MenuPermissionService;
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
    private final com.microoffice.service.DataScopeService dataScopeService;
    private final MenuPermissionService menuPermissionService;

    @GetMapping("/me/lookups")
    public ApiResponse<Map<String, Object>> lookups() {
        String currentUserId = (String) org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        List<String> visibleOrgIds = dataScopeService.getVisibleOrgIds(currentUserId);
        Map<String, Object> result = new LinkedHashMap<>();
        if (visibleOrgIds.isEmpty()) {
            result.put("orgs", new ArrayList<>());
            result.put("users", new ArrayList<>());
        } else {
            result.put("orgs", jdbc.queryForList(
                "SELECT id, name, parent_id FROM organization WHERE id = ANY(?::varchar[]) ORDER BY sort_order, id",
                (Object) visibleOrgIds.toArray(new String[0])
            ));
            result.put("users", jdbc.queryForList(
                "SELECT id, name, org_id FROM sys_user WHERE org_id = ANY(?::varchar[]) ORDER BY id",
                (Object) visibleOrgIds.toArray(new String[0])
            ));
        }
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

        List<String> userMenus = menuPermissionService.getEffectiveMenus(userId).stream()
            .filter(menu -> !"/org".equals(menu))
            .toList();
        m.put("menus", userMenus);
        m.put("homePath", resolveHomePath(userMenus));
        m.put("hasCustomMenus", menuPermissionService.hasCustomMenus(userId));

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

    @PutMapping("/me/password")
    public ApiResponse<Void> changeMyPassword(@RequestBody Map<String, Object> body) {
        String currentUserId = (String) org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        SysUser u = userMapper.selectById(currentUserId);
        if (u == null) throw new RuntimeException("用户不存在");
        String password = body.get("password") != null ? body.get("password").toString().trim() : "";
        if (password.isBlank()) throw new RuntimeException("新密码不能为空");
        if (password.length() < 6) throw new RuntimeException("密码至少6位");
        u.setPasswordHash(passwordEncoder.encode(password));
        userMapper.updateById(u);
        return ApiResponse.ok(null);
    }

    @GetMapping("/page")
    public ApiResponse<com.microoffice.dto.response.PageResponse<Map<String, Object>>> page(
        @RequestParam(defaultValue = "1") long current,
        @RequestParam(defaultValue = "20") long size,
        @RequestParam(required = false) String orgId
    ) {
        // 复用现有 list 逻辑先拿到全量结果，再分页切片（保证业务规则不变）
        List<Map<String, Object>> all = list(orgId).getData();
        long total = all.size();
        int from = (int) Math.max(0, (current - 1) * size);
        int to = (int) Math.min(total, from + size);
        List<Map<String, Object>> records = from >= to ? new ArrayList<>() : all.subList(from, to);
        return ApiResponse.ok(new com.microoffice.dto.response.PageResponse<>(current, size, total, records));
    }

    @GetMapping
    public ApiResponse<List<Map<String, Object>>> list(@RequestParam(required = false) String orgId) {
        String currentUserId = (String) org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        menuPermissionService.requireMenu(currentUserId, "/users");
        List<String> visibleOrgIds = dataScopeService.getVisibleOrgIds(currentUserId);
        List<SysUser> users;
        if (orgId != null) {
            if (!visibleOrgIds.contains(orgId)) {
                return ApiResponse.ok(new ArrayList<>());
            }
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
            users = userMapper.selectList(new LambdaQueryWrapper<SysUser>().in(SysUser::getOrgId, visibleOrgIds));
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
        String currentUserId = (String) org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        menuPermissionService.requireMenu(currentUserId, "/users");
        List<String> visibleOrgIds = dataScopeService.getVisibleOrgIds(currentUserId);
        SysUser u = userMapper.selectById(id);
        if (u != null && !visibleOrgIds.contains(u.getOrgId())) {
            return ApiResponse.ok(null);
        }
        if (u != null) u.setPasswordHash(null);
        return ApiResponse.ok(u);
    }

    @PostMapping
    public ApiResponse<Map<String, Object>> create(@RequestBody Map<String, Object> body) {
        String currentUserId = (String) org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        menuPermissionService.requireMenu(currentUserId, "/users");
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
        String currentUserId = (String) org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        menuPermissionService.requireMenu(currentUserId, "/users");
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
        String currentUserId = (String) org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        menuPermissionService.requireMenu(currentUserId, "/users");
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
        return "/org";
    }
}
