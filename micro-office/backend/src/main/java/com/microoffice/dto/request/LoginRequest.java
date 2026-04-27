package com.microoffice.dto.request;

import com.fasterxml.jackson.annotation.JsonAlias;
import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class LoginRequest {
    @JsonAlias("login")
    @NotBlank(message = "登录账号不能为空")
    private String email;

    @NotBlank(message = "密码不能为空")
    private String password;
}
