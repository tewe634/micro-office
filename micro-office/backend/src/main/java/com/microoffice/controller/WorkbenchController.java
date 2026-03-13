package com.microoffice.controller;

import com.microoffice.dto.response.ApiResponse;
import com.microoffice.entity.WorkNode;
import com.microoffice.entity.WorkThread;
import com.microoffice.service.NodeService;
import com.microoffice.service.ThreadService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/workbench")
@RequiredArgsConstructor
public class WorkbenchController {
    private final ThreadService threadService;
    private final NodeService nodeService;

    @GetMapping
    public ApiResponse<Map<String, Object>> index(
            @RequestParam(defaultValue = "todo") String view, Authentication auth) {
        Integer userId = (Integer) auth.getPrincipal();
        return switch (view) {
            case "active" -> ApiResponse.ok(Map.of("threads", threadService.getActive(userId)));
            case "done" -> ApiResponse.ok(Map.of("threads", threadService.getCompleted(userId)));
            case "todo" -> ApiResponse.ok(Map.of("nodes", nodeService.getTodoNodes(userId)));
            default -> ApiResponse.error(400, "无效视图参数");
        };
    }
}
