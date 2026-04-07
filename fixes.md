Verify each finding against the current code and only fix it if needed.
verify if this fix is needed, if it is, fix it and report back, if not, give why it is not needed.

Inline comments:
In `@backend/app/api/routes/clubs.py`:
- Around line 25-45: The URL is built by interpolating cleaned_name directly in
fetch_ea_id which breaks for spaces and special characters; encode the club name
before inserting it into the URL (e.g., use urllib.parse.quote or httpx request
params) so cleaned_name is percent-encoded when building url, update the url
construction to use the encoded value (or pass {"clubName": cleaned_name} as
params to client.get) and add the required import (urllib.parse.quote) if using
manual encoding.
- Around line 102-124: The bulk_create_clubs endpoint uses asyncio.gather over
all items which can spawn unbounded concurrent fetch_ea_id requests
(DoS/rate-limit risk); change to run process_club with a concurrency limiter
(asyncio.Semaphore or an async pool) so each process_club(across clubs_in)
acquires/releases the semaphore before calling fetch_ea_id, and await tasks in
bounded batches instead of asyncio.gather(*) for the whole list; also enforce a
max input length check on clubs_in at the start of bulk_create_clubs to reject
overly large payloads.

In `@backend/tests/api/routes/test_clubs.py`:
- Around line 10-26: The test test_create_club makes real HTTP calls via the
fetch_ea_id function (in app/api/routes/clubs.py) causing flakiness; add an
HTTP-mocking fixture (e.g., respx or pytest-httpx) in conftest.py that
intercepts requests to https://proclubs.ea.com/api/nhl/clubs/search and returns
a deterministic JSON (mapping the expected EA ID to the club name), then update
the test_create_club invocation to include that fixture (e.g., mock_ea_api) so
the POST to the clubs endpoint uses the mocked response instead of calling
fetch_ea_id over the network.
- Around line 104-125: The test_bulk_create_clubs currently triggers real
concurrent EA API requests via asyncio.gather in the /clubs/bulk endpoint and
makes a brittle positional assertion; instead, patch/mock the function or HTTP
client used by that endpoint to contact EA (the async request helper invoked by
asyncio.gather) so the bulk handler receives deterministic mocked EA responses
(including ea_id "8501"), then change the verification to locate the created
club by name (e.g., search the response/db results for an item where ["name"] ==
"Zambroneez") and assert that that item's ["ea_id"] == "8501" rather than
assuming it is at index 0. Ensure the mock returns the expected payload for both
parallel requests so asyncio.gather runs without external network calls.

In `@frontend/src/components/XBHL/DeleteClub.tsx`:
- Line 35: The current invalidateQueries call in deleteSingleMutation and
deleteBulkMutation only invalidates ["clubs"] so filtered lists (e.g. ["clubs",
search]) don't refresh; update both queryClient.invalidateQueries calls inside
DeleteClub.tsx (the ones in deleteSingleMutation and deleteBulkMutation
handlers) to include the current search filter (e.g.
queryClient.invalidateQueries({ queryKey: ["clubs", search] })) or otherwise
invalidate the filtered key used elsewhere so filtered results refresh after
deletions.

In `@frontend/src/components/XBHL/EditClub.tsx`:
- Line 59: The current call queryClient.invalidateQueries({ queryKey: ["clubs"]
}) only targets the exact ["clubs"] key and won't refetch lists that include the
search param (e.g. ["clubs", search]); update the invalidation in EditClub.tsx
to match all club queries—replace the call with queryClient.invalidateQueries({
predicate: (query) => query.queryKey[0] === "clubs" }) (or an equivalent
non-exact invalidation) so any cached queries whose first key is "clubs" (as
used by Clubs.tsx) are refetched after edits.
- Around line 44-51: The form's defaultValues are only applied on mount so
EditClub's useForm(...) (ClubFormValues, clubSchema, defaultValues) shows stale
data when the dialog is reused; fix by watching the club prop and calling
form.reset(...) with the new values (name, logo || "", ea_id || "") inside a
useEffect that depends on [club, form], or alternatively supply the current
values via the useForm `values` prop so the form updates when club changes.

In `@frontend/src/components/XBHL/EditSeason.tsx`:
- Around line 73-78: Remove start_date from the EditSeason form and payload:
delete the start_date field from the form schema/UI in EditSeason.tsx (remove
its input and any label), stop converting and attaching start_date in the
requestBody (remove the start_date?: new Date(...) logic) so the object truly
matches the backend SeasonUpdate type, and ensure any form validation/messages
no longer reference start_date; this keeps the frontend payload consistent with
SeasonUpdate and removes the unsafe "as SeasonUpdate" masking.

In `@frontend/src/components/XBHL/Leagues.tsx`:
- Around line 45-47: The selection is only cleared on mount because the
useEffect that calls setSelectedIds([]) has an empty dependency array; restore
clearing when the search term changes by updating the useEffect dependencies so
that the effect depends on search (i.e., the useEffect that calls
setSelectedIds([]) should list search in its dependency array) so selectedIds is
reset whenever search changes and hidden items are not unintentionally deleted;
look for the useEffect, setSelectedIds, selectedIds and search identifiers in
Leagues.tsx to update this.

In `@frontend/src/components/XBHL/Seasons.tsx`:
- Around line 32-34: The useEffect that calls setSelectedIds([]) currently runs
only on mount, leaving previous selectedIds across league or search changes
which can cause DeleteSeason to send stale IDs; update the dependency array for
the useEffect in Seasons.tsx (the hook using setSelectedIds) to include leagueId
and search (e.g., [leagueId, search]) so selections are cleared whenever the
league or search filter changes, and optionally ensure DeleteSeason validates
selectedIds against the current result set before calling the backend.

In `@frontend/src/hooks/useCustomToast.ts`:
- Around line 10-15: showErrorToast currently expects (description: string,
error?: any) but handleError is bound with only one arg, causing the toast
description to be empty when using handleError.bind(showErrorToast); fix by
updating handleError so when it invokes the bound function it passes both the
message and the original error object (i.e., call this(errorMessage, error) or
equivalent) so showErrorToast receives the error as the second parameter;
reference the functions handleError and showErrorToast (and handleError.bind) to
locate where to change the invocation.

---

Outside diff comments:
In `@frontend/src/components/XBHL/EditSeason.tsx`:
- Line 136: In the EditSeason component update the Start Date field label to
indicate it's optional (e.g., change the FormLabel text for the start_date field
to "Start Date (Optional)") so the UI matches the form schema where start_date
is optional; locate the FormLabel rendered next to the start_date form control
in EditSeason and change its text accordingly (ensure any helper/placeholder
text or tests referencing the label are updated if needed).

---

Nitpick comments:
In `@backend/app/alembic/versions/51e851130dcc_add_club_model.py`:
- Around line 23-25: Add indexes for frequently queried columns by creating
sa.Index entries for the 'name' and 'ea_id' columns in the migration's upgrade()
— e.g., add sa.Index('ix_club_name', 'name') and sa.Index('ix_club_ea_id',
'ea_id') tied to the table created in this migration (the Club/club table where
sa.Column('name', ...) and sa.Column('ea_id', ...) are defined), and remove/drop
those same indexes in downgrade() (use sa.drop_index or op.drop_index with the
same index names) so the migration cleanly applies and reverts.

In `@backend/app/api/routes/clubs.py`:
- Around line 141-147: Normalize both the incoming name and the stored name
before comparing to avoid unnecessary EA API calls: compute a normalized version
of club_in.name (e.g., using the existing " ".join(club_in.name.split()) logic)
and compare it against a normalized db_club.name (apply the same normalization)
and only call fetch_ea_id(club_in.name) when the normalized values differ;
update club_in.ea_id from fetch_ea_id when appropriate and ensure club_in.name
is set to the normalized value used in the comparison.
- Around line 164-174: The bulk_delete_clubs endpoint currently ignores IDs that
don't exist and always returns success; modify bulk_delete_clubs to track which
IDs were found and deleted versus which were not found (use the existing
session.get(Club, id) lookup), delete only found clubs, session.commit(), and
return a Message that includes lists like deleted_ids and not_found_ids (or log
skipped IDs) so callers/auditors can see which UUIDs were actually removed;
update the function signature/return payload accordingly (referencing
bulk_delete_clubs, ids, session.get, session.delete, and Message).
- Around line 35-37: The code creates a new httpx.AsyncClient for each call (the
block using "async with httpx.AsyncClient() as client" in clubs.py); replace
this with a shared/reused AsyncClient to avoid per-request connection overhead:
create a single AsyncClient instance that is initialized once (module-level or
via the application's startup event) and closed on shutdown, then change the
code in the function that currently uses "async with httpx.AsyncClient() as
client" to call that shared client's get/post methods (keeping per-request
timeout and headers), ensuring proper lifecycle management so the client is not
re-created per request.
- Around line 43-44: The except block that currently reads "except Exception:
pass" in clubs.py should not silently swallow errors; replace it with explicit
error handling: catch specific exceptions (e.g.,
requests.exceptions.RequestException, ValueError) where applicable, log the
exception with a contextual message via the module logger (e.g.,
logger.error("...: %s", exc)), and either re-raise or return an appropriate
error response; for transient network errors consider a retry/backoff strategy
or raise a retryable exception. Locate the try/except around the failing
operation in clubs.py and update it to log the exception details and
handle/re-raise specific exception types instead of using a bare "except
Exception: pass".

In `@backend/app/models.py`:
- Around line 166-193: Club names currently have no uniqueness constraint (see
ClubBase.name / Club class) which permits duplicates; if names must be unique,
update the Field for the name attribute (either in ClubBase or override in the
Club table model) to include a uniqueness/index constraint (e.g., add
unique=True and index=True via the Field or via an sa_column with Column(...,
unique=True, index=True)) so the DB enforces uniqueness; if duplicate names are
intentional, leave as-is.

In `@backend/tests/api/routes/test_clubs.py`:
- Line 11: The tests test_create_club, test_create_club_with_big_name, and
test_bulk_create_clubs declare an unused db fixture parameter which triggers
static-analysis warnings; remove the db parameter from each test function
signature (or if you plan to use direct DB access later, keep it but annotate or
use it to avoid linter errors) so the parameters match actual usage and silence
the warning in those test functions.

In `@frontend/src/components/XBHL/ClubActions.tsx`:
- Around line 33-36: The DropdownMenuItem for "Club details" currently has a
no-op onClick (() => {}) — replace it with a real handler (e.g., openClubDetails
or navigateToClubDetails) that either opens the club details modal or routes to
the club details page; locate the DropdownMenuItem in ClubActions.tsx and wire
its onClick to the existing modal toggle or router push (use the component's
state handler or the app router/navigation helper) and remove the menu item if
no implementation exists yet. Ensure the handler uses the current club id/props
available in ClubActions and follows the component's existing patterns for
opening modals or navigation.

In `@frontend/src/components/XBHL/Clubs.tsx`:
- Around line 45-47: Remove the redundant useEffect that resets selectedIds to
an empty array on mount in the Clubs component: the state variable selectedIds
is already initialized to [] via useState<string[]>([]), so delete the entire
useEffect(() => { setSelectedIds([]) }, []) block (referencing selectedIds and
setSelectedIds in Clubs.tsx) to simplify the component.
- Line 17: When the search string changes, clear the current selection to avoid
stale IDs: update the search change handler (where useState's search and
setSearch are used) to also call setSelectedIds([]) (or the equivalent selected
state setter used in this component, e.g., selectedIds/setSelectedIds) and do
the same for other filter state changes referenced in the block around the Clubs
component (lines ~20-37) so selections are reset whenever visible results
change; alternatively add a useEffect that watches `search` (and other filter
state) and calls setSelectedIds([]) when they change.

In `@frontend/src/components/XBHL/CreateClub.tsx`:
- Line 140: The "Club Name" FormLabel in CreateClub (component CreateClub,
FormLabel for "Club Name") is missing a required-field indicator; update that
label to include an asterisk (e.g., "Club Name *" or use the UI library's
required indicator prop) so it matches the "(Optional)" convention used for
other fields and clearly marks the field as required in the modal.
- Line 123: The Tabs component call uses an unsafe cast (v as any); define a
proper union type for tab values (e.g., type TabValue = 'tab1' | 'tab2' | 'tab3'
or derive it from your tab options) and use it for the activeTab state and the
onValueChange handler: change the state declaration to const [activeTab,
setActiveTab] = useState<TabValue>(...) and update the Tabs prop to
onValueChange={(v: TabValue) => setActiveTab(v)} (or use the Tabs component's
exported value type if available) to remove the any cast in CreateClub.

In `@frontend/src/components/XBHL/EditClub.tsx`:
- Around line 86-93: EditClub's form labels are not following the guideline to
mark required fields and explicitly label optional ones; update the FormLabel
text inside the EditClub component (e.g., the "Club Name" FormLabel and the
labels for "Logo URL" and "EA ID") so required fields include a visible required
marker (such as an asterisk) and optional fields include the "(Optional)"
suffix, matching the pattern used in CreateClub.tsx; ensure the FormLabel
strings and any accessible label props are updated so the UI and screen-readers
reflect required vs optional status.

In `@frontend/src/routes/_layout/admin/index.tsx`:
- Around line 12-17: The users list currently uses getUsersQueryOptions with a
hardcoded limit (UsersService.readUsers({ skip: 0, limit: 100 })) which can
truncate results; change this to an infinite/query-by-page pattern and add
search filtering: replace getUsersQueryOptions/its usage with a
useInfiniteQuery-style implementation that calls UsersService.readUsers({ skip:
pageParam.skip, limit: pageParam.limit, q: searchTerm }) (or equivalent
pagination params), use a stable queryKey like ["users", searchTerm], implement
getNextPageParam based on total/count or returned nextSkip, add a "Load
more"/"Loading more..." indicator in the UI and a search input that updates
searchTerm and resets pagination when changed so the users list supports
infinite scroll and dynamic filtering.
