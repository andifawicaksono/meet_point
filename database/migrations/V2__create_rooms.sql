DO $$ BEGIN
  CREATE TYPE room_status AS ENUM ('active', 'closed');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS rooms (
  id               UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  name             VARCHAR(100) NOT NULL,
  description      TEXT,
  invite_code      VARCHAR(20)  NOT NULL,
  owner_id         UUID         NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  is_locked        BOOLEAN      NOT NULL DEFAULT false,
  max_participants  INT          NOT NULL DEFAULT 50,
  status           room_status  NOT NULL DEFAULT 'active',
  created_at       TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

  CONSTRAINT rooms_invite_code_unique UNIQUE (invite_code)
);

CREATE INDEX IF NOT EXISTS idx_rooms_owner_id    ON rooms (owner_id);
CREATE INDEX IF NOT EXISTS idx_rooms_invite_code ON rooms (invite_code);
CREATE INDEX IF NOT EXISTS idx_rooms_status      ON rooms (status);

DROP TRIGGER IF EXISTS set_rooms_updated_at ON rooms;
CREATE TRIGGER set_rooms_updated_at
  BEFORE UPDATE ON rooms
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
