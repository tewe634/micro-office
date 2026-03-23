package com.microoffice.config;

import com.microoffice.service.AuthSessionService;
import com.microoffice.util.JwtUtil;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;
import java.io.IOException;
import java.util.List;

@Component
public class JwtFilter extends OncePerRequestFilter {

    private final JwtUtil jwtUtil;
    private final AuthSessionService authSessionService;

    public JwtFilter(JwtUtil jwtUtil, AuthSessionService authSessionService) {
        this.jwtUtil = jwtUtil;
        this.authSessionService = authSessionService;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        String header = request.getHeader("Authorization");
        if (header != null && header.startsWith("Bearer ")) {
            String token = header.substring(7);
            JwtUtil.TokenClaims claims = jwtUtil.parseToken(token);
            if (claims != null && authSessionService.isSessionActive(claims.sessionId(), claims.userId())) {
                var authorities = claims.role() != null
                        ? List.of(new SimpleGrantedAuthority("ROLE_" + claims.role()))
                        : List.<SimpleGrantedAuthority>of();
                var auth = new UsernamePasswordAuthenticationToken(claims.userId(), null, authorities);
                auth.setDetails(claims.sessionId());
                SecurityContextHolder.getContext().setAuthentication(auth);
            }
        }
        chain.doFilter(request, response);
    }
}
