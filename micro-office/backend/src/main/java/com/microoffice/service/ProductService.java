package com.microoffice.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.microoffice.entity.Product;
import com.microoffice.entity.WorkThread;
import com.microoffice.mapper.ProductMapper;
import com.microoffice.mapper.WorkThreadMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

@Service
@RequiredArgsConstructor
public class ProductService {
    private static final String DEFAULT_PRODUCT_LINE = "ABB";

    private final ProductMapper mapper;
    private final WorkThreadMapper workThreadMapper;

    public Page<Product> list(long current, long size, String categoryCode, String code, String name, String productLine) {
        LambdaQueryWrapper<Product> q = new LambdaQueryWrapper<>();
        if (StringUtils.hasText(productLine)) q.eq(Product::getProductLine, productLine);
        if (StringUtils.hasText(categoryCode)) q.eq(Product::getCategoryCode, categoryCode);
        if (StringUtils.hasText(code)) q.like(Product::getCode, code);
        if (StringUtils.hasText(name)) q.like(Product::getName, name);
        q.orderByAsc(Product::getCode);
        return mapper.selectPage(new Page<>(current, size), q);
    }

    public Product getById(String id) {
        return mapper.selectById(id);
    }

    public Product create(Product p) {
        if (!StringUtils.hasText(p.getProductLine())) {
            p.setProductLine(DEFAULT_PRODUCT_LINE);
        }
        mapper.insert(p);
        return p;
    }

    public void update(Product p) {
        if (!StringUtils.hasText(p.getProductLine())) {
            Product existing = mapper.selectById(p.getId());
            p.setProductLine(existing != null && StringUtils.hasText(existing.getProductLine())
                ? existing.getProductLine()
                : DEFAULT_PRODUCT_LINE);
        }
        mapper.updateById(p);
    }

    public void delete(String id) {
        long childProductCount = mapper.selectCount(new LambdaQueryWrapper<Product>()
            .eq(Product::getParentId, id));
        if (childProductCount > 0) {
            throw new RuntimeException("该产品下还有子产品，不能删除");
        }

        long threadCount = workThreadMapper.selectCount(new LambdaQueryWrapper<WorkThread>()
            .eq(WorkThread::getProductId, id));
        if (threadCount > 0) {
            throw new RuntimeException("该产品已被工作流引用，不能删除");
        }

        mapper.deleteById(id);
    }
}
