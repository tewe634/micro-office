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

    @GetMapping("/me")
    public ApiResponse<Map<String, Object>> me() {
        Integer userId = (Integer) org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        SysUser u = userMapper.selectById(userId);
        if (u == null) throw new RuntimeException("用户不存在");
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", u.getId()); m.put("name", u.getName()); m.put("email", u.getEmail());
        m.put("role", u.getRole()); m.put("orgId", u.getOrgId()); m.put("primaryPositionId", u.getPrimaryPositionId());

        // 菜单权限：优先个人配置，否则走角色默认
        List<String> userMenus = jdbc.queryForList(
            "SELECT menu_key FROM user_menu_permission WHERE user_id = ? ORDER BY menu_key", String.class, userId);
        if (userMenus.isEmpty()) {
            userMenus = jdbc.queryForList(
                "SELECT menu_key FROM role_menu_permission WHERE role = ? ORDER BY menu_key", String.class, u.getRole());
        }
        m.put("menus", userMenus);
        m.put("hasCustomMenus", !jdbc.queryForList("SELECT 1 FROM user_menu_permission WHERE user_id = ? LIMIT 1", userId).isEmpty());

        // 可见的外部对象类型：根据主岗位+辅助岗位汇总
        List<String> objectTypes = jdbc.queryForList(
            "SELECT DISTINCT object_type FROM position_object_type WHERE position_id IN " +
            "(SELECT ? UNION SELECT position_id FROM user_position WHERE user_id = ?)",
            String.class, u.getPrimaryPositionId(), userId);
        m.put("objectTypes", objectTypes);

        return ApiResponse.ok(m);
    }

    @GetMapping
    public ApiResponse<List<Map<String, Object>>> list(@RequestParam(required = false) Integer orgId) {
        var qw = new LambdaQueryWrapper<SysUser>();
        if (orgId != null) qw.eq(SysUser::getOrgId, orgId);
        List<SysUser> users = userMapper.selectList(qw);
        List<Map<String, Object>> result = new ArrayList<>();
        for (SysUser u : users) {
            u.setPasswordHash(null);
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", u.getId()); m.put("name", u.getName()); m.put("email", u.getEmail());
            m.put("phone", u.getPhone()); m.put("orgId", u.getOrgId());
            m.put("primaryPositionId", u.getPrimaryPositionId());
            m.put("role", u.getRole());
            m.put("hiredAt", u.getHiredAt()); m.put("createdAt", u.getCreatedAt());
            // 查辅助岗位
            List<Integer> extraPositions = jdbc.queryForList(
                "SELECT position_id FROM user_position WHERE user_id = ?", Integer.class, u.getId());
            m.put("extraPositionIds", extraPositions);
            result.add(m);
        }
        return ApiResponse.ok(result);
    }

    @GetMapping("/{id}")
    public ApiResponse<SysUser> get(@PathVariable Integer id) {
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
        u.setOrgId(body.get("orgId") != null ? ((Number) body.get("orgId")).intValue() : null);
        u.setPrimaryPositionId(body.get("primaryPositionId") != null ? ((Number) body.get("primaryPositionId")).intValue() : null);
        u.setRole(body.get("role") != null ? (String) body.get("role") : "STAFF");
        userMapper.insert(u);
        // 辅助岗位
        saveExtraPositions(u.getId(), body);
        Map<String, Object> res = new LinkedHashMap<>();
        res.put("id", u.getId()); res.put("name", u.getName());
        return ApiResponse.ok(res);
    }

    @PutMapping("/{id}")
    public ApiResponse<Void> update(@PathVariable Integer id, @RequestBody Map<String, Object> body) {
        SysUser u = userMapper.selectById(id);
        if (u == null) throw new RuntimeException("用户不存在");
        if (body.containsKey("name")) u.setName((String) body.get("name"));
        if (body.containsKey("phone")) u.setPhone((String) body.get("phone"));
        if (body.containsKey("orgId")) u.setOrgId(body.get("orgId") != null ? ((Number) body.get("orgId")).intValue() : null);
        if (body.containsKey("primaryPositionId")) u.setPrimaryPositionId(body.get("primaryPositionId") != null ? ((Number) body.get("primaryPositionId")).intValue() : null);
        if (body.containsKey("role")) u.setRole((String) body.get("role"));
        // 修改密码
        if (body.containsKey("password") && body.get("password") != null && !((String) body.get("password")).isBlank()) {
            u.setPasswordHash(passwordEncoder.encode((String) body.get("password")));
        }
        userMapper.updateById(u);
        // 辅助岗位
        if (body.containsKey("extraPositionIds")) {
            saveExtraPositions(id, body);
        }
        return ApiResponse.ok(null);
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Void> delete(@PathVariable Integer id) {
        jdbc.update("DELETE FROM user_position WHERE user_id = ?", id);
        userMapper.deleteById(id);
        return ApiResponse.ok(null);
    }

    private void saveExtraPositions(Integer userId, Map<String, Object> body) {
        jdbc.update("DELETE FROM user_position WHERE user_id = ?", userId);
        Object ep = body.get("extraPositionIds");
        if (ep instanceof List<?> list) {
            for (Object pid : list) {
                jdbc.update("INSERT INTO user_position (user_id, position_id) VALUES (?, ?)",
                    userId, ((Number) pid).intValue());
            }
        }
    }
}
