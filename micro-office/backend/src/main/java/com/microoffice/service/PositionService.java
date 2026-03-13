package com.microoffice.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.microoffice.entity.Position;
import com.microoffice.mapper.PositionMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import java.util.List;

@Service
@RequiredArgsConstructor
public class PositionService {
    private final PositionMapper mapper;

    public List<Position> list() { return mapper.selectList(null); }
    public Position getById(Integer id) { return mapper.selectById(id); }
    public Position create(Position p) { mapper.insert(p); return p; }
    public void update(Position p) { mapper.updateById(p); }
    public void delete(Integer id) { mapper.deleteById(id); }
}
