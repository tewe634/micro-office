package com.microoffice.controller;

import com.microoffice.dto.response.ApiResponse;
import com.microoffice.entity.Comment;
import com.microoffice.mapper.CommentMapper;
import com.microoffice.service.CommentService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import java.util.List;
import java.util.Map;

@RestController
@RequiredArgsConstructor
public class CommentController {
    private final CommentService commentService;
    private final CommentMapper commentMapper;

    @GetMapping("/api/threads/{threadId}/comments")
    public ApiResponse<List<Comment>> list(@PathVariable Integer threadId) {
        return ApiResponse.ok(commentService.listByThread(threadId));
    }

    @PostMapping("/api/threads/{threadId}/comments")
    public ApiResponse<Comment> create(@PathVariable Integer threadId, @RequestBody Map<String, String> body, Authentication auth) {
        return ApiResponse.ok(commentService.create(threadId, (Integer) auth.getPrincipal(), body.get("content")));
    }

    @PutMapping("/api/comments/{id}")
    public ApiResponse<Void> update(@PathVariable Integer id, @RequestBody Map<String, String> body) {
        Comment c = commentMapper.selectById(id);
        if (c == null) throw new RuntimeException("评论不存在");
        c.setContent(body.get("content"));
        commentMapper.updateById(c);
        return ApiResponse.ok(null);
    }

    @DeleteMapping("/api/comments/{id}")
    public ApiResponse<Void> delete(@PathVariable Integer id) {
        commentMapper.deleteById(id);
        return ApiResponse.ok(null);
    }
}
