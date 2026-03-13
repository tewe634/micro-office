package com.microoffice.controller;

import com.microoffice.dto.response.ApiResponse;
import com.microoffice.entity.ExternalObject;
import com.microoffice.enums.ObjectType;
import com.microoffice.service.ExternalObjectService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/api/objects")
@RequiredArgsConstructor
public class ObjectController {
    private final ExternalObjectService service;

    @GetMapping
    public ApiResponse<List<ExternalObject>> list(@RequestParam(required = false) ObjectType type) {
        return ApiResponse.ok(service.list(type));
    }

    @GetMapping("/{id}")
    public ApiResponse<ExternalObject> get(@PathVariable Integer id) { return ApiResponse.ok(service.getById(id)); }

    @PostMapping
    public ApiResponse<ExternalObject> create(@RequestBody ExternalObject obj) { return ApiResponse.ok(service.create(obj)); }

    @PutMapping("/{id}")
    public ApiResponse<Void> update(@PathVariable Integer id, @RequestBody ExternalObject obj) {
        obj.setId(id); service.update(obj); return ApiResponse.ok(null);
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Void> delete(@PathVariable Integer id) { service.delete(id); return ApiResponse.ok(null); }
}
