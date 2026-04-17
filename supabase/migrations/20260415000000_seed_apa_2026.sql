-- Seed APA National Championship dates for 2026
-- Source: APA announces annually, August 4-15 for 2026
INSERT INTO championship_date_options (organization, year, start_date, end_date, dev_verified)
VALUES ('APA', 2026, '2026-08-04', '2026-08-15', true)
ON CONFLICT DO NOTHING;
