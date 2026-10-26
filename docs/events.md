# What's next in Koh Tao

## Operating model

The /whats-next page shows published events up to six calendar months ahead, with 3/6 month and category filters. Times use Asia/Bangkok. Every entry links to its source; automated discovery never marks an event personally tested.

data/sources.json is the explicit registry: Escobar's organizer schedule, Koh Tao Yoga retreat pages, and the Koh Tao calendar on phangan.events. This is bounded coverage, not an internet-wide or Instagram search.

scripts/collect_events.py uses Python's standard library. It respects robots.txt, follows bounded relevant links on approved hosts, parses Event JSON-LD or the Escobar schedule, validates date/location, classifies, deduplicates and writes data/events.json. Summaries are original, factual one-sentence descriptions. No images, LLM API, paid search provider or scraping credentials are used.

## Automatic refresh

The GitHub Actions workflow runs daily at 01:17 UTC (08:17 Thailand), on collector changes, or manually from Actions. It tests, fetches and commits only data/events.json. GitHub schedules may run late or be disabled after public-repository inactivity; monitor Actions if the feed becomes stale.

The website fetches the current JSON from the public repository's main branch. Data updates need no Vercel redeployment or token. The bundled JSON is an outage fallback. The UI shows the update date, flags checks over 48 hours old, and hides records not checked for seven days. Keep the repository public or replace the feed transport before making it private.

All-source failures preserve the prior file and fail the workflow. Partial failures retain affected last-known events for up to seven days, marked stale. Known cancelled/postponed events are excluded. Undated events, ambiguous venues and calendar entries not clearly on Koh Tao are excluded. Recurrence is never extrapolated into invented future dates.

## Expanding coverage

Add a source with URL, allowed hosts, link pattern, page cap and parser. Prefer direct organizer calendars with Event JSON-LD. Other formats need a tested adapter. Visitor-supplied arbitrary URLs are never fetched.

Instagram is NOT connected. Meta Business Discovery / Hashtag Search require a separately authorized account and permissions and have coverage restrictions; they are not an unrestricted location/keyword search. Image-only posters need an explicit extraction/review step. Do not advertise Instagram coverage until implemented and verified.

Per-source health, page counts, errors and checked dates are stored in data/events.json. Monitor the Actions refresh job. An editorial approval queue and organizer submissions are possible follow-ups, not features of this version. The wider EAT/RELAX/etc. category wheel is separate from this event page.

Validation: python3 -m unittest discover -s tests; node --check events.js. Do not generate previews or screenshots; Paul tests the live site.
