DO $$ BEGIN
  CREATE TYPE sticky_note_type AS ENUM ('idea', 'problem', 'solution', 'action_item');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS sticky_notes (
  id          UUID             PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id     UUID             NOT NULL REFERENCES rooms (id) ON DELETE CASCADE,
  author_id   UUID             NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  type        sticky_note_type NOT NULL,
  title       VARCHAR(200),
  content     TEXT,
  color       VARCHAR(7)       NOT NULL DEFAULT '#FBBF24',
  position_x  FLOAT            NOT NULL DEFAULT 0,
  position_y  FLOAT            NOT NULL DEFAULT 0,
  vote_count  INT              NOT NULL DEFAULT 0,
  created_at  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sticky_notes_room_id   ON sticky_notes (room_id);
CREATE INDEX IF NOT EXISTS idx_sticky_notes_author_id ON sticky_notes (author_id);
CREATE INDEX IF NOT EXISTS idx_sticky_notes_type      ON sticky_notes (room_id, type);

DROP TRIGGER IF EXISTS set_sticky_notes_updated_at ON sticky_notes;
CREATE TRIGGER set_sticky_notes_updated_at
  BEFORE UPDATE ON sticky_notes
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
