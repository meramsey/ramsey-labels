# GS1 support matrix

**Scope:** this plugin encodes the documented subset below as GS1-128 (GS1 Application
Identifier element strings carried by Code 128). It does not claim general GS1, GS1 DataMatrix,
GS1 QR, EANcom, EPC, or full GS1 General Specifications conformance.

## Standards and verification sources

- GS1 General Specifications, current standards landing page: <https://ref.gs1.org/standards/genspecs/>.
- GS1 Application Identifier browser: <https://www.gs1.org/standards/barcodes/application-identifiers>.
- GS1 check digit calculator: <https://www.gs1.org/services/check-digit-calculator>.
- GS1-128/FNC1 and element-string rules are defined by the General Specifications; software
  references here are explanatory, not substitutes for the normative document.

The installed encoder is tested independently with ZXing-C++'s decoder and the generated group
separator is checked as ASCII GS (`0x1D`). This is executable subset evidence, not GS1
certification or verifier grading.

## Implemented AIs

| AI | Meaning | Format accepted | Encoding/validation |
|---|---|---|---|
| `00` | SSCC | Fixed 18 digits | Mod-10 GS1 check digit validated; GS1-128 leading FNC1 |
| `01` | GTIN of trade item | Fixed 14 digits in raw element strings; parenthesized input also accepts GTIN-8/12/13 and left-pads to 14 | Numeric and mod-10 check digit validated |
| `02` | GTIN of contained trade items | Fixed 14 digits | Numeric and mod-10 check digit validated |
| `10` | Batch/lot | Variable, 1–20 supported ASCII characters | ASCII GS separator inserted when followed by another AI |
| `11` | Production date | Fixed `YYMMDD` | Month/calendar day checked; day `00` accepted as the GS1 month-end convention |
| `15` | Best-before date | Fixed `YYMMDD` | Same date validation |
| `17` | Expiration date | Fixed `YYMMDD` | Same date validation |
| `21` | Serial number | Variable, 1–20 supported ASCII characters | ASCII GS separator inserted when followed by another AI |
| `30` | Variable count | Variable numeric, 1–8 digits | ASCII GS separator inserted when followed by another AI |
| `37` | Count of trade items | Variable numeric, 1–8 digits | ASCII GS separator inserted when followed by another AI |

For the human-readable form `(AI)value`, variable-length fields are separated automatically in
the encoded element string when another AI follows. Raw element strings must include ASCII GS
between variable fields. FNC1 is inserted at Code 128 start in GS1 mode; GS bytes inside the
element string are encoded as FNC1 separators.

## Support status

- **Supported:** only the AIs listed above and the stated character/length subset.
- **Partially supported:** parenthesized GTIN-8/12/13 normalization applies only to AIs `01` and
  `02`; year values are interpreted in the 2000–2099 range for calendar validation. Application
  context, allocation/licence validity, and semantic relationships between AIs are not verified.
- **Unsupported:** all other AIs, AI qualifiers, nested/extended AIs, GS1 DataMatrix, GS1 QR,
  composite symbols, application identifiers longer than two digits, and non-ASCII GS1 character
  set extensions. Unsupported input is rejected; the encoder does not guess field boundaries.
- **Requires external verification:** scanner interoperability, GS1 verifier grade, market-specific
  GS1 application rules, century interpretation outside the stated range, and conformity approval.

The encoder intentionally supports fewer characters than the full GS1 X character set. For AIs
`10` and `21` it currently accepts ASCII letters/digits, space, period, slash, and hyphen. For
security and deterministic parsing, do not paste parentheses into values or expect undocumented
AI syntax to be passed through.

## Test vectors

The automated unit/E2E suite covers:

- `(01)09506000134352(17)260101(10)LOT42(21)SERIAL9`, including the group separator before AI
  `21`, and independent ZXing-C++ decoding of the resulting GS1-128 symbol.
- Invalid/unsupported AI rejection, invalid check digits, fixed/variable field lengths, invalid
  dates, GTIN-8/12/13 normalization in parenthesized input, and rejection of short raw GTIN data.

Do not market “complete GS1 support” based on these vectors.
