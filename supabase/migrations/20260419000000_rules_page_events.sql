-- ============================================================================
-- RULES_PAGE_EVENTS TABLE
--
-- Lightweight usage log for the public /rules feature (Branch 1 of the
-- rulebook-reader project). Lets the owner forecast demand for the future
-- AI-helper by watching how many page opens / searches / deep-link opens
-- happen over time.
--
-- Deliberately stores only counts + optional slug metadata. No raw search
-- query text: avoids PII/abuse concerns on a public route.
-- ============================================================================

SET search_path = public;

CREATE TABLE IF NOT EXISTS rules_page_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL CHECK (event_type IN ('page_open', 'search_query', 'deep_link_open')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  game TEXT CHECK (game IS NULL OR char_length(game) <= 40),
  rule_id TEXT CHECK (rule_id IS NULL OR char_length(rule_id) <= 40),
  result_count INTEGER CHECK (result_count IS NULL OR result_count >= 0)
);

-- Index for querying volume over time.
CREATE INDEX idx_rules_page_events_event_type_created
  ON rules_page_events (event_type, created_at DESC);

-- Enable RLS on the table.
ALTER TABLE rules_page_events ENABLE ROW LEVEL SECURITY;

-- Anyone can INSERT. The column check constraints bound payload size, and
-- the event_type check constraint caps the set of valid types. No free-text
-- column exists, so there is no PII or abuse-payload vector beyond row
-- count itself.
CREATE POLICY "Anyone can insert rules page events"
  ON rules_page_events
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Only developer-role members can read the log. Operators can also inspect
-- via the Supabase dashboard (service role bypasses RLS).
CREATE POLICY "Developers can read rules page events"
  ON rules_page_events
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM members
      WHERE members.user_id = auth.uid()
        AND members.role = 'developer'
    )
  );

COMMENT ON TABLE rules_page_events IS
  'Usage log for the public /rules feature. Counts only — no raw query text is stored. Reads restricted to developer role.';
