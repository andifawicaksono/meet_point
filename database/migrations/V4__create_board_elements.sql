CREATE TABLE IF NOT EXISTS board_elements (
  id               UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id          UUID    NOT NULL REFERENCES rooms (id) ON DELETE CASCADE,
  tldraw_snapshot  JSONB,
  version          INT     NOT NULL DEFAULT 1,
  updated_by       UUID    REFERENCES users (id) ON DELETE SET NULL,
  updated_at       TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Each room has exactly one board document; enforce via unique index
CREATE UNIQUE INDEX IF NOT EXISTS idx_board_elements_room_id ON board_elements (room_id);

-- GIN index for fast JSONB queries on the snapshot
CREATE INDEX IF NOT EXISTS idx_board_elements_snapshot_gin
  ON board_elements USING GIN (tldraw_snapshot);

-- Auto-bump updated_at on write
DROP TRIGGER IF EXISTS set_board_elements_updated_at ON board_elements;
CREATE TRIGGER set_board_elements_updated_at
  BEFORE UPDATE ON board_elements
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
