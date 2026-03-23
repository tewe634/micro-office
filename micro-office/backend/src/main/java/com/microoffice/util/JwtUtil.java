package com.microoffice.util;

import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.util.Date;

@Component
public class JwtUtil {

    private final SecretKey key;
    private final long expiration;

    public JwtUtil(@Value("${jwt.secret}") String secret, @Value("${jwt.expiration}") long expiration) {
        this.key = Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
        this.expiration = expiration;
    }

    public String generateToken(String userId, String role, String sessionId) {
        var builder = Jwts.builder()
                .subject(userId)
                .claim("role", role)
                .issuedAt(new Date())
                .claim("sid", sessionId);
        if (expiration > 0) {
            builder.expiration(new Date(System.currentTimeMillis() + expiration));
        }
        return builder.signWith(key).compact();
    }

    public TokenClaims parseToken(String token) {
        try {
            var claims = Jwts.parser().verifyWith(key).build().parseSignedClaims(token).getPayload();
            return new TokenClaims(
                    claims.getSubject(),
                    claims.get("role", String.class),
                    claims.get("sid", String.class)
            );
        } catch (Exception ignored) {
            return null;
        }
    }

    public record TokenClaims(String userId, String role, String sessionId) {
    }
}
