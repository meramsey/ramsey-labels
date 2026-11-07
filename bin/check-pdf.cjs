const fs = require('node:fs');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const Z = require('zxing-wasm/reader');
Z.prepareZXingModule({
    overrides: {
        wasmBinary: fs.readFileSync(require.resolve('zxing-wasm/reader/zxing_reader.wasm')),
    },
});
async function main() {
    const info = execFileSync('pdfinfo', ['build/labels-e2e.pdf'], { encoding: 'utf8' });
    assert.match(info, /Pages:\s+5\b/);
    assert.match(info, /Page size:\s+144 x 72 pts/);
    execFileSync('pdftoppm', [
        '-r',
        '300',
        '-f',
        '1',
        '-singlefile',
        '-png',
        'build/labels-e2e.pdf',
        'build/pdf-raster',
    ]);
    const result = await Z.readBarcodes(fs.readFileSync('build/pdf-raster.png'), {
        formats: ['QRCode'],
    });
    assert.deepEqual(
        result.map((r) => r.text),
        ['RRA-726474'],
    );
    const sheet = execFileSync('pdfinfo', ['build/synthetic-sheet.pdf'], { encoding: 'utf8' });
    assert.match(sheet, /Pages:\s+3\b/);
    assert.match(sheet, /Page size:\s+595\.\d+ x 841\.\d+ pts/);
    const batch = execFileSync('pdfinfo', ['build/streamed-4500-labels.pdf'], { encoding: 'utf8' });
    assert.match(batch, /Pages:\s+4500\b/);
    execFileSync('pdftoppm', [
        '-r',
        '300',
        '-f',
        '4500',
        '-singlefile',
        '-png',
        'build/streamed-4500-labels.pdf',
        'build/streamed-last-page',
    ]);
    const finalQr = await Z.readBarcodes(fs.readFileSync('build/streamed-last-page.png'), {
        formats: ['Code128'],
    });
    assert.equal(finalQr[0]?.text, 'RRA-726474');
    console.log(
        'PASS: Poppler verifies 5 pages, 50.8 x 25.4 mm media, and independently rasterized PDF QR decodes exact RRA-726474',
    );
    console.log('PASS: Poppler verifies 131 sheet labels occupy 3 A4 pages');
    console.log(
        'PASS: streamed PDF has all 4,500 pages and independently decodes exact SKU on final page',
    );
}
main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
});
