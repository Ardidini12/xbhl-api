# Project Progress & Context Memory

This file tracks the features implemented, architectural decisions made, and the current state of the application.

## Core Template State
- [x] Backend: FastAPI + SQLModel + PostgreSQL
- [x] Frontend: React + TanStack Router + TanStack Query + shadcn/ui
- [x] Infrastructure: Docker Compose + Traefik + Mailcatcher
- [x] Tooling: uv (Python), bun (Frontend), prek (Linting)

## Feature Log

### [Initial State] - 2026-04-02
- Template successfully initialized.
- Authentication and Login flow active.
- Dashboard and User Settings pages functional.

### [Cleaned Up] - 2026-04-02
- Removed all "Items" sample logic from the project.
- Deleted `backend/app/api/routes/items.py`, `frontend/src/routes/_layout/items.tsx`, and associated components (`PendingItems`).
- Updated `User` model to remove the `items` relationship.
- Regenerated frontend API client and applied database migration to drop the `item` table.
- Cleaned up sidebar navigation to remove "Items" for both admin and regular users.
- Re-generated TanStack Router tree to remove stale routes.
- Verified all remaining tests pass (49/49).

### [Feature] XBHL Seasons Management - 2026-04-03
- Implemented `Season` model with relationship to `League`.
- Added CRUD operations and API endpoints for Seasons (including bulk delete and "end season").
- Updated Leagues page with a search filter bar for dynamic filtering.
- Updated League actions to include "Enter League" navigation.
- Created League-specific page (`/xbhl/{league_id}`) for managing seasons within a league.
- Implemented Seasons management:
    - Infinite scroll (25 items per batch).
    - Dynamic search filter with date format hint.
    - Create, Edit, End, and Delete (single/bulk) functionality for Seasons.
    - Automatic `start_date` registration on season creation.
- Applied database migration for the new `Season` model.
- **Fixed Build Errors:**
    - Added `read_league` endpoint to backend.
    - Added `date-fns` dependency to frontend.
    - Refactored XBHL routes to support child routes (moved leagues to `/xbhl/index`).
    - Implemented `validateSearch` for `/xbhl` route to handle optional search parameters.
    - Updated navigation throughout the app to satisfy new route schemas.
- Verified all backend tests pass for both Leagues and Seasons (12/12 new tests) — CI: [CI Run URL] @ [Commit SHA].
- Verified frontend builds successfully (`bun run build`) — CI: [CI Run URL] @ [Commit SHA].

### Fixed Build Errors (Regression Guards)
- **Backend `read_league` Endpoint:**
    - **Fix:** Restored missing endpoint for fetching a single league by ID.
    - **Regression Guard:** Added a dedicated test case `test_read_league` in `test_leagues.py` and ensured OpenAPI schema synchronization.
- **Frontend `date-fns` Dependency:**
    - **Fix:** Installed `date-fns` to resolve missing dependency error.
    - **Regression Guard:** Added a build-step check to verify dependency resolution and updated `package.json` to lock version.
- **XBHL Routing Refactor:**
    - **Fix:** Moved routes from `/xbhl` to `/xbhl/index` to resolve TanStack Router conflicts.
    - **Regression Guard:** Implemented route schema validation tests to assert child-route patterns and updated E2E tests to exercise `validateSearch` for `/xbhl`.
- **Navigation & Type Safety:**
    - **Fix:** Corrected broken imports and navigation logic in `Sidebar.tsx`.
    - **Regression Guard:** Enabled strict type-checking (`tsc`) in the CI pipeline to fail on broken route imports or navigation type errors.

### [Feature] Clubs Management & Relationships - 2026-04-07
- Implemented `Club` model with automated `ea_id` fetching from EA Pro Clubs API.
- Added many-to-many relationships between `Club`, `Season`, and `League` using link tables (`ClubSeasonLink`, `ClubLeagueLink`).
- Configured deletion logic to preserve clubs when linked seasons or leagues are deleted (history cleanup only).
- Created administrative Clubs management interface:
    - Infinite scroll and dynamic search.
    - Support for single and bulk club creation (with name cleaning).
    - Support for single and bulk deletion.
    - Logo display and EA ID integration.
- Refactored admin routing to support nested `/admin/clubs` path.
- Applied database migrations for the new `Club` model and relationship links.
- Verified all backend tests pass, including EA ID extraction and CRUD operations.

### [Feature] Admin Scheduler & Match Management System - 2026-04-09
- Implemented background task system using `APScheduler` to pull NHL game data from EA Pro Clubs API.
- Added `Scheduler` and `Match` data models:
    - `Scheduler`: Stores league/season targets, days of week, start/end times, and intervals.
    - `Match`: Stores raw JSON data from EA API with `matchId` primary key for automatic deduplication.
- Developed `ea_api` service for automated data pulling:
    - Authenticated requests using browser headers to bypass protection.
    - Deduplication logic to prevent redundant storage.
- Created Administrative Schedulers Dashboard:
    - Real-time status tracking: 🟢 Running (inside window), 🟡 Idle (outside window), 🔴 Stopped.
    - Dynamic job management (Start/Stop/Edit updates background tasks immediately).
    - Infinite scroll and league/season filtering.
- Created Administrative Matches Dashboard:
    - List view with Match ID, Club vs Club display, and EST timestamps.
    - **Expandable JSON Editor**: Allows admins to modify raw match data directly in the UI.
    - Support for bulk deletion and case-insensitive club name search.
- Configured FastAPI lifespan to initialize and resume background jobs on server startup.
- Applied database migrations for `scheduler` and `match` tables.
- Regenerated frontend API client to support new scheduler and match services.
- Changed League/Season on the Scheduler page to show actual League and Season names, not IDs.

### [Feature] Season Detail & Club Management - 2026-04-21
- **Backend Updates:**
    - Added `GET /seasons/{id}` to retrieve season details.
    - Added `GET /seasons/{id}/clubs` to list clubs assigned to a season with search and pagination support.
    - Added `POST /seasons/{id}/clubs` for bulk assigning clubs to a season.
    - Added `DELETE /seasons/{id}/clubs` for bulk removing clubs from a season.
- **Frontend Updates:**
    - Created `SeasonDetail.tsx` for managing a specific season's clubs with search filtering and bulk remove operations.
    - Created `AddClubsToSeason.tsx` dialog for searching and selecting clubs to add.
    - Implemented nested route `/_layout/xbhl/$leagueId/$seasonId` for the Season Detail page.
    - Enabled "Enter Season" navigation from the seasons list actions menu.

### [Fix/Optimization] Club Name Uniqueness & Deduplication - 2026-04-27
- **Database Integrity:**
    - Added a `unique=True` constraint and index to the `name` field in the `Club` model.
    - Implemented and executed a cleanup script to remove 60 duplicate club entries from the database prior to applying the migration.
    - Applied Alembic migration `b0d0df7ae555` to enforce uniqueness at the database level.
- **CRUD & API Enhancements:**
    - Updated `crud.create_club` to return an existing club if a name collision is detected instead of raising an error or creating a duplicate.
    - Updated `bulk_create_clubs` API route to handle duplicates gracefully, reporting the number of *new* clubs created.
    - Integrated name normalization (cleaning extra spaces) into all creation and update paths.
- **Verification:**
    - Updated `test_clubs.py` to assert that creating a club with an existing name returns the original record.
    - Added `test_bulk_create_duplicate_clubs` to verify graceful handling of duplicate names within a single bulk request.
    - Fixed `test_update_club` to avoid accidental unique constraint violations during test runs.
    - Verified all 9 club-related tests pass successfully.

14 may: 
Summary of Changes
*Note: The most recent dated entry below supersedes all earlier entries; earlier items are maintained for archival purposes.*

  Backend Enhancements
   - Statistics Endpoint: Added GET /api/v1/clubs/{id}/stats to retrieve match statistics for a specific club, grouped by league and season.
   - Match Filtering: Updated read_matches in backend/app/api/routes/matches.py to support filtering by league_id and season_id.
   - Data Models: Introduced ClubStatsPublic, LeagueStats, and SeasonStats in backend/app/models.py to support the new hierarchical statistics view.

  Frontend Enhancements
   - Club Detail Page: Created a new, visually rich Club Profile page (frontend/src/components/XBHL/ClubDetail.tsx) featuring:
       - Header: Large club logo and name with EA ID badge.
       - Overall Stats: Quick-view cards for total matches and leagues played.
       - Competition History: A hierarchical view using accordions:
           - Leagues: Displays total games per league.
           - Seasons: Displays total games per season.
           - Matches: An infinite scroll list of matches within each season, showing match IDs, dates, and scores.
       - Global Filter: A search bar to filter match history by opponent name or match ID.
   - Improved Navigation:
       - Updated Clubs.tsx to support single-click row navigation to the details page, adhering to the project's UX standards.
       - Implemented a "Back" button on the detail page for easy navigation.
   - Route Restructuring: Standardized club routes by creating a nested structure:
       - admin/clubs/index.tsx: The list view.
       - admin/clubs/$clubId.tsx: The detail view.
       - admin/clubs.tsx: A parent layout to manage route nesting.
  These changes provide a comprehensive and intuitive way to view a club's performance history across various competitions.

### Archive
29 april
- **Navigation Preference:** Always use single-click events to navigate to detail pages from list views (Leagues, Seasons, Clubs, Schedulers). This ensures a consistent and intuitive user experience across the application. Ensure that interactions with interactive elements within the row (like checkboxes or action menus) use `e.stopPropagation()` to prevent unwanted navigation. A "Back" button should always be present on detail pages.

10 may:
- **Navigation Update:**
    - Fixed double-click navigation paths in Leagues.tsx and Seasons.tsx.
    - Updated GEMINI.md to reflect the new double-click navigation standard and system rules.
    - Fixed Double-Click Navigation: Updated frontend/src/components/Admin/Schedulers.tsx to use TanStack Router's typed navigation API.

15 may: 
Scheduler Details Page: Fixed the infinite scroll labels for both activity logs and pending matches. When the end of the list is reached, it now displays the total number
      of actual items fetched (e.g., Total runs: 25) instead of continuing to show "Scroll for more".
   2. Unsaved Matches: 
       * Backend: Added a new PATCH /api/v1/schedulers/unsaved-matches/{match_id} endpoint and a corresponding UnsavedMatchUpdate model to allow updating the raw JSON data of
         unsaved matches.
       * Frontend: 
           * Updated the SchedulerDetail component to allow clicking on any unsaved match in the list.
           * Implemented a modal (Dialog) that displays the full raw JSON data of the unsaved match.
           * Added the ability to edit and save the JSON data directly within the modal, similar to how it works in the main matches table.
           * Regenerated the API client to include the new endpoint and models.

I've updated the requested components to use US Eastern Time (America/New_York) with an "ET" suffix. In frontend/src/components/Admin/SchedulerDetail.tsx, I
  updated formatDateTime and the inline date formatting for pending matches, and removed the unused date-fns import. In frontend/src/components/Admin/Schedulers.tsx, I
  corrected the getStatus function to ensure scheduler activity is accurately determined using the EST timeframe.


### [Feature] Club Statistics & Detail View - 2026-05-14
- **Backend Enhancements:**
    - Added `GET /api/v1/clubs/{id}/stats` to retrieve match statistics grouped by league and season.
    - Updated `read_matches` to support filtering by `league_id` and `season_id`.
    - Introduced `ClubStatsPublic`, `LeagueStats`, and `SeasonStats` models for hierarchical statistics.
- **Frontend Enhancements:**
    - Created `ClubDetail.tsx` with logo, EA ID badge, and competition history using accordions.
    - Implemented infinite scroll for matches within each season accordion.
    - Standardized club routes with nested structure: `admin/clubs/index.tsx`, `admin/clubs/$clubId.tsx`, and `admin/clubs.tsx`.
    - Adhered to single-click navigation standards for club detail access.

### [Feature] Player Statistics & Position Tracking - 2026-05-18
- **Database & Relationships:**
    - Implemented `MatchPlayerLink` many-to-many relationship to connect players directly to matches for efficient querying.
    - Updated `Match` and `Player` relationship logic to automatically populate links during the EA API pull process.
    - Applied Alembic migration `5cf3f39e8bab` to add the link table.
- **Backend Analytics:**
    - Updated `read_player` endpoint to calculate a player's **Most Frequent Position** on-the-fly from all linked match raw JSON data.
    - Implemented `POSITION_MAPPING` to translate internal EA position codes (e.g., `defenseMen`) to readable formats (e.g., `Defense`).
- **Frontend Enhancements:**
    - Updated `PlayerDetail.tsx` to display the calculated most frequent position in a Badge in the PlayerDetail header.
    - Ensured privacy standards by keeping EA IDs hidden from the player profile view.

### [Feature] Games Played Statistics (Link Tables) - 2026-05-20
- **Database & Performance Optimization:**
    - Implemented `MatchClubLink` table to explicitly track club participation in matches, enabling highly efficient statistics queries.
    - Updated EA API ingestion logic (`ea_api.py`) to automatically populate both `MatchClubLink` and `MatchPlayerLink` upon match persistence.
    - Applied Alembic migration `93d6413690c0` to create the link table.
    - Executed a backfill script (`backfill_links.py`) to populate participation links for all 54 existing matches.
- **Backend API Expansion:**
    - Refactored `GET /clubs/{id}/stats` to use indexed JOINs on `MatchClubLink`, significantly improving response times over JSON parsing.
    - Added `GET /players/{ea_id}/stats` to provide hierarchical games-played statistics for players, grouped by league and season.
- **Frontend Enhancements:**
    - Upgraded `PlayerDetail.tsx` to a full Profile view mirroring the Club Profile:
        - Header with Gamertag, Position, and Total Games summary cards.
        - Hierarchical Competition History with nested League/Season accordions.
        - Infinite scroll match list for players, allowing deep-dive into every game played.
        - Dynamic search/filter within match history by opponent or match ID.
    - Regenerated frontend API client to support the new player statistics service.

### [Fix/Optimization] Player Data Integrity & UI Robustness - 2026-05-17
- **Database & Migrations:**
    - Fixed `Add player model` migration (`231146874916`): Corrected primary key handling on `ea_id` and ensured safe `downgrade` with UUID backfilling.
- **Backend Performance & Concurrency:**
    - Optimized Scheduler routes: Replaced row-by-row deletion with efficient set-based `DELETE` operations for both activities and unsaved matches.
    - Fixed race condition in `save_players` service using `asyncio.Lock` to ensure atomic player creation during concurrent club processing.
    - Refactored `process_club_matches` to use granular commits, ensuring player data is persisted independently of match processing success.
- **Frontend Admin UI Enhancements:**
    - **Matches & Schedulers:** Fixed "Select All" toggle logic in both Matches and Scheduler Detail pages to correctly clear entire selections (including hidden items).
    - **Accessibility:** Added `aria-label` to the Player Detail back button and enhanced the Players list table with keyboard navigation (`Enter`/`Space`) and `role="button"`.
    - **Robustness:** Implemented explicit error state handling in the Players list to display backend failure messages instead of an empty state.


Implementation Summary

│ CSV Header         │ API Key (Source)         │ Logic for Aggregates │ Formula / Notes                      │
  ├────────────────────┼──────────────────────────┼──────────────────────┼──────────────────────────────────────┤
  │ POSITION           │ position                 │ Most Frequent        │ Pulled per match                     │
  │ RECORD (W/L/OTL)   │ Derived                  │ ADD                  │ Based on result (16385=W, etc.)      │
  │ GAMES PLAYED       │ N/A                      │ ADD                  │ +1 for every match processed         │
  │ GOALS              │ skgoals                  │ ADD                  │                                      │
  │ GOALS/GP           │ Calculated               │ / GP                 │ Total Goals / Games Played           │
  │ GAME WINNING GOALS │ skgwg                    │ ADD                  │                                      │
  │ ASSISTS            │ skassists                │ ADD                  │                                      │
  │ ASSISTS/GP         │ Calculated               │ / GP                 │ Total Assists / Games Played         │
  │ POINTS             │ skgoals + skassists      │ ADD                  │ Sum of goals and assists             │
  │ POINTS/GP          │ Calculated               │ / GP                 │ Total Points / Games Played          │
  │ POSSESSION         │ skpossession             │ ADD                  │ (Sum / 60) / GP (Min per Game)       │
  │ +/-                │ skplusmin                │ ADD                  │ Supports negative values             │
  │ SHOTS              │ skshots                  │ ADD                  │                                      │
  │ SHOT ATTEMPTS      │ skshotattempts           │ ADD                  │                                      │
  │ SCORING %          │ skshotpct                │ AVERAGE              │ Or (Total Goals / Total Shots) * 100 │
  │ MISSED SHOTS       │ skshotattempts - skshots │ ADD                  │ Derived from the two keys            │
  │ SHOTS ON NET %     │ skshotonnetpct           │ AVERAGE              │                                      │
  │ DEFELCTIONS        │ skdeflections            │ ADD                  │ (Note: CSV spelling "DEFELCTIONS")   │
  │ PASSES             │ skpasses                 │ ADD                  │                                      │
  │ PASSES/GP          │ Calculated               │ / GP                 │ Total Passes / Games Played          │
  │ PASS ATTEMPTS      │ skpassattempts           │ ADD                  │                                      │
  │ PA/GP              │ Calculated               │ / GP                 │ Total Pass Attempts / Games Played   │
  │ PASSING %          │ skpasspct                │ AVERAGE              │                                      │
  │ SAUCER PASSES      │ sksaucerpasses           │ ADD                  │                                      │
  │ SP/GP              │ Calculated               │ / GP                 │ Total Saucer Passes / Games Played   │
  │ HITS               │ skhits                   │ ADD                  │                                      │
  │ HITS/GP            │ Calculated               │ / GP                 │ Total Hits / Games Played            │
  │ GIVEAWAYS          │ skgiveaways              │ ADD                  │                                      │
  │ GIVEAWAYS/GP       │ Calculated               │ / GP                 │ Total Giveaways / Games Played       │
  │ TAKEAWAYS          │ sktakeaways              │ ADD                  │                                      │
  │ TAKEAWAYS/GP       │ Calculated               │ / GP                 │ Total Takeaways / Games Played       │
  │ INTERCEPTIONS      │ skinterceptions          │ ADD                  │                                      │
  │ INTERCEPTIONS/GP   │ Calculated               │ / GP                 │ Total Interceptions / Games Played   │
  │ BLOCKED SHOTS      │ skbs                     │ ADD                  │                                      │
  │ BLOCKS/GP          │ Calculated               │ / GP                 │ Total Blocks / Games Played          │
  │ PENALTY MINUTES    │ skpim                    │ ADD                  │                                      │
  │ PENALTIES DRAWN    │ skpenaltiesdrawn         │ ADD                  │                                      │
  │ PENALTY CLEARS     │ skpkclearzone            │ ADD                  │                                      │
  │ FACEOFFS WON       │ skfow                    │ ADD                  │                                      │
  │ FACEOFFS LOST      │ skfol                    │ ADD                  │                                      │
  │ FACEOFF WIN %      │ skfopct                  │ AVERAGE              │ Or Wins / (Wins + Losses) 

   1. Database Models (backend/app/models.py):
       * MatchPlayerStats: Stores the raw data for every player in every match. This serves as the "history log" you requested, allowing you to track exactly which match
         contributed what.
       * PlayerAggregateStats: Stores running totals for Overall Career, League Career, and Season levels.
       * PlayerDetailedStats: A specialized public schema that matches your CSV header order perfectly for frontend display.

   2. Statistics Service (backend/app/services/stats_service.py):
       * process_match_stats: An atomic function that handles the "Add" and "Subtract" logic.
       * Add Logic: When a match is saved, it creates history entries and increments the aggregate sums for all three levels (Season, League, Career).
       * Subtract Logic: When a match is deleted or edited, it subtracts those exact values from the aggregates and removes the history entries.

   3. Real-Time Integration:
       * backend/app/services/ea_api.py: Now triggers process_match_stats immediately after a match is successfully saved from the EA API.
       * backend/app/api/routes/matches.py: Triggers subtraction of stats before any match deletion or update, ensuring data integrity is never compromised.

   4. New API Endpoints (backend/app/api/routes/players.py):
       * GET /players/{ea_id}/detailed-stats: Returns the fully calculated statistics (averages, percentages, totals) in the exact order of your CSV. Supports filtering by
         league_id and season_id.
       * GET /players/{ea_id}/match-history: Returns the list of match history entries for a player, allowing the frontend to show the "Match History" view you requested.

  How Statistics are Calculated
   * Records: Wins and Losses are extracted from the match result (16385 for Win). OTL defaults to 0 as requested.
   * Averages: Derived on-the-fly from total sums (e.g., Total Goals / Games Played).
   * Percentages: Calculated as the average of the percentages reported by the API per match (e.g., Sum of skpasspct / Games Played).
   * Transparency: Every stat is linked to a match_id. If a match is changed or removed, the stats update instantly.


   @to do 
   Verify each finding against current code. Fix only still-valid issues, skip the
rest with a brief reason, keep changes minimal, and validate.

In `@backend/app/services/stats_service.py`:
- Around line 95-98: The otl field is never set and all non-wins are treated as
losses; update the record creation in stats_service.py where position, win,
loss, otl are assigned so otl reflects overtime/shootout losses (e.g., use an
is_otl or similar flag derived from the game result) and set loss to 1 only for
regulation losses (loss = 1 if not is_win and not is_otl; otl = 1 if is_otl).
Locate the block that builds the per-player dict (references: p_info, is_win,
win, loss, otl) and adjust the conditional logic to use the overtime-loss
indicator when incrementing loss vs otl.