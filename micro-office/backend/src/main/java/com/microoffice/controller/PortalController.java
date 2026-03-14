package com.microoffice.controller;

import com.microoffice.dto.response.ApiResponse;
import com.microoffice.entity.SysUser;
import com.microoffice.mapper.SysUserMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import java.util.*;

@RestController
@RequestMapping("/api/portal")
@RequiredArgsConstructor
public class PortalController {
    private final SysUserMapper userMapper;
    private final JdbcTemplate jdbc;

    @GetMapping
    public ApiResponse<Map<String, Object>> index(Authentication auth) {
        Integer userId = (Integer) auth.getPrincipal();
        SysUser u = userMapper.selectById(userId);
        Map<String, Object> result = new LinkedHashMap<>();

        // 基础信息
        Map<String, Object> profile = new LinkedHashMap<>();
        profile.put("id", u.getId()); profile.put("name", u.getName());
        profile.put("email", u.getEmail()); profile.put("phone", u.getPhone());
        profile.put("orgId", u.getOrgId()); profile.put("role", u.getRole());
        profile.put("hiredAt", u.getHiredAt()); profile.put("primaryPositionId", u.getPrimaryPositionId());
        // 组织名
        if (u.getOrgId() != null) {
            profile.put("orgName", jdbc.queryForObject("SELECT name FROM organization WHERE id = ?", String.class, u.getOrgId()));
        }
        // 岗位名
        if (u.getPrimaryPositionId() != null) {
            profile.put("positionName", jdbc.queryForObject("SELECT name FROM position WHERE id = ?", String.class, u.getPrimaryPositionId()));
        }
        // 在职天数
        if (u.getHiredAt() != null) {
            profile.put("daysEmployed", jdbc.queryForObject("SELECT CURRENT_DATE - ?::date", Integer.class, u.getHiredAt()));
        }
        result.put("profile", profile);

        // 同岗位排名（按完成工作数）
        if (u.getPrimaryPositionId() != null) {
            List<Map<String, Object>> ranking = jdbc.queryForList(
                "SELECT su.id, su.name, COUNT(wt.id) AS thread_count " +
                "FROM sys_user su LEFT JOIN work_thread wt ON wt.creator_id = su.id AND wt.status = 'COMPLETED' " +
                "WHERE su.primary_position_id = ? GROUP BY su.id, su.name ORDER BY thread_count DESC", u.getPrimaryPositionId());
            result.put("positionRanking", ranking);
        }

        // 关系网 - 上级（同组织更高岗位）
        List<Map<String, Object>> superiors = jdbc.queryForList(
            "SELECT id, name, primary_position_id FROM sys_user WHERE org_id = ? AND id != ? AND primary_position_id < ?",
            u.getOrgId(), userId, u.getPrimaryPositionId() != null ? u.getPrimaryPositionId() : 999);
        result.put("superiors", superiors);

        // 关系网 - 下级
        List<Map<String, Object>> subordinates = jdbc.queryForList(
            "SELECT id, name, primary_position_id FROM sys_user WHERE org_id = ? AND id != ? AND primary_position_id > ?",
            u.getOrgId(), userId, u.getPrimaryPositionId() != null ? u.getPrimaryPositionId() : 0);
        result.put("subordinates", subordinates);

        // 关系网 - 关联的外部对象
        List<Map<String, Object>> externalContacts = jdbc.queryForList(
            "SELECT id, type, name, contact, phone FROM external_object WHERE owner_id = ? ORDER BY type, name", userId);
        result.put("externalContacts", externalContacts);

        // 重大事件/奖励
        List<Map<String, Object>> achievements = jdbc.queryForList(
            "SELECT id, title, description, event_date, type, created_at FROM user_achievement WHERE user_id = ? ORDER BY event_date DESC NULLS LAST", userId);
        result.put("achievements", achievements);

        return ApiResponse.ok(result);
    }

    // 重大事件 CRUD
    @PostMapping("/achievements")
    public ApiResponse<Void> addAchievement(@RequestBody Map<String, Object> body, Authentication auth) {
        jdbc.update("INSERT INTO user_achievement (user_id, title, description, event_date, type) VALUES (?, ?, ?, ?::date, ?)",
            auth.getPrincipal(), body.get("title"), body.get("description"), body.get("eventDate"),
            body.getOrDefault("type", "ACHIEVEMENT"));
        return ApiResponse.ok(null);
    }

    @PutMapping("/achievements/{id}")
    public ApiResponse<Void> updateAchievement(@PathVariable Integer id, @RequestBody Map<String, Object> body) {
        jdbc.update("UPDATE user_achievement SET title = ?, description = ?, event_date = ?::date, type = ? WHERE id = ?",
            body.get("title"), body.get("description"), body.get("eventDate"), body.getOrDefault("type", "ACHIEVEMENT"), id);
        return ApiResponse.ok(null);
    }

    @DeleteMapping("/achievements/{id}")
    public ApiResponse<Void> deleteAchievement(@PathVariable Integer id) {
        jdbc.update("DELETE FROM user_achievement WHERE id = ?", id);
        return ApiResponse.ok(null);
    }
}
