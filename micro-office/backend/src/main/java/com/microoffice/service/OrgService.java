package com.microoffice.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.microoffice.entity.ExternalObject;
import com.microoffice.entity.Organization;
import com.microoffice.entity.SysUser;
import com.microoffice.mapper.ExternalObjectMapper;
import com.microoffice.mapper.OrganizationMapper;
import com.microoffice.mapper.SysUserMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.text.Collator;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

@Service
@RequiredArgsConstructor
public class OrgService {
    private static final Collator ZH_COLLATOR = Collator.getInstance(Locale.CHINA);
    private static final Comparator<Organization> ORG_COMPARATOR = Comparator
        .comparing((Organization org) -> org.getSortOrder() == null ? 0 : org.getSortOrder())
        .thenComparing(org -> org.getName() == null ? "" : org.getName(), ZH_COLLATOR)
        .thenComparing(org -> org.getId() == null ? "" : org.getId());

    private final OrganizationMapper mapper;
    private final SysUserMapper userMapper;
    private final ExternalObjectMapper externalObjectMapper;

    public List<Organization> list() {
        List<Organization> orgs = mapper.selectList(null);
        if (orgs.isEmpty()) {
            return orgs;
        }

        Map<String, Organization> orgById = new LinkedHashMap<>();
        for (Organization org : orgs) {
            if (org.getId() != null) {
                orgById.put(org.getId(), org);
            }
        }

        List<Organization> roots = new ArrayList<>();
        Map<String, List<Organization>> childrenByParent = new LinkedHashMap<>();
        for (Organization org : orgs) {
            String parentId = normalizeId(org.getParentId());
            if (parentId == null || !orgById.containsKey(parentId)) {
                roots.add(org);
                continue;
            }
            childrenByParent.computeIfAbsent(parentId, key -> new ArrayList<>()).add(org);
        }

        List<Organization> ordered = new ArrayList<>(orgs.size());
        Set<String> visited = new LinkedHashSet<>();

        roots.stream()
            .sorted(ORG_COMPARATOR)
            .forEach(root -> appendOrg(root, childrenByParent, ordered, visited));

        orgs.stream()
            .filter(org -> !visited.contains(org.getId()))
            .sorted(ORG_COMPARATOR)
            .forEach(org -> appendOrg(org, childrenByParent, ordered, visited));

        return ordered;
    }

    public Organization getById(String id) { return mapper.selectById(id); }
    public Organization create(Organization org) { mapper.insert(org); return org; }
    public void update(Organization org) { mapper.updateById(org); }

    public void delete(String id) {
        long childOrgCount = mapper.selectCount(new LambdaQueryWrapper<Organization>()
            .eq(Organization::getParentId, id));
        if (childOrgCount > 0) {
            throw new RuntimeException("该组织下还有子组织，不能删除");
        }

        long userCount = userMapper.selectCount(new LambdaQueryWrapper<SysUser>()
            .eq(SysUser::getOrgId, id));
        if (userCount > 0) {
            throw new RuntimeException("该组织下还有用户，不能删除");
        }

        long objectCount = externalObjectMapper.selectCount(new LambdaQueryWrapper<ExternalObject>()
            .eq(ExternalObject::getOrgId, id));
        if (objectCount > 0) {
            throw new RuntimeException("该组织下还有客户/供应商数据，不能删除");
        }

        mapper.deleteById(id);
    }

    public List<Organization> children(String parentId) {
        return mapper.selectList(new LambdaQueryWrapper<Organization>()
            .eq(Organization::getParentId, parentId)
            .orderByAsc(Organization::getSortOrder, Organization::getName));
    }

    private void appendOrg(Organization org,
                           Map<String, List<Organization>> childrenByParent,
                           List<Organization> ordered,
                           Set<String> visited) {
        if (org == null || !visited.add(org.getId())) {
            return;
        }
        ordered.add(org);
        childrenByParent.getOrDefault(org.getId(), List.of()).stream()
            .sorted(ORG_COMPARATOR)
            .forEach(child -> appendOrg(child, childrenByParent, ordered, visited));
    }

    private String normalizeId(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        return value;
    }
}
