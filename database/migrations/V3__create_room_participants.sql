DO $$ BEGIN
  CREATE TYPE participant_role AS ENUM ('owner', 'member', 'guest');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS room_participants (
  id            UUID             PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id       UUID             NOT NULL REFERENCES rooms (id) ON DELETE CASCADE,
  user_id       UUID             NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  role          participant_role NOT NULL DEFAULT 'member',
  joined_at     TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  is_online     BOOLEAN          NOT NULL DEFAULT false,
  cursor_color  VARCHAR(7),

  CONSTRAINT room_participants_unique UNIQUE (room_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_room_participants_room_id  ON room_participants (room_id);
CREATE INDEX IF NOT EXISTS idx_room_participants_user_id  ON room_participants (user_id);
CREATE INDEX IF NOT EXISTS idx_room_participants_is_online ON room_participants (room_id, is_online);
