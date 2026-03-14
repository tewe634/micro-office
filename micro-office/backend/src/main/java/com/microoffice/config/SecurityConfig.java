package com.microoffice.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
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

    public SecurityConfig(JwtFilter jwtFilter) {
        this.jwtFilter = jwtFilter;
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
            .authorizeHttpRequests(a -> a
                .requestMatchers("/api/auth/**").permitAll()
                // 基础模块: 所有登录用户可访问
                .requestMatchers("/api/users/me").authenticated()
                .requestMatchers("/api/portal/**").authenticated()
                .requestMatchers("/api/workbench/**").authenticated()
                .requestMatchers("/api/clock/**").authenticated()
                .requestMatchers("/api/dashboard/**").authenticated()
                .requestMatchers("/api/threads/**").authenticated()
                .requestMatchers("/api/nodes/**").authenticated()
                // 组织架构 + 人员管理: HR 和 ADMIN
                .requestMatchers("/api/orgs/**").hasAnyRole("HR", "ADMIN")
                .requestMatchers("/api/users/**").hasAnyRole("HR", "ADMIN")
                .requestMatchers("/api/positions/**").hasAnyRole("HR", "ADMIN")
                // 系统管理: 仅 ADMIN
                .requestMatchers("/api/admin/**").hasRole("ADMIN")
                // 外部对象: SALES, PURCHASE, FINANCE, ADMIN
                .requestMatchers("/api/objects/**").hasAnyRole("SALES", "PURCHASE", "FINANCE", "ADMIN")
                .anyRequest().authenticated()
            )
            .addFilterBefore(jwtFilter, UsernamePasswordAuthenticationFilter.class);
        return http.build();
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }
}
