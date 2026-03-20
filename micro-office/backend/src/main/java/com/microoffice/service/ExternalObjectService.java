package com.microoffice.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.microoffice.entity.ExternalObject;
import com.microoffice.enums.ObjectType;
import com.microoffice.mapper.ExternalObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
@RequiredArgsConstructor
public class ExternalObjectService {
    private final ExternalObjectMapper mapper;
    private final JdbcTemplate jdbc;

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

    public ExternalObject getById(String id) {
        return mapper.selectById(id);
    }

    public ExternalObject create(ExternalObject obj) {
        sanitizeByType(obj);
        mapper.insert(obj);
        return obj;
    }

    public void update(ExternalObject obj) {
        sanitizeByType(obj);
        jdbc.update(
            "UPDATE external_object SET " +
                "type = ?::object_type, " +
                "name = ?, contact = ?, phone = ?, address = ?, remark = ?, " +
                "account_no = ?, subject_code = ?, org_id = ?, dept_id = ?, owner_id = ?, industry = ?, updated_at = NOW() " +
            "WHERE id = ?",
            obj.getType() == null ? null : obj.getType().name(),
            obj.getName(),
            obj.getContact(),
            obj.getPhone(),
            obj.getAddress(),
            obj.getRemark(),
            obj.getAccountNo(),
            obj.getSubjectCode(),
            obj.getOrgId(),
            obj.getDeptId(),
            obj.getOwnerId(),
            obj.getIndustry(),
            obj.getId()
        );
    }

    public void delete(String id) {
        mapper.deleteById(id);
    }

    private void sanitizeByType(ExternalObject obj) {
        if (obj.getType() != ObjectType.CUSTOMER) {
            obj.setIndustry(null);
        }
    }
}
