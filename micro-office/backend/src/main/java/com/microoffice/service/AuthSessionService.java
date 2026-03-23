package com.microoffice.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.conditions.update.LambdaUpdateWrapper;
import com.microoffice.entity.AuthSession;
import com.microoffice.mapper.AuthSessionMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.OffsetDateTime;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class AuthSessionService {

    private final AuthSessionMapper authSessionMapper;

    public String createSession(String userId) {
        AuthSession session = new AuthSession();
        session.setId(UUID.randomUUID().toString());
        session.setUserId(userId);
        authSessionMapper.insert(session);
        return session.getId();
    }

    public boolean isSessionActive(String sessionId, String userId) {
        if (sessionId == null || userId == null) {
            return false;
        }
        return authSessionMapper.selectCount(
                new LambdaQueryWrapper<AuthSession>()
                        .eq(AuthSession::getId, sessionId)
                        .eq(AuthSession::getUserId, userId)
                        .isNull(AuthSession::getRevokedAt)
        ) > 0;
    }

    public void revokeSession(String sessionId, String userId) {
        if (sessionId == null || userId == null) {
            return;
        }
        authSessionMapper.update(
                null,
                new LambdaUpdateWrapper<AuthSession>()
                        .eq(AuthSession::getId, sessionId)
                        .eq(AuthSession::getUserId, userId)
                        .isNull(AuthSession::getRevokedAt)
                        .set(AuthSession::getRevokedAt, OffsetDateTime.now())
        );
    }
}
