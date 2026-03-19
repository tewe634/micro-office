package com.microoffice.service;

import com.microoffice.entity.SysUser;
import com.microoffice.mapper.SysUserMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
@RequiredArgsConstructor
public class MenuPermissionService {
    private final JdbcTemplate jdbc;
    private final SysUserMapper userMapper;

    public List<String> getEffectiveMenus(String userId) {
        SysUser user = userMapper.selectById(userId);
        if (user == null) return List.of();

        List<String> userMenus = jdbc.queryForList(
            "SELECT menu_key FROM user_menu_permission WHERE user_id = ? ORDER BY menu_key",
            String.class,
            userId
        );
        if (!userMenus.isEmpty()) {
            return userMenus;
        }

        return jdbc.queryForList(
            "SELECT menu_key FROM role_menu_permission WHERE role = ? ORDER BY menu_key",
            String.class,
            user.getRole()
        );
    }

    public boolean hasCustomMenus(String userId) {
        return !jdbc.queryForList("SELECT 1 FROM user_menu_permission WHERE user_id = ? LIMIT 1", userId).isEmpty();
    }

    public boolean hasMenu(String userId, String menuKey) {
        if ("/org".equals(menuKey)) {
            return true;
        }
        return getEffectiveMenus(userId).contains(menuKey);
    }

    public void requireMenu(String userId, String menuKey) {
        if (!hasMenu(userId, menuKey)) {
            throw new AccessDeniedException("无权限访问");
        }
    }
}
