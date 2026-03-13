package com.microoffice.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.microoffice.entity.Organization;
import com.microoffice.mapper.OrganizationMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import java.util.List;

@Service
@RequiredArgsConstructor
public class OrgService {
    private final OrganizationMapper mapper;

    public List<Organization> list() { return mapper.selectList(null); }
    public Organization getById(Integer id) { return mapper.selectById(id); }
    public Organization create(Organization org) { mapper.insert(org); return org; }
    public void update(Organization org) { mapper.updateById(org); }
    public void delete(Integer id) { mapper.deleteById(id); }

    public List<Organization> children(Integer parentId) {
        return mapper.selectList(new LambdaQueryWrapper<Organization>()
                .eq(Organization::getParentId, parentId).orderByAsc(Organization::getSortOrder));
    }
}
