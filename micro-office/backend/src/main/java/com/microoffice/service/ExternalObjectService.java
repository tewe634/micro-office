package com.microoffice.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.microoffice.entity.ExternalObject;
import com.microoffice.enums.ObjectType;
import com.microoffice.mapper.ExternalObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import java.util.List;

@Service
@RequiredArgsConstructor
public class ExternalObjectService {
    private final ExternalObjectMapper mapper;

    public List<ExternalObject> list(ObjectType type, String orgId, String deptId) {
        LambdaQueryWrapper<ExternalObject> q = new LambdaQueryWrapper<>();
        if (type != null) q.eq(ExternalObject::getType, type);
        if (orgId != null) q.eq(ExternalObject::getOrgId, orgId);
        if (deptId != null) q.eq(ExternalObject::getDeptId, deptId);
        q.orderByDesc(ExternalObject::getUpdatedAt)
            .orderByDesc(ExternalObject::getCreatedAt)
            .orderByDesc(ExternalObject::getId);
        return mapper.selectList(q);
    }
    public ExternalObject getById(String id) { return mapper.selectById(id); }
    public ExternalObject create(ExternalObject obj) { mapper.insert(obj); return obj; }
    public void update(ExternalObject obj) { mapper.updateById(obj); }
    public void delete(String id) { mapper.deleteById(id); }
}
