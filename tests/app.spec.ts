import { test, expect } from '@playwright/test';

test.describe('Architecture Diagrammer', () => {
  test.beforeEach(async ({ page }) => {
    // Clear localStorage for clean state
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.removeItem('sysdesign-diagrams');
      localStorage.removeItem('sysdesign-active');
    });
    await page.reload();
    await page.waitForSelector('.diagram-svg .diagram-node', { timeout: 10000 });
  });

  test('page loads with correct heading', async ({ page }) => {
    const heading = page.locator('h1');
    await expect(heading).toContainText('System Design Diagrammer');
  });

  test('SVG canvas is present with nodes rendered', async ({ page }) => {
    const svg = page.locator('.diagram-svg');
    await expect(svg).toBeVisible();

    const nodes = page.locator('.diagram-svg .diagram-node');
    const count = await nodes.count();
    expect(count).toBeGreaterThanOrEqual(1);
  });

  test('YAML editor textarea is present with default content', async ({ page }) => {
    const textarea = page.locator('textarea.yaml-textarea');
    await expect(textarea).toBeVisible();

    const value = await textarea.inputValue();
    expect(value).toContain('nodes:');
    expect(value).toContain('Client Apps');
    expect(value).toContain('API Gateway');
  });

  test('default nodes are rendered in the SVG', async ({ page }) => {
    const svgText = await page.locator('.diagram-svg').innerHTML();
    expect(svgText).toContain('Client Apps');
    expect(svgText).toContain('API Gateway');
    expect(svgText).toContain('Load Balancer');
    expect(svgText).toContain('Video Storage');
  });

  test('connections are rendered as paths', async ({ page }) => {
    const connections = page.locator('.diagram-svg .diagram-connection path');
    const count = await connections.count();
    expect(count).toBeGreaterThanOrEqual(3);
  });

  test('theme switching changes diagram appearance', async ({ page }) => {
    const canvasPanel = page.locator('.canvas-panel');
    const bgBefore = await canvasPanel.evaluate(el => el.style.background);
    await page.locator('.toolbar-select').selectOption('light');
    await page.waitForTimeout(300);
    const bgAfter = await canvasPanel.evaluate(el => el.style.background);
    expect(bgAfter).not.toEqual(bgBefore);
  });

  test('tiered layout arranges nodes by tier', async ({ page }) => {
    await page.locator('.toolbar-btn', { hasText: 'Tiered' }).click();
    await page.waitForTimeout(300);
    // Client nodes should be near top, database nodes near bottom
    const clientY = await page.locator('.diagram-svg .diagram-node').first().evaluate(
      el => parseFloat(el.getAttribute('transform')?.match(/translate\([^,]+,\s*([^)]+)\)/)?.[1] || '0')
    );
    const nodes = page.locator('.diagram-svg .diagram-node');
    const count = await nodes.count();
    const lastY = await nodes.nth(count - 1).evaluate(
      el => parseFloat(el.getAttribute('transform')?.match(/translate\([^,]+,\s*([^)]+)\)/)?.[1] || '0')
    );
    // Last node (data tier) should be below first node (client tier)
    expect(lastY).toBeGreaterThan(clientY);
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
    const moved = nodesBefore.some((pos, i) => pos !== nodesAfter[i]);
    expect(moved).toBe(true);
  });

  test('export SVG button exists', async ({ page }) => {
    const exportBtn = page.locator('.toolbar-btn', { hasText: 'SVG' });
    await expect(exportBtn).toBeVisible();
    await expect(exportBtn).toHaveAttribute('title', 'Download as SVG');
  });

  test('pencil draw tool activates and draws', async ({ page }) => {
    // Click pencil button
    const pencilBtn = page.locator('.draw-btn', { hasText: '✏️' });
    await pencilBtn.click();
    await expect(pencilBtn).toHaveClass(/draw-btn-active/);

    // Canvas overlay should be interactive
    const canvas = page.locator('.draw-overlay');
    await expect(canvas).toHaveCSS('pointer-events', 'auto');

    // Draw a stroke
    const box = await canvas.boundingBox();
    if (box) {
      await page.mouse.move(box.x + 100, box.y + 100);
      await page.mouse.down();
      await page.mouse.move(box.x + 200, box.y + 200, { steps: 5 });
      await page.mouse.up();
    }

    // Deactivate pencil
    await pencilBtn.click();
    await expect(pencilBtn).not.toHaveClass(/draw-btn-active/);
    await expect(canvas).toHaveCSS('pointer-events', 'none');
  });

  test('zoom works with scroll wheel', async ({ page }) => {
    const svg = page.locator('.diagram-svg');
    const vbBefore = await svg.getAttribute('viewBox');

    // Scroll to zoom
    const box = await svg.boundingBox();
    if (box) {
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.wheel(0, -300);
      await page.waitForTimeout(300);
    }

    const vbAfter = await svg.getAttribute('viewBox');
    expect(vbAfter).not.toEqual(vbBefore);
  });

  test('zoom works while pencil is active', async ({ page }) => {
    // Activate pencil
    await page.locator('.draw-btn', { hasText: '✏️' }).click();

    const svg = page.locator('.diagram-svg');
    const vbBefore = await svg.getAttribute('viewBox');

    const canvas = page.locator('.draw-overlay');
    const box = await canvas.boundingBox();
    if (box) {
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.wheel(0, -300);
      await page.waitForTimeout(300);
    }

    const vbAfter = await svg.getAttribute('viewBox');
    expect(vbAfter).not.toEqual(vbBefore);
  });

  test('notes tab switches and accepts input', async ({ page }) => {
    // Click notes tab
    await page.locator('.editor-tab', { hasText: 'Notes' }).click();
    const editor = page.locator('.notes-editor');
    await expect(editor).toBeVisible();

    // Type something
    await editor.click();
    await page.keyboard.type('Test note');
    const content = await editor.textContent();
    expect(content).toContain('Test note');

    // Switch back to YAML
    await page.locator('.editor-tab', { hasText: 'YAML' }).click();
    await expect(page.locator('textarea.yaml-textarea')).toBeVisible();
  });

  test('reference panel node types are grouped by tier', async ({ page }) => {
    // Open reference panel if collapsed
    const toggle = page.locator('.reference-toggle');
    const content = page.locator('.reference-content');
    if (!(await content.isVisible())) {
      await toggle.click();
    }
    // Should have tier dividers
    const dividers = page.locator('.reference-tier-divider');
    const count = await dividers.count();
    expect(count).toBeGreaterThanOrEqual(4);
  });

  test('clicking reference node type adds entry to YAML', async ({ page }) => {
    const textarea = page.locator('textarea.yaml-textarea');
    const valueBefore = await textarea.inputValue();

    // Open reference and click a node type
    const toggle = page.locator('.reference-toggle');
    const content = page.locator('.reference-content');
    if (!(await content.isVisible())) {
      await toggle.click();
    }
    // Click the first clickable item (should be 'client')
    await page.locator('.reference-item-clickable').first().click();
    await page.waitForTimeout(300);

    const valueAfter = await textarea.inputValue();
    expect(valueAfter.length).toBeGreaterThan(valueBefore.length);
    // Should contain a new node entry
    expect(valueAfter).toContain('label: New client');
  });

  test('diagram tabs persist independently', async ({ page }) => {
    // Create a new tab
    await page.locator('.tab-add').click();
    await page.waitForTimeout(300);

    // Should have 2 tabs now
    const tabs = page.locator('.tab-bar .tab');
    expect(await tabs.count()).toBe(2);

    // Second tab should be active and have default content
    const textarea = page.locator('textarea.yaml-textarea');
    const value = await textarea.inputValue();
    expect(value).toContain('nodes:');
  });
});
