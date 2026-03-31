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
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/objects")
@RequiredArgsConstructor
public class ObjectController {
    private static final Set<String> OBJECT_ROOT_ORG_NAMES = Set.of(
        "管理体系",
        "业务一部",
        "业务二部",
        "业务三部",
        "产品支持体系"
    );
    private static final Set<String> CUSTOMER_ROLE_OPTIONS = Set.of(
        "最终用户",
        "总包商",
        "制造商",
        "分销商"
    );
    private static final Set<String> CUSTOMER_SCALE_OPTIONS = Set.of(
        "大客户",
        "中型客户",
        "小客户"
    );

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
        obj.setCustomerRole(trimToNull(obj.getCustomerRole()));
        obj.setCustomerScale(trimToNull(obj.getCustomerScale()));
        obj.setOrgId(trimToNull(obj.getOrgId()));
        obj.setDeptId(trimToNull(obj.getDeptId()));
        obj.setOwnerId(trimToNull(obj.getOwnerId()));

        if (obj.getType() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "对象类型不能为空");
        }
        if (obj.getName() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "对象名称不能为空");
        }
        if (obj.getType() == ObjectType.CUSTOMER) {
            validateCustomerRole(obj.getCustomerRole());
            validateCustomerScale(obj.getCustomerScale());
        } else {
            obj.setCustomerRole(null);
            obj.setCustomerScale(null);
        }

        normalizeObjectOrganization(obj, currentUser);

        if (obj.getOwnerId() == null && obj.getOrgId() == null && obj.getDeptId() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "未设置负责人时，至少需要选择组织或部门");
        }
    }

    private void normalizeObjectOrganization(ExternalObject obj, SysUser currentUser) {
        Map<String, OrgNode> allNodes = loadAllOrganizationNodeMap();

        if (obj.getOwnerId() == null && obj.getOrgId() == null && obj.getDeptId() == null && currentUser != null) {
            obj.setOrgId(trimToNull(findObjectRootOrgId(currentUser.getOrgId(), allNodes)));
        }

        if (obj.getOrgId() != null) {
            OrgNode orgNode = allNodes.get(obj.getOrgId());
            if (orgNode == null) {
                throw badRequest("所属组织不存在");
            }
            String normalizedOrgId = findObjectRootOrgId(obj.getOrgId(), allNodes);
            if (normalizedOrgId == null) {
                throw badRequest("所属组织不在外部对象可用组织架构内");
            }
            if (!normalizedOrgId.equals(obj.getOrgId())) {
                if (obj.getDeptId() == null) {
                    obj.setDeptId(obj.getOrgId());
                    obj.setOrgId(normalizedOrgId);
                } else if (obj.getOrgId().equals(obj.getDeptId())) {
                    obj.setOrgId(normalizedOrgId);
                } else {
                    throw badRequest("所属组织与部门不匹配");
                }
            }
        }

        if (obj.getDeptId() != null) {
            OrgNode deptNode = allNodes.get(obj.getDeptId());
            if (deptNode == null) {
                throw badRequest("所属部门不存在");
            }
            String departmentOrgId = findObjectRootOrgId(obj.getDeptId(), allNodes);
            if (departmentOrgId == null) {
                throw badRequest("所属部门不在外部对象可用组织架构内");
            }
            if (isObjectRootOrg(deptNode)) {
                if (obj.getOrgId() == null || obj.getDeptId().equals(obj.getOrgId())) {
                    obj.setOrgId(departmentOrgId);
                    obj.setDeptId(null);
                } else {
                    throw badRequest("所属组织与部门不匹配");
                }
            } else if (obj.getOrgId() == null) {
                obj.setOrgId(departmentOrgId);
            } else if (!obj.getOrgId().equals(departmentOrgId)) {
                throw badRequest("所属组织与部门不匹配");
            }
        }

        if (obj.getOrgId() != null) {
            OrgNode orgNode = allNodes.get(obj.getOrgId());
            String normalizedOrgId = findObjectRootOrgId(obj.getOrgId(), allNodes);
            if (orgNode == null || normalizedOrgId == null || !normalizedOrgId.equals(obj.getOrgId()) || !isObjectRootOrg(orgNode)) {
                throw badRequest("所属组织必须选择外部对象可用组织");
            }
        }
    }

    private OrgStructureResponse buildObjectOrgStructure(List<String> visibleOrgIds) {
        List<OrgNode> allNodes = loadAllOrganizationNodes();
        Map<String, OrgNode> allNodeMap = indexOrganizationNodes(allNodes);
        LinkedHashMap<String, OrgNode> visibleNodeMap = new LinkedHashMap<>();
        for (String id : visibleOrgIds) {
            OrgNode node = allNodeMap.get(id);
            if (node != null) {
                visibleNodeMap.put(id, node);
            }
        }

        LinkedHashMap<String, OrgNode> visibleRootOrgs = new LinkedHashMap<>();
        for (OrgNode node : visibleNodeMap.values()) {
            String rootOrgId = findObjectRootOrgId(node.id(), allNodeMap);
            if (rootOrgId != null) {
                visibleRootOrgs.putIfAbsent(rootOrgId, allNodeMap.get(rootOrgId));
            }
        }

        List<OrgStructureItem> orgs = allNodes.stream()
            .filter(node -> visibleRootOrgs.containsKey(node.id()))
            .map(node -> new OrgStructureItem(node.id(), node.name(), node.parentId()))
            .collect(Collectors.toList());

        List<DepartmentStructureItem> departments = allNodes.stream()
            .filter(node -> visibleNodeMap.containsKey(node.id()))
            .map(node -> {
                String rootOrgId = findObjectRootOrgId(node.id(), allNodeMap);
                if (rootOrgId == null || rootOrgId.equals(node.id()) || !visibleRootOrgs.containsKey(rootOrgId)) {
                    return null;
                }
                return new DepartmentStructureItem(node.id(), node.name(), node.parentId(), rootOrgId);
            })
            .filter(Objects::nonNull)
            .collect(Collectors.toList());

        LinkedHashMap<String, OrgNode> allNodesForResponse = new LinkedHashMap<>();
        for (OrgNode node : allNodes) {
            if (visibleRootOrgs.containsKey(node.id()) || visibleNodeMap.containsKey(node.id())) {
                allNodesForResponse.put(node.id(), node);
            }
        }

        List<OrgStructureItem> allVisibleNodes = allNodesForResponse.values().stream()
            .map(node -> new OrgStructureItem(node.id(), node.name(), node.parentId()))
            .collect(Collectors.toList());

        return new OrgStructureResponse(orgs, departments, allVisibleNodes);
    }

    private List<OrgNode> loadAllOrganizationNodes() {
        return jdbc.query(
            "SELECT id, name, parent_id FROM organization ORDER BY sort_order, id",
            (rs, rowNum) -> new OrgNode(
                rs.getString("id"),
                rs.getString("name"),
                rs.getString("parent_id")
            )
        );
    }

    private Map<String, OrgNode> loadAllOrganizationNodeMap() {
        return indexOrganizationNodes(loadAllOrganizationNodes());
    }

    private Map<String, OrgNode> indexOrganizationNodes(List<OrgNode> nodes) {
        return nodes.stream().collect(Collectors.toMap(
            OrgNode::id,
            node -> node,
            (left, right) -> left,
            LinkedHashMap::new
        ));
    }

    private String findObjectRootOrgId(String nodeId, Map<String, OrgNode> allNodes) {
        String currentId = nodeId;
        while (currentId != null) {
            OrgNode node = allNodes.get(currentId);
            if (node == null) {
                return null;
            }
            if (isObjectRootOrg(node)) {
                return node.id();
            }
            currentId = node.parentId();
        }
        return null;
    }

    private boolean isObjectRootOrg(OrgNode node) {
        return node != null && OBJECT_ROOT_ORG_NAMES.contains(node.name());
    }

    private ResponseStatusException badRequest(String message) {
        return new ResponseStatusException(HttpStatus.BAD_REQUEST, message);
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
        if (body.containsKey("customerRole")) target.setCustomerRole(asString(body.get("customerRole")));
        if (body.containsKey("customerScale")) target.setCustomerScale(asString(body.get("customerScale")));
    }

    private void validateCustomerRole(String customerRole) {
        if (customerRole != null && !CUSTOMER_ROLE_OPTIONS.contains(customerRole)) {
            throw badRequest("客户角色仅支持：最终用户、总包商、制造商、分销商");
        }
    }

    private void validateCustomerScale(String customerScale) {
        if (customerScale != null && !CUSTOMER_SCALE_OPTIONS.contains(customerScale)) {
            throw badRequest("客户规模仅支持：大客户、中型客户、小客户");
        }
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

    @GetMapping("/org-structure")
    public ApiResponse<OrgStructureResponse> orgStructure(Authentication auth) {
        String userId = (String) auth.getPrincipal();
        return ApiResponse.ok(buildObjectOrgStructure(dataScopeService.getVisibleOrgIds(userId)));
    }

    @GetMapping("/departments")
    public ApiResponse<List<DepartmentStructureItem>> departments(Authentication auth) {
        String userId = (String) auth.getPrincipal();
        return ApiResponse.ok(buildObjectOrgStructure(dataScopeService.getVisibleOrgIds(userId)).departments());
    }

    @GetMapping
    public ApiResponse<List<ExternalObject>> list(@RequestParam(required = false) ObjectType type,
                                                  @RequestParam(required = false) String orgId,
                                                  @RequestParam(required = false) String deptId,
                                                  @RequestParam(required = false) String name,
                                                  @RequestParam(required = false) String customerRole,
                                                  @RequestParam(required = false) String customerScale,
                                                  Authentication auth) {
        RequestAccessContext ctx = buildRequestContext(auth);
        List<ExternalObject> all = service.list(type, orgId, deptId, name, customerRole, customerScale);
        return ApiResponse.ok(filterAccessibleObjects(all, ctx));
    }

    @GetMapping("/page")
    public ApiResponse<PageResponse<ExternalObject>> page(@RequestParam(defaultValue = "1") long current,
                                                          @RequestParam(defaultValue = "20") long size,
                                                          @RequestParam(required = false) ObjectType type,
                                                          @RequestParam(required = false) String orgId,
                                                          @RequestParam(required = false) String deptId,
                                                          @RequestParam(required = false) String name,
                                                          @RequestParam(required = false) String customerRole,
                                                          @RequestParam(required = false) String customerScale,
                                                          Authentication auth) {
        RequestAccessContext ctx = buildRequestContext(auth);
        List<ExternalObject> all = filterAccessibleObjects(service.list(type, orgId, deptId, name, customerRole, customerScale), ctx);
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

    private record OrgNode(String id, String name, String parentId) {}

    private record OrgStructureItem(String id, String name, String parentId) {}

    private record DepartmentStructureItem(String id, String name, String parentId, String orgId) {}

    private record OrgStructureResponse(
        List<OrgStructureItem> orgs,
        List<DepartmentStructureItem> departments,
        List<OrgStructureItem> allNodes
    ) {}
}
