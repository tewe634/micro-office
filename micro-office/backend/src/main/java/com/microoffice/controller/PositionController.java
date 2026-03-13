package com.microoffice.controller;

import com.microoffice.dto.response.ApiResponse;
import com.microoffice.entity.Position;
import com.microoffice.service.PositionService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/api/positions")
@RequiredArgsConstructor
public class PositionController {
    private final PositionService service;

    @GetMapping
    public ApiResponse<List<Position>> list() { return ApiResponse.ok(service.list()); }

    @GetMapping("/{id}")
    public ApiResponse<Position> get(@PathVariable Integer id) { return ApiResponse.ok(service.getById(id)); }

    @PostMapping
    public ApiResponse<Position> create(@RequestBody Position p) { return ApiResponse.ok(service.create(p)); }

    @PutMapping("/{id}")
    public ApiResponse<Void> update(@PathVariable Integer id, @RequestBody Position p) {
        p.setId(id); service.update(p); return ApiResponse.ok(null);
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Void> delete(@PathVariable Integer id) { service.delete(id); return ApiResponse.ok(null); }
}
