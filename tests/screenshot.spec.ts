import { test } from '@playwright/test';

test('capture screenshot of default diagram', async ({ page }) => {
  await page.goto('/');

  // Wait for the diagram nodes to fully render
  await page.waitForSelector('.diagram-svg .diagram-node', { timeout: 10000 });

  // Brief pause to let layout settle
  await page.waitForTimeout(500);

  await page.screenshot({ path: 'screenshot.png', fullPage: true });
});
