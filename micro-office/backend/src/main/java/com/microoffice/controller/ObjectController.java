package com.microoffice.controller;

import com.microoffice.dto.response.ApiResponse;
import com.microoffice.dto.response.PageResponse;
import com.microoffice.entity.ExternalObject;
import com.microoffice.entity.SysUser;
import com.microoffice.enums.ObjectType;
import com.microoffice.mapper.SysUserMapper;
import com.microoffice.service.DataScopeService;
import com.microoffice.service.ExternalObjectAccessService;
import com.microoffice.service.ExternalObjectService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/objects")
@RequiredArgsConstructor
public class ObjectController {
    private final ExternalObjectService service;
    private final SysUserMapper userMapper;
    private final JdbcTemplate jdbc;
    private final DataScopeService dataScopeService;
    private final ExternalObjectAccessService objectAccessService;

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

    private RequestAccessContext buildRequestContext(Authentication auth) {
        String userId = (String) auth.getPrincipal();
        return new RequestAccessContext(
            userId,
            dataScopeService.isGlobalAdmin(userId),
            getAllowedTypes(userId),
            dataScopeService.getScopeOrgIds(userId),
            objectAccessService.buildContext(userId)
        );
    }

    private List<ExternalObject> filterAccessibleObjects(List<ExternalObject> all, RequestAccessContext ctx) {
        if (ctx.globalAdmin()) {
            return all;
        }
        return all.stream()
            .filter(obj -> hasTypeAccess(obj, ctx.allowedTypes()))
            .filter(obj -> objectAccessService.canAccess(obj, ctx.objectAccessContext(), ctx.scopeOrgIds()))
            .collect(Collectors.toList());
    }

    private boolean hasTypeAccess(ExternalObject obj, List<String> allowedTypes) {
        if (obj == null || obj.getType() == null) {
            return false;
        }
        return allowedTypes == null || allowedTypes.isEmpty() || allowedTypes.contains(obj.getType().name());
    }

    private ExternalObject requireAccessibleObject(String id, RequestAccessContext ctx) {
        ExternalObject existing = service.getById(id);
        if (existing == null) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "对象不存在");
        }
        if (ctx.globalAdmin()) {
            return existing;
        }
        if (!hasTypeAccess(existing, ctx.allowedTypes()) || !objectAccessService.canAccess(existing, ctx.objectAccessContext(), ctx.scopeOrgIds())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "无权访问该对象");
        }
        return existing;
    }

    private void normalizeObjectForSave(ExternalObject obj, SysUser currentUser) {
        obj.setName(trimToNull(obj.getName()));
        obj.setContact(trimToNull(obj.getContact()));
        obj.setPhone(trimToNull(obj.getPhone()));
        obj.setAddress(trimToNull(obj.getAddress()));
        obj.setRemark(trimToNull(obj.getRemark()));
        obj.setAccountNo(trimToNull(obj.getAccountNo()));
        obj.setSubjectCode(trimToNull(obj.getSubjectCode()));
        obj.setIndustry(trimToNull(obj.getIndustry()));
        obj.setOrgId(trimToNull(obj.getOrgId()));
        obj.setDeptId(trimToNull(obj.getDeptId()));
        obj.setOwnerId(trimToNull(obj.getOwnerId()));

        if (obj.getType() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "对象类型不能为空");
        }
        if (obj.getName() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "对象名称不能为空");
        }

        if (obj.getOwnerId() == null && obj.getOrgId() == null && obj.getDeptId() == null && currentUser != null) {
            obj.setOrgId(trimToNull(currentUser.getOrgId()));
        }
        if (obj.getOwnerId() == null && obj.getOrgId() == null && obj.getDeptId() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "未设置负责人时，至少需要选择组织或部门");
        }
    }

    private void applyPatch(ExternalObject target, Map<String, Object> body) {
        if (body.containsKey("type") && body.get("type") != null) {
            target.setType(ObjectType.valueOf(String.valueOf(body.get("type"))));
        }
        if (body.containsKey("name")) target.setName(asString(body.get("name")));
        if (body.containsKey("contact")) target.setContact(asString(body.get("contact")));
        if (body.containsKey("phone")) target.setPhone(asString(body.get("phone")));
        if (body.containsKey("address")) target.setAddress(asString(body.get("address")));
        if (body.containsKey("remark")) target.setRemark(asString(body.get("remark")));
        if (body.containsKey("accountNo")) target.setAccountNo(asString(body.get("accountNo")));
        if (body.containsKey("subjectCode")) target.setSubjectCode(asString(body.get("subjectCode")));
        if (body.containsKey("orgId")) target.setOrgId(asString(body.get("orgId")));
        if (body.containsKey("deptId")) target.setDeptId(asString(body.get("deptId")));
        if (body.containsKey("ownerId")) target.setOwnerId(asString(body.get("ownerId")));
        if (body.containsKey("industry")) target.setIndustry(asString(body.get("industry")));
    }

    private String asString(Object value) {
        return value == null ? null : String.valueOf(value);
    }

    private String trimToNull(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    @GetMapping("/departments")
    public ApiResponse<List<Map<String, Object>>> departments(Authentication auth) {
        String userId = (String) auth.getPrincipal();
        List<String> orgIds = dataScopeService.getScopeOrgIds(userId);
        if (orgIds.isEmpty()) {
            return ApiResponse.ok(Collections.emptyList());
        }
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
        RequestAccessContext ctx = buildRequestContext(auth);
        List<ExternalObject> all = service.list(type, orgId, deptId);
        return ApiResponse.ok(filterAccessibleObjects(all, ctx));
    }

    @GetMapping("/page")
    public ApiResponse<PageResponse<ExternalObject>> page(@RequestParam(defaultValue = "1") long current,
                                                          @RequestParam(defaultValue = "20") long size,
                                                          @RequestParam(required = false) ObjectType type,
                                                          @RequestParam(required = false) String orgId,
                                                          @RequestParam(required = false) String deptId,
                                                          Authentication auth) {
        RequestAccessContext ctx = buildRequestContext(auth);
        List<ExternalObject> all = filterAccessibleObjects(service.list(type, orgId, deptId), ctx);
        long total = all.size();
        int fromIndex = (int) Math.max(0, (current - 1) * size);
        int toIndex = (int) Math.min(total, fromIndex + size);
        List<ExternalObject> records = fromIndex >= total ? Collections.emptyList() : all.subList(fromIndex, toIndex);
        return ApiResponse.ok(new PageResponse<>(current, size, total, records));
    }

    @GetMapping("/{id}")
    public ApiResponse<ExternalObject> get(@PathVariable String id, Authentication auth) {
        return ApiResponse.ok(requireAccessibleObject(id, buildRequestContext(auth)));
    }

    @PostMapping
    public ApiResponse<ExternalObject> create(@RequestBody ExternalObject obj, Authentication auth) {
        RequestAccessContext ctx = buildRequestContext(auth);
        if (!ctx.globalAdmin() && !hasTypeAccess(obj, ctx.allowedTypes())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "无权创建该类型对象");
        }
        SysUser currentUser = userMapper.selectById(ctx.userId());
        normalizeObjectForSave(obj, currentUser);
        return ApiResponse.ok(service.create(obj));
    }

    @PutMapping("/{id}")
    public ApiResponse<Void> update(@PathVariable String id, @RequestBody Map<String, Object> body, Authentication auth) {
        RequestAccessContext ctx = buildRequestContext(auth);
        ExternalObject existing = requireAccessibleObject(id, ctx);
        applyPatch(existing, body);
        if (!ctx.globalAdmin() && !hasTypeAccess(existing, ctx.allowedTypes())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "无权修改该类型对象");
        }
        SysUser currentUser = userMapper.selectById(ctx.userId());
        normalizeObjectForSave(existing, currentUser);
        service.update(existing);
        return ApiResponse.ok(null);
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Void> delete(@PathVariable String id, Authentication auth) {
        requireAccessibleObject(id, buildRequestContext(auth));
        service.delete(id);
        return ApiResponse.ok(null);
    }

    private record RequestAccessContext(
        String userId,
        boolean globalAdmin,
        List<String> allowedTypes,
        List<String> scopeOrgIds,
        ExternalObjectAccessService.AccessContext objectAccessContext
    ) {}
}
