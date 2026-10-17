import { defineConfig } from '@playwright/test';

const previewUrl = process.env.GAME_PREVIEW_URL;

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  timeout: 90000,
  use: { baseURL: previewUrl ?? 'http://127.0.0.1:5173', viewport: { width: 1280, height: 720 }, trace: 'retain-on-failure' },
  webServer: previewUrl ? undefined : { command: `${process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm'} dev`, url: 'http://127.0.0.1:5173', reuseExistingServer: !process.env.CI },
  projects: [
    { name: 'chrome', use: { browserName: 'chromium', channel: 'chrome' } },
    { name: 'edge', use: { browserName: 'chromium', channel: 'msedge' } },
    { name: 'firefox', use: { browserName: 'firefox' } },
  ],
});
