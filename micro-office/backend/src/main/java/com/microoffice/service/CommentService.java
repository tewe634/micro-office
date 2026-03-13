package com.microoffice.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.microoffice.entity.Comment;
import com.microoffice.entity.ModuleConfig;
import com.microoffice.mapper.CommentMapper;
import com.microoffice.mapper.ModuleConfigMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.*;

@Service
@RequiredArgsConstructor
public class CommentService {

    private final CommentMapper commentMapper;
    private final ModuleConfigMapper moduleConfigMapper;

    public Comment create(Integer threadId, Integer authorId, String content) {
        Comment c = new Comment();
        c.setThreadId(threadId);
        c.setAuthorId(authorId);
        c.setContent(content);
        // 关键词匹配，生成模块触发信息
        c.setTriggers(matchModuleTriggers(content));
        commentMapper.insert(c);
        return c;
    }

    public List<Comment> listByThread(Integer threadId) {
        return commentMapper.selectList(new LambdaQueryWrapper<Comment>()
                .eq(Comment::getThreadId, threadId)
                .orderByAsc(Comment::getCreatedAt));
    }

    /** 评论关键词匹配模块配置 */
    private List<Map<String, Object>> matchModuleTriggers(String content) {
        List<ModuleConfig> configs = moduleConfigMapper.selectList(null);
        List<Map<String, Object>> triggers = new ArrayList<>();
        for (ModuleConfig mc : configs) {
            if (content.contains(mc.getKeyword())) {
                triggers.add(Map.of(
                    "moduleConfigId", mc.getId(),
                    "keyword", mc.getKeyword(),
                    "moduleName", mc.getModuleName(),
                    "moduleUrl", mc.getModuleUrl()
                ));
            }
        }
        return triggers.isEmpty() ? null : triggers;
    }
}
