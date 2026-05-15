# Gemini CLI Instructional Context

This file provides instructional context for the Gemini CLI agent when interacting with the **Full Stack FastAPI Template** project.

## Project Overview

This is a full-stack web application template featuring a FastAPI backend and a React frontend. It's designed for scalability, security, and developer productivity.

### Core Technologies
- **Backend:** [FastAPI](https://fastapi.tiangolo.com/), [SQLModel](https://sqlmodel.tiangolo.com/) (ORM), [PostgreSQL](https://www.postgresql.org/), [Pydantic](https://docs.pydantic.dev/) (validation), [Pytest](https://pytest.org/).
- **Frontend:** [React](https://react.dev/), [Vite](https://vitejs.dev/), [TypeScript](https://www.typescriptlang.org/), [Tailwind CSS v4](https://tailwindcss.com/), [shadcn/ui](https://ui.shadcn.com/), [TanStack Router](https://tanstack.com/router), [TanStack Query](https://tanstack.com/query).
- **Tooling:** [uv](https://github.com/astral-sh/uv) (Python management), [bun](https://bun.sh/) (Frontend/Root scripts), [prek](https://prek.j178.dev/) (Linting/Pre-commit).
- **Infrastructure:** [Docker Compose](https://docs.docker.com/compose/), [Traefik](https://traefik.io/) (Proxy), [Mailcatcher](https://mailcatcher.me/) (Dev emails).

## Building and Running

### Using Docker Compose (Recommended)
- **Start Stack:** `docker compose watch`
- **Stop Stack:** `docker compose down`
- **View Logs:** `docker compose logs -f [service_name]` (e.g., `backend`, `frontend`, `db`)

### Local Development (without Docker)
#### Backend
1. `cd backend`
2. `uv sync` (install dependencies)
3. `fastapi dev app/main.py`
4. **Migrations:** `alembic upgrade head`
    - **Rollback:**
        - Step back one: `alembic downgrade -1`
        - Target specific: `alembic downgrade <revision_id>`
        - Reset all: `alembic downgrade base`
        - *Note: Check `alembic history` before downgrading.*
5. **Initial Data:** `python app/initial_data.py`

#### Frontend
1. `cd frontend`
2. `bun install`
3. `bun run dev` (starts Vite)

### Testing
- **Backend:** `cd backend && pytest` or `./scripts/test.sh`
- **Frontend (E2E):** `cd frontend && bunx playwright install && bun run test` (runs Playwright)

## Development Conventions

### Backend
- **Models:** Use `SQLModel` for both database and API schemas. Defined in `backend/app/models.py`.
- **API Routes:** Grouped by domain in `backend/app/api/routes/`.
- **CRUD:** Business logic is often abstracted into `backend/app/crud.py`.
- **Formatting/Linting:** Managed by `ruff`. Run via `uv run prek run --all-files` at root.


### Frontend
- **TanStack Router:** Always verify route IDs in `frontend/src/routeTree.gen.ts` when using `getRouteApi` or `navigate`. Note that route IDs for directories with an `index.tsx` (e.g., `xbhl/$leagueId.index.tsx`) must exactly match the generated output, often requiring a trailing slash (e.g., `/_layout/xbhl/$leagueId/`).
- **Build Validation:** ALWAYS run `bun run build` in the `frontend` directory (or at least `tsc -p tsconfig.build.json`) before finalizing changes to catch TypeScript errors that would otherwise break the Docker build.

### UI/UX Development Conventions
- **Search Filters:** Always provide a dynamic search bar that filters results as the user types (using case-insensitive matching).
- **Bulk Operations:**
    - Always include checkboxes for each row in a list.
    - Provide a "Select All" checkbox in the header.
    - Show a "Delete X selected" button when one or more items are selected.
- **Infinite Scroll:** Implement infinite scroll for lists that may grow large (e.g., leagues, seasons), with a "Scroll for more" or "Loading more..." indicator (automatic loading of more items as the user scrolls), and a total count at the end.
- **Action Menus:** Use a "three dots" icon (MoreVertical) for row-level actions, consistently including options like:
    - `Enter [Resource]` (for navigation to sub-resources).
    - `Edit [Resource]` (opens a modal).
    - `Delete` (opens a confirmation modal).
- **Modals:** Use Dialogs for creating and editing resources. Ensure required fields are marked and optional ones are explicitly labeled.
- **Dynamic Date Search:** When implementing search for resources with dates, include a hint for supported formats (e.g., "YYYY-MM-DD") and support searching by year, month, or full date.

## Key Directory Structure

- `backend/app/`: Core backend application logic.
    - `api/routes/`: Endpoint definitions.
    - `core/`: Configuration, database setup, and security.
    - `models.py`: Data models (SQLModel).
- `frontend/src/`: Frontend source code.
    - `components/`: UI components (shadcn/ui).
    - `routes/`: TanStack Router pages and layouts.
    - `client/`: Automatically generated API client.
- `scripts/`: Root-level utility scripts (mostly for CI/CD and client generation).
- `compose.yml`: Main Docker Compose configuration.

## Environment Configuration
- Primary configuration is handled via `.env` file at the root.
- Default values are provided in `.env.example`.
- Crucial variables for local dev: `DOMAIN`, `POSTGRES_PASSWORD`, `SECRET_KEY`, `FIRST_SUPERUSER_PASSWORD`.

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

  