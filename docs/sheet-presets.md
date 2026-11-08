# Sheet presets, sources, and calibration

## Manufacturer layouts verified from published source templates

The preset geometries below were extracted from Avery's public product/template pages and their
linked blank Word templates. The `.doc` files are not copied into this repository or either
plugin ZIP. A4 is 210 × 297 mm. Counts and nominal label dimensions come from Avery's product/
template metadata. Grid positions/pitches were inspected in the blank Word template's VML geometry
and checked with LibreOffice PDF/SVG output. Product listings round some dimensions (e.g. 33.87 mm),
so millimeter values retain the source-template precision only where needed. These are software
coordinates, not a printer-feed guarantee.

| Preset | Paper/orientation | Label W × H (mm) | Grid | Left/top margin (mm) | Pitch X/Y (mm) | Source |
|---|---|---:|---:|---:|---:|---|
| Avery L7164, 12-up | A4 portrait | 63.50 × 71.9667 | 3 × 4 | 7.2141 / 4.6031 | 66.04 / 71.9667 | [Avery template L7164](https://www.avery.co.uk/template-l7164), [blank grid DOC](https://www.avery.co.uk/sites/avery.co.uk/files/avery_importer/template/files/Avery_L7164_Word_Template.doc) |
| Avery L7163, 14-up | A4 portrait | 99.06 × 38.10 | 2 × 7 | 4.6743 / 15.1875 | 101.60 / 38.10 | [Avery template L7163](https://www.avery.co.uk/template-l7163), [blank grid DOC](https://www.avery.co.uk/sites/avery.co.uk/files/avery_importer/template/files/Avery_L7163_WordTemplate.doc) |
| Avery L7162, 16-up | A4 portrait | 99.06 × 33.8667 (product listing rounds to 33.87) | 2 × 8 | 4.6743 / 13.0528 | 101.60 / 33.8667 | [Avery template L7162](https://www.avery.co.uk/template-l7162), [blank grid DOC](https://www.avery.co.uk/sites/avery.co.uk/files/avery_importer/template/files/Avery_L7162_WordTemplate.doc) |
| Avery L7160, 21-up | A4 portrait | 63.50 × 38.10 | 3 × 7 | 7.1967 / 15.1875 | 66.04 / 38.10 | [Avery template L7160](https://www.avery.co.uk/template-l7160), [blank grid DOC](https://www.avery.co.uk/sites/avery.co.uk/files/avery_importer/template/files/Avery_L7160_WordTemplate.doc) |
| Avery L7159, 24-up | A4 portrait | 63.50 × 33.86 | 3 × 8 | 7.1967 / 13.0886 | 66.04 / 33.8667 | [Avery template L7159](https://www.avery.co.uk/template-l7159), [blank grid DOC](https://www.avery.co.uk/sites/avery.co.uk/files/avery_importer/template/files/Avery_L7159_WordTemplate.doc) |
| Avery L7651, 65-up | A4 portrait | 38.10 × 21.1667 (product listing rounds to 21.17) | 5 × 13 | 4.6743 / 10.9361 | 40.64 / 21.1667 | [Avery template L7651](https://www.avery.co.uk/template-l7651), [blank grid DOC](https://www.avery.co.uk/sites/avery.co.uk/files/avery_importer/template/files/Avery_L7651_WordTemplate.doc) |

Pitch was read from successive shape positions in the blank Word grid; gaps are derived as pitch
minus the source template's label dimension. Right and bottom margins are calculated from A4 size,
left/top position, grid, label size and pitch; all six are non-negative. Every preset stores source
URLs and explicit `pitchX`/`pitchY` fields in
`assets/core.js`. Automated checks verify fit, non-overlap, all slot positions, first/last slots,
skip-start behavior, offsets, saved-profile serialization and one-page A4 PDF physical media.

The previous A4 65-up profile remains unchanged for RC10 saved-layout compatibility. Avery L7651
is a separate, source-backed exact-layout preset.

## Generic count layouts (not manufacturer claims)

The requested counts 12, 14, 16, 21, 24, 40, 44, 56, 65, 120, 189, 230, and 324 are offered as
generic grid starters. Only the six Avery layouts above carry manufacturer compatibility names.
The other counts—including generic alternatives to a verified count—do not claim a brand or stock
match. They start with a paper-size and row/column arrangement only; users must enter the actual
label size, margins, pitch/gaps and orientation from their own stock manufacturer. The UI keeps
this warning visible, serializes the generic preset ID, and does not infer label dimensions from
the label count.

The paper formats supported for generic layouts are A4 (210 × 297 mm), US Letter (215.9 × 279.4
mm), P4 (250 × 353 mm), and custom width/height. Generic landscape orientation swaps page width
and height. Thermal/roll geometry remains a separate custom-page mode.

## Printable calibration sheet

For sheet profiles, **Download calibration sheet SVG** creates a dimensioned, self-contained
vector sheet with the current label boxes, center marks, margins, offsets, pitch, orientation and
start-slot positions recorded in SVG metadata. Skipped initial slots are dashed in red. Print the
file at 100% / actual size, with fit-to-page scaling, printer margins and headers/footers disabled.
Measure the print against a ruler and adjust offsets on the target printer. This is a diagnostic
aid, not a hardware compatibility guarantee. Test one sheet on plain paper before adhesive stock.

Automated geometry proves file coordinates only. It cannot verify a printer's feed path, driver,
scaling behavior, paper stock or physical alignment; owner acceptance remains pending.
