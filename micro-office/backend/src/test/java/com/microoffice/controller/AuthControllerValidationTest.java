package com.microoffice.controller;

import com.microoffice.config.GlobalExceptionHandler;
import com.microoffice.dto.request.LoginRequest;
import com.microoffice.service.AuthService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.validation.beanvalidation.LocalValidatorFactoryBean;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@ExtendWith(MockitoExtension.class)
class AuthControllerValidationTest {

    @Mock
    private AuthService authService;

    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        LocalValidatorFactoryBean validator = new LocalValidatorFactoryBean();
        validator.afterPropertiesSet();

        mockMvc = MockMvcBuilders.standaloneSetup(new AuthController(authService))
            .setControllerAdvice(new GlobalExceptionHandler())
            .setValidator(validator)
            .build();
    }

    @Test
    void loginShouldAcceptLoginAlias() throws Exception {
        when(authService.login(any(LoginRequest.class))).thenReturn(Map.of(
            "token", "test-token",
            "userId", "user-1",
            "role", "ADMIN"
        ));

        mockMvc.perform(post("/api/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {
                      "login": "13305713391",
                      "password": "123456"
                    }
                    """))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.code").value(0))
            .andExpect(jsonPath("$.data.userId").value("user-1"))
            .andExpect(jsonPath("$.data.role").value("ADMIN"));

        ArgumentCaptor<LoginRequest> requestCaptor = ArgumentCaptor.forClass(LoginRequest.class);
        verify(authService).login(requestCaptor.capture());
        assertEquals("13305713391", requestCaptor.getValue().getEmail());
        assertEquals("123456", requestCaptor.getValue().getPassword());
    }

    @Test
    void loginShouldReturnReadableValidationMessageWhenAccountMissing() throws Exception {
        mockMvc.perform(post("/api/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {
                      "password": "123456"
                    }
                    """))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.code").value(400))
            .andExpect(jsonPath("$.message").value("登录账号不能为空"))
            .andExpect(jsonPath("$.errorType").value("VALIDATION_ERROR"))
            .andExpect(jsonPath("$.field").value("email"))
            .andExpect(jsonPath("$.errors[0].field").value("email"))
            .andExpect(jsonPath("$.errors[0].message").value("登录账号不能为空"));

        verifyNoInteractions(authService);
    }

    @Test
    void loginShouldReturnStructuredErrorWhenJsonInvalid() throws Exception {
        mockMvc.perform(post("/api/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{bad json"))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.code").value(400))
            .andExpect(jsonPath("$.message").value("请求体格式错误或字段类型不匹配"))
            .andExpect(jsonPath("$.errorType").value("REQUEST_BODY_INVALID"));

        verifyNoInteractions(authService);
    }
}
