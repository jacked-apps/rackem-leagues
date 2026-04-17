-- ============================================================================
-- ADD FK FROM PREFERENCES TO THRESHOLD CHARTS
-- ============================================================================
--
-- Runs AFTER both the preferences extension (000000) and threshold_charts
-- creation (000002) so both tables exist.
-- ============================================================================

-- Add FK constraint linking preferences.threshold_chart_id to threshold_charts
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'preferences_threshold_chart_id_fkey'
  ) THEN
    ALTER TABLE preferences
      ADD CONSTRAINT preferences_threshold_chart_id_fkey
      FOREIGN KEY (threshold_chart_id) REFERENCES threshold_charts(id)
      ON DELETE SET NULL;
  END IF;
END $$;
