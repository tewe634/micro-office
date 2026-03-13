package com.microoffice.service;

import com.microoffice.entity.ModuleConfig;
import com.microoffice.mapper.ModuleConfigMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import java.util.List;

@Service
@RequiredArgsConstructor
public class ModuleConfigService {
    private final ModuleConfigMapper mapper;

    public List<ModuleConfig> list() { return mapper.selectList(null); }
    public ModuleConfig getById(Integer id) { return mapper.selectById(id); }
    public ModuleConfig create(ModuleConfig mc) { mapper.insert(mc); return mc; }
    public void update(ModuleConfig mc) { mapper.updateById(mc); }
    public void delete(Integer id) { mapper.deleteById(id); }
}
