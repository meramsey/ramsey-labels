#!/usr/bin/env node
/* Capture actual isolated WooCommerce admin states; synthetic fixtures only. */
const { chromium } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');
const baseURL = 'http://127.0.0.1:' + (process.env.TEST_PORT || '18885');
const output = path.resolve(process.env.GALLERY_DIR || 'docs/assets/gallery');
fs.mkdirSync(output, { recursive: true });
(async () => {
    const browser = await chromium.launch({
        executablePath: process.env.CHROME_PATH || chromium.executablePath(),
        args: ['--no-sandbox'],
    });
    const page = await browser.newPage({
        viewport: { width: 1440, height: 1000 },
        deviceScaleFactor: 1,
    });
    async function login() {
        await page.goto(baseURL + '/wp-login.php');
        await page.locator('#user_login').fill('labels_admin');
        await page.locator('#user_pass').fill('local-test-only-password');
        await page.locator('#wp-submit').click();
        await page.waitForURL(/wp-admin\//, { timeout: 15000 });
        await page.goto(baseURL + '/wp-admin/admin.php?page=ramsey-labels');
        await page.getByRole('heading', { name: 'Ramsey Labels — Designer & Print' }).waitFor();
    }
    async function shot(name) {
        await page.locator('#rli-app').screenshot({ path: path.join(output, name + '.png') });
    }
    async function reset() {
        await page.goto(baseURL + '/wp-admin/admin.php?page=ramsey-labels');
        await page.getByRole('heading', { name: 'Ramsey Labels — Designer & Print' }).waitFor();
    }
    await login();
    await shot('01-main-interface');
    await page.getByRole('button', { name: 'Design', exact: true }).click();
    await shot('02-visual-designer');
    await shot('03-qr-left-sku-below');
    await page
        .locator('.rli-element')
        .filter({ hasText: /barcode/i })
        .first()
        .click()
        .catch(() => {});
    await shot('04-code128-label-controls');
    await reset();
    await page.getByRole('button', { name: 'Products & orders', exact: true }).click();
    await page.locator('#rli-search').fill('RRA-726474');
    await page.getByRole('button', { name: 'Search', exact: true }).click();
    await page.locator('.rli-product-result').first().waitFor();
    await shot('05-product-sku-search');
    await shot('06-product-thumbnails-search');
    await page.locator('#rli-category').selectOption({ label: 'Synthetic Earrings' });
    await page.getByRole('button', { name: 'Search', exact: true }).click();
    await page.locator('.rli-product-result').first().waitFor();
    await shot('07-category-filtering');
    await page.goto(baseURL + '/wp-admin/edit.php?post_type=product&s=Twinkle%20Light');
    await page
        .locator('tr')
        .filter({ has: page.getByRole('link', { name: 'Twinkle Light Earrings', exact: true }) })
        .locator('input[type=checkbox]')
        .check();
    await page.screenshot({
        path: path.join(output, '08-woocommerce-bulk-selection.png'),
        fullPage: true,
    });
    await page.locator('#bulk-action-selector-top').selectOption('rli_products');
    await page.locator('#doaction').click();
    await page.locator('.rli-queued-product').first().waitFor();
    await shot('09-print-queue-images');
    await page.getByLabel('Sort print queue', { exact: true }).selectOption('sku-desc');
    await shot('10-queue-quantities-sorting');
    await page.getByRole('button', { name: 'Print preview', exact: true }).click();
    await page.getByRole('button', { name: 'Generate preview', exact: true }).click();
    await page.locator('.rli-preview-page').first().waitFor();
    await shot('11-vertical-batch-preview');
    await shot('12-thermal-two-by-one-layout');
    await shot('16-pdf-export-controls');
    await shot('17-full-label-svg-export');
    await reset();
    await page.getByRole('button', { name: 'Design', exact: true }).click();
    await page.getByLabel('Page type', { exact: true }).selectOption('sheet');
    await page.getByRole('button', { name: 'Products & orders', exact: true }).click();
    await page.getByRole('button', { name: 'Design', exact: true }).click();
    await page.getByLabel('Sheet stock / grid preset', { exact: true }).selectOption('avery-l7160');
    await shot('13-a4-sheet-layout');
    await shot('14-sheet-preset-selection');
    await shot('15-calibration-tools');
    await shot('18-saved-templates-profiles');
    await page.locator('.rli-element').first().focus();
    await page.keyboard.press('Enter');
    await shot('19-barcode-format-selection');
    const expression = page.getByLabel('Text / field expression', { exact: true });
    if (await expression.count()) {
        await expression.fill('{{meta:synthetic_custom_field}}');
        await expression.press('Tab');
    }
    await shot('20-custom-fields-attributes');
    await shot('24-keyboard-accessible-editor');
    await reset();
    await page.getByRole('button', { name: 'Products & orders', exact: true }).click();
    await page
        .locator('#rli-source')
        .selectOption('orders')
        .catch(() => {});
    await shot('21-order-based-labels');
    await page
        .locator('#rli-source')
        .selectOption('products')
        .catch(() => {});
    await shot('22-import-export-controls');
    await page.evaluate(() =>
        window.RamseyLabels.queueRecords([
            {
                key: 'gallery-large',
                source: 'manual',
                quantity: 2000,
                selected: true,
                values: { name: 'Synthetic large batch', sku: 'RRA-726474' },
            },
        ]),
    );
    await shot('23-large-batch-segment-navigation');
    await browser.close();
})().catch((error) => {
    console.error(error);
    process.exit(1);
});
