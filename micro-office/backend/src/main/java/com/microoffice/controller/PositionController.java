package com.microoffice.controller;

import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.microoffice.dto.response.ApiResponse;
import com.microoffice.dto.response.PageResponse;
import com.microoffice.entity.Position;
import com.microoffice.service.MenuPermissionService;
import com.microoffice.service.PositionService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/positions")
@RequiredArgsConstructor
public class PositionController {
    private final PositionService service;
    private final MenuPermissionService menuPermissionService;

    @GetMapping
    public ApiResponse<List<Position>> list(Authentication auth) {
        String currentUserId = (String) auth.getPrincipal();
        menuPermissionService.requireMenu(currentUserId, "/users");
        return ApiResponse.ok(service.list(currentUserId));
    }

    @GetMapping("/page")
    public ApiResponse<PageResponse<Position>> page(@RequestParam(defaultValue = "1") long current,
                                                    @RequestParam(defaultValue = "20") long size,
                                                    Authentication auth) {
        String currentUserId = (String) auth.getPrincipal();
        menuPermissionService.requireMenu(currentUserId, "/users");
        Page<Position> page = service.page(current, size, currentUserId);
        return ApiResponse.ok(new PageResponse<>(page.getCurrent(), page.getSize(), page.getTotal(), page.getRecords()));
    }

    @GetMapping("/{id}")
    public ApiResponse<Position> get(@PathVariable String id, Authentication auth) {
        String currentUserId = (String) auth.getPrincipal();
        menuPermissionService.requireMenu(currentUserId, "/users");
        return ApiResponse.ok(service.getById(id, currentUserId));
    }

    @PostMapping
    public ApiResponse<Position> create(@RequestBody Position p, Authentication auth) {
        String currentUserId = (String) auth.getPrincipal();
        menuPermissionService.requireMenu(currentUserId, "/users");
        return ApiResponse.ok(service.create(p));
    }

    @PutMapping("/{id}")
    public ApiResponse<Void> update(@PathVariable String id, @RequestBody Position p, Authentication auth) {
        String currentUserId = (String) auth.getPrincipal();
        menuPermissionService.requireMenu(currentUserId, "/users");
        p.setId(id);
        service.update(p);
        return ApiResponse.ok(null);
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Void> delete(@PathVariable String id, Authentication auth) {
        String currentUserId = (String) auth.getPrincipal();
        menuPermissionService.requireMenu(currentUserId, "/users");
        service.delete(id);
        return ApiResponse.ok(null);
    }
}
