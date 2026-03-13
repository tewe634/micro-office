package com.microoffice.controller;

import com.microoffice.dto.response.ApiResponse;
import com.microoffice.entity.Product;
import com.microoffice.service.ProductService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/api/products")
@RequiredArgsConstructor
public class ProductController {
    private final ProductService service;

    @GetMapping
    public ApiResponse<List<Product>> list() { return ApiResponse.ok(service.list()); }

    @GetMapping("/{id}")
    public ApiResponse<Product> get(@PathVariable Integer id) { return ApiResponse.ok(service.getById(id)); }

    @PostMapping
    public ApiResponse<Product> create(@RequestBody Product p) { return ApiResponse.ok(service.create(p)); }

    @PutMapping("/{id}")
    public ApiResponse<Void> update(@PathVariable Integer id, @RequestBody Product p) {
        p.setId(id); service.update(p); return ApiResponse.ok(null);
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Void> delete(@PathVariable Integer id) { service.delete(id); return ApiResponse.ok(null); }
}
