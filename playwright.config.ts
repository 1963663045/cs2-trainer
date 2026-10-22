import { defineConfig } from '@playwright/test';

// 本地可用 CHROME_PATH 指向已安装的 Chrome/Chromium；CI 中使用 `npx playwright install chromium` 下载的浏览器。
const executablePath = process.env.CHROME_PATH || undefined;

export default defineConfig({
  testDir: 'e2e',
  timeout: 180_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: 'http://127.0.0.1:4179/',
    viewport: { width: 1280, height: 900 },
    launchOptions: { executablePath, args: ['--no-sandbox'] },
    trace: 'retain-on-failure'
  },
  webServer: {
    command: 'npx vite preview --outDir dist-e2e --port 4179 --strictPort --host 127.0.0.1',
    url: 'http://127.0.0.1:4179/',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000
  }
});
