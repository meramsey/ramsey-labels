const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const Z = require('zxing-wasm/reader');
Z.prepareZXingModule({
    overrides: {
        wasmBinary: fs.readFileSync(require.resolve('zxing-wasm/reader/zxing_reader.wasm')),
    },
});
test.beforeEach(async ({ page }) => {
    await page.goto('/wp-login.php');
    await page.locator('#user_login').fill('labels_admin');
    await page.locator('#user_pass').fill('local-test-only-password');
    await page.locator('#wp-submit').click();
    await page.goto('/wp-admin/admin.php?page=ramsey-labels');
    await expect(
        page.getByRole('heading', { name: 'Ramsey Labels — Designer & Print' }),
    ).toBeVisible();
});
test('keyboard designer edits persist; JSON library export/import preserves settings', async ({
    page,
}) => {
    const name = page.getByLabel('Profile name', { exact: true });
    const original = await name.inputValue();
    await name.fill('Synthetic keyboard profile');
    await name.press('Tab');
    await page.getByRole('button', { name: 'Save settings', exact: true }).click();
    await expect(page.locator('#rli-status')).toContainText('Saved to WordPress.');
    await page.reload();
    await expect(page.getByLabel('Profile name', { exact: true })).toHaveValue(
        'Synthetic keyboard profile',
    );
    const element = page.locator('.rli-element').first();
    await element.focus();
    await element.press('Enter');
    await expect(page.getByRole('heading', { name: 'Element properties' })).toBeVisible();
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Export library', exact: true }).click();
    const exported = await downloadPromise;
    await exported.saveAs('build/synthetic-export.json');
    const library = JSON.parse(fs.readFileSync('build/synthetic-export.json', 'utf8'));
    expect(library.profiles[0].design.elements.find((e) => e.type === 'barcode').content).toBe(
        '{{sku|id}}',
    );
    library.profiles[0].name = original;
    const chooserPromise = page.waitForEvent('filechooser');
    await page.getByRole('button', { name: 'Import library', exact: true }).click();
    page.once('dialog', (dialog) => dialog.accept());
    await (
        await chooserPromise
    ).setFiles({
        name: 'synthetic-library.json',
        mimeType: 'application/json',
        buffer: Buffer.from(JSON.stringify(library)),
    });
    await expect(page.getByLabel('Profile name', { exact: true })).toHaveValue(original);
    await page.getByRole('button', { name: 'Save settings', exact: true }).click();
    await expect(page.locator('#rli-status')).toContainText('Saved');
});
test('rendered 50.8 x 25.4 mm QR card decodes exact SKU independently', async ({ page }) => {
    const rendered = await page.evaluate(async () => {
        const library = window.RLI_BOOT.library;
        const design = library.templates.find((t) => t.id === 'qr-card').design;
        const result = await window.RLIRender.renderLabel(
            design,
            {
                values: {
                    name: 'Twinkle Light Earrings',
                    sku: 'RRA-726474',
                    id: '42',
                    price: '$12.00',
                },
            },
            { dpi: 300 },
        );
        const image = result.canvas
            .getContext('2d')
            .getImageData(0, 0, result.canvas.width, result.canvas.height);
        return {
            width: image.width,
            height: image.height,
            data: Array.from(image.data),
            issues: result.issues,
        };
    });
    expect(rendered.issues.filter((i) => i.severity === 'error')).toEqual([]);
    expect(rendered.width).toBe(600);
    expect(rendered.height).toBe(300);
    const result = await Z.readBarcodes(
        { ...rendered, data: new Uint8ClampedArray(rendered.data) },
        { formats: ['QRCode'] },
    );
    expect(result.map((r) => r.text)).toEqual(['RRA-726474']);
});
test('declined remote HTML images cause no browser request', async ({ page }) => {
    let requests = 0;
    await page.route('http://example.invalid/**', (route) => {
        requests++;
        return route.abort();
    });
    page.on('dialog', (dialog) => dialog.dismiss());
    const errors = await page.evaluate(async () => {
        const design = window.RLICore.defaultDesign();
        design.mode = 'html';
        design.html = '<p>Safe</p><img src="http://example.invalid/private-image">';
        const result = await window.RLIRender.renderLabel(design, { values: {} }, { dpi: 300 });
        return result.issues.filter((i) => i.severity === 'error').map((i) => i.message);
    });
    expect(errors.join(' ')).toContain('declined');
    expect(requests).toBe(0);
});
test('sheet rendering retains 65-label capacity, millimeter margins and all 131 labels', async ({
    page,
}) => {
    const downloadPromise = page.waitForEvent('download');
    const layout = await page.evaluate(async () => {
        const profile = window.RLI_BOOT.library.profiles.find((p) => p.id === 'a4-65');
        const job = await window.RLIRender.prepareJob(profile, [
            {
                key: 'synthetic-sheet',
                quantity: 131,
                values: {
                    name: 'Twinkle Light Earrings',
                    sku: 'RRA-726474',
                    id: '42',
                    price: '$12.00',
                },
            },
        ]);
        window.RLIRender.download(await window.RLIRender.exportPDF(job), 'synthetic-sheet.pdf');
        return {
            counts: job.layout.pages.map((p) => p.length),
            page: job.layout.page,
            first: job.layout.pages[0][0],
        };
    });
    await (await downloadPromise).saveAs('build/synthetic-sheet.pdf');
    expect(layout.counts).toEqual([65, 65, 1]);
    expect(layout.page.width).toBe(210);
    expect(layout.page.height).toBe(297);
    expect(layout.first.x).toBe(4.65);
    expect(layout.first.y).toBe(10.7);
});
test('attachment image expression resolves through authenticated local media route', async ({
    page,
}) => {
    const result = await page.evaluate(async () => {
        const base = new URL(window.RLI_BOOT.rest);
        const route = base.searchParams.get('rest_route');
        if (route) base.searchParams.set('rest_route', route + 'products');
        else base.pathname += 'products';
        base.searchParams.set('search', 'RRA-726474');
        const response = await fetch(base, { headers: { 'X-WP-Nonce': window.RLI_BOOT.nonce } });
        const products = await response.json();
        const recordsURL = new URL(window.RLI_BOOT.rest);
        if (route) recordsURL.searchParams.set('rest_route', route + 'records');
        else recordsURL.pathname += 'records';
        const records = await fetch(recordsURL, {
            method: 'POST',
            headers: { 'X-WP-Nonce': window.RLI_BOOT.nonce, 'Content-Type': 'application/json' },
            body: JSON.stringify({ ids: [products.items[0].id] }),
        }).then((r) => r.json());
        const design = window.RLICore.defaultDesign();
        design.elements = [
            window.RLICore.element('image', { x: 1, y: 1, w: 20, h: 20, content: '{{image}}' }),
        ];
        const rendered = await window.RLIRender.renderLabel(design, records.records[0], {
            dpi: 300,
        });
        return rendered.issues;
    });
    expect(result.filter((i) => i.severity === 'error')).toEqual([]);
});
