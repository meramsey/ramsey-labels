const { test, expect } = require('@playwright/test');
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
test('Enter search, thumbnails, queue, automatic complete preview, PDF and print initiation', async ({
    page,
}) => {
    await page.getByRole('button', { name: 'Products & orders', exact: true }).click();
    await page.locator('#rli-search').fill('RRA-726474');
    await page.locator('#rli-search').press('Enter');
    const result = page
        .locator('.rli-product-result')
        .filter({ hasText: 'Twinkle Light Earrings' });
    await expect(result).toHaveCount(1);
    await expect(result.locator('img')).toBeVisible();
    await result.locator('input').check();
    await page.getByRole('button', { name: 'Add selected to job', exact: true }).click();
    const row = page.locator('.rli-queued-product');
    await expect(row).toContainText('RRA-726474');
    await expect(row).toContainText('12.00');
    await expect(row.locator('img')).toBeVisible();
    await row.getByLabel('Quantity').fill('5');
    await row.getByLabel('Quantity').press('Tab');
    await page.getByRole('button', { name: 'Print preview', exact: true }).click();
    await expect(page.locator('.rli-preview-page')).toHaveCount(5);
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
    await page.screenshot({ path: 'build/synthetic-preview.png', fullPage: true });
});
test('category selection, row action and bulk-action handoff', async ({ page }) => {
    await page.getByRole('button', { name: 'Products & orders', exact: true }).click();
    await page.locator('#rli-category').selectOption({ label: 'Synthetic Earrings' });
    await page.getByRole('button', { name: 'Search', exact: true }).click();
    await expect(page.locator('.rli-product-result')).toHaveCount(1);
    await page.goto('/wp-admin/edit.php?post_type=product&s=Twinkle%20Light');
    const row = page
        .locator('tr')
        .filter({ has: page.getByRole('link', { name: 'Twinkle Light Earrings', exact: true }) });
    await expect(row.locator('a').filter({ hasText: /^Print labels$/ })).toHaveCount(1);
    await row.locator('input[type=checkbox]').check();
    await page.locator('#bulk-action-selector-top').selectOption('rli_products');
    await page.locator('#doaction').click();
    await expect(page.locator('.rli-queued-product')).toContainText('RRA-726474');
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
