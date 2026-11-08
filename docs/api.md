# Developer integration API

These hooks and methods are local extension points, not a promise to mirror any other plugin.
Names already shipped in RC8 remain stable:

## PHP filters

```php
add_filter('rli_field_value', function ($value, $field, $product, $order, $item) {
    if ($field === 'meta:internal_color') {
        return $product ? $product->get_meta('internal_color', true) : $value;
    }
    return $value;
}, 10, 5);

add_filter('rli_records', function (array $records, array $request) {
    // Return scalar, schema-valid records. No output HTML is executed.
    return $records;
}, 10, 2);
```

`rli_field_value` values are scalarized and validated before rendering. `rli_records` is a
trusted PHP extension hook, but its return is schema-validated and constrained by the same
data, byte, quantity and rendering budgets. Never perform network calls or writes inside a
high-volume filter. Do not return credentials or customer/order data unless the invoking
operator is authorized and the data subject/retention policy permits it.

## JavaScript API

After the label administration page loads, `window.RamseyLabels` exposes:

- `version`
- `queueRecords(records)` — append validated scalar records (8 MB queue budget).
- `queueProducts(ids)` — resolve records through authenticated REST capabilities.
- `clear()`, `showPreview()`, `refresh()`, `cancel()`.
- `encode(format, payload, options)` — supported independent barcode encoder.
- `segment(records, profile, index)` — arithmetic bounded-segment descriptor.
- `exports.png(design, record, options)`, `exports.svg(design, record)` (complete visual label SVG with embedded raster images), `exports.barcodeSVG(design, record)` (barcode only),
  `exports.pdf(job)` and `exports.streamPDF(profile, records, writable, options)`.

Custom record shape: `{key, source, values: {field: scalar}, quantity, selected}`.
Keys use letters/digits/underscore/hyphen/dot/colon. Objects, functions, unsafe keys, NULs,
excessive field sizes and unbounded browser queue data are rejected. Integrations must not
use `innerHTML`, modify commerce data or send records to remote services.

`document.addEventListener('ramsey-labels:after-render', event => { ... })` fires for each
unique raster rendered. Event detail contains the temporary canvas, record index and profile
ID. Do not retain canvases or add unbounded pixels. Preferred PHP filters run before this
event; no arbitrary JavaScript from stored templates is executed. Full shipping-compatible
ABI stability requires a separately versioned API contract before general-public release.
