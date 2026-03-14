package com.microoffice.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.conditions.update.LambdaUpdateWrapper;
import com.microoffice.dto.request.CompleteNodeRequest;
import com.microoffice.dto.request.CreateNodeRequest;
import com.microoffice.entity.WorkNode;
import com.microoffice.enums.NodeStatus;
import com.microoffice.enums.NodeType;
import com.microoffice.mapper.WorkNodeMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.OffsetDateTime;
import java.util.List;

@Service
@RequiredArgsConstructor
public class NodeService {

    private final WorkNodeMapper nodeMapper;
    private final JdbcTemplate jdbc;
    private final StringRedisTemplate redis;

    /** 创建节点 */
    public WorkNode create(Integer threadId, CreateNodeRequest req) {
        WorkNode node = new WorkNode();
        node.setThreadId(threadId);
        node.setName(req.getName());
        node.setType(req.getType() != null ? req.getType() : NodeType.TASK);
        node.setStatus(req.getPoolPositionId() != null ? NodeStatus.IN_PROGRESS : NodeStatus.IN_PROGRESS);
        node.setOwnerId(req.getOwnerId());
        node.setPrevNodeId(req.getPrevNodeId());
        node.setPoolPositionId(req.getPoolPositionId());
        node.setModuleData(req.getModuleData());
        nodeMapper.insert(node);

        // 回填前置节点的 next_node_id
        if (req.getPrevNodeId() != null) {
            nodeMapper.update(null, new LambdaUpdateWrapper<WorkNode>()
                    .eq(WorkNode::getId, req.getPrevNodeId())
                    .set(WorkNode::getNextNodeId, node.getId()));
        }
        return node;
    }

    /** 获取单个节点 */
    public WorkNode getById(Integer id) {
        return nodeMapper.selectById(id);
    }

    /** 获取工作下所有节点 */
    public List<WorkNode> listByThread(Integer threadId) {
        return nodeMapper.selectList(new LambdaQueryWrapper<WorkNode>()
                .eq(WorkNode::getThreadId, threadId)
                .orderByAsc(WorkNode::getCreatedAt));
    }

    /** 完成节点 + 决定下一步 */
    @Transactional
    public WorkNode complete(Integer nodeId, CompleteNodeRequest req) {
        WorkNode node = nodeMapper.selectById(nodeId);
        if (node == null || node.getStatus() != NodeStatus.IN_PROGRESS) {
            throw new RuntimeException("节点不存在或状态不允许完成");
        }

        node.setStatus("DEFER".equals(req.getNextAction()) ? NodeStatus.PENDING_NEXT : NodeStatus.COMPLETED);
        node.setCompletedAt(OffsetDateTime.now());
        nodeMapper.updateById(node);

        // 根据 nextAction 创建下一个节点
        if ("ASSIGN".equals(req.getNextAction()) && req.getAssignToUserId() != null) {
            CreateNodeRequest next = new CreateNodeRequest();
            next.setName(req.getCustomNodeName() != null ? req.getCustomNodeName() : "待处理");
            next.setOwnerId(req.getAssignToUserId());
            next.setPrevNodeId(nodeId);
            return create(node.getThreadId(), next);
        }
        if ("COMPLETE_TASK".equals(req.getNextAction())) {
            // 标记整个工作流完成
            jdbc.update("UPDATE work_thread SET status = 'COMPLETED'::thread_status, updated_at = NOW() WHERE id = ?", node.getThreadId());
        }
        if ("POOL".equals(req.getNextAction()) && req.getPoolPositionId() != null) {
            CreateNodeRequest next = new CreateNodeRequest();
            next.setName(req.getCustomNodeName() != null ? req.getCustomNodeName() : "待领取");
            next.setPoolPositionId(req.getPoolPositionId());
            next.setPrevNodeId(nodeId);
            return create(node.getThreadId(), next);
        }
        return node;
    }

    /** 流程回退 */
    @Transactional
    public void rollback(Integer nodeId, Integer targetNodeId) {
        // 将 targetNode 到 nodeId 之间的节点标记作废
        WorkNode current = nodeMapper.selectById(nodeId);
        while (current != null && !current.getId().equals(targetNodeId)) {
            current.setStatus(NodeStatus.VOIDED);
            nodeMapper.updateById(current);
            current = current.getPrevNodeId() != null ? nodeMapper.selectById(current.getPrevNodeId()) : null;
        }
        // 恢复目标节点
        if (current != null) {
            current.setStatus(NodeStatus.IN_PROGRESS);
            current.setCompletedAt(null);
            current.setNextNodeId(null);
            nodeMapper.updateById(current);
        }
    }

    /** 任务池查询 */
    public List<WorkNode> getPoolTasks(Integer positionId) {
        return nodeMapper.selectPoolTasks(positionId);
    }

    /** 任务池领取（Redis分布式锁） */
    @Transactional
    public WorkNode claim(Integer nodeId, Integer userId) {
        String lockKey = "taskpool:claim:" + nodeId;
        Boolean locked = redis.opsForValue().setIfAbsent(lockKey, userId.toString(), Duration.ofSeconds(30));
        if (locked == null || !locked) {
            throw new RuntimeException("已被他人领取");
        }
        try {
            WorkNode node = nodeMapper.selectById(nodeId);
            if (node == null || node.getOwnerId() != null) {
                throw new RuntimeException("已被他人领取");
            }
            node.setOwnerId(userId);
            node.setResponseAt(OffsetDateTime.now());
            nodeMapper.updateById(node);
            return node;
        } finally {
            redis.delete(lockKey);
        }
    }

    /** 用户待办节点 */
    public List<WorkNode> getTodoNodes(Integer userId) {
        return nodeMapper.selectList(new LambdaQueryWrapper<WorkNode>()
                .eq(WorkNode::getOwnerId, userId)
                .in(WorkNode::getStatus, NodeStatus.IN_PROGRESS, NodeStatus.PENDING_NEXT)
                .orderByDesc(WorkNode::getCreatedAt));
    }
}
