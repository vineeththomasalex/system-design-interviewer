import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  timeout: 30000,
  use: {
    baseURL: 'http://localhost:4176',
    headless: true,
  },
  webServer: {
    command: 'npm run build && npx vite preview --port 4176',
    port: 4176,
    reuseExistingServer: false,
  },
});
