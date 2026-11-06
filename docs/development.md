# Local development

Local verification used Node 22.20.0 and Composer 2.8.12 in Docker. Install locked PHP
developer dependencies with the documented Composer container even when the target host
runs PHP 7.4; developer-tool installation requirements differ from the plugin runtime.

Never reuse production credentials, volumes, SQL dumps, media or printers.
Compose uses its own `ramsey-labels-test` network/volumes, synthetic credentials and a
loopback-only port 18885. Existing unrelated containers must not be stopped or modified.
The repository plugin mount is read-only in WordPress; edit files on the host.

```sh
npm ci
docker run --rm --user "$(id -u):$(id -g)" -v "$PWD:/app" -w /app composer:2.8.12 install
docker compose up -d wordpress
bash bin/setup-test-site.sh
bash bin/integration.sh
npm run test:e2e
```

The browser tests default to `/usr/bin/google-chrome`. Override `CHROME_PATH` with an installed
Chromium executable. They intercept the print function and never invoke a physical printer.
Containers supply PHP where host PHP is unavailable. Unit/static tools can use the Composer
container; PHPUnit needs PHP DOM/mbstring, supplied by the WordPress image.

ESLint 10.14.0's minimatch 10 dependency is affected by GHSA-g3hv-75wg-m249. A locked
development-only override selects fixed minimatch 11.0.1; lint and glob discovery are retested.
Remove the override when upstream adopts a fixed supported range. No audit findings are suppressed.

Stop just this environment with `docker compose stop`. Do not delete volumes casually: they
retain migration/test evidence. No remote repository is created or pushed by these scripts.
See compose.yaml for test-only credentials; they are not deployment secrets.
