const { test } = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');

test('multisite uses Playwright Chromium by default and honors explicit overrides', () => {
    const readExecutable = (override) => {
        const env = { ...process.env };
        delete env.CHROME_PATH;
        if (override) env.CHROME_PATH = override;
        return execFileSync(
            process.execPath,
            [
                '-e',
                "process.stdout.write(JSON.stringify(require('./playwright.multisite.config.cjs').use.launchOptions))",
            ],
            { env, encoding: 'utf8' },
        );
    };
    assert.equal(JSON.parse(readExecutable()).executablePath, undefined);
    assert.equal(JSON.parse(readExecutable('/custom/chrome')).executablePath, '/custom/chrome');
});
