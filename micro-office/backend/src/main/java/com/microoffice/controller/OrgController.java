package com.microoffice.controller;

import com.microoffice.dto.response.ApiResponse;
import com.microoffice.entity.Organization;
import com.microoffice.service.OrgService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/api/orgs")
@RequiredArgsConstructor
public class OrgController {
    private final OrgService orgService;

    @GetMapping
    public ApiResponse<List<Organization>> list() { return ApiResponse.ok(orgService.list()); }

    @GetMapping("/{id}")
    public ApiResponse<Organization> get(@PathVariable Integer id) { return ApiResponse.ok(orgService.getById(id)); }

    @GetMapping("/{id}/children")
    public ApiResponse<List<Organization>> children(@PathVariable Integer id) { return ApiResponse.ok(orgService.children(id)); }

    @PostMapping
    public ApiResponse<Organization> create(@RequestBody Organization org) { return ApiResponse.ok(orgService.create(org)); }

    @PutMapping("/{id}")
    public ApiResponse<Void> update(@PathVariable Integer id, @RequestBody Organization org) {
        org.setId(id); orgService.update(org); return ApiResponse.ok(null);
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Void> delete(@PathVariable Integer id) { orgService.delete(id); return ApiResponse.ok(null); }
}
