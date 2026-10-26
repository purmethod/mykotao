import json
import unittest
from scripts import event_adapters as a
from scripts import collect_events as c


class AdapterTests(unittest.TestCase):
    def setUp(self):
        self.now = c.parse_date('2026-10-26T06:00:00+07:00')
        self.source = {'id': 'test', 'name': 'Test', 'kind': 'organizer', 'url': 'https://example.org/calendar', 'location': 'Koh Tao'}

    def ical(self, content):
        return a.ical('BEGIN:VCALENDAR\n' + content + '\nEND:VCALENDAR', self.source, self.source['url'], self.now)[0]

    def test_ics_unfold_escape_timezone_and_until(self):
        rows = self.ical('''BEGIN:VEVENT
UID:weekly
DTSTART:20261020T120000Z
DTEND:20261020T133000Z
RRULE:FREQ=WEEKLY;UNTIL=20261103T165959Z
SUMMARY:Beach & Reef
 Clean
LOCATION:Mae Haad\\, Koh Tao
END:VEVENT''')
        self.assertEqual([e['startDate'] for e in rows], ['2026-10-27T19:00:00+07:00', '2026-11-03T19:00:00+07:00'])
        self.assertEqual(rows[0]['name'], 'Beach & ReefClean')
        self.assertEqual(rows[0]['location'], 'Mae Haad, Koh Tao')
        self.assertEqual(rows[0]['endDate'], '2026-10-27T20:30:00+07:00')

    def test_ics_interval_count_exdate_and_cancelled_override(self):
        rows = self.ical('''BEGIN:VEVENT
UID:quiz
DTSTART;TZID=Asia/Bangkok:20261013T193000
RRULE:FREQ=WEEKLY;INTERVAL=2;BYDAY=TU;COUNT=5
EXDATE;TZID=Asia/Bangkok:20261027T193000
SUMMARY:Quiz
END:VEVENT
BEGIN:VEVENT
UID:quiz
RECURRENCE-ID;TZID=Asia/Bangkok:20261110T193000
DTSTART;TZID=Asia/Bangkok:20261110T193000
STATUS:CANCELLED
END:VEVENT''')
        # No UNTIL: only four weeks ahead. Both possible dates in this window are excluded.
        self.assertEqual(rows, [])

    def test_ics_moved_override_and_count_limit(self):
        rows = self.ical('''BEGIN:VEVENT
UID:talk
DTSTART:20261027T120000Z
RRULE:FREQ=WEEKLY;COUNT=2
SUMMARY:Talk
END:VEVENT
BEGIN:VEVENT
UID:talk
RECURRENCE-ID:20261103T120000Z
DTSTART:20261104T120000Z
SUMMARY:Rescheduled talk
END:VEVENT''')
        self.assertEqual([r['startDate'][:10] for r in rows], ['2026-10-27', '2026-11-04'])

    def test_ics_all_day_end_is_exclusive(self):
        rows = self.ical('''BEGIN:VEVENT
DTSTART;VALUE=DATE:20261101
DTEND;VALUE=DATE:20261104
SUMMARY:Retreat
END:VEVENT''')
        self.assertEqual(rows[0]['startDate'], '2026-11-01')
        self.assertEqual(rows[0]['endDate'], '2026-11-03')

    def test_unsupported_recurrence_rejected(self):
        with self.assertRaises(ValueError):
            self.ical('BEGIN:VEVENT\nDTSTART:20261027T120000Z\nRRULE:FREQ=YEARLY\nEND:VEVENT')

    def test_blue_chitta_dated_class_and_link_scope(self):
        html = '''<section id="day-2026-10-27"><article class="site-book-card"><span class="site-book-time">7:15pm-8:30pm</span><strong>Yin &amp; Nidra</strong><span class="site-book-meta">Blue Chitta<!-- --> · 350 thb</span></article></section><a href="/schedule/?week=2026-11-02">Next</a><a href="/schedule/?week=2026-11-02&amp;category=yoga">Filtered</a>'''
        rows, links = a.blue_chitta(html, self.source, 'https://bluechitta.com/schedule/', self.now)
        self.assertEqual(rows[0]['startDate'], '2026-10-27T19:15:00+07:00')
        self.assertEqual(rows[0]['name'], 'Yin & Nidra')
        self.assertEqual(rows[0]['location'], 'Blue Chitta, Koh Tao')
        self.assertEqual(links, ['https://bluechitta.com/schedule/?week=2026-11-02'])

    def test_todo_requires_channel_and_exact_event_date(self):
        data = {'channel': 'koh-tao', 'target_date': '2026-10-27', 'sections': [{'events': [
            {'name': 'Meetup', 'link': 'https://todo.today/koh-tao/2026/10/27/meetup', 'status': 'publish', 'venue': 'Local venue', 'start_time': '7:30 PM'},
            {'name': 'Wrong date', 'link': 'https://todo.today/koh-tao/2026/10/28/event', 'status': 'publish', 'venue': 'Local venue'}]}]}
        source = dict(self.source, dataUrl='https://todo.today/api/todo-today/v1/events?channel=koh-tao')
        rows, _ = a.todo_today(json.dumps(data), source, source['url'], self.now)
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]['startDate'], '2026-10-27T19:30:00+07:00')
        data['channel'] = 'koh-phangan'
        with self.assertRaises(ValueError):
            a.todo_today(json.dumps(data), source, source['url'], self.now)

    def test_jungle_uses_only_explicit_published_dates(self):
        rows, _ = a.jungle('<script type="application/json" id="jungle-party-data">[{"name":"Secret Party","date":"2027-01-04"}]</script>', self.source, self.source['url'], self.now)
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]['startDate'], '2027-01-04')
        self.assertEqual(rows[0]['location'], 'Karma Bar, Koh Tao')

    def test_hii_conflicting_utc_field_does_not_shift_published_day(self):
        raw = [{'title': 'Hii Festival Koh Tao - October 31st, 2026', 'date': '2026-10-31T21:30:00.000Z', 'endDate': '2026-11-01T06:00:00Z', 'status': 'PUBLISHED', 'location': 'Koh Tao'}, {'title': 'Draft', 'status': 'DRAFT'}]
        rows, _ = a.hii(json.dumps(raw), self.source, self.source['url'], self.now)
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]['startDate'], '2026-10-31')
        self.assertIsNone(rows[0]['endDate'])
        self.assertIn('disagree', rows[0]['note'])

    def test_changed_weekly_copy_fails_instead_of_inventing_dates(self):
        with self.assertRaises(ValueError):
            a.weekly_pages('No events this week.', dict(self.source, id='choppers'), self.source['url'], self.now)

    def test_weekly_program_rolling_limit_and_last_saturday(self):
        rows, _ = a.weekly_pages('Beach Cleanups Every Sunday at 17:30 h Ocean Insights Last Saturday of every month at 19:00 h', self.source, self.source['url'], self.now)
        talks = [e for e in rows if e['name'] == 'Ocean Insights']
        self.assertEqual([e['startDate'][:10] for e in talks], ['2026-10-31'])
        self.assertTrue(all(c.parse_date(e['startDate']) < self.now + c.timedelta(days=28) for e in rows))

    def event(self, title, start, **kw):
        e = {'title': title, 'start': start, 'location': 'Blue Chitta, Koh Tao', 'sourceKind': 'organizer', 'url': 'https://example.org', 'dateOnly': False}
        return dict(e, **kw)

    def test_dedup_keeps_different_class_sessions(self):
        am = self.event('Yoga', '2026-10-27T08:00:00+07:00')
        pm = self.event('Yoga', '2026-10-27T17:00:00+07:00')
        self.assertEqual(len(c.deduplicate([am, pm])), 2)

    def test_dedup_official_class_wins_over_copied_am_pm_error(self):
        official = self.event('Candlelight Yin & Nidra', '2026-10-27T19:15:00+07:00')
        copied = self.event('Candlelight Yin & Nidra w/ Mica', '2026-10-27T07:15:00+07:00', sourceKind='calendar')
        self.assertEqual(c.deduplicate([copied, official]), [official])

    def test_dedup_class_with_optional_yoga_word(self):
        official = self.event('Ashtanga', '2026-10-27T09:30:00+07:00')
        copied = self.event('Ashtanga Yoga w/ Anuj', '2026-10-27T09:30:00+07:00', sourceKind='calendar')
        self.assertEqual(c.deduplicate([copied, official]), [official])

    def test_hii_discovers_only_published_linked_ticket_exports(self):
        raw = [{'title': 'Hii Festival', 'date': '2026-10-31T21:30:00+07:00', 'status': 'PUBLISHED', 'ticketUrl': 'https://www.eventpop.me/e/123456'}]
        _, links = a.hii(json.dumps(raw), self.source, self.source['url'], self.now)
        self.assertEqual(links, ['https://www.eventpop.me/event_details/123456/calendar.ics'])
        raw[0]['ticketUrl'] = 'https://untrusted.example/123456'
        self.assertEqual(a.hii(json.dumps(raw), self.source, self.source['url'], self.now)[1], [])

    def test_retreat_title_takes_precedence_over_activity_category(self):
        event = c.normalize({'name': '4 Days Freediving Retreat', 'startDate': '2026-10-28T09:00:00+07:00', 'location': 'Blue Chitta', 'category': 'sports'}, self.source, self.source['url'], self.now)
        self.assertEqual(event['category'], 'retreats')

    def test_dedup_jungle_and_named_escobar_party(self):
        official = self.event('Night of the Wild', '2026-10-30T22:00:00+07:00', location='Escobar, Koh Tao')
        copied = self.event('Jungle Party', '2026-10-30T00:00:00+07:00', sourceKind='calendar', dateOnly=True, location='Escobar, Koh Tao')
        self.assertEqual(c.deduplicate([copied, official]), [official])

    def test_dedup_recognizes_festival_alias(self):
        official = self.event('Hii Festival Koh Tao - October 31st, 2026', '2026-10-31T00:00:00+07:00', dateOnly=True, location='Koh Tao Island')
        copied = self.event('Hii Festival', '2026-10-31T21:30:00+07:00', sourceKind='calendar', location='Hii Festival Koh Tao')
        self.assertEqual(c.deduplicate([copied, official]), [official])


if __name__ == '__main__':
    unittest.main()
