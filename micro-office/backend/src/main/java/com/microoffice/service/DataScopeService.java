package com.microoffice.service;

import com.microoffice.entity.SysUser;
import com.microoffice.mapper.SysUserMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;

@Service
@RequiredArgsConstructor
public class DataScopeService {
    private final JdbcTemplate jdbc;
    private final SysUserMapper userMapper;

    public boolean isGlobalAdmin(String userId) {
        SysUser user = userMapper.selectById(userId);
        if (user == null) return false;
        return "ADMIN".equals(user.getRole()) || "SYS_ADMIN".equals(user.getRole());
    }

    public List<String> getScopeOrgIds(String userId) {
        SysUser user = userMapper.selectById(userId);
        if (user == null || user.getOrgId() == null) return List.of();
        return jdbc.queryForList(
            "WITH RECURSIVE sub AS (" +
                "SELECT id FROM organization WHERE id = ? " +
                "UNION ALL " +
                "SELECT o.id FROM organization o JOIN sub s ON o.parent_id = s.id" +
            ") SELECT id FROM sub",
            String.class,
            user.getOrgId()
        );
    }

    public List<String> getVisibleOrgIds(String userId) {
        if (isGlobalAdmin(userId)) {
            return jdbc.queryForList("SELECT id FROM organization", String.class);
        }
        return new ArrayList<>(getScopeOrgIds(userId));
    }
}
