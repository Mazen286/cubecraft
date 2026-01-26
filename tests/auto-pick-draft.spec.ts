import { test, expect, Browser, BrowserContext, Page } from '@playwright/test';

const BASE_URL = 'http://localhost:5173';

test.describe('Auto-Pick Draft Card Count', () => {
  let browser: Browser;
  let context: BrowserContext;
  let page: Page;

  test.beforeAll(async ({ browser: b }) => {
    browser = b;
  });

  test.afterEach(async () => {
    if (context) {
      await context.close();
    }
  });

  test('Solo draft with bots - verify exact card count', async () => {
    test.setTimeout(360000); // 6 minutes max

    context = await browser.newContext();
    page = await context.newPage();

    // Navigate and set up user
    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');

    await page.evaluate(() => {
      localStorage.setItem('yugioh-draft-user-id', `test-${Date.now()}`);
      localStorage.setItem('yugioh-draft-player-name', 'TestPlayer');
    });

    // Refresh to apply localStorage
    await page.reload();
    await page.waitForLoadState('networkidle');

    console.log('=== Step 1: Create draft ===');

    // Click Start Draft
    await page.click('button:has-text("Start Draft")');
    await page.waitForURL(/\/setup/, { timeout: 10000 });
    console.log('On setup page');

    // Take screenshot to see current state
    await page.screenshot({ path: 'test-results/setup-page.png' });

    // Wait for page to load
    await page.waitForTimeout(2000);

    // Just click Start Draft with defaults (should be Solo + bots)
    // The default should work for testing
    const startBtn = page.locator('button:has-text("Start Draft"), button:has-text("Start Solo"), button:has-text("Create")').first();
    await startBtn.waitFor({ state: 'visible', timeout: 10000 });

    // Expected cards per player - use default 60
    const expectedCards = 60;
    console.log(`Expected cards per player: ${expectedCards}`);

    await startBtn.click();
    console.log('Clicked Start');

    // Wait for draft page
    await page.waitForURL(/\/draft\/|\/lobby\//, { timeout: 20000 });
    console.log(`On page: ${page.url()}`);

    // If in lobby, add bots and start draft
    if (page.url().includes('/lobby/')) {
      console.log('In lobby');
      await page.waitForTimeout(2000);
      await page.screenshot({ path: 'test-results/lobby-page.png' });

      // Add bots until room is full or Start button is enabled
      const addBotBtn = page.locator('button:has-text("Add Bot")');
      for (let i = 0; i < 10; i++) {
        if (await addBotBtn.isVisible({ timeout: 1000 })) {
          await addBotBtn.click();
          console.log('Added bot');
          await page.waitForTimeout(500);
        } else {
          break;
        }
      }

      await page.waitForTimeout(1000);
      const lobbyStart = page.locator('button:has-text("Start Draft")');
      if (await lobbyStart.isVisible({ timeout: 5000 })) {
        await lobbyStart.click();
        console.log('Started from lobby');
        await page.waitForURL(/\/draft\//, { timeout: 20000 });
      }
    }

    console.log('=== Step 2: On draft page ===');
    await page.screenshot({ path: 'test-results/draft-page.png' });

    // Try to enable auto-pick
    await page.waitForTimeout(2000);

    // Look for auto-pick toggle with various selectors
    const autoPickSelectors = [
      '[title*="uto" i]',
      'button:has-text("Auto")',
      'label:has-text("Auto")',
      '[aria-label*="auto" i]',
      '.auto-pick',
    ];

    for (const selector of autoPickSelectors) {
      try {
        const el = page.locator(selector).first();
        if (await el.isVisible({ timeout: 1000 })) {
          await el.click();
          console.log(`Clicked auto-pick: ${selector}`);
          break;
        }
      } catch {
        // Try next
      }
    }

    console.log('=== Step 3: Waiting for completion ===');

    // Wait for results page (auto-pick should complete the draft)
    try {
      await page.waitForURL(/\/results\//, { timeout: 300000 });
      console.log('Draft completed!');
    } catch (e) {
      console.log('Timeout waiting for results');
      await page.screenshot({ path: 'test-results/timeout-state.png' });
      throw e;
    }

    console.log('=== Step 4: Verify card count ===');
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'test-results/results-page.png' });

    // Get card count from page
    const cardCountText = await page.locator('text=/\\d+ cards? drafted/i').textContent({ timeout: 5000 });
    console.log(`Card count text: ${cardCountText}`);

    let cardCount = 0;
    if (cardCountText) {
      const match = cardCountText.match(/(\d+)/);
      cardCount = match ? parseInt(match[1], 10) : 0;
    }

    console.log(`\n=== RESULT: ${cardCount} cards drafted (expected: ${expectedCards}) ===\n`);

    // Assert
    expect(cardCount, `Should have exactly ${expectedCards} cards`).toBe(expectedCards);
  });
});
