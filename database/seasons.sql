-- Seasons Table
-- Represents a pool league season with basic metadata
-- Schedule weeks stored in separate season_weeks table
-- Holidays and championships fetched on-demand during schedule editing

CREATE TABLE IF NOT EXISTS seasons (
  -- Primary identification
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  league_id UUID NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,

  -- Season naming and identification
  season_name TEXT NOT NULL,

  -- Date information
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  season_length INTEGER NOT NULL CHECK (season_length >= 10 AND season_length <= 52),

  -- Status
  status VARCHAR(20) NOT NULL DEFAULT 'upcoming' CHECK (status IN ('upcoming', 'scheduled', 'active', 'completed', 'cancelled')),

  -- Season completion tracking
  season_completed BOOLEAN DEFAULT false,

  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_seasons_league_id ON seasons(league_id);
CREATE INDEX IF NOT EXISTS idx_seasons_status ON seasons(status);
CREATE INDEX IF NOT EXISTS idx_seasons_start_date ON seasons(start_date);

-- Trigger to auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_seasons_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER seasons_updated_at
  BEFORE UPDATE ON seasons
  FOR EACH ROW
  EXECUTE FUNCTION update_seasons_updated_at();

-- Row Level Security (RLS) Policies
ALTER TABLE seasons ENABLE ROW LEVEL SECURITY;

-- Policy: Operators can view their own league's seasons
CREATE POLICY "Operators can view own league seasons"
  ON seasons FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM leagues
      JOIN league_operators ON leagues.operator_id = league_operators.id
      JOIN members ON league_operators.member_id = members.id
      WHERE leagues.id = league_id
      AND members.user_id = auth.uid()
    )
  );

-- Policy: Operators can create seasons for their own leagues
CREATE POLICY "Operators can create seasons for own leagues"
  ON seasons FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM leagues
      JOIN league_operators ON leagues.operator_id = league_operators.id
      JOIN members ON league_operators.member_id = members.id
      WHERE leagues.id = league_id
      AND members.user_id = auth.uid()
    )
  );

-- Policy: Operators can update their own league's seasons
CREATE POLICY "Operators can update own league seasons"
  ON seasons FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM leagues
      JOIN league_operators ON leagues.operator_id = league_operators.id
      JOIN members ON league_operators.member_id = members.id
      WHERE leagues.id = league_id
      AND members.user_id = auth.uid()
    )
  );

-- Policy: Operators can delete their own league's seasons
CREATE POLICY "Operators can delete own league seasons"
  ON seasons FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM leagues
      JOIN league_operators ON leagues.operator_id = league_operators.id
      JOIN members ON league_operators.member_id = members.id
      WHERE leagues.id = league_id
      AND members.user_id = auth.uid()
    )
  );

-- Policy: Public can view active seasons (for player discovery)
CREATE POLICY "Public can view active seasons"
  ON seasons FOR SELECT
  USING (status = 'active');

-- Comments for documentation
COMMENT ON TABLE seasons IS 'Pool league seasons with basic metadata. Schedule weeks stored in season_weeks table. Holidays and championships fetched on-demand during editing.';
COMMENT ON COLUMN seasons.season_name IS 'Auto-generated name like "Fall 2025 Monday 8-Ball"';
COMMENT ON COLUMN seasons.season_length IS 'Number of weeks in the season (10-52)';
COMMENT ON COLUMN seasons.start_date IS 'First possible league play date';
COMMENT ON COLUMN seasons.end_date IS 'Last possible league play date (including playoffs)';
COMMENT ON COLUMN seasons.season_completed IS 'True when entire season is finished';
