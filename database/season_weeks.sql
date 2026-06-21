-- Season Weeks Table
-- Unified table storing ALL weeks for a season: regular play weeks, blackout dates, season-end breaks, and playoffs
-- Each row represents one calendar date with its purpose

CREATE TABLE IF NOT EXISTS season_weeks (
  -- Primary identification
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  season_id UUID NOT NULL REFERENCES seasons(id) ON DELETE CASCADE,

  -- Date and name
  scheduled_date DATE NOT NULL,
  week_name TEXT NOT NULL, -- legacy display label; numbers are now DERIVED from
                           -- position (see deriveWeekLabels). Dropped in Phase C.

  -- Week type determines how this date is treated. A season-end break is a
  -- blackout labelled "Week Off" (the season_end_break type was collapsed into
  -- blackout in migration 20260621000000).
  week_type VARCHAR(20) NOT NULL CHECK (week_type IN ('regular', 'blackout', 'playoffs')),

  -- Completion tracking (prevents editing past weeks)
  week_completed BOOLEAN NOT NULL DEFAULT false,

  -- A blackout's display label (holiday name / "Week Off"). Regular & playoff
  -- labels are derived, not stored.
  notes TEXT,

  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Constraint: Each season can only have one entry per date
  CONSTRAINT unique_season_date UNIQUE (season_id, scheduled_date)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_season_weeks_season_id ON season_weeks(season_id);
CREATE INDEX IF NOT EXISTS idx_season_weeks_date ON season_weeks(scheduled_date);
CREATE INDEX IF NOT EXISTS idx_season_weeks_type ON season_weeks(week_type);
CREATE INDEX IF NOT EXISTS idx_season_weeks_completed ON season_weeks(week_completed);

-- Trigger to auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_season_weeks_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER season_weeks_updated_at
  BEFORE UPDATE ON season_weeks
  FOR EACH ROW
  EXECUTE FUNCTION update_season_weeks_updated_at();

-- Row Level Security (RLS) Policies
ALTER TABLE season_weeks ENABLE ROW LEVEL SECURITY;

-- Policy: Operators can view their own league's season weeks
CREATE POLICY "Operators can view own league season weeks"
  ON season_weeks FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM seasons
      JOIN leagues ON seasons.league_id = leagues.id
      JOIN organization_staff ON leagues.organization_id = organization_staff.organization_id
      JOIN members ON organization_staff.member_id = members.id
      WHERE seasons.id = season_id
      AND members.user_id = auth.uid()
    )
  );

-- Policy: Operators can create season weeks for their own leagues
CREATE POLICY "Operators can create season weeks for own leagues"
  ON season_weeks FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM seasons
      JOIN leagues ON seasons.league_id = leagues.id
      JOIN organization_staff ON leagues.organization_id = organization_staff.organization_id
      JOIN members ON organization_staff.member_id = members.id
      WHERE seasons.id = season_id
      AND members.user_id = auth.uid()
    )
  );

-- Policy: Operators can update their own league's season weeks
CREATE POLICY "Operators can update own league season weeks"
  ON season_weeks FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM seasons
      JOIN leagues ON seasons.league_id = leagues.id
      JOIN organization_staff ON leagues.organization_id = organization_staff.organization_id
      JOIN members ON organization_staff.member_id = members.id
      WHERE seasons.id = season_id
      AND members.user_id = auth.uid()
    )
  );

-- Policy: Operators can delete their own league's season weeks
CREATE POLICY "Operators can delete own league season weeks"
  ON season_weeks FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM seasons
      JOIN leagues ON seasons.league_id = leagues.id
      JOIN organization_staff ON leagues.organization_id = organization_staff.organization_id
      JOIN members ON organization_staff.member_id = members.id
      WHERE seasons.id = season_id
      AND members.user_id = auth.uid()
    )
  );

-- Policy: Public can view weeks for active seasons (for player discovery)
CREATE POLICY "Public can view active season weeks"
  ON season_weeks FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM seasons
      WHERE seasons.id = season_id
      AND seasons.status = 'active'
    )
  );

-- Comments for documentation
COMMENT ON TABLE season_weeks IS 'Unified calendar for season - includes play weeks, blackout dates, season-end breaks, and playoffs';
COMMENT ON COLUMN season_weeks.scheduled_date IS 'The date for this calendar entry - use this for sorting';
COMMENT ON COLUMN season_weeks.week_name IS 'Display name: "Week 1", "Thanksgiving", "Playoffs", etc.';
COMMENT ON COLUMN season_weeks.week_type IS 'Type: regular (league play), blackout (date skipped — incl. season-end "Week Off"), or playoffs';
COMMENT ON COLUMN season_weeks.week_completed IS 'True when all matches scored and week is locked from editing';
COMMENT ON COLUMN season_weeks.notes IS 'Optional notes for operators (e.g., venue changes, special events)';
