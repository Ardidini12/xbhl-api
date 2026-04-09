Admin Scheduler & Match Management System

  Implement a centralized background task management system to pull NHL game data from the EA Pro Clubs API and a raw match storage/editing system.

  1. Data Modeling (Backend)
  File: backend/app/models.py
   - Scheduler Model:
     - id: UUID (Primary Key).
     - league_id: UUID (Foreign Key to League).
     - season_id: UUID (Foreign Key to Season).
     - days: JSON/List of strings (e.g., ["Monday", "Tuesday"]).
     - start_time: Time object.
     - end_time: Time object.
     - interval_minutes: Integer.
     - is_enabled: Boolean (Admin toggle state).
     - last_run_at: DateTime (Audit field).
     - Constraints: Unique constraint on (league_id, season_id).
   - Match Model:
     - match_id: String (Primary Key - mapping to matchId from EA API).
     - league_id: UUID (Foreign Key).
     - season_id: UUID (Foreign Key).
     - raw_data: JSON (The full match object response).
     - created_at: DateTime.
     - updated_at: DateTime (To track admin edits).

  2. Background Orchestration (Backend)
  File: backend/app/core/scheduler.py (New)
   - Implement AsyncIOScheduler (APScheduler).
   - Dynamic Job Management: Must add, modify, or remove jobs in the background runner immediately upon API changes.
   - Window Logic:
       - Every X minutes, check: Is is_enabled True? Is today in days? Is current time between start_time and end_time?
       - Active/Running: Enabled and inside window.
       - Active/Idle: Enabled but outside window.
       - Stopped: Stopped by admin.

  3. EA Data Puller Service (Backend)
  File: backend/app/services/ea_api.py (New)
   - API Integration: Use httpx with the provided browser headers (User-Agent, Origin, etc.) to fetch from https://proclubs.ea.com/api/nhl/clubs/matches....
   - Deduplication: For every match found, check the Match table by match_id. Skip if it exists; insert if new.
   - Automatic Sync: Upon inserting a new Match entry, trigger a sync to update the core Game, PlayerStats, and Standing models. (Later on, not now as we still don't have the logic for it)

  4. API Layer (Backend)
  Files: backend/app/api/routes/schedulers.py & matches.py
   - Schedulers: Standard CRUD + /start, /stop, /resume /delete actions.
   - Matches:
       - GET /: List raw matches with server-side filtering (by club name), sorting, and pagination.
       - PATCH /{match_id}: Allow admin to modify the raw_data JSON directly.
       - DELETE /: Support for bulk deletion.

  5. UI: Schedulers Dashboard (Frontend)
  Path: frontend/src/routes/_layout/admin/schedulers.tsx
   - Sidebar: Add "Schedulers" link with a gear icon in the Admin section.
   - Table View: Show League, Season, Timeframe (ET / America/New_York), Interval, and Status Badges (🟢 Running, 🟡 Idle, 🔴 Stopped).
   - Modals: Create/Edit with multi-day selection and time pickers.
   - Actions: Conditional Start/Stop/Resume and Edit/Delete in a row-level menu.

  6. UI: Matches Management (Frontend)
  Path: frontend/src/routes/_layout/admin/matches.tsx
   - Sidebar: Add "Matches" link with an activity icon.
   - Match List:
       - Display cards/rows with Match ID, Timestamp (converted to readable ET / America/New_York date and time), Club 1 vs Club 2, and Score.
       - Search: Case-insensitive dynamic filter by club names.
   - Expandable Raw Editor:
       - When a match row is clicked, expand to show a JSON editor (with syntax highlighting).
       - Allow admin to edit any field and "Save" to update the raw data and trigger a re-sync.

  7. Standards & UX (Memory Check)
   - Timezone: All timestamps MUST be displayed in ET / America/New_York.
   - Infinite Scroll: Implement on both Schedulers and Matches pages.
   - Bulk Ops: Include "Select All" and "Delete Selected" for matches.


request curl: 
curl 'https://proclubs.ea.com/api/nhl/clubs/matches?matchType=club_private&platform=common-gen5&clubIds=8501' \
  -H 'accept: application/json' \
  -H 'accept-language: en-US,en;q=0.9,sq;q=0.8,hy;q=0.7' \
  -H 'origin: https://www.ea.com' \
  -H 'priority: u=1, i' \
  -H 'referer: https://www.ea.com/' \
  -H 'sec-ch-ua: "Chromium";v="146", "Not-A.Brand";v="24", "Google Chrome";v="146"' \
  -H 'sec-ch-ua-mobile: ?0' \
  -H 'sec-ch-ua-platform: "Linux"' \
  -H 'sec-fetch-dest: empty' \
  -H 'sec-fetch-mode: cors' \
  -H 'sec-fetch-site: same-site' \
  -H 'user-agent: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36'

  as you can see the club id is the ea id we take from clubs page. when we add a club to the platform, we make a request to the ea api to get its id.
  we need that id in order to get games from the endpoint.

  response looks like this (sanitized example):
[
    {
        "matchId": "REDACTED_MATCH_ID",
        "timestamp": 1234567890,
        "timeAgo": {
            "number": 9,
            "unit": "days"
        },
        "clubs": {
            "CLUB_ID_1": {
                "clubDivision": "3",
                "score": "5",
                "opponentScore": "7",
                "details": {
                    "name": "Club Name 1",
                    "clubId": "REDACTED_CLUB_ID_1"
                }
            },
            "CLUB_ID_2": {
                "clubDivision": "10",
                "score": "7",
                "opponentScore": "5",
                "details": {
                    "name": "Club Name 2",
                    "clubId": "REDACTED_CLUB_ID_2"
                }
            }
        },
        "players": {
            "CLUB_ID_1": {
                "PLAYER_ID_1": {
                    "position": "center",
                    "playername": "AnonymizedPlayer1",
                    "skgoals": "2",
                    "skassists": "1"
                }
            }
        },
        "aggregate": {
            "CLUB_ID_1": {
                "skgoals": 5,
                "skassists": 7
            }
        }
    }
]       