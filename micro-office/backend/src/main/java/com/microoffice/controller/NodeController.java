package com.microoffice.controller;

import com.microoffice.dto.request.CompleteNodeRequest;
import com.microoffice.dto.request.CreateNodeRequest;
import com.microoffice.dto.response.ApiResponse;
import com.microoffice.entity.WorkNode;
import com.microoffice.service.NodeService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class NodeController {
    private final NodeService nodeService;

    @PostMapping("/threads/{threadId}/nodes")
    public ApiResponse<WorkNode> create(@PathVariable Integer threadId, @Valid @RequestBody CreateNodeRequest req) {
        return ApiResponse.ok(nodeService.create(threadId, req));
    }

    @GetMapping("/threads/{threadId}/nodes")
    public ApiResponse<List<WorkNode>> list(@PathVariable Integer threadId) {
        return ApiResponse.ok(nodeService.listByThread(threadId));
    }

    @PutMapping("/nodes/{id}/complete")
    public ApiResponse<WorkNode> complete(@PathVariable Integer id, @RequestBody CompleteNodeRequest req) {
        return ApiResponse.ok(nodeService.complete(id, req));
    }

    @PutMapping("/nodes/{id}/rollback")
    public ApiResponse<Void> rollback(@PathVariable Integer id, @RequestParam Integer targetNodeId) {
        nodeService.rollback(id, targetNodeId);
        return ApiResponse.ok(null);
    }
}
