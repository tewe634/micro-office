package com.microoffice.controller;

import com.microoffice.dto.response.ApiResponse;
import com.microoffice.entity.Comment;
import com.microoffice.service.CommentService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/threads/{threadId}/comments")
@RequiredArgsConstructor
public class CommentController {
    private final CommentService commentService;

    @GetMapping
    public ApiResponse<List<Comment>> list(@PathVariable Integer threadId) {
        return ApiResponse.ok(commentService.listByThread(threadId));
    }

    @PostMapping
    public ApiResponse<Comment> create(@PathVariable Integer threadId, @RequestBody Map<String, String> body, Authentication auth) {
        return ApiResponse.ok(commentService.create(threadId, (Integer) auth.getPrincipal(), body.get("content")));
    }
}
