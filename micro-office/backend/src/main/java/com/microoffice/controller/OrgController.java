package com.microoffice.controller;

import com.microoffice.dto.response.ApiResponse;
import com.microoffice.entity.Organization;
import com.microoffice.service.DataScopeService;
import com.microoffice.service.OrgService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import java.util.List;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/orgs")
@RequiredArgsConstructor
public class OrgController {
    private final OrgService orgService;
    private final DataScopeService dataScopeService;

    @GetMapping
    public ApiResponse<List<Organization>> list(Authentication auth) {
        String userId = (String) auth.getPrincipal();
        List<String> visibleOrgIds = dataScopeService.getVisibleOrgIds(userId);
        return ApiResponse.ok(orgService.list().stream()
            .filter(o -> visibleOrgIds.contains(o.getId()))
            .collect(Collectors.toList()));
    }

    @GetMapping("/{id}")
    public ApiResponse<Organization> get(@PathVariable String id) { return ApiResponse.ok(orgService.getById(id)); }

    @GetMapping("/{id}/children")
    public ApiResponse<List<Organization>> children(@PathVariable String id) { return ApiResponse.ok(orgService.children(id)); }

    @PostMapping
    public ApiResponse<Organization> create(@RequestBody Organization org) { return ApiResponse.ok(orgService.create(org)); }

    @PutMapping("/{id}")
    public ApiResponse<Void> update(@PathVariable String id, @RequestBody Organization org) {
        org.setId(id); orgService.update(org); return ApiResponse.ok(null);
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Void> delete(@PathVariable String id) { orgService.delete(id); return ApiResponse.ok(null); }
}
