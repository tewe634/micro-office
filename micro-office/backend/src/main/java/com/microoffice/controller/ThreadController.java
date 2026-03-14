package com.microoffice.controller;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.microoffice.dto.request.CreateThreadRequest;
import com.microoffice.dto.response.ApiResponse;
import com.microoffice.entity.WorkThread;
import com.microoffice.mapper.WorkThreadMapper;
import com.microoffice.service.ThreadService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/api/threads")
@RequiredArgsConstructor
public class ThreadController {
    private final ThreadService threadService;
    private final WorkThreadMapper threadMapper;

    @GetMapping
    public ApiResponse<List<WorkThread>> list(@RequestParam(required = false) String status, Authentication auth) {
        var qw = new LambdaQueryWrapper<WorkThread>().orderByDesc(WorkThread::getCreatedAt);
        if (status != null) qw.eq(WorkThread::getStatus, status);
        return ApiResponse.ok(threadMapper.selectList(qw));
    }

    @PostMapping
    public ApiResponse<WorkThread> create(@Valid @RequestBody CreateThreadRequest req, Authentication auth) {
        return ApiResponse.ok(threadService.create(req, (Integer) auth.getPrincipal()));
    }

    @GetMapping("/{id}")
    public ApiResponse<WorkThread> get(@PathVariable Integer id) {
        return ApiResponse.ok(threadService.getById(id));
    }

    @PutMapping("/{id}")
    public ApiResponse<Void> update(@PathVariable Integer id, @RequestBody java.util.Map<String, Object> body) {
        WorkThread t = threadMapper.selectById(id);
        if (t == null) throw new RuntimeException("工作不存在");
        if (body.containsKey("title")) t.setTitle((String) body.get("title"));
        if (body.containsKey("content")) t.setContent((String) body.get("content"));
        if (body.containsKey("status")) t.setStatus(com.microoffice.enums.ThreadStatus.valueOf((String) body.get("status")));
        threadMapper.updateById(t);
        return ApiResponse.ok(null);
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Void> delete(@PathVariable Integer id) {
        threadMapper.deleteById(id);
        return ApiResponse.ok(null);
    }
}
