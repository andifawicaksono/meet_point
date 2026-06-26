CREATE TABLE IF NOT EXISTS votes (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id        UUID NOT NULL REFERENCES rooms (id) ON DELETE CASCADE,
  sticky_note_id UUID NOT NULL REFERENCES sticky_notes (id) ON DELETE CASCADE,
  voter_id       UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  stars          INT  NOT NULL,
  created_at     TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

  CONSTRAINT votes_stars_range    CHECK (stars BETWEEN 1 AND 5),
  CONSTRAINT votes_one_per_user   UNIQUE (sticky_note_id, voter_id)
);

CREATE INDEX IF NOT EXISTS idx_votes_sticky_note_id ON votes (sticky_note_id);
CREATE INDEX IF NOT EXISTS idx_votes_voter_id        ON votes (voter_id);
CREATE INDEX IF NOT EXISTS idx_votes_room_id         ON votes (room_id);

-- Keep sticky_notes.vote_count in sync automatically
CREATE OR REPLACE FUNCTION sync_vote_count() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE sticky_notes SET vote_count = vote_count + 1 WHERE id = NEW.sticky_note_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE sticky_notes SET vote_count = vote_count - 1 WHERE id = OLD.sticky_note_id;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_vote_count ON votes;
CREATE TRIGGER trg_sync_vote_count
  AFTER INSERT OR DELETE ON votes
  FOR EACH ROW EXECUTE FUNCTION sync_vote_count();
