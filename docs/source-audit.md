# Koh Tao source audit

Research and integration review: 26–27 October 2026. This is a coverage register, not a claim that every event on the island can be found automatically. Koh Tao is the geographic scope; Koh Phangan, Koh Samui and Qatar are excluded.

## Connected collection sources

| Source | Collection method | Coverage and constraints |
| --- | --- | --- |
| [Escobar](https://www.kohtaoescobar.com/buy) | Official dated schedule | Individual party dates and published hours. |
| [Koh Tao Yoga](https://kohtaoyoga.com/retreats/) | Event JSON-LD and linked retreat schedules | Dated retreats, including 2027. Flexible/on-request retreats do not become invented events. |
| [phangan.events — Koh Tao](https://phangan.events/event-type-2/koh-tao/) | Event JSON-LD and linked island event pages | Koh Tao only. Both island landing pages are crawled; expanded allowance from 8 to 40 pages. |
| [Jungle Hostel party calendar](https://junglekohtao.com/party-calendar/) | Public `jungle-party-data` JSON embedded in the calendar | Explicit dates for Jungle Party, Secret Party, Leo Beach Music Festival and Hii. No times supplied; secondary calendar, subject to organizer changes. Twelve-month display boundary still applies. |
| [Goodtime Adventures & Beach Club](https://goodtimethailand.com/events/) | Official public iCalendar feed linked from the website | Dated one-offs, conservation, quiz nights and weekly beach-club program. Expand weekly recurrence only within published UNTIL/COUNT and the display window; honor EXDATE and cancelled/changed instances. |
| [Blue Chitta](https://bluechitta.com/schedule/) | Dated booking-day cards | Yoga, meditation, freediving, activities and courses. Follow published next-week links up to four weeks; stop when no dates are published. |
| [Todo Today](https://todo.today/) | Public website API, explicitly `channel=koh-tao` | Dated listings from studios, cafés and nightlife venues; rolling two-week discovery through the API's advertised days. Each event's URL date must match the requested day. |
| [Choppers](https://www.chopperskohtao.com/events-on-koh-tao/) | Verified weekly rules in official page text | Pub Crawl (check-in time), Jam Jar open mic, Pub Quiz. No annual promise: four-week rolling entries labelled weekly program. Stop parsing and flag the source if the published rule changes. |
| [Black Turtle Conservation](https://www.blackturtleconservation.com/community/) | Verified official weekly/monthly rules | Sunday beach cleanups and last-Saturday Ocean Insights talks. Four-week rolling entries, meeting point to be confirmed, weather dependent. |
| [Entrix — Koh Tao](https://www.entrix.club/th/koh-tao/events) | Event JSON-LD on linked island listings | Dated party listings with venue addresses; restrict discovery to Koh Tao paths. |
| [Hii Festival](https://hiifestivalkohtao.com/) | Public `/events` API used by the festival's own frontend | Only PUBLISHED records. Public Eventpop calendar exports linked by the organizer are also collected and take precedence when they supply an unambiguous time. No admin endpoints, accounts or credentials. Some UTC values conflict with the explicit date in the event title; those entries retain the published date, hide the disputed time and show a note. |

Source health, page count, upcoming raw listing count, errors and last check are stored in `data/events.json`. Raw per-source counts include overlapping copies; the event list is deduplicated. A reachable source with no future events is not equivalent to a guarantee of coverage.

Additional venues found through the connected island calendar include Ocean Sound, AC Bar Beachclub, Ibiza Beach Club, Jungle Hostel, Amanita Bakery, Prana Cafe and High the Moon. These are not seven additional direct integrations; their individual listings retain their actual source attribution.

## Further sources investigated

These are research candidates, not automatically connected feeds. They must not be represented as active integrations in the interface.

| Source | Finding / next integration requirement |
| --- | --- |
| [Ocean Sound yoga](https://www.oceansoundkohtao.com/yoga-classes) | Public class information; current dated classes also occur in Todo Today. A reliable direct dated feed was not established in this review. |
| [Koh Tao Tourism Association — festivals](https://visitkohtao.org/detail-sub/3/21/16/festival-events) | Useful festival/holiday discovery. General descriptions do not establish a specific future occurrence, venue and year. |
| [Tourism Association — live music](https://visitkohtao.org/detail-sub/3/21/55/live-music) | Useful venue/category discovery; generic sunset/live-band hours are not individually dated bookings. |
| [Tourism Authority of Thailand — Spotlight Koh Tao](https://www.tourismthailand.org/Events-and-Festivals/spotlight-koh-tao-2026-2) | Official festival discovery; require a future explicitly dated edition before importing. |
| [Koh Tao Festival](https://kohtaofestival.com/) | Website reviewed; older edition information must not be relabelled as a future event. |
| [Koh Tao Thailand events guide](https://kohtaothailand.com/events.html) | Useful party/venue discovery and weekly summaries. Secondary descriptions do not provide precise individual dates for every series. Avoid multiplying the same party copies. |
| [Khao San Road — Koh Tao](https://www.khaosanroad.com/events/city/koh-tao) | Additional Maya/Choppers listings; repeated/overlapping weekly entries. Needs a dedicated dated adapter and duplicate review. |
| [Megatix Secret Party](https://megatix.in.th/SECRETPARTY) | Automated access blocked by published robots policy in this environment. No bypass. Series dates may still be present in connected public island calendars. |
| [Megatix Leo Beach Music Festival](https://megatix.in.th/events/leo-beach-music-festival-13th-october-2026) | Known ticket listing, but past dates must not be reused as future dates. Same access constraint. |
| [Koh Tao Events Telegram](https://t.me/s/kohtao_events) | Cross-posts the island calendar but also forwards Koh Phangan events. Not an island-only source without per-event location validation; no connected Telegram feed. |
| [New Heaven Dive School](https://newheavendiveschool.com/blog-full-width/) | Conservation and community discovery. Article publication dates are not event dates. |
| [New Heaven Reef Conservation](https://newheavenreefconservation.org/) | Conservation program candidate; require published individual dates or an explicitly supported schedule. |
| [Sparkle Yoga retreats](https://sparklyoga.com/retreats.html) | Future Koh Tao retreat mentioned with dates to be confirmed; not imported until an actual date is published. |

## Social coverage and editorial limits

Instagram/Facebook are not automatically searched or imported. Organizer accounts, posters and Stories can contain events absent from public calendars. A separately authorized social API or organizer submission/review workflow is required for that coverage. Public web discovery does not imply unrestricted social-platform access. No messages have been sent to any organizer.

An automatically discovered event is not a personally tested recommendation. All listings link to their source. Do not claim “every event”, “all Instagram”, guaranteed attendance, or organizer confirmation beyond what the source actually publishes. Twelve months is the calendar's search/display window, not a claim that every venue has released a year of dates.
