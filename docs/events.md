# What's next in Koh Tao

## Operating model

The /whats-next page shows published events for the next twelve calendar months in chronological order, with a category filter and no time-range selector. Times use Asia/Bangkok. Every entry links to its source; automated discovery never marks an event personally tested.

data/sources.json is the explicit registry of eleven connected sources. It includes official organizer calendars, ticket/festival data, class bookings, island calendars and community schedules. See [source-audit.md](source-audit.md) for integration methods, research candidates and limitations. Coverage is bounded, not an unrestricted internet or Instagram search.

scripts/collect_events.py uses Python's standard library. It respects robots.txt, follows bounded relevant links on approved hosts, parses Event JSON-LD, dated HTML schedules, public JSON feeds and official iCalendar, validates date/location, classifies, deduplicates and writes data/events.json. Summaries are original, factual one-sentence descriptions. No images, LLM API, paid search provider or scraping credentials are used.

## Automatic refresh

The GitHub Actions workflow runs every six hours at minute 17 (01:17, 07:17, 13:17 and 19:17 Thailand), on collector changes, or manually from Actions. It tests, fetches and commits only data/events.json. GitHub schedules may run late or be disabled after public-repository inactivity; monitor Actions if the feed becomes stale.

The website fetches the current JSON from the public repository's main branch. Data updates need no Vercel redeployment or token. The bundled JSON is an outage fallback. The UI shows the update date, flags checks over 48 hours old, and hides records not checked for seven days. Keep the repository public or replace the feed transport before making it private.

All-source failures preserve the prior file and fail the workflow. Partial failures retain affected last-known events for up to seven days, marked stale. Known cancelled/postponed events are excluded. Undated events, ambiguous venues and calendar entries not clearly on Koh Tao are excluded. Recurring entries use an explicitly published rule, never an inferred pattern. Official iCalendar recurrence respects UNTIL/COUNT, exclusions and overrides. Undated weekly programs are limited to the next four weeks and clearly labelled for reconfirmation. Missing times stay missing. Conflicting Hii UTC/time fields are flagged rather than shifting the explicitly published event day.

## Expanding coverage

Add a source with URL, allowed hosts, link pattern, page cap and parser. Prefer direct organizer calendars with Event JSON-LD. Other formats need a tested adapter. Visitor-supplied arbitrary URLs are never fetched.

Instagram is NOT connected. Meta Business Discovery / Hashtag Search require a separately authorized account and permissions and have coverage restrictions; they are not an unrestricted location/keyword search. Image-only posters need an explicit extraction/review step. Do not advertise Instagram coverage until implemented and verified.

Organizer data takes precedence over calendar copies. Known party-series aliases and class-name variants are deduplicated; distinct same-day sessions remain. Per-source health, page counts, errors and checked dates are stored in data/events.json. Monitor the Actions refresh job. An editorial approval queue and organizer submissions are possible follow-ups, not features of this version. The wider EAT/RELAX/etc. category wheel is separate from this event page.

Adapters live in scripts/event_adapters.py. The expanded collector uses six workers with a per-source time budget, allowlisted hosts, bounded page discovery and no paid dependencies.

Validation: python3 -m unittest discover -s tests; node --check events.js. Do not generate previews or screenshots; Paul tests the live site.
