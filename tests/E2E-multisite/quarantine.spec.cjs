const { test, expect } = require('@playwright/test');

test('network admin reviews redacted metadata, dry-runs, assigns and rolls back a legacy job', async ({
    page,
}) => {
    await page.goto('/wp-login.php');
    await page.locator('#user_login').fill('labels_admin');
    await page.locator('#user_pass').fill('local-test-only-password');
    await page.locator('#wp-submit').click();
    await expect(page).toHaveURL(/wp-admin\//);
    await page.goto('/wp-admin/network/settings.php?page=rli-network-jobs');
    await expect(
        page.getByRole('heading', { name: 'Ramsey Labels legacy-job quarantine' }),
    ).toBeVisible();

    const row = page.getByRole('row').filter({ hasText: '2a8fe6483351' });
    await expect(row).toHaveCount(1);
    expect(await row.locator('td').nth(0).innerText()).toMatch(/^\d+$/);
    await expect(row.locator('td').nth(3)).toHaveText('1');
    await expect(page.locator('body')).not.toContainText('Sensitive Legacy Order 9999');
    await expect(page.locator('body')).not.toContainText('private-customer@example.test');
    await row.getByLabel('Destination site ID').first().fill('1');
    await row.getByRole('button', { name: 'Dry run' }).click();
    await expect(page.locator('.notice-success')).toContainText('Dry run passed');
    await expect(page.locator('.notice-success')).toContainText('No data was changed');

    page.once('dialog', (dialog) => dialog.accept());
    await row.getByLabel('Destination site ID').nth(1).fill('1');
    await row.getByRole('button', { name: 'Assign this job' }).click();
    await expect(page.locator('.notice-success')).toContainText('assigned to site 1');
    await expect(page.getByRole('row').filter({ hasText: '2a8fe6483351' })).toContainText(
        'assigned',
    );

    await page
        .getByRole('row')
        .filter({ hasText: '2a8fe6483351' })
        .getByRole('button', { name: 'Rollback unchanged copy' })
        .click();
    await expect(page.locator('.notice-success')).toContainText('rolled back');
    await expect(page.getByRole('row').filter({ hasText: '2a8fe6483351' })).toContainText(
        'rolled-back',
    );
    await expect(page.locator('body')).not.toContainText('private-customer@example.test');
});
