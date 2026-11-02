#!/usr/bin/env python3
"""Generates web/i18n/fr.json from the French text authored in web/index.html (+ JS-driven extras)."""
import json, re, html, pathlib
root = pathlib.Path(__file__).resolve().parent.parent
src = (root / "web/index.html").read_text(encoding="utf-8")
out = {}
for m in re.finditer(r'<([a-z0-9]+)\b[^>]*\bdata-i18n="([^"]+)"[^>]*>([^<]*)</\1>', src):
    out[m.group(2)] = html.unescape(m.group(3)).strip()
for m in re.finditer(r'<[^>]*\bdata-i18n-attr="([^"]+)"[^>]*>', src):
    tag = m.group(0)
    for pair in m.group(1).split():
        attr, key = pair.split(":")
        a = re.search(r'\b' + re.escape(attr) + r'="([^"]*)"', tag)
        if a: out[key] = html.unescape(a.group(1))
out.update({
    "meta.title": "ANAGEM — Association Nationale des Géographes Marocains",
    "meta.desc": "L'ANAGEM fédère les géographes marocains, produit et diffuse le savoir géographique, et contribue à l'éclairage des territoires et des politiques publiques.",
    "soon.msg": "Bientôt disponible : cette fonction sera reliée au CMS dans une prochaine phase.",
    "ev.status.upcoming": "À venir", "ev.status.ongoing": "En cours", "ev.status.past": "Terminé",
    "events.recent": "Récemment terminés",
    "feature.label.next": "Prochain colloque", "feature.label.ongoing": "Colloque en cours", "feature.label.past": "Dernier colloque",
    "city.tanger": "Tanger", "city.oujda": "Oujda", "city.kenitra": "Kénitra", "city.fes": "Fès", "city.rabat": "Rabat",
    "city.casablanca": "Casablanca", "city.marrakech": "Marrakech", "city.agadir": "Agadir", "city.laayoune": "Laâyoune", "city.dakhla": "Dakhla",
})
(root / "web/i18n").mkdir(exist_ok=True)
(root / "web/i18n/fr.json").write_text(json.dumps(out, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(len(out), "keys ->", "web/i18n/fr.json")
