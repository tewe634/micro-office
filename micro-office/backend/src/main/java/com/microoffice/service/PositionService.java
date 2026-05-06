package com.microoffice.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.microoffice.entity.Position;
import com.microoffice.entity.SysUser;
import com.microoffice.mapper.PositionMapper;
import com.microoffice.mapper.SysUserMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

@Service
@RequiredArgsConstructor
public class PositionService {
    private final PositionMapper mapper;
    private final SysUserMapper userMapper;
    private final JdbcTemplate jdbc;
    private final DataScopeService dataScopeService;

    public List<Position> list(String currentUserId) {
        return mapper.selectList(buildQuery(currentUserId));
    }

    public Page<Position> page(long current, long size, String currentUserId) {
        return mapper.selectPage(new Page<>(current, size), buildQuery(currentUserId));
    }

    private LambdaQueryWrapper<Position> buildQuery(String currentUserId) {
        LambdaQueryWrapper<Position> q = new LambdaQueryWrapper<>();
        if (!canManagePersonnel(currentUserId)) {
            List<String> visibleOrgIds = dataScopeService.getVisibleOrgIds(currentUserId);
            if (visibleOrgIds.isEmpty()) {
                q.apply("1 = 0");
                return q;
            }
            Set<String> positionIds = new LinkedHashSet<>();
            positionIds.addAll(jdbc.queryForList(
                "SELECT DISTINCT primary_position_id FROM sys_user WHERE primary_position_id IS NOT NULL AND org_id = ANY(?::varchar[])",
                String.class,
                (Object) visibleOrgIds.toArray(new String[0])
            ));
            positionIds.addAll(jdbc.queryForList(
                "SELECT DISTINCT up.position_id FROM user_position up JOIN sys_user su ON su.id = up.user_id WHERE su.org_id = ANY(?::varchar[])",
                String.class,
                (Object) visibleOrgIds.toArray(new String[0])
            ));
            if (positionIds.isEmpty()) {
                q.apply("1 = 0");
                return q;
            }
            q.in(Position::getId, positionIds);
        }
        q.orderByAsc(Position::getCode);
        return q;
    }

    public Position getById(String id, String currentUserId) {
        Position position = mapper.selectById(id);
        if (position == null || canManagePersonnel(currentUserId)) return position;
        List<Position> positions = mapper.selectList(buildQuery(currentUserId));
        return positions.stream().anyMatch(p -> p.getId().equals(id)) ? position : null;
    }

    public Position getById(String id) { return mapper.selectById(id); }
    public Position create(Position p) { mapper.insert(p); return p; }
    public void update(Position p) { mapper.updateById(p); }
    public void delete(String id) { mapper.deleteById(id); }

    private boolean canManagePersonnel(String currentUserId) {
        SysUser currentUser = userMapper.selectById(currentUserId);
        if (currentUser == null) return false;
        return "ADMIN".equals(currentUser.getRole()) || "HR".equals(currentUser.getRole());
    }
}
