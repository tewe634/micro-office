package com.microoffice.controller;

import com.microoffice.dto.request.CreateThreadRequest;
import com.microoffice.dto.response.ApiResponse;
import com.microoffice.entity.WorkThread;
import com.microoffice.service.ThreadService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/threads")
@RequiredArgsConstructor
public class ThreadController {
    private final ThreadService threadService;

    @PostMapping
    public ApiResponse<WorkThread> create(@Valid @RequestBody CreateThreadRequest req, Authentication auth) {
        return ApiResponse.ok(threadService.create(req, (Integer) auth.getPrincipal()));
    }

    @GetMapping("/{id}")
    public ApiResponse<WorkThread> get(@PathVariable Integer id) {
        return ApiResponse.ok(threadService.getById(id));
    }
}
