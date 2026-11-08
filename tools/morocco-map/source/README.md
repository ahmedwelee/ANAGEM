# Source data of the regional map

`geoBoundaries-MAR-ADM1_simplified.geojson` — the twelve regions of Morocco (administrative level 1, 2015 regional division), southern
provinces included (MA-11 Laâyoune-Sakia El Hamra and MA-12 Dakhla-Oued Ed-Dahab).

| | |
|---|---|
| Provider | geoBoundaries (William & Mary geoLab), release **gbOpen**, <https://www.geoboundaries.org> |
| File | `releaseData/gbOpen/MAR/ADM1/geoBoundaries-MAR-ADM1_simplified.geojson` in <https://github.com/wmgeolab/geoBoundaries> (fetched 2026-11-08, 250 KB, unchanged here) |
| Underlying data | OpenStreetMap, via Wambacher (<https://wambachers-osm.website/boundaries/>), source data updated 2023-01-19 |
| Licence | **ODbL 1.0** for the boundary data (<https://www.openstreetmap.org/copyright>); geoBoundaries' own code and derivative works CC BY 4.0 |
| Credit required | "© OpenStreetMap contributors" and a mention of geoBoundaries. The public site shows it in the footer (`public.mapCredit`) |

Rebuild the shape used by the site: `cd tools/morocco-map && npm install && npm run build` (writes
`frontend/src/app/features/public/shared/morocco-regions.ts`).

This is open data, not ANAGEM's official cartography. If the association supplies its own region map, replace this file and run the build
again (see `docs/requirements`, question 1, about the official map and the depiction of the territory).
