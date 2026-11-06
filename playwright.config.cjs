const { defineConfig } = require('@playwright/test');
module.exports = defineConfig({
    testDir: './tests/E2E',
    workers: 1,
    retries: 0,
    timeout: 60000,
    use: {
        baseURL: 'http://127.0.0.1:' + (process.env.TEST_PORT || '18885'),
        headless: true,
        launchOptions: {
            executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome',
            args: ['--no-sandbox'],
        },
    },
    reporter: [['list'], ['json', { outputFile: 'build/reports/e2e.json' }]],
});
