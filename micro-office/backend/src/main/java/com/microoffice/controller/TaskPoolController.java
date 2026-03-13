package com.microoffice.controller;

import com.microoffice.dto.response.ApiResponse;
import com.microoffice.entity.WorkNode;
import com.microoffice.service.NodeService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/api/taskpool")
@RequiredArgsConstructor
public class TaskPoolController {
    private final NodeService nodeService;

    @GetMapping
    public ApiResponse<List<WorkNode>> list(@RequestParam Integer positionId) {
        return ApiResponse.ok(nodeService.getPoolTasks(positionId));
    }

    @PostMapping("/{nodeId}/claim")
    public ApiResponse<WorkNode> claim(@PathVariable Integer nodeId, Authentication auth) {
        return ApiResponse.ok(nodeService.claim(nodeId, (Integer) auth.getPrincipal()));
    }
}
