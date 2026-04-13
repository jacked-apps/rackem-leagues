# TODO: Season Preferences Editor

**Status:** Not started
**Discovered:** 2026-04-12 during wizard 2.0 season wizard work
**Related branch:** `lo-manual-scoring` had playoff editor work that may be relevant

## What's needed

After a season is created via the wizard, operators need a way to go back
and edit season-level preferences:
- Season length (number of regular weeks)
- Playoff weeks / playoff format
- Other season settings as they're added

Currently the Season Creation Wizard sets these values and the Schedule
Manager handles the week-by-week calendar, but there's no standalone
"edit season settings" page to change the numbers after creation.

## Where it might live

- A "Season Settings" section on the league detail page
- Or a settings tab within the Schedule Manager
- The playoff editor from `lo-manual-scoring` branch may cover part of this

## Notes

- Season preferences should follow the same cascade pattern as league preferences
- Changes to season length after schedule generation may require schedule regeneration
- Playoff format changes may require playoff bracket regeneration
