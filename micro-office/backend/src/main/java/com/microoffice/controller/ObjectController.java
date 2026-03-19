package com.microoffice.controller;

import com.microoffice.dto.response.ApiResponse;
import com.microoffice.dto.response.PageResponse;
import com.microoffice.entity.ExternalObject;
import com.microoffice.entity.SysUser;
import com.microoffice.enums.ObjectType;
import com.microoffice.mapper.SysUserMapper;
import com.microoffice.service.DataScopeService;
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
    private final DataScopeService dataScopeService;

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

    private List<ExternalObject> filterAccessibleObjects(List<ExternalObject> all, Authentication auth) {
        String userId = (String) auth.getPrincipal();
        String role = auth.getAuthorities().stream().findFirst()
            .map(a -> a.getAuthority().replace("ROLE_", "")).orElse("STAFF");

        if ("ADMIN".equals(role) && dataScopeService.isGlobalAdmin(userId)) {
            return all;
        }

        List<String> allowed = getAllowedTypes(userId);
        if (!allowed.isEmpty()) {
            all = all.stream()
                .filter(o -> allowed.contains(o.getType().name()))
                .collect(Collectors.toList());
        }

        List<String> orgIds = dataScopeService.getScopeOrgIds(userId);
        return all.stream()
            .filter(o -> userId.equals(o.getOwnerId()) || orgIds.contains(o.getOrgId()) || orgIds.contains(o.getDeptId()))
            .collect(Collectors.toList());
    }

    @GetMapping("/departments")
    public ApiResponse<List<Map<String, Object>>> departments(Authentication auth) {
        String userId = (String) auth.getPrincipal();
        List<String> orgIds = dataScopeService.getScopeOrgIds(userId);
        List<Map<String, Object>> rows = jdbc.queryForList(
            "SELECT id, name, parent_id FROM organization WHERE id = ANY(?::varchar[]) ORDER BY sort_order, id",
            (Object) orgIds.toArray(new String[0])
        );
        return ApiResponse.ok(rows.stream()
            .filter(r -> r.get("parent_id") != null)
            .collect(Collectors.toList()));
    }

    @GetMapping
    public ApiResponse<List<ExternalObject>> list(@RequestParam(required = false) ObjectType type,
                                                  @RequestParam(required = false) String orgId,
                                                  @RequestParam(required = false) String deptId,
                                                  Authentication auth) {
        List<ExternalObject> all = service.list(type, orgId, deptId);
        return ApiResponse.ok(filterAccessibleObjects(all, auth));
    }

    @GetMapping("/page")
    public ApiResponse<PageResponse<ExternalObject>> page(@RequestParam(defaultValue = "1") long current,
                                                          @RequestParam(defaultValue = "20") long size,
                                                          @RequestParam(required = false) ObjectType type,
                                                          @RequestParam(required = false) String orgId,
                                                          @RequestParam(required = false) String deptId,
                                                          Authentication auth) {
        List<ExternalObject> all = filterAccessibleObjects(service.list(type, orgId, deptId), auth);
        long total = all.size();
        int fromIndex = (int) Math.max(0, (current - 1) * size);
        int toIndex = (int) Math.min(total, fromIndex + size);
        List<ExternalObject> records = fromIndex >= total ? Collections.emptyList() : all.subList(fromIndex, toIndex);
        return ApiResponse.ok(new PageResponse<>(current, size, total, records));
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
