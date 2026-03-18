package com.microoffice.controller;

import com.microoffice.dto.response.ApiResponse;
import com.microoffice.entity.ExternalObject;
import com.microoffice.entity.SysUser;
import com.microoffice.enums.ObjectType;
import com.microoffice.mapper.SysUserMapper;
import com.microoffice.service.ExternalObjectService;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import java.util.*;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/objects")
@RequiredArgsConstructor
public class ObjectController {
    private final ExternalObjectService service;
    private final SysUserMapper userMapper;
    private final JdbcTemplate jdbc;

    private List<String> getAllowedTypes(String userId) {
        List<String> personal = jdbc.queryForList(
            "SELECT object_type FROM user_object_type WHERE user_id = ?", String.class, userId);
        if (!personal.isEmpty()) return personal;
        return jdbc.queryForList(
            "SELECT DISTINCT pot.object_type FROM position_object_type pot " +
            "JOIN sys_user su ON su.primary_position_id = pot.position_id WHERE su.id = ? " +
            "UNION SELECT DISTINCT pot.object_type FROM position_object_type pot " +
            "JOIN user_position uap ON uap.position_id = pot.position_id WHERE uap.user_id = ?",
            String.class, userId, userId);
    }

    @GetMapping
    public ApiResponse<List<ExternalObject>> list(@RequestParam(required = false) ObjectType type,
                                                   @RequestParam(required = false) String orgId,
                                                   @RequestParam(required = false) String deptId,
                                                   Authentication auth) {
        String userId = (String) auth.getPrincipal();
        String role = auth.getAuthorities().stream().findFirst()
            .map(a -> a.getAuthority().replace("ROLE_", "")).orElse("STAFF");

        List<ExternalObject> all = service.list(type, orgId, deptId);
        if ("ADMIN".equals(role)) return ApiResponse.ok(all);

        List<String> allowed = getAllowedTypes(userId);
        if (!allowed.isEmpty()) {
            all = all.stream()
                .filter(o -> allowed.contains(o.getType().name()))
                .collect(Collectors.toList());
        }

        String posCode = "";
        try {
            posCode = jdbc.queryForObject(
                "SELECT COALESCE(p.code,'') FROM sys_user su LEFT JOIN position p ON p.id = su.primary_position_id WHERE su.id = ?",
                String.class, userId);
        } catch (Exception e) { posCode = ""; }

        Set<String> mgmtCodes = Set.of("BOSS", "SALES_DIR", "DEPT_MGR", "SYS_ADMIN");
        if (mgmtCodes.contains(posCode)) {
            SysUser user = userMapper.selectById(userId);
            List<String> orgIds = jdbc.queryForList(
                "WITH RECURSIVE sub AS (SELECT id FROM organization WHERE id = ? UNION ALL SELECT o.id FROM organization o JOIN sub s ON o.parent_id = s.id) SELECT id FROM sub",
                String.class, user.getOrgId());
            final List<String> orgIdsFinal = orgIds;
            all = all.stream()
                .filter(o -> userId.equals(o.getOwnerId()) || orgIdsFinal.contains(o.getOrgId()) || orgIdsFinal.contains(o.getDeptId()))
                .collect(Collectors.toList());
        } else if ("SALES_MGR".equals(posCode)) {
            SysUser user = userMapper.selectById(userId);
            String userOrgId = user.getOrgId();
            all = all.stream()
                .filter(o -> userId.equals(o.getOwnerId()) || (userOrgId != null && (userOrgId.equals(o.getOrgId()) || userOrgId.equals(o.getDeptId()))))
                .collect(Collectors.toList());
        } else {
            all = all.stream()
                .filter(o -> userId.equals(o.getOwnerId()))
                .collect(Collectors.toList());
        }
        return ApiResponse.ok(all);
    }

    @GetMapping("/{id}")
    public ApiResponse<ExternalObject> get(@PathVariable String id) {
        return ApiResponse.ok(service.getById(id));
    }

    @PostMapping
    public ApiResponse<ExternalObject> create(@RequestBody ExternalObject obj, Authentication auth) {
        String userId = (String) auth.getPrincipal();
        SysUser user = userMapper.selectById(userId);
        if (obj.getOwnerId() == null) obj.setOwnerId(userId);
        if (obj.getOrgId() == null && user.getOrgId() != null) obj.setOrgId(user.getOrgId());
        return ApiResponse.ok(service.create(obj));
    }

    @PutMapping("/{id}")
    public ApiResponse<Void> update(@PathVariable String id, @RequestBody ExternalObject obj, Authentication auth) {
        obj.setId(id);
        ExternalObject existing = service.getById(id);
        if (existing != null) {
            if (obj.getOwnerId() == null) obj.setOwnerId(existing.getOwnerId());
            if (obj.getOrgId() == null) obj.setOrgId(existing.getOrgId());
        }
        service.update(obj);
        return ApiResponse.ok(null);
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Void> delete(@PathVariable String id) {
        service.delete(id);
        return ApiResponse.ok(null);
    }
}
