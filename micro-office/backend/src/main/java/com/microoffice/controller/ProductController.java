package com.microoffice.controller;

import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.microoffice.dto.response.ApiResponse;
import com.microoffice.entity.Product;
import com.microoffice.service.ProductService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/products")
@RequiredArgsConstructor
public class ProductController {
    private final ProductService service;

    @GetMapping
    public ApiResponse<Page<Product>> list(@RequestParam(defaultValue = "1") long current,
                                           @RequestParam(defaultValue = "20") long size,
                                           @RequestParam(required = false) String categoryCode,
                                           @RequestParam(required = false) String code,
                                           @RequestParam(required = false) String name) {
        return ApiResponse.ok(service.list(current, size, categoryCode, code, name));
    }

    @GetMapping("/{id}")
    public ApiResponse<Product> get(@PathVariable String id) { return ApiResponse.ok(service.getById(id)); }

    @PostMapping
    public ApiResponse<Product> create(@RequestBody Product p) { return ApiResponse.ok(service.create(p)); }

    @PutMapping("/{id}")
    public ApiResponse<Void> update(@PathVariable String id, @RequestBody Product p) {
        p.setId(id); service.update(p); return ApiResponse.ok(null);
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Void> delete(@PathVariable String id) { service.delete(id); return ApiResponse.ok(null); }
}
