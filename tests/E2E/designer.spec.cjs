const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const Z = require('zxing-wasm/reader');
const AxeBuilder = require('@axe-core/playwright').default;
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
    await expect(page).toHaveURL(/wp-admin\//);
    await page.goto('/wp-admin/admin.php?page=ramsey-labels');
    await expect(
        page.getByRole('heading', { name: 'Ramsey Labels — Designer & Print' }),
    ).toBeVisible();
});
test('admin UI axe scan has no WCAG 2.1 A/AA accessibility violations', async ({ page }) => {
    await page.getByRole('button', { name: 'Design', exact: true }).click();
    const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze();
    expect(
        results.violations,
        results.violations
            .map((v) => v.id + ': ' + v.nodes.map((n) => n.target.join(' ')).join(', '))
            .join('\n'),
    ).toEqual([]);
});
test('RTL layout keeps logical controls and physical label coordinates usable', async ({
    page,
}) => {
    await page.evaluate(() => {
        document.documentElement.dir = 'rtl';
        document.documentElement.lang = 'ar';
    });
    await page.locator('[data-rli-view="design"]').evaluate((button) => button.click());
    const element = page.locator('.rli-element').first();
    await element.focus();
    await element.press('Enter');
    await expect(page.getByLabel('X position (mm)', { exact: true })).toBeVisible();
    const directions = await page.evaluate(() => ({
        root: getComputedStyle(document.querySelector('#rli-app')).direction,
        board: getComputedStyle(document.querySelector('.rli-board')).direction,
    }));
    expect(directions.root).toBe('rtl');
    expect(directions.board).toBe('ltr');
});
test('axe scan covers product and print workflows', async ({ page }) => {
    await page.getByRole('button', { name: 'Products & orders', exact: true }).click();
    let scan = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze();
    expect(
        scan.violations,
        scan.violations
            .map((v) => v.id + ': ' + v.nodes.map((n) => n.target.join(' ')).join(', '))
            .join('\n'),
    ).toEqual([]);
    await page.getByRole('button', { name: 'Preview / print', exact: true }).click();
    scan = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze();
    expect(
        scan.violations,
        scan.violations
            .map((v) => v.id + ': ' + v.nodes.map((n) => n.target.join(' ')).join(', '))
            .join('\n'),
    ).toEqual([]);
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
    await page.locator('#rli-app').screenshot({ path: 'build/synthetic-designer.png' });
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
    const exported = await page.evaluate(async () => {
        const design = window.RLI_BOOT.library.templates.find((t) => t.id === 'qr-card').design;
        const record = {
            values: {
                name: 'Twinkle Light Earrings',
                sku: 'RRA-726474',
                id: '42',
                price: '$12.00',
            },
        };
        const png = await window.RLIRender.exportPNG(design, record, { dpi: 300 });
        const svg = window.RLIRender.exportSVG(design, record);
        return { png: Array.from(new Uint8Array(await png.arrayBuffer())), svg: await svg.text() };
    });
    expect(Buffer.from(exported.png).subarray(1, 4).toString()).toBe('PNG');
    expect(exported.svg).toContain('<svg');
    const qr = await Z.readBarcodes(new Uint8Array(exported.png), { formats: ['QRCode'] });
    expect(qr.map((x) => x.text)).toEqual(['RRA-726474']);
    const vector = await page.evaluate(async (svg) => {
        const image = new Image();
        image.src = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
        await image.decode();
        const canvas = document.createElement('canvas');
        canvas.width = image.naturalWidth * 3;
        canvas.height = image.naturalHeight * 3;
        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
        return {
            width: canvas.width,
            height: canvas.height,
            data: Array.from(ctx.getImageData(0, 0, canvas.width, canvas.height).data),
        };
    }, exported.svg);
    const decodedVector = await Z.readBarcodes(
        { ...vector, data: new Uint8ClampedArray(vector.data) },
        { formats: ['QRCode'] },
    );
    expect(decodedVector.map((x) => x.text)).toEqual(['RRA-726474']);
});
test('bounded PHP/JavaScript integration API emits one after-render event per unique record', async ({
    page,
}) => {
    const count = await page.evaluate(async () => {
        const records = [
            {
                key: 'api-one',
                source: 'manual',
                quantity: 9,
                values: { name: 'Synthetic API label', sku: 'RRA-726474' },
                selected: true,
            },
            {
                key: 'api-two',
                source: 'manual',
                quantity: 3,
                values: { name: 'Synthetic API label two', sku: 'RRA-726475' },
                selected: true,
            },
        ];
        const events = [];
        document.addEventListener('ramsey-labels:after-render', (event) =>
            events.push(event.detail.recordIndex),
        );
        const job = await window.RLIRender.prepareJob(window.RLICore.defaultProfile(), records);
        window.RLIRender.releaseJob(job);
        return { events, total: job.layout.total };
    });
    expect(count.total).toBe(12);
    expect(count.events).toEqual([0, 1]);
});
test('currency symbol preference changes raster output without changing store price data', async ({
    page,
}) => {
    const result = await page.evaluate(async () => {
        const design = window.RLICore.defaultDesign();
        design.elements = [
            window.RLICore.element('text', {
                id: 'money',
                x: 1,
                y: 1,
                w: 48,
                h: 20,
                content: '{{price}}',
                fontSize: 20,
            }),
        ];
        const record = { values: { price: '$12.00', currency_symbol: '$' } };
        const withSymbol = await window.RLIRender.renderLabel(
            { ...design, showCurrency: true },
            record,
            { dpi: 150 },
        );
        const without = await window.RLIRender.renderLabel(
            { ...design, showCurrency: false },
            record,
            { dpi: 150 },
        );
        return {
            with: withSymbol.canvas.toDataURL(),
            without: without.canvas.toDataURL(),
            unchanged: record.values.price,
        };
    });
    expect(result.with).not.toBe(result.without);
    expect(result.unchanged).toBe('$12.00');
});
test('multiple barcode standards render on one label and independently decode', async ({
    page,
}) => {
    const output = await page.evaluate(async () => {
        const design = window.RLICore.defaultDesign();
        design.elements = [
            window.RLICore.element('barcode', {
                id: 'linear',
                format: 'code128',
                x: 1,
                y: 1,
                w: 23,
                h: 22,
                content: '{{sku}}',
            }),
            window.RLICore.element('barcode', {
                id: 'qr',
                format: 'qrcode',
                x: 26,
                y: 1,
                w: 23,
                h: 22,
                content: '{{sku}}',
            }),
        ];
        const result = await window.RLIRender.renderLabel(design, {
            values: { sku: 'RRA-726474', name: 'Synthetic' },
        });
        return {
            width: result.canvas.width,
            height: result.canvas.height,
            data: Array.from(
                result.canvas
                    .getContext('2d')
                    .getImageData(0, 0, result.canvas.width, result.canvas.height).data,
            ),
            issues: result.issues,
        };
    });
    expect(output.issues.filter((i) => i.severity === 'error')).toEqual([]);
    const decoded = await Z.readBarcodes(
        { ...output, data: new Uint8ClampedArray(output.data) },
        { formats: ['Code128', 'QRCode'], tryHarder: true },
    );
    expect(decoded.map((item) => item.text).sort()).toEqual(['RRA-726474', 'RRA-726474']);
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
test('legacy HTML bindings are escaped before substitution and SVG image payloads rejected', async ({
    page,
}) => {
    const result = await page.evaluate(async () => {
        const design = window.RLICore.defaultDesign();
        design.mode = 'html';
        design.html = '<p>[name]</p><img src="{{image}}">';
        const record = {
            values: {
                name: '<img src=x onerror=alert(1)>',
                image: 'data:image/svg+xml,<svg onload=alert(1) />',
            },
        };
        const output = window.RLIRender.sanitizeHTML(
            window.RLICore.resolve(design.html, record, {
                escape: window.RLIRender.escapeHTML,
                maxLength: 200000,
            }),
        );
        const rendered = await window.RLIRender.renderLabel(
            {
                width: 50.8,
                height: 25.4,
                mode: 'visual',
                elements: [
                    window.RLICore.element('image', {
                        x: 1,
                        y: 1,
                        w: 20,
                        h: 20,
                        content: 'data:image/svg+xml,<svg onload=alert(1) />',
                    }),
                ],
            },
            record,
            { dpi: 300 },
        );
        return { output, imageError: rendered.issues.map((issue) => issue.message).join(' ') };
    });
    expect(result.output).not.toMatch(/<img src=x| onerror="/);
    expect(result.output).toContain('&lt;img src=x');
    expect(result.imageError).toContain('Image source must be');
});
test('literal private-network image hosts are rejected before any fetch', async ({ page }) => {
    let requests = 0;
    await page.route('http://127.0.0.2:*/**', (route) => {
        requests++;
        return route.fulfill({
            status: 200,
            contentType: 'image/png',
            body: Buffer.from('not-image'),
        });
    });
    const issues = await page.evaluate(async () => {
        const design = window.RLICore.defaultDesign();
        design.elements = [
            window.RLICore.element('image', {
                id: 'internal',
                x: 1,
                y: 1,
                w: 20,
                h: 20,
                content: 'http://127.0.0.2:18885/private.png',
            }),
        ];
        return (await window.RLIRender.renderLabel(design, { values: {} }, { dpi: 150 })).issues
            .map((issue) => issue.message)
            .join(' ');
    });
    expect(issues).toContain('Private-network image URLs are not allowed');
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
