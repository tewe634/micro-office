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

import java.util.List;

@Service
@RequiredArgsConstructor
public class OrgService {
    private final OrganizationMapper mapper;
    private final SysUserMapper userMapper;
    private final ExternalObjectMapper externalObjectMapper;

    public List<Organization> list() { return mapper.selectList(null); }
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
                .eq(Organization::getParentId, parentId).orderByAsc(Organization::getSortOrder));
    }
}
