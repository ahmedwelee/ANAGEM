#!/usr/bin/env python3
"""Builds backend/src/main/resources/dev/sample-content.json (dev profile only) from the Phase 2 prototype texts."""
import json, pathlib
root = pathlib.Path(__file__).resolve().parent.parent
D = {l: json.loads((root / f"web/i18n/{l}.json").read_text(encoding="utf-8")) for l in ("fr", "ar", "en")}
tr = lambda **keys: {l: {f: D[l][k] for f, k in keys.items() if k in D[l]} for l in D}
data = {
  "news": [
    dict(slug="sample-appel-a-communications", publishedAt="2026-10-12T09:00:00Z", category="events", featured=False, tags=["sample", "colloque"], translations=tr(title="news.1.t", summary="news.1.d")),
    dict(slug="sample-publication-numero-12", publishedAt="2026-10-03T09:00:00Z", category="publications", featured=False, tags=["sample", "revue"], translations=tr(title="news.2.t", summary="news.2.d")),
    dict(slug="sample-adhesion-en-ligne", publishedAt="2026-09-28T09:00:00Z", category="association", featured=False, tags=["sample"], translations=tr(title="news.3.t", summary="news.3.d")),
  ],
  "events": [
    dict(slug="sample-conseil-anagem-2026", type="MEETING", startsAt="2026-10-14T09:00:00Z", endsAt="2026-10-14T14:00:00Z", allDay=False, featured=False, translations=tr(title="ev.1.t", location="ev.1.p")),
    dict(slug="sample-seminaire-doctoral-2026", type="SEMINAR", startsAt="2026-11-22T00:00:00Z", endsAt="2026-11-22T00:00:00Z", allDay=True, featured=False, translations=tr(title="ev.3.t", description="ev.3.d", location="ev.3.p")),
    dict(slug="sample-journees-d-etude-2026", type="STUDY_DAY", startsAt="2026-12-12T00:00:00Z", endsAt="2026-12-13T00:00:00Z", allDay=True, featured=False, translations=tr(title="ev.4.t", description="ev.4.d", location="ev.4.p")),
  ],
  "publications": [
    dict(kind="MAGAZINE_ISSUE", year=2026, issue="12", featured=True, publishedAt="2026-10-03T09:00:00Z",
         translations={l: {"title": {"fr": "Géographie du Maroc — Numéro 12", "ar": "جغرافية المغرب — العدد 12", "en": "Géographie du Maroc — Issue 12"}[l], "description": D[l]["mag.sub"]} for l in D}),
  ],
}
out = root / "backend/src/main/resources/dev/sample-content.json"
out.write_text(json.dumps(data, ensure_ascii=False, indent=1), encoding="utf-8")
print("written", out.name)
