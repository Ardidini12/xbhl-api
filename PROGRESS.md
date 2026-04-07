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
