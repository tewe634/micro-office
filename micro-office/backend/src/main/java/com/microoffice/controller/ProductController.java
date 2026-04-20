package com.microoffice.controller;

import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.microoffice.dto.response.ApiResponse;
import com.microoffice.entity.Product;
import com.microoffice.entity.SysUser;
import com.microoffice.mapper.SysUserMapper;
import com.microoffice.service.MenuPermissionService;
import com.microoffice.service.ProductService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/products")
@RequiredArgsConstructor
public class ProductController {
    private final ProductService service;
    private final MenuPermissionService menuPermissionService;
    private final SysUserMapper userMapper;

    @GetMapping
    public ApiResponse<Page<Product>> list(@RequestParam(defaultValue = "1") long current,
                                           @RequestParam(defaultValue = "20") long size,
                                           @RequestParam(required = false) String categoryCode,
                                           @RequestParam(required = false) String code,
                                           @RequestParam(required = false) String name,
                                           @RequestParam(required = false) String productLine,
                                           @RequestParam(required = false) String structureLevel1,
                                           @RequestParam(required = false) String structureLevel2,
                                           @RequestParam(required = false) String seriesDisplayName,
                                           Authentication auth) {
        requireProductRead((String) auth.getPrincipal());
        return ApiResponse.ok(service.list(current, size, categoryCode, code, name, productLine, structureLevel1, structureLevel2, seriesDisplayName));
    }

    @GetMapping("/{id}")
    public ApiResponse<Product> get(@PathVariable String id, Authentication auth) {
        requireProductRead((String) auth.getPrincipal());
        return ApiResponse.ok(service.getById(id));
    }

    @PostMapping
    public ApiResponse<Product> create(@RequestBody Product p, Authentication auth) {
        requireProductWrite((String) auth.getPrincipal());
        return ApiResponse.ok(service.create(p));
    }

    @PutMapping("/{id}")
    public ApiResponse<Void> update(@PathVariable String id, @RequestBody Product p, Authentication auth) {
        requireProductWrite((String) auth.getPrincipal());
        p.setId(id);
        service.update(p);
        return ApiResponse.ok(null);
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Void> delete(@PathVariable String id, Authentication auth) {
        requireProductWrite((String) auth.getPrincipal());
        service.delete(id);
        return ApiResponse.ok(null);
    }

    private void requireProductRead(String userId) {
        menuPermissionService.requireMenu(userId, "/products");
    }

    private void requireProductWrite(String userId) {
        menuPermissionService.requireMenu(userId, "/products");
        SysUser user = userMapper.selectById(userId);
        String role = user == null ? null : user.getRole();
        if ("STAFF".equals(role)) {
            throw new AccessDeniedException("无权限访问");
        }
    }
}
