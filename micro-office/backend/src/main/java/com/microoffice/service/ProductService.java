package com.microoffice.service;

import com.microoffice.entity.Product;
import com.microoffice.mapper.ProductMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import java.util.List;

@Service
@RequiredArgsConstructor
public class ProductService {
    private final ProductMapper mapper;

    public List<Product> list() { return mapper.selectList(null); }
    public Product getById(Integer id) { return mapper.selectById(id); }
    public Product create(Product p) { mapper.insert(p); return p; }
    public void update(Product p) { mapper.updateById(p); }
    public void delete(Integer id) { mapper.deleteById(id); }
}
