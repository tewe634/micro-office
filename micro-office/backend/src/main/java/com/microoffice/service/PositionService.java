package com.microoffice.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.microoffice.entity.Position;
import com.microoffice.mapper.PositionMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
@RequiredArgsConstructor
public class PositionService {
    private final PositionMapper mapper;

    public List<Position> list() {
        return mapper.selectList(buildQuery());
    }

    public Page<Position> page(long current, long size) {
        return mapper.selectPage(new Page<>(current, size), buildQuery());
    }

    private LambdaQueryWrapper<Position> buildQuery() {
        LambdaQueryWrapper<Position> q = new LambdaQueryWrapper<>();
        q.orderByAsc(Position::getCode);
        return q;
    }

    public Position getById(String id) { return mapper.selectById(id); }
    public Position create(Position p) { mapper.insert(p); return p; }
    public void update(Position p) { mapper.updateById(p); }
    public void delete(String id) { mapper.deleteById(id); }
}
