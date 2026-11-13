import { defineConfig, devices } from '@playwright/test';

const url = process.env.API_URL;
const anon = process.env.ANON_KEY;
if (!url || new URL(url).hostname !== '127.0.0.1' || !anon || !process.env.SERVICE_ROLE_KEY) {
  throw new Error('E2E requires isolated local Supabase (API_URL, ANON_KEY, SERVICE_ROLE_KEY).');
}
export default defineConfig({
  testDir: './tests/e2e',
  timeout: 120000,
  expect: { timeout: 15000 },
  workers: 1,
  retries: 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://127.0.0.1:3000',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1 --strictPort',
    url: 'http://127.0.0.1:3000',
    reuseExistingServer: false,
    timeout: 60000,
    env: { VITE_SUPABASE_URL: url, VITE_SUPABASE_ANON_KEY: anon },
  },
});
