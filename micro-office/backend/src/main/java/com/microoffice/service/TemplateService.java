package com.microoffice.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.microoffice.entity.WorkflowTemplate;
import com.microoffice.entity.TemplateNode;
import com.microoffice.mapper.WorkflowTemplateMapper;
import com.microoffice.mapper.TemplateNodeMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import java.util.List;

@Service
@RequiredArgsConstructor
public class TemplateService {
    private final WorkflowTemplateMapper templateMapper;
    private final TemplateNodeMapper nodeMapper;

    public List<WorkflowTemplate> list() { return templateMapper.selectList(null); }
    public WorkflowTemplate getById(Integer id) { return templateMapper.selectById(id); }
    public WorkflowTemplate create(WorkflowTemplate t) { templateMapper.insert(t); return t; }
    public void update(WorkflowTemplate t) { templateMapper.updateById(t); }
    public void delete(Integer id) { templateMapper.deleteById(id); }

    public List<TemplateNode> getNodes(Integer templateId) {
        return nodeMapper.selectList(new LambdaQueryWrapper<TemplateNode>()
                .eq(TemplateNode::getTemplateId, templateId)
                .orderByAsc(TemplateNode::getSortOrder));
    }

    public TemplateNode addNode(TemplateNode node) { nodeMapper.insert(node); return node; }
    public void removeNode(Integer nodeId) { nodeMapper.deleteById(nodeId); }
}
