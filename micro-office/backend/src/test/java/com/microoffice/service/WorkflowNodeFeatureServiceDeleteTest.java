package com.microoffice.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InOrder;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.server.ResponseStatusException;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class WorkflowNodeFeatureServiceDeleteTest {

    @Mock
    private JdbcTemplate jdbc;

    @Test
    void deleteFeatureShouldRefuseWhenReferencedByTemplateNodes() {
        WorkflowNodeFeatureService service = new WorkflowNodeFeatureService(jdbc, new ObjectMapper());
        when(jdbc.queryForMap(anyString(), eq("mod_1"))).thenReturn(featureRow());
        when(jdbc.queryForObject(anyString(), eq(Integer.class), eq("mod_1"))).thenReturn(1);
        when(jdbc.queryForList(anyString(), eq("mod_1"))).thenReturn(List.of(referenceRow()));

        ResponseStatusException ex = assertThrows(
            ResponseStatusException.class,
            () -> service.deleteFeature("mod_1", "admin-user")
        );

        assertEquals(400, ex.getStatusCode().value());
        assertEquals("节点功能已被工作流模板节点引用，无法删除", ex.getReason());
        verify(jdbc, never()).update("DELETE FROM mo_module_fields WHERE module_definition_id = ?", "mod_1");
        verify(jdbc, never()).update("DELETE FROM mo_workflow_module_definitions WHERE id = ?", "mod_1");
        verify(jdbc, never()).update("DELETE FROM mo_module_definitions WHERE id = ?", "mod_1");
    }

    @Test
    void deleteFeatureShouldDeleteFieldsBehaviorCarrierThenFeature() {
        WorkflowNodeFeatureService service = new WorkflowNodeFeatureService(jdbc, new ObjectMapper());
        when(jdbc.queryForMap(anyString(), eq("mod_1"))).thenReturn(featureRow());
        when(jdbc.queryForObject(anyString(), eq(Integer.class), eq("mod_1"))).thenReturn(1);
        when(jdbc.queryForList(anyString(), eq("mod_1"))).thenReturn(List.of());
        when(jdbc.update("DELETE FROM mo_module_fields WHERE module_definition_id = ?", "mod_1")).thenReturn(2);
        when(jdbc.update("DELETE FROM mo_workflow_module_definitions WHERE id = ?", "mod_1")).thenReturn(1);
        when(jdbc.update("DELETE FROM mo_module_definitions WHERE id = ?", "mod_1")).thenReturn(1);

        Map<String, Object> result = service.deleteFeature("mod_1", "admin-user");

        assertEquals("mod_1", result.get("id"));
        assertEquals("节点功能A", result.get("name"));
        assertEquals("admin-user", result.get("deletedBy"));
        InOrder inOrder = inOrder(jdbc);
        inOrder.verify(jdbc).update("DELETE FROM mo_module_fields WHERE module_definition_id = ?", "mod_1");
        inOrder.verify(jdbc).update("DELETE FROM mo_workflow_module_definitions WHERE id = ?", "mod_1");
        inOrder.verify(jdbc).update("DELETE FROM mo_module_definitions WHERE id = ?", "mod_1");
    }

    private Map<String, Object> featureRow() {
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("id", "mod_1");
        row.put("source_module_id", null);
        row.put("code", "FEATURE_A");
        row.put("name", "节点功能A");
        row.put("source_system", "MICRO_OFFICE");
        row.put("node_type", "TASK");
        row.put("is_active", false);
        row.put("version", 1);
        row.put("role_key", null);
        row.put("position_key", null);
        return row;
    }

    private Map<String, Object> referenceRow() {
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("package_id", "pkg_1");
        row.put("package_name", "模板包A");
        row.put("package_status", "ACTIVE");
        row.put("node_id", "node_1");
        row.put("display_name", "节点A");
        row.put("relation_type", "SEQUENCE");
        row.put("parent_package_node_id", null);
        row.put("branch_group_key", null);
        row.put("branch_order", null);
        row.put("sort_order", 0);
        return row;
    }
}
