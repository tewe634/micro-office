package com.microoffice.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.microoffice.dto.response.ApiResponse;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpStatus;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;

import java.util.List;

@Configuration
@EnableWebSecurity
public class SecurityConfig {

    private final JwtFilter jwtFilter;
    private final ObjectMapper objectMapper;

    public SecurityConfig(JwtFilter jwtFilter, ObjectMapper objectMapper) {
        this.jwtFilter = jwtFilter;
        this.objectMapper = objectMapper;
    }

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http.csrf(c -> c.disable())
            .cors(c -> c.configurationSource(req -> {
                var cors = new CorsConfiguration();
                cors.setAllowedOrigins(List.of("*"));
                cors.setAllowedMethods(List.of("*"));
                cors.setAllowedHeaders(List.of("*"));
                return cors;
            }))
            .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .exceptionHandling(e -> e
                .authenticationEntryPoint((request, response, ex) ->
                    writeJson(response, HttpStatus.UNAUTHORIZED, ApiResponse.error(401, "未登录或登录已失效")))
                .accessDeniedHandler((request, response, ex) ->
                    writeJson(response, HttpStatus.FORBIDDEN, ApiResponse.error(403, "无权限访问")))
            )
            .authorizeHttpRequests(a -> a
                .requestMatchers(HttpMethod.POST, "/api/auth/logout").authenticated()
                .requestMatchers("/api/auth/login", "/api/auth/register").permitAll()
                // 基础模块: 所有登录用户可访问
                .requestMatchers("/api/users/me", "/api/users/me/**").authenticated()
                .requestMatchers("/api/portal/**").authenticated()
                // 组织架构: 全员可查看；变更操作仍保留给 HR 和 ADMIN
                .requestMatchers(HttpMethod.GET, "/api/orgs/**").authenticated()
                .requestMatchers("/api/orgs/**").hasAnyRole("HR", "ADMIN")
                // 人员管理: 读取接口需登录，具体查看范围由模块权限 + 数据范围控制；变更操作仍保留给 HR 和 ADMIN
                .requestMatchers(HttpMethod.GET, "/api/users/**").authenticated()
                .requestMatchers(HttpMethod.GET, "/api/positions/**").authenticated()
                .requestMatchers("/api/users/**").hasAnyRole("HR", "ADMIN")
                .requestMatchers("/api/positions/**").hasAnyRole("HR", "ADMIN")
                // 系统管理: 仅 ADMIN
                .requestMatchers("/api/admin/**").hasRole("ADMIN")
                // 外部对象: 登录即可访问（具体范围在业务侧控制）
                .requestMatchers("/api/objects/**").authenticated()
                .anyRequest().authenticated()
            )
            .addFilterBefore(jwtFilter, UsernamePasswordAuthenticationFilter.class);
        return http.build();
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    private void writeJson(jakarta.servlet.http.HttpServletResponse response, HttpStatus status, ApiResponse<Void> body)
            throws java.io.IOException {
        response.setStatus(status.value());
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        response.setCharacterEncoding("UTF-8");
        objectMapper.writeValue(response.getWriter(), body);
    }
}
