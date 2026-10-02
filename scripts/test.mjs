// `npm run test:once` — runs the unit tests a single time in a headless browser and exits.
// Karma needs a Chromium browser: use Chrome if CHROME_BIN or a standard install exists,
// otherwise fall back to Edge (always present on Windows).
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';

const candidates = [
  process.env.CHROME_BIN,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
];
const browser = candidates.find((p) => p && existsSync(p));
if (!browser) {
  console.error('No Chrome or Edge found — set CHROME_BIN to a Chromium-based browser.');
  process.exit(1);
}

const result = spawnSync('npx', ['ng', 'test', '--watch=false', '--browsers=ChromeHeadless'], {
  stdio: 'inherit',
  shell: true,
  env: { ...process.env, CHROME_BIN: browser },
});
process.exit(result.status ?? 1);
