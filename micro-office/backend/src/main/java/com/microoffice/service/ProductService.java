package com.microoffice.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.microoffice.entity.Product;
import com.microoffice.mapper.ProductMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

@Service
@RequiredArgsConstructor
public class ProductService {
    private static final String DEFAULT_PRODUCT_LINE = "ABB";

    private final ProductMapper mapper;

    public Page<Product> list(long current,
                              long size,
                              String categoryCode,
                              String code,
                              String name,
                              String productLine,
                              String structureLevel1,
                              String structureLevel2,
                              String seriesDisplayName) {
        LambdaQueryWrapper<Product> q = new LambdaQueryWrapper<>();
        if (StringUtils.hasText(productLine)) q.eq(Product::getProductLine, productLine);
        if (StringUtils.hasText(categoryCode)) q.eq(Product::getCategoryCode, categoryCode);
        if (StringUtils.hasText(code)) q.like(Product::getCode, code);
        if (StringUtils.hasText(name)) q.like(Product::getName, name);
        if (StringUtils.hasText(structureLevel1)) q.eq(Product::getStructureLevel1, structureLevel1.trim());
        if (StringUtils.hasText(structureLevel2)) q.like(Product::getStructureLevel2, structureLevel2.trim());
        if (StringUtils.hasText(seriesDisplayName)) q.like(Product::getSeriesDisplayName, seriesDisplayName.trim());
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
        normalizeStructure(p);
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
        normalizeStructure(p);
        mapper.updateById(p);
    }

    public void delete(String id) {
        long childProductCount = mapper.selectCount(new LambdaQueryWrapper<Product>()
            .eq(Product::getParentId, id));
        if (childProductCount > 0) {
            throw new RuntimeException("该产品下还有子产品，不能删除");
        }

        mapper.deleteById(id);
    }

    private void normalizeStructure(Product product) {
        product.setStructureLevel1(normalizeText(product.getStructureLevel1()));
        product.setStructureLevel2(normalizeText(product.getStructureLevel2()));
        product.setSeriesDisplayName(normalizeText(product.getSeriesDisplayName()));
    }

    private String normalizeText(String value) {
        return StringUtils.hasText(value) ? value.trim() : null;
    }
}
