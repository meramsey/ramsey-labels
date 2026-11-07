const { test } = require('node:test');
const assert = require('node:assert/strict');
const C = require('../../assets/core.js');
const B = require('../../assets/barcodes.js');
const Batches = require('../../assets/batches.js');
const fs = require('node:fs');
const Z = require('zxing-wasm/reader');
const zbar = require('@undecaf/zbar-wasm');
Z.prepareZXingModule({
    overrides: {
        wasmBinary: fs.readFileSync(require.resolve('zxing-wasm/reader/zxing_reader.wasm')),
    },
});

test('QR card binds exact SKU, not permalink, with product ID fallback', () => {
    const qr = C.defaultLibrary().templates.find((t) => t.id === 'qr-card');
    const e = qr.design.elements.find((e) => e.type === 'barcode');
    assert.equal(
        C.resolve(e.content, {
            sku: 'RRA-726474',
            id: '42',
            product_url: 'https://example.test/product',
        }),
        'RRA-726474',
    );
    assert.equal(C.resolve(e.content, { sku: '', id: '42' }), '42');
});
test('all factory profiles and templates validate', () => {
    C.validateLibrary(C.defaultLibrary());
    const shipped = require('../../assets/defaults.json');
    C.validateLibrary(shipped);
    assert.equal(shipped.profiles[0].design.width, 50.8);
    assert.equal(shipped.profiles[0].design.height, 25.4);
});
test('complete 2000-label roll batch has no three-page limit', () => {
    const job = C.paginate([{ quantity: 2000, values: {} }], C.defaultProfile());
    assert.equal(job.pages.length, 2000);
    assert.equal(job.pages.flat().length, 2000);
    assert.throws(() => C.paginate([{ quantity: 2001, values: {} }], C.defaultProfile()));
});
test('large total label quantities segment arithmetically without expanding a queue', () => {
    const profile = C.defaultProfile(),
        records = [
            { key: 'bulk', source: 'manual', quantity: 100000, values: { name: 'Synthetic' } },
        ];
    const parts = Array.from({ length: 50 }, (_, i) => Batches.segment(records, profile, i));
    assert.equal(parts[0].count, 50);
    assert.equal(parts[0].records[0].quantity, 2000);
    assert.equal(parts[49].records[0].quantity, 2000);
    assert.equal(parts[49].end, 100000);
    assert.deepEqual(Batches.segment(records, profile, 50).records, parts[49].records);
});
test('render segments account for decoded-canvas and encoded-cache budgets', () => {
    const profile = C.defaultProfile(),
        records = Array.from({ length: 100 }, (_, i) => ({
            key: 'unique-' + i,
            source: 'manual',
            quantity: 1,
            selected: true,
            values: { name: 'Unique ' + i, sku: 'S-' + i },
        }));
    const first = Batches.segment(records, profile, 0),
        last = Batches.segment(records, profile, first.count - 1);
    assert.ok(first.count > 1);
    assert.equal(first.records.length + last.records.length, 100);
    assert.ok(first.records.length < 100);
    assert.equal(last.end, 100);
});
test('external integration records are copied, scalar-only and bounded', () => {
    const clean = Batches.append(
        [],
        [
            {
                key: 'extern',
                source: 'manual',
                quantity: 2,
                values: { name: 'External', sku: 'RRA-726474' },
            },
        ],
    );
    assert.equal(clean[0].values.name, 'External');
    assert.throws(() => Batches.append([], [{ values: { constructor: 'unsafe' } }]));
    assert.throws(() =>
        Batches.append(
            [],
            [
                {
                    values: {
                        name: {
                            toString() {
                                return 'x';
                            },
                        },
                    },
                },
            ],
        ),
    );
});
test('record sorting is stable and queue order survives append/serialization', () => {
    let records = Batches.append(
        [],
        [
            { key: 'second', values: { name: 'Beta' }, quantity: 1 },
            { key: 'first', values: { name: 'Alpha' }, quantity: 1 },
        ],
    );
    records = Batches.sort(records, 'alpha-asc');
    assert.deepEqual(
        records.map((r) => r.key),
        ['first', 'second'],
    );
    records = Batches.append(records, [{ key: 'third', values: { name: 'Gamma' }, quantity: 1 }]);
    assert.deepEqual(
        Batches.sort(records, 'manual').map((r) => r.key),
        ['second', 'first', 'third'],
    );
    Batches.rememberManualOrder(records);
    assert.deepEqual(
        Batches.sort(records, 'manual').map((r) => r.key),
        records.map((r) => r.key),
    );
});
test('GS1-128 validates fixed and variable application identifiers', () => {
    const value = '(01)09506000134352(17)260101(10)LOT42';
    const payload = B.gs1Payload(value);
    assert.equal(payload, '01095060001343521726010110LOT42');
    assert.equal(B.encode('code128', payload, { gs1: true }).text, payload);
    assert.throws(() => B.gs1Payload('(01)123(99)BAD'));
    assert.throws(() => B.gs1Payload('(17)261332'));
});
test('common GS1-128 payload independently decodes with separators intact', async () => {
    const human = '(01)09506000134352(17)260101(10)LOT42(21)SERIAL9';
    const expected = '01095060001343521726010110LOT42\x1d21SERIAL9';
    const symbol = B.encode('code128', B.gs1Payload(human), { gs1: true });
    const decoded = await Z.readBarcodes(pixels(symbol), {
        formats: ['Code128'],
        textMode: 'Plain',
    });
    assert.equal(decoded[0]?.text, expected);
});
test('HTML compatibility aliases collect and resolve custom fields without evaluating input', () => {
    const design = {
        mode: 'html',
        html: '[product-id] [product-sku] [cf name="_color"] [attr=value="size"] [order-item-meta-field value="_batch"] [barcode_img_url]',
        elements: [],
        css: '',
        htmlBarcodeSource: '',
    };
    const fields = C.requestedFields(design);
    for (const field of [
        'id',
        'sku',
        'meta:_color',
        'attr:size',
        'item_meta:_batch',
        'barcode_image',
    ])
        assert.ok(fields.includes(field), field);
    const record = {
        values: {
            id: '42',
            sku: 'RRA-726474',
            'meta:_color': 'Blue',
            'attr:size': 'M',
            'item_meta:_batch': 'A-1',
            barcode_image: 'https://example.test/no-load',
        },
    };
    assert.equal(
        C.resolve(design.html, record),
        '42 RRA-726474 Blue M A-1 https://example.test/no-load',
    );
    assert.equal(C.resolve('{{name}}', { values: { name: '{{sku}}' } }), '{{sku}}');
});
test('currency-symbol visibility is an explicit validated design preference', () => {
    const design = C.defaultDesign();
    design.showCurrency = false;
    assert.deepEqual(C.validateDesign(design), []);
    design.showCurrency = 'false';
    assert.ok(C.validateDesign(design).some((error) => error.includes('currency symbol')));
});
test('sheet pagination honors skip, offsets, column flow and boundaries', () => {
    const p = C.defaultLibrary().profiles[1];
    p.page.start = 64;
    p.page.offsetX = 1;
    p.page.offsetY = -1;
    const j = C.paginate([{ quantity: 3, values: {} }], p);
    assert.deepEqual(
        j.pages.map((p) => p.length),
        [1, 2],
    );
    assert.equal(j.pages[1][0].x, 5.65);
    p.page.flow = 'column';
    p.page.start = 1;
    assert.equal(C.paginate([{ quantity: 1, values: {} }], p).pages[0][0].y, 30.9);
});
test('CSV export neutralizes spreadsheet formulas and preserves exact round trip', () => {
    const records = [
        {
            quantity: 2,
            values: {
                name: '=HYPERLINK("bad")',
                sku: '001-ABC',
                barcode: '',
                price: '-12',
                note: "'test",
            },
        },
    ];
    const csv = C.exportCSV(records);
    assert.match(csv, /'=HYPERLINK/);
    const r = C.csvRecords(csv)[0];
    assert.deepEqual({ ...r.values }, records[0].values);
    assert.equal(r.quantity, 2);
});
test('malformed CSV, duplicate headers and prototype keys are rejected', () => {
    for (const csv of ['name,name\na,b', '__proto__,name\na,b', 'name\n"oops', 'name\n"a"bad'])
        assert.throws(() => C.parseCSV(csv));
});
test('checksum validation rejects malformed retail codes', () => {
    assert.throws(() => B.encode('ean13', '4006381333932'));
    assert.throws(() => B.encode('ean8', 'RRA-726474'));
    assert.throws(() => B.encode('code39', 'lowercase'));
});
function pixels(symbol) {
    const scale = 4,
        q = symbol.quiet;
    const height = symbol.kind === 'linear' ? 80 : symbol.height;
    const w = (symbol.width + 2 * q) * scale,
        h = (height + 2 * q) * scale;
    const data = new Uint8ClampedArray(w * h * 4);
    data.fill(255);
    for (let y = 0; y < height; y++)
        for (let x = 0; x < symbol.width; x++)
            if (symbol.matrix[symbol.kind === 'linear' ? 0 : y][x]) {
                for (let dy = 0; dy < scale; dy++)
                    for (let dx = 0; dx < scale; dx++) {
                        const i = (((y + q) * scale + dy) * w + (x + q) * scale + dx) * 4;
                        data[i] = data[i + 1] = data[i + 2] = 0;
                    }
            }
    return { data, width: w, height: h };
}
for (const [format, payload, decoder] of [
    ['code128', 'RRA-726474', 'Code128'],
    ['code39', 'RRA-726474', 'Code39'],
    ['ean13', '4006381333931', 'EAN-13'],
    ['ean8', '96385074', 'EAN-8'],
    ['upca', '036000291452', 'UPC-A'],
    ['upce', '04252614', 'UPC-E'],
    ['qrcode', 'RRA-726474', 'QRCode'],
    ['datamatrix', 'RRA-726474', 'DataMatrix'],
    ['code128', 'abc-123XY', 'Code128'],
    ['qrcode', 'SKU-É-001', 'QRCode'],
    ['datamatrix', 'SKU-É-001', 'DataMatrix'],
])
    test(`${format}: independent ZXing decode of ${payload}`, async () => {
        const symbol = B.encode(format, payload);
        assert.ok(symbol.quiet >= (symbol.kind === 'linear' ? 10 : format === 'qrcode' ? 4 : 1));
        const result = await Z.readBarcodes(pixels(symbol), {
            formats: [decoder],
            tryHarder: true,
            textMode: 'Plain',
        });
        assert.equal(result.length, 1);
        if (format === 'upca' || format === 'upce') {
            // ZXing-C++ canonicalizes retail results to EAN-13. Verify those
            // exact bytes too, then use ZBar with an explicit UPC hint to
            // independently verify the original, unexpanded payload.
            assert.equal(result[0].text, format === 'upca' ? '0' + payload : '0' + symbol.expanded);
            const scanner = await zbar.ZBarScanner.create();
            scanner.setConfig(
                zbar.ZBarSymbolType.ZBAR_NONE,
                zbar.ZBarConfigType.ZBAR_CFG_ENABLE,
                0,
            );
            scanner.setConfig(
                format === 'upca' ? zbar.ZBarSymbolType.ZBAR_UPCA : zbar.ZBarSymbolType.ZBAR_UPCE,
                zbar.ZBarConfigType.ZBAR_CFG_ENABLE,
                1,
            );
            if (format === 'upca')
                scanner.setConfig(
                    zbar.ZBarSymbolType.ZBAR_EAN13,
                    zbar.ZBarConfigType.ZBAR_CFG_ENABLE,
                    1,
                );
            const decoded = await zbar.scanImageData(pixels(symbol), scanner);
            scanner.destroy();
            assert.equal(decoded.length, 1);
            assert.equal(decoded[0].decode(), payload);
        } else assert.equal(result[0].text, payload);
    });
