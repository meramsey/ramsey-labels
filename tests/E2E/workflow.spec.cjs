const { test, expect } = require('@playwright/test');
const { execFileSync } = require('node:child_process');
const AxeBuilder = require('@axe-core/playwright').default;
async function logIn(page) {
    let lastError;
    for (let attempt = 0; attempt < 2; attempt++) {
        await page.goto('/wp-login.php');
        await page.locator('#user_login').fill('labels_admin');
        await page.locator('#user_pass').fill('local-test-only-password');
        await page.locator('#wp-submit').click();
        try {
            await page.waitForURL(/wp-admin\//, { timeout: 15000 });
            return;
        } catch (error) {
            lastError = error;
        }
    }
    throw lastError;
}
async function productBySku(page, sku) {
    return page.evaluate(async (value) => {
        const url = new URL(window.RLI_BOOT.rest);
        if (url.searchParams.has('rest_route')) {
            url.searchParams.set('rest_route', url.searchParams.get('rest_route') + 'products');
            url.searchParams.set('search', value);
        } else {
            url.pathname += 'products';
            url.search = new URLSearchParams({ search: value }).toString();
        }
        const response = await fetch(url, { headers: { 'X-WP-Nonce': window.RLI_BOOT.nonce } });
        const data = await response.json();
        if (!response.ok) throw Error(data.message || 'Product lookup failed.');
        return data.items.find((item) => item.sku === value);
    }, sku);
}
function productResult(page, productId) {
    return page.locator('.rli-product-result').filter({
        has: page.locator(`input[value="${productId}"]`),
    });
}
async function searchProductResult(page, sku, productId) {
    await page.locator('#rli-search').fill(sku);
    await page.getByRole('button', { name: 'Search', exact: true }).click();
    const result = productResult(page, productId);
    await expect(result).toHaveCount(1, { timeout: 15000 });
    return result;
}
async function expectLoadedProductImage(image, expectedUrl) {
    await expect(image).toBeVisible();
    await expect(image).toHaveAttribute('src', expectedUrl);
    await expect(image).toHaveJSProperty('complete', true);
    await expect
        .poll(() => image.evaluate((node) => node.naturalWidth > 0 && node.naturalHeight > 0))
        .toBe(true);
    await expect
        .poll(() =>
            image.evaluate((node) => {
                const box = node.getBoundingClientRect();
                const style = getComputedStyle(node);
                return (
                    box.width >= 70 &&
                    box.height >= 70 &&
                    style.display !== 'none' &&
                    style.visibility !== 'hidden'
                );
            }),
        )
        .toBe(true);
}

test.beforeEach(async ({ page }) => {
    await logIn(page);
    await page.goto('/wp-admin/admin.php?page=ramsey-labels');
    await expect(
        page.getByRole('heading', { name: 'Ramsey Labels — Designer & Print' }),
    ).toBeVisible();
});
test('Enter search, thumbnails, queue, automatic complete preview, PDF and print initiation', async ({
    page,
}) => {
    await page.getByRole('button', { name: 'Products & orders', exact: true }).click();
    await expect(page.locator('#rli-category')).not.toBeDisabled();
    await page.locator('#rli-search').fill('RRA-726474');
    await page.locator('#rli-search').press('Enter');
    const result = page
        .locator('.rli-product-result')
        .filter({ hasText: 'Twinkle Light Earrings' });
    await expect(result).toHaveCount(1);
    const simple = await productBySku(page, 'RRA-726474');
    expect(simple.image_url).toBeTruthy();
    await expectLoadedProductImage(result.locator('img'), simple.image_url);
    await page.locator('#rli-app').screenshot({ path: 'build/synthetic-product-search.png' });
    await result.locator('input').check();
    await page.getByRole('button', { name: 'Add selected to job', exact: true }).click();
    const row = page.locator('.rli-queued-product');
    await expect(row).toContainText('RRA-726474');
    await expect(row).toContainText('12.00');
    await expectLoadedProductImage(row.locator('img'), simple.image_url);
    await page.locator('#rli-app').screenshot({ path: 'build/synthetic-product-queue.png' });
    await row.getByLabel('Quantity').fill('5');
    await row.getByLabel('Quantity').press('Tab');
    await page.getByRole('button', { name: 'Print preview', exact: true }).click();
    await expect(page.locator('.rli-preview-page')).toHaveCount(5);
    const a11y = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze();
    expect(
        a11y.violations,
        a11y.violations
            .map((v) => v.id + ': ' + v.nodes.map((n) => n.target.join(' ')).join(', '))
            .join('\n'),
    ).toEqual([]);
    const boxes = await page.locator('.rli-preview-page').evaluateAll((nodes) =>
        nodes.map((n) => ({
            y: n.getBoundingClientRect().y,
            h: n.getBoundingClientRect().height,
        })),
    );
    for (let i = 1; i < boxes.length; i++)
        expect(boxes[i].y).toBeGreaterThanOrEqual(boxes[i - 1].y + boxes[i - 1].h);
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Export PDF', exact: true }).click();
    const download = await downloadPromise;
    await download.saveAs('build/labels-e2e.pdf');
    expect(download.suggestedFilename()).toBe('ramsey-labels.pdf');
    await page.evaluate(() => {
        window.__printCalls = 0;
        window.__originalPrint = window.print;
        const d = Object.getOwnPropertyDescriptor(Window.prototype, 'print');
        window.__printDescriptor = d;
    });
    // Override the isolated iframe's print method, never contact a real printer.
    await page.evaluate(() => {
        const append = Node.prototype.appendChild;
        Node.prototype.appendChild = function (node) {
            const r = append.call(this, node);
            if (node.id === 'rli-print-frame')
                node.contentWindow.print = () => {
                    window.__printCalls++;
                };
            return r;
        };
        const original = Element.prototype.append;
        Element.prototype.append = function (...nodes) {
            original.apply(this, nodes);
            for (const n of nodes)
                if (n.id === 'rli-print-frame')
                    n.contentWindow.print = () => {
                        window.__printCalls++;
                    };
        };
    });
    await page.getByRole('button', { name: 'Print', exact: true }).click();
    await expect.poll(() => page.evaluate(() => window.__printCalls)).toBe(1);
    await expect(page.frameLocator('#rli-print-frame').locator('.rli-print-page')).toHaveCount(5);
    await page.evaluate(() => {
        window.showSaveFilePicker = undefined;
    });
    const fullPdfPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Export full PDF', exact: true }).click();
    const fullPdf = await fullPdfPromise;
    await fullPdf.saveAs('build/ui-full-streamed.pdf');
    const pdfInfo = execFileSync('pdfinfo', ['build/ui-full-streamed.pdf'], { encoding: 'utf8' });
    expect(pdfInfo).toMatch(/Pages:\s+5\b/);
    await page.locator('#rli-app').screenshot({ path: 'build/synthetic-preview.png' });
});
test('category selection, row action and bulk-action handoff', async ({ page }) => {
    await page.getByRole('button', { name: 'Products & orders', exact: true }).click();
    await expect(page.locator('#rli-category')).not.toBeDisabled();
    for (
        let categoryPage = 0;
        categoryPage < 5 &&
        (await page
            .locator('#rli-category option')
            .filter({ hasText: 'Synthetic Earrings' })
            .count()) === 0;
        categoryPage++
    ) {
        await page.getByRole('button', { name: 'Next category page', exact: true }).click();
        await expect(page.locator('#rli-category-page')).toContainText(String(categoryPage + 2));
    }
    await page.locator('#rli-category').selectOption({ label: 'Synthetic Earrings' });
    await page.getByRole('button', { name: 'Search', exact: true }).click();
    await expect(page.locator('.rli-product-result')).toHaveCount(1);
    const categorySimple = await productBySku(page, 'RRA-726474');
    await expectLoadedProductImage(
        page.locator('.rli-product-result img'),
        categorySimple.image_url,
    );
    await page.locator('#rli-app').screenshot({ path: 'build/synthetic-category-selection.png' });
    await page.goto('/wp-admin/edit.php?post_type=product&s=Twinkle%20Light');
    const row = page
        .locator('tr')
        .filter({ has: page.getByRole('link', { name: 'Twinkle Light Earrings', exact: true }) });
    await expect(row.locator('a').filter({ hasText: /^Print labels$/ })).toHaveCount(1);
    await row.locator('input[type=checkbox]').check();
    await page.locator('#bulk-action-selector-top').selectOption('rli_products');
    await page.locator('#doaction').click();
    const bulkQueue = page.locator('.rli-queued-product').filter({ hasText: 'RRA-726474' });
    await expect(bulkQueue).toHaveCount(1);
    const bulkSimple = await productBySku(page, 'RRA-726474');
    await expectLoadedProductImage(bulkQueue.locator('img'), bulkSimple.image_url);
});
test('WooCommerce attachment thumbnails survive variation fallback, queue sorting and missing-image states', async ({
    page,
}) => {
    await page.getByRole('button', { name: 'Products & orders', exact: true }).click();
    const own = await productBySku(page, 'SYNTHETIC-VAR-IMAGE');
    const fallback = await productBySku(page, 'SYNTHETIC-VAR-1');
    const missing = await productBySku(page, 'SYNTHETIC-NO-IMAGE');
    expect(own.image_url).toBeTruthy();
    expect(fallback.image_url).toBeTruthy();
    expect(own.image_url).not.toBe(fallback.image_url);
    expect(missing.image_url).toBe('');

    const ownResult = await searchProductResult(page, 'SYNTHETIC-VAR-IMAGE', own.id);
    await expectLoadedProductImage(ownResult.locator('img'), own.image_url);
    await ownResult.locator('input').check();
    await page.getByRole('button', { name: 'Add selected to job', exact: true }).click();
    await expect(
        page.locator('.rli-queued-product').filter({ hasText: 'SYNTHETIC-VAR-IMAGE' }),
    ).toHaveCount(1);

    const fallbackResult = await searchProductResult(page, 'SYNTHETIC-VAR-1', fallback.id);
    await expectLoadedProductImage(fallbackResult.locator('img'), fallback.image_url);
    await fallbackResult.locator('input').check();
    await page.getByRole('button', { name: 'Add selected to job', exact: true }).click();
    await expect(
        page.locator('.rli-queued-product').filter({ hasText: 'SYNTHETIC-VAR-1' }),
    ).toHaveCount(1);

    const missingResult = await searchProductResult(page, 'SYNTHETIC-NO-IMAGE', missing.id);
    await expect(missingResult.locator('img')).toHaveCount(0);
    await expect(missingResult.locator('.rli-no-image')).toHaveText('No photo');
    await missingResult.locator('input').check();
    await page.getByRole('button', { name: 'Add selected to job', exact: true }).click();
    await expect(
        page.locator('.rli-queued-product').filter({ hasText: 'SYNTHETIC-NO-IMAGE' }),
    ).toHaveCount(1);

    const ownQueue = page.locator('.rli-queued-product').filter({ hasText: 'SYNTHETIC-VAR-IMAGE' });
    const fallbackQueue = page
        .locator('.rli-queued-product')
        .filter({ hasText: 'SYNTHETIC-VAR-1' });
    const missingQueue = page
        .locator('.rli-queued-product')
        .filter({ hasText: 'SYNTHETIC-NO-IMAGE' });
    await expectLoadedProductImage(ownQueue.locator('img'), own.image_url);
    await expectLoadedProductImage(fallbackQueue.locator('img'), fallback.image_url);
    await expect(missingQueue.locator('img')).toHaveCount(0);
    await expect(missingQueue.locator('.rli-no-image')).toHaveText('No photo');
    await ownQueue.getByLabel('Quantity').fill('3');
    await ownQueue.getByLabel('Quantity').press('Tab');
    await page.getByLabel('Sort print queue', { exact: true }).selectOption('sku-desc');
    await expectLoadedProductImage(
        page
            .locator('.rli-queued-product')
            .filter({ hasText: 'SYNTHETIC-VAR-IMAGE' })
            .locator('img'),
        own.image_url,
    );
    await expectLoadedProductImage(
        page.locator('.rli-queued-product').filter({ hasText: 'SYNTHETIC-VAR-1' }).locator('img'),
        fallback.image_url,
    );
    await expect(
        page
            .locator('.rli-queued-product')
            .filter({ hasText: 'SYNTHETIC-VAR-IMAGE' })
            .getByLabel('Quantity'),
    ).toHaveValue('3');
    await page.locator('#rli-app').screenshot({ path: 'build/synthetic-thumbnail-queue.png' });
});
test('REST cookie authentication rejects missing and forged nonce', async ({ page }) => {
    const statuses = await page.evaluate(async () => {
        const path = window.RLI_BOOT.rest + 'records';
        return Promise.all(
            [undefined, 'forged'].map(async (nonce) => {
                const r = await fetch(path, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        ...(nonce ? { 'X-WP-Nonce': nonce } : {}),
                    },
                    body: JSON.stringify({ ids: [1] }),
                });
                return r.status;
            }),
        );
    });
    expect(statuses.every((s) => s === 401 || s === 403)).toBe(true);
});
test('profile edits during asynchronous rendering cannot publish a stale preview', async ({
    page,
}) => {
    await page.getByRole('button', { name: 'Products & orders', exact: true }).click();
    await page.locator('#rli-search').fill('RRA-726474');
    await page.locator('#rli-search').press('Enter');
    await page.locator('.rli-product-result input').check();
    await page.getByRole('button', { name: 'Add selected to job', exact: true }).click();
    await expect(page.locator('.rli-queued-product')).toHaveCount(1);
    await expect(page.locator('.rli-queued-product')).toHaveCount(1);
    await page.evaluate(() => {
        window.__nativeFrame = window.requestAnimationFrame;
        window.__renderFrames = [];
        window.requestAnimationFrame = (callback) => {
            window.__renderFrames.push(callback);
            return window.__renderFrames.length;
        };
    });
    await page
        .getByRole('button', { name: 'Print preview', exact: true })
        .evaluate((button) => button.click());
    await expect.poll(() => page.evaluate(() => window.__renderFrames.length)).toBeGreaterThan(0);
    await page.evaluate(() => {
        const select = document.querySelector('.rli-toolbar select');
        select.value = 'a4-65';
        select.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await page.evaluate(() => {
        window.requestAnimationFrame = window.__nativeFrame;
        window.__renderFrames.forEach((callback) => window.requestAnimationFrame(callback));
    });
    await expect(page.locator('#rli-status')).toContainText(
        'Queue or profile changed while rendering',
    );
    await expect(page.locator('.rli-preview-page')).toHaveCount(0);
    await page.getByRole('button', { name: 'Generate preview', exact: true }).click();
    await expect(page.locator('.rli-preview-page')).toHaveCount(1);
});
test('save and restore private saved print jobs', async ({ page }) => {
    await page.getByRole('button', { name: 'Products & orders', exact: true }).click();
    await page.locator('#rli-search').fill('RRA-726474');
    await page.locator('#rli-search').press('Enter');
    await page.locator('.rli-product-result input').check();
    await page.getByRole('button', { name: 'Add selected to job', exact: true }).click();
    await expect(page.locator('.rli-queued-product')).toHaveCount(1);
    const savedSimple = await productBySku(page, 'RRA-726474');
    await expectLoadedProductImage(page.locator('.rli-queued-product img'), savedSimple.image_url);
    await page.getByRole('button', { name: 'Save print job', exact: true }).click();
    const saveDialog = page.getByRole('dialog');
    await expect(saveDialog).toBeVisible();
    let dialogA11y = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze();
    expect(dialogA11y.violations, dialogA11y.violations.map((v) => v.id).join(', ')).toEqual([]);
    await saveDialog.getByLabel('Job name', { exact: true }).fill('Synthetic saved label job');
    await saveDialog.getByLabel(/I understand this job/).check();
    await saveDialog.getByRole('button', { name: 'Save print job', exact: true }).click();
    await expect(page.locator('#rli-status')).toContainText(
        'saved to your private WordPress account',
    );
    page.once('dialog', (dialog) => dialog.accept());
    await page.getByRole('button', { name: 'Clear job', exact: true }).click();
    const savedJobs = await page.evaluate(async () => {
        const url = new URL(window.RLI_BOOT.rest);
        if (url.searchParams.has('rest_route'))
            url.searchParams.set('rest_route', url.searchParams.get('rest_route') + 'jobs');
        else url.pathname += 'jobs';
        const response = await fetch(url, { headers: { 'X-WP-Nonce': window.RLI_BOOT.nonce } });
        return { status: response.status, jobs: await response.json() };
    });
    expect(savedJobs.status).toBe(200);
    expect(
        Object.values(savedJobs.jobs).some((job) => job.name === 'Synthetic saved label job'),
    ).toBe(true);
    await page.getByRole('button', { name: 'Load saved print job', exact: true }).click();
    const loadDialog = page.getByRole('dialog');
    await expect(loadDialog).toBeVisible();
    dialogA11y = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze();
    expect(dialogA11y.violations, dialogA11y.violations.map((v) => v.id).join(', ')).toEqual([]);
    await loadDialog
        .getByLabel('Saved print job', { exact: true })
        .selectOption({ label: 'Synthetic saved label job' });
    await loadDialog.getByRole('button', { name: 'Load saved print job', exact: true }).click();
    await expect(page.locator('.rli-queued-product')).toContainText('RRA-726474');
    await expectLoadedProductImage(page.locator('.rli-queued-product img'), savedSimple.image_url);
});
test('public JavaScript API appends scalar synthetic records and keyboard-sort controls reorder output', async ({
    page,
}) => {
    await page.evaluate(() =>
        window.RamseyLabels.queueRecords([
            {
                key: 'synthetic-first',
                source: 'manual',
                quantity: 1,
                values: { name: 'Synthetic First', sku: 'SYN-1' },
            },
            {
                key: 'synthetic-second',
                source: 'manual',
                quantity: 1,
                values: { name: 'Synthetic Second', sku: 'SYN-2' },
            },
        ]),
    );
    const rows = page.locator('.rli-queued-product');
    await expect(rows).toHaveCount(2);
    await rows.nth(1).getByRole('button', { name: 'Move up', exact: true }).focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('.rli-queued-product').first()).toContainText('Synthetic Second');
    await expect(
        page.locator('.rli-queued-product').first().locator('input[type=checkbox]'),
    ).toHaveAttribute('aria-label', /Include Synthetic Second/);
});
test('name/SKU sort options produce the same order in queue and preview', async ({ page }) => {
    await page.evaluate(() =>
        window.RamseyLabels.queueRecords([
            {
                key: 'sort-z',
                source: 'manual',
                quantity: 1,
                selected: true,
                values: { name: 'Zulu', sku: 'SKU-30' },
            },
            {
                key: 'sort-e',
                source: 'manual',
                quantity: 1,
                selected: true,
                values: { name: 'Éclair', sku: 'SKU-20' },
            },
            {
                key: 'sort-a',
                source: 'manual',
                quantity: 2,
                selected: true,
                values: { name: 'Alpha', sku: 'SKU-10' },
            },
        ]),
    );
    await page.getByLabel('Sort print queue', { exact: true }).selectOption('name-asc');
    await expect(page.locator('.rli-queued-product')).toHaveCount(3);
    await expect(page.locator('.rli-queued-product').nth(0)).toContainText('Alpha');
    await expect(page.locator('.rli-queued-product').nth(1)).toContainText('Éclair');
    await expect(page.locator('.rli-queued-product').nth(2)).toContainText('Zulu');
    await page.getByRole('button', { name: 'Print preview', exact: true }).click();
    await page.getByRole('button', { name: 'Generate preview', exact: true }).click();
    await expect(page.locator('#rli-status')).toContainText('Ready: 4 labels');
    await expect(page.locator('.rli-preview-page')).toHaveCount(4);
    const altText = await page
        .locator('.rli-preview-page img')
        .evaluateAll((images) => images.map((image) => image.alt));
    expect(altText).toEqual([
        'Label: Alpha — SKU-10',
        'Label: Alpha — SKU-10',
        'Label: Éclair — SKU-20',
        'Label: Zulu — SKU-30',
    ]);
    await page.getByRole('button', { name: 'Products & orders', exact: true }).click();
    await page.getByLabel('Sort print queue', { exact: true }).selectOption('selection');
    await expect(page.locator('.rli-queued-product').nth(0)).toContainText('Zulu');
    await page.getByLabel('Sort print queue', { exact: true }).selectOption('sku-desc');
    await expect(page.locator('.rli-queued-product').nth(0)).toContainText('Zulu');
    await expect(page.locator('.rli-queued-product').nth(1)).toContainText('Éclair');
    await expect(page.locator('.rli-queued-product').nth(2)).toContainText('Alpha');
});
test('cancelled multi-segment PDF aborts its sink and a fresh retry completes', async ({
    page,
}) => {
    const result = await page.evaluate(async () => {
        const profile = window.RLICore.defaultProfile(),
            records = [
                {
                    key: 'cancel-fixture',
                    source: 'manual',
                    quantity: 4500,
                    selected: true,
                    values: { name: 'Cancellation fixture', sku: 'CANCEL-4500' },
                },
            ];
        let cancelled = false,
            aborted = false,
            writes = 0;
        try {
            await window.RLIRender.exportPDFStream(
                profile,
                records,
                {
                    write(chunk) {
                        writes += chunk.length;
                    },
                    abort() {
                        aborted = true;
                    },
                },
                {
                    cancelled: () => cancelled,
                    progress() {
                        cancelled = true;
                    },
                },
            );
            return { cancelled: false, aborted, writes };
        } catch (error) {
            const retry = await window.RLIRender.exportPDFStream(
                profile,
                [{ ...records[0], quantity: 3 }],
                {
                    write() {},
                    close() {},
                    abort() {},
                },
            );
            return {
                cancelled: /cancelled/i.test(error.message),
                aborted,
                writes,
                retryLabels: retry.labels,
                retryPages: retry.pages,
            };
        }
    });
    expect(result.cancelled).toBe(true);
    expect(result.aborted).toBe(true);
    expect(result.writes).toBeGreaterThan(0);
    expect(result.retryLabels).toBe(3);
    expect(result.retryPages).toBe(3);
});
test('streamed PDF covers more than two rendered segments without truncation', async ({ page }) => {
    const result = await page.evaluate(async () => {
        const profile = window.RLICore.defaultProfile();
        const records = [
            {
                key: 'stress',
                source: 'manual',
                quantity: 4500,
                selected: true,
                values: { name: 'Synthetic stress label', sku: 'RRA-726474', id: '42' },
            },
        ];
        const chunks = [];
        let bytes = 0;
        const summary = await window.RLIRender.exportPDFStream(
            profile,
            records,
            {
                write(chunk) {
                    chunks.push(chunk);
                    bytes += chunk.length;
                },
                close() {},
                abort() {
                    chunks.length = 0;
                },
            },
            {
                progress(done, total) {
                    if (done > total) throw Error('progress exceeds total');
                },
            },
        );
        const blob = new Blob(chunks, { type: 'application/pdf' });
        window.__stressPDF = await blob.arrayBuffer();
        return {
            summary,
            bytes,
            header: new TextDecoder().decode(new Uint8Array(window.__stressPDF).slice(0, 8)),
        };
    });
    expect(result.summary.labels).toBe(4500);
    expect(result.summary.pages).toBe(4500);
    expect(result.header).toContain('%PDF-1.4');
    const bytes = await page.evaluate(() => Array.from(new Uint8Array(window.__stressPDF)));
    require('node:fs').writeFileSync('build/streamed-4500-labels.pdf', Buffer.from(bytes));
});
test('CSS and HTML imports remain inert', async ({ page }) => {
    const output = await page.evaluate(() => ({
        html: window.RLIRender.sanitizeHTML(
            '<img src="javascript:alert(1)" onerror="alert(1)"><svg onload="alert(1)"></svg><p>safe</p>',
        ),
        css: window.RLIRender.sanitizeCSS('p{background:u/**/rl(https://example.test)}'),
        escaped: window.RLIRender.sanitizeCSS('p{background:\\75rl(https://example.test)}'),
    }));
    expect(output.html).not.toMatch(/onerror|javascript:|<svg/);
    expect(output.css).toBe('');
    expect(output.escaped).toBe('');
});
