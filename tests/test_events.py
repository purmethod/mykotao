import importlib.util
import unittest
from pathlib import Path

spec = importlib.util.spec_from_file_location("collector", Path(__file__).resolve().parents[1] / "scripts/collect_events.py")
c = importlib.util.module_from_spec(spec)
spec.loader.exec_module(c)

class EventTests(unittest.TestCase):
    def setUp(self):
        self.now = c.parse_date("2026-10-26T12:00:00+07:00")
        self.source = {"id": "test", "name": "Organizer", "kind": "organizer"}
        self.raw = {"name": "Yoga retreat", "startDate": "2027-01-04", "endDate": "2027-01-08", "location": {"name": "Koh Tao Yoga"}, "url": "https://example.com/event"}
    def event(self, **updates):
        return c.normalize(dict(self.raw, **updates), self.source, "https://example.com", self.now)
    def test_explicit_dates_and_location_required(self):
        self.assertIsNone(self.event(startDate="Next Friday"))
        self.assertIsNone(self.event(location=None))
        self.assertIsNone(self.event(startDate="2026-10-20", endDate="2026-10-21"))
        self.assertIsNone(self.event(startDate="2027-07-04", endDate="2027-07-08"))
    def test_cancelled_online_and_unsafe_links(self):
        self.assertIsNone(self.event(eventStatus="https://schema.org/EventCancelled"))
        self.assertIsNone(self.event(eventAttendanceMode="https://schema.org/OnlineEventAttendanceMode"))
        self.assertIsNone(self.event(url="javascript:alert(1)"))
    def test_bangkok_and_retreat_classification(self):
        event = self.event()
        self.assertEqual(event["category"], "yoga-retreats")
        self.assertTrue(event["start"].endswith("+07:00"))
        self.assertTrue(event["summary"].startswith("5-day"))
        self.assertFalse(event["personallyTested"])
    def test_malformed_eventon_iso(self):
        self.assertEqual(c.parse_date("2026-11-1T03:00+7:00").isoformat(), "2026-11-01T03:00:00+07:00")
    def test_finished_overnight_event_is_hidden(self):
        self.assertIsNone(self.event(startDate="2026-10-25T22:00:00+07:00", endDate="2026-10-26T04:00:00+07:00"))
    def test_nested_schema(self):
        self.assertEqual(len(list(c.walk_events({"@graph": [dict(self.raw, **{"@type": "Event"})]}))), 1)
    def test_dedup_prefers_organizer(self):
        direct = self.event()
        copy = dict(direct, sourceKind="calendar", sourceId="calendar")
        self.assertEqual(c.deduplicate([copy, direct]), [direct])
    def test_calendar_rejects_other_islands(self):
        self.source["kind"] = "calendar"
        self.assertIsNone(self.event(location={"name": "Koh Phangan Yoga"}))
    def test_escobar_overnight(self):
        page = c.Page('<h2>Wild Night</h2><p>2026-11-03</p><h6>Party Hours: 10pm-4am</h6><a href="https://example.com/buy/wild">Tickets</a>')
        parsed = c.escobar_events(page, dict(self.source, location="Escobar, Koh Tao"))
        self.assertEqual(parsed[0]["endDate"], "2026-11-04T04:00:00+07:00")
        self.assertEqual(parsed[0]["startDate"], "2026-11-03T22:00:00+07:00")

if __name__ == "__main__":
    unittest.main()

