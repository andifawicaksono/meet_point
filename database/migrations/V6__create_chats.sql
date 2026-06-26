CREATE TABLE IF NOT EXISTS chats (
  id          UUID      PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id     UUID      NOT NULL REFERENCES rooms (id) ON DELETE CASCADE,
  author_id   UUID      NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  content     TEXT      NOT NULL,
  reply_to_id UUID      REFERENCES chats (id) ON DELETE SET NULL,
  mentions    UUID[]    NOT NULL DEFAULT '{}',
  created_at  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Primary query pattern: fetch messages for a room ordered by time
CREATE INDEX IF NOT EXISTS idx_chats_room_created ON chats (room_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chats_author_id    ON chats (author_id);
CREATE INDEX IF NOT EXISTS idx_chats_reply_to_id  ON chats (reply_to_id) WHERE reply_to_id IS NOT NULL;

-- GIN index for fast mention lookups: find all chats that mention a given user
CREATE INDEX IF NOT EXISTS idx_chats_mentions_gin ON chats USING GIN (mentions);
