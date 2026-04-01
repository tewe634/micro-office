package com.microoffice.controller;

import com.microoffice.dto.response.ApiResponse;
import com.microoffice.mapper.SysUserMapper;
import com.microoffice.service.DataScopeService;
import com.microoffice.service.MenuPermissionService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InOrder;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class UserControllerDeleteTest {

    @Mock
    private SysUserMapper userMapper;

    @Mock
    private PasswordEncoder passwordEncoder;

    @Mock
    private JdbcTemplate jdbcTemplate;

    @Mock
    private DataScopeService dataScopeService;

    @Mock
    private MenuPermissionService menuPermissionService;

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void deleteShouldClearOwnedObjectReferencesBeforeDeletingUser() {
        Authentication authentication = mock(Authentication.class);
        when(authentication.getPrincipal()).thenReturn("admin-user");
        SecurityContextHolder.getContext().setAuthentication(authentication);

        UserController controller = new UserController(
            userMapper,
            passwordEncoder,
            jdbcTemplate,
            dataScopeService,
            menuPermissionService
        );

        ApiResponse<Void> response = controller.delete("target-user");

        verify(menuPermissionService).requireMenu("admin-user", "/users");

        InOrder inOrder = inOrder(jdbcTemplate, userMapper);
        inOrder.verify(jdbcTemplate).update("DELETE FROM auth_session WHERE user_id = ?", "target-user");
        inOrder.verify(jdbcTemplate).update("DELETE FROM user_position WHERE user_id = ?", "target-user");
        inOrder.verify(jdbcTemplate).update("UPDATE external_object SET owner_id = NULL WHERE owner_id = ?", "target-user");
        inOrder.verify(userMapper).deleteById("target-user");

        assertEquals(0, response.getCode());
        assertNull(response.getData());
    }
}
