import { test, expect } from '@playwright/test';

test.describe('System Design Interviewer', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.removeItem('sysdesign-diagrams');
      localStorage.removeItem('sysdesign-active');
      localStorage.removeItem('sdi-settings');
    });
    await page.reload();
    await page.waitForSelector('.diagram-svg .diagram-node', { timeout: 10000 });
  });

  test('page loads with correct heading', async ({ page }) => {
    const heading = page.locator('h1');
    await expect(heading).toContainText('System Design Interviewer');
  });

  test('SVG canvas renders default diagram nodes', async ({ page }) => {
    const svg = page.locator('.diagram-svg');
    await expect(svg).toBeVisible();
    const nodes = page.locator('.diagram-svg .diagram-node');
    expect(await nodes.count()).toBeGreaterThanOrEqual(3);
  });

  test('connections are rendered', async ({ page }) => {
    const connections = page.locator('.diagram-svg .diagram-connection path');
    expect(await connections.count()).toBeGreaterThanOrEqual(3);
  });

  test('YAML editor has content via CodeMirror', async ({ page }) => {
    const cmContent = page.locator('.cm-content');
    await expect(cmContent).toBeVisible();
    const text = await cmContent.textContent();
    expect(text).toContain('nodes:');
    expect(text).toContain('client');
  });

  // ---- Interview Button & Header ----
  test('interview button is visible in header', async ({ page }) => {
    const btn = page.locator('.toolbar-btn-interview');
    await expect(btn).toBeVisible();
    await expect(btn).toContainText('Interview');
  });

  test('settings button is visible in header', async ({ page }) => {
    const btn = page.getByRole('button', { name: '⚙️' });
    await expect(btn).toBeVisible();
  });

  // ---- Settings Page ----
  test('settings dialog opens and closes', async ({ page }) => {
    await page.getByRole('button', { name: '⚙️' }).click();
    const dialog = page.locator('.settings-dialog');
    await expect(dialog).toBeVisible();
    await expect(page.locator('.settings-dialog h2')).toContainText('Settings');

    // Close
    await page.getByRole('button', { name: 'Save & Close' }).click();
    await expect(dialog).not.toBeVisible();
  });

  test('settings persists API key', async ({ page }) => {
    await page.getByRole('button', { name: '⚙️' }).click();
    const input = page.locator('.settings-dialog input[type="password"]');
    await input.fill('test-key-12345');
    await page.getByRole('button', { name: 'Save & Close' }).click();

    // Reopen and check
    await page.getByRole('button', { name: '⚙️' }).click();
    const value = await page.locator('.settings-dialog input[type="password"]').inputValue();
    expect(value).toBe('test-key-12345');
  });

  test('settings persists candidate name', async ({ page }) => {
    await page.getByRole('button', { name: '⚙️' }).click();
    await page.locator('.settings-dialog input[placeholder="Your name"]').fill('Alice');
    await page.getByRole('button', { name: 'Save & Close' }).click();

    // Reload and check persistence
    await page.reload();
    await page.waitForSelector('.diagram-svg .diagram-node');
    await page.getByRole('button', { name: '⚙️' }).click();
    const value = await page.locator('.settings-dialog input[placeholder="Your name"]').inputValue();
    expect(value).toBe('Alice');
  });

  test('settings shows validate button disabled without key', async ({ page }) => {
    await page.getByRole('button', { name: '⚙️' }).click();
    // Clear key
    await page.locator('.settings-dialog input[type="password"]').fill('');
    const validateBtn = page.locator('.settings-btn-validate');
    await expect(validateBtn).toBeDisabled();
  });

  // ---- Interview Setup Dialog ----
  test('interview setup dialog opens', async ({ page }) => {
    await page.locator('.toolbar-btn-interview').click();
    const dialog = page.locator('.setup-dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.locator('h2')).toContainText('New Interview');
  });

  test('interview setup shows API key warning', async ({ page }) => {
    await page.locator('.toolbar-btn-interview').click();
    const warning = page.locator('.setup-warning');
    await expect(warning).toBeVisible();
    await expect(warning).toContainText('API key not configured');
  });

  test('interview setup cancel returns to idle', async ({ page }) => {
    await page.locator('.toolbar-btn-interview').click();
    await expect(page.locator('.setup-dialog')).toBeVisible();
    await page.getByRole('button', { name: 'Cancel' }).click();
    await expect(page.locator('.setup-dialog')).not.toBeVisible();
  });

  test('interview setup template browser toggles', async ({ page }) => {
    await page.locator('.toolbar-btn-interview').click();

    // Toggle to templates
    await page.locator('.setup-btn-toggle').click();
    const grid = page.locator('.setup-templates-grid');
    await expect(grid).toBeVisible();

    // Should have 10 template cards
    const cards = grid.locator('.setup-template-card');
    expect(await cards.count()).toBe(10);

    // Toggle back to custom
    await page.locator('.setup-btn-toggle').click();
    await expect(grid).not.toBeVisible();
  });

  test('clicking template fills question and settings', async ({ page }) => {
    await page.locator('.toolbar-btn-interview').click();
    await page.locator('.setup-btn-toggle').click();

    // Click the first template (URL Shortener)
    await page.locator('.setup-template-card').first().click();

    // Should switch back to custom view with question filled
    const input = page.locator('.setup-input[placeholder*="Design"]');
    const value = await input.inputValue();
    expect(value).toContain('URL shortening');
  });

  test('interview setup word count limits to 50', async ({ page }) => {
    await page.locator('.toolbar-btn-interview').click();
    const input = page.locator('.setup-input[placeholder*="Design"]');
    
    // Type a short question
    await input.fill('Design a URL shortener');
    const wordCount = page.locator('.setup-word-count');
    await expect(wordCount).toContainText('4/50');
  });

  test('begin interview button disabled without question', async ({ page }) => {
    await page.locator('.toolbar-btn-interview').click();
    const beginBtn = page.getByRole('button', { name: 'Begin Interview' });
    await expect(beginBtn).toBeDisabled();
  });

  // ---- Diagram Features (preserved from architecture-diagrammer) ----
  test('theme switching works', async ({ page }) => {
    const canvasPanel = page.locator('.canvas-panel');
    const bgBefore = await canvasPanel.evaluate(el => el.style.background);
    await page.locator('.toolbar-select').first().selectOption('light');
    await page.waitForTimeout(300);
    const bgAfter = await canvasPanel.evaluate(el => el.style.background);
    expect(bgAfter).not.toEqual(bgBefore);
  });

  test('auto layout repositions nodes', async ({ page }) => {
    const nodesBefore = await page.locator('.diagram-svg .diagram-node').evaluateAll(
      nodes => nodes.map(n => n.getAttribute('transform'))
    );
    await page.locator('.toolbar-btn', { hasText: 'Grid' }).click();
    await page.waitForTimeout(300);
    const nodesAfter = await page.locator('.diagram-svg .diagram-node').evaluateAll(
      nodes => nodes.map(n => n.getAttribute('transform'))
    );
    expect(nodesBefore.some((pos, i) => pos !== nodesAfter[i])).toBe(true);
  });

  test('pencil draw tool activates', async ({ page }) => {
    const pencilBtn = page.locator('.draw-btn', { hasText: '✏️' });
    await pencilBtn.click();
    await expect(pencilBtn).toHaveClass(/draw-btn-active/);
    await pencilBtn.click();
    await expect(pencilBtn).not.toHaveClass(/draw-btn-active/);
  });

  test('notes tab works', async ({ page }) => {
    await page.locator('.editor-tab', { hasText: 'Notes' }).click();
    const editor = page.locator('.notes-editor');
    await expect(editor).toBeVisible();
    await editor.click();
    await page.keyboard.type('Test note');
    const content = await editor.textContent();
    expect(content).toContain('Test note');
  });

  test('new diagram tab can be created', async ({ page }) => {
    await page.locator('.tab-add').click();
    await page.waitForTimeout(300);
    const tabs = page.locator('.tab-bar .tab');
    expect(await tabs.count()).toBe(2);
  });

  test('reference panel shows node types', async ({ page }) => {
    const toggle = page.locator('.reference-toggle');
    const content = page.locator('.reference-content');
    if (!(await content.isVisible())) {
      await toggle.click();
    }
    const dividers = page.locator('.reference-tier-divider');
    expect(await dividers.count()).toBeGreaterThanOrEqual(4);
  });

  test('zoom works with scroll wheel', async ({ page }) => {
    const svg = page.locator('.diagram-svg');
    const vbBefore = await svg.getAttribute('viewBox');
    const box = await svg.boundingBox();
    if (box) {
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.wheel(0, -300);
      await page.waitForTimeout(300);
    }
    const vbAfter = await svg.getAttribute('viewBox');
    expect(vbAfter).not.toEqual(vbBefore);
  });
});

