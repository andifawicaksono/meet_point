CREATE TABLE IF NOT EXISTS audit_logs (
  id         UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID         REFERENCES users (id) ON DELETE SET NULL,
  room_id    UUID         REFERENCES rooms (id) ON DELETE SET NULL,
  action     VARCHAR(100) NOT NULL,
  metadata   JSONB        NOT NULL DEFAULT '{}',
  ip_address INET,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

  CONSTRAINT audit_logs_action_valid CHECK (
    action IN (
      'LOGIN', 'LOGOUT',
      'ROOM_CREATED', 'ROOM_JOINED',
      'DRAW', 'STICKY_CREATED',
      'CHAT_SENT', 'VOTE_CAST',
      'FILE_EXPORTED', 'PARTICIPANT_REMOVED'
    )
  )
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id    ON audit_logs (user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action     ON audit_logs (action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_room_id    ON audit_logs (room_id) WHERE room_id IS NOT NULL;

-- Composite index for the primary query pattern: user activity timeline
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_action_time
  ON audit_logs (user_id, action, created_at DESC);

-- Partition hint: for high-volume deployments, consider range partitioning on created_at
