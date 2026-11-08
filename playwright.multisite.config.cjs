const { defineConfig } = require('@playwright/test');
module.exports = defineConfig({
    testDir: './tests/E2E-multisite',
    workers: 1,
    retries: 0,
    timeout: 30000,
    use: {
        baseURL: 'http://127.0.0.1:' + (process.env.TEST_PORT || '18890'),
        headless: true,
        browserName: 'chromium',
        launchOptions: {
            executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome',
            args: ['--no-sandbox'],
        },
    },
    reporter: [['list'], ['json', { outputFile: 'build/rc11-reports/multisite-ui.json' }]],
});
