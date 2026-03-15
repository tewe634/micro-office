package com.microoffice.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.microoffice.dto.request.CreateThreadRequest;
import com.microoffice.entity.WorkThread;
import com.microoffice.enums.ThreadStatus;
import com.microoffice.mapper.WorkThreadMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import java.util.List;

@Service
@RequiredArgsConstructor
public class ThreadService {

    private final WorkThreadMapper threadMapper;
    private final JdbcTemplate jdbc;

    public WorkThread create(CreateThreadRequest req, Integer creatorId) {
        WorkThread t = new WorkThread();
        t.setTitle(req.getTitle());
        t.setContent(req.getContent());
        t.setStatus(ThreadStatus.ACTIVE);
        t.setCreatorId(creatorId);
        t.setObjectId(req.getObjectId());
        t.setTemplateId(req.getTemplateId());
        t.setProductId(req.getProductId());
        threadMapper.insert(t);
        String nodeName = req.getFirstNodeName() != null && !req.getFirstNodeName().isBlank() ? req.getFirstNodeName() : "发起处理";
        Integer ownerId = req.getAssignToUserId() != null ? req.getAssignToUserId() : creatorId;
        jdbc.update("INSERT INTO work_node (thread_id, name, type, status, owner_id) VALUES (?, ?, 'TASK'::node_type, 'IN_PROGRESS'::node_status, ?)",
                t.getId(), nodeName, ownerId);
        return t;
    }

    public WorkThread getById(Integer id) {
        return threadMapper.selectById(id);
    }

    /** 工作台：进行中 */
    public List<WorkThread> getActive(Integer userId) {
        return threadMapper.selectList(new LambdaQueryWrapper<WorkThread>()
                .eq(WorkThread::getCreatorId, userId)
                .eq(WorkThread::getStatus, ThreadStatus.ACTIVE)
                .orderByDesc(WorkThread::getUpdatedAt));
    }

    /** 工作台：已完成 */
    public List<WorkThread> getCompleted(Integer userId) {
        return threadMapper.selectList(new LambdaQueryWrapper<WorkThread>()
                .eq(WorkThread::getCreatorId, userId)
                .eq(WorkThread::getStatus, ThreadStatus.COMPLETED)
                .orderByDesc(WorkThread::getUpdatedAt));
    }
}
