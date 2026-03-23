CREATE TABLE auth_session (
    id         VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    VARCHAR(36) NOT NULL,
    revoked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_auth_session_user_id ON auth_session(user_id);
