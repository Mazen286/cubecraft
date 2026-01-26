import { test, expect, Browser, BrowserContext, Page } from '@playwright/test';

const BASE_URL = 'http://localhost:5173';

interface Player {
  context: BrowserContext;
  page: Page;
  name: string;
}

test.describe('Multiplayer Draft', () => {
  let browser: Browser;
  let players: Player[] = [];

  test.beforeAll(async ({ browser: b }) => {
    browser = b;
  });

  test.afterAll(async () => {
    for (const player of players) {
      await player.context.close();
    }
  });

  test('3-player draft flow', async () => {
    test.setTimeout(180000);

    const playerNames = ['Host', 'Player2', 'Player3'];

    // Create 3 isolated browser contexts
    for (const name of playerNames) {
      const context = await browser.newContext();
      const page = await context.newPage();
      await page.goto(BASE_URL);

      await page.evaluate((playerName) => {
        localStorage.setItem('draft_user_id', `test-${playerName}-${Date.now()}`);
        localStorage.setItem('draft_user_name', playerName);
      }, name);

      players.push({ context, page, name });
    }

    const [host, player2, player3] = players;

    // === STEP 1: Host creates a draft ===
    console.log('\n=== Step 1: Host creates draft ===');
    await host.page.goto(BASE_URL);
    await host.page.waitForLoadState('networkidle');

    await host.page.click('button:has-text("Start Draft")');
    await host.page.waitForURL(/\/setup/);
    console.log('Host on setup page');

    await host.page.waitForTimeout(1500);

    // Use all selects on the page - they appear in order
    const allSelects = host.page.locator('select');
    const selectCount = await allSelects.count();
    console.log(`Found ${selectCount} select elements`);

    // First select after cubes should be Players (index may vary)
    // Find by option text - look for select that has "Players" option
    const playersSelect = host.page.locator('select:has(option:text("Players"))');
    await playersSelect.selectOption('3');
    console.log('Set player count to 3');

    // Find cards per player select (has "Cards" options)
    // Valid options are: 30, 45, 60, 75
    const cardsSelect = host.page.locator('select:has(option:text("Cards"))').first();
    await cardsSelect.selectOption('30');
    console.log('Set cards per player to 30');

    // Find timer select (has "Seconds" options)
    const timerSelect = host.page.locator('select:has(option:text("Seconds"))');
    await timerSelect.selectOption('30');
    console.log('Set timer to 30 seconds');

    // Create room
    await host.page.click('button:has-text("Create Room")');
    console.log('Clicked Create Room');

    await host.page.waitForURL(/\/lobby\//, { timeout: 15000 });
    console.log('Host in lobby');

    // Get room code - it's the large text in the lobby
    await host.page.waitForTimeout(1000);
    const roomCodeEl = host.page.locator('span.text-gold-400, span[class*="gold"]').first();
    await roomCodeEl.waitFor({ state: 'visible', timeout: 10000 });
    const roomCode = (await roomCodeEl.textContent())?.trim();
    console.log(`Room code: ${roomCode}`);
    expect(roomCode).toBeTruthy();
    expect(roomCode!.length).toBe(4);

    // === STEP 2: Other players join ===
    console.log('\n=== Step 2: Players joining ===');

    for (const player of [player2, player3]) {
      await player.page.goto(BASE_URL);
      await player.page.waitForLoadState('networkidle');

      await player.page.click('button:has-text("Join Room")');
      await player.page.waitForURL(/\/join/);

      const codeInput = player.page.locator('input');
      await codeInput.fill(roomCode!);
      console.log(`${player.name} entered room code`);

      await player.page.click('button[type="submit"]');

      await player.page.waitForURL(/\/lobby\//, { timeout: 15000 });
      console.log(`${player.name} joined lobby!`);
    }

    await host.page.waitForTimeout(2000);

    // === STEP 3: Host starts the draft ===
    console.log('\n=== Step 3: Host starting draft ===');

    const startButton = host.page.locator('button:has-text("Start Draft")');
    await startButton.waitFor({ state: 'visible', timeout: 10000 });
    await startButton.click();
    console.log('Host clicked Start Draft');

    for (const player of players) {
      await player.page.waitForURL(/\/draft\//, { timeout: 20000 });
      console.log(`${player.name} on draft page`);
    }

    await host.page.waitForTimeout(4000);

    // === STEP 4: Simulate picks ===
    console.log('\n=== Step 4: Making picks ===');

    const totalPicks = 30;
    for (let pick = 1; pick <= totalPicks; pick++) {
      console.log(`\n--- Pick ${pick}/${totalPicks} ---`);

      for (const player of players) {
        try {
          // Check if already picked
          const picked = await player.page.locator('text=/Waiting for other/i').isVisible({ timeout: 300 });
          if (picked) {
            console.log(`${player.name}: Waiting...`);
            continue;
          }

          // Find cards in the Current Pack section
          const packSection = player.page.locator('text=Current Pack').locator('..').locator('..');
          const cards = packSection.locator('img');

          const cardCount = await cards.count();
          if (cardCount === 0) {
            console.log(`${player.name}: No cards yet`);
            continue;
          }

          // Click a card (force: true to bypass the hover overlay)
          await cards.first().click({ timeout: 2000, force: true });
          await player.page.waitForTimeout(200);

          // Try to confirm pick
          const confirmBtn = player.page.locator('button:has-text("Confirm"), button:has-text("Pick")').first();
          if (await confirmBtn.isVisible({ timeout: 500 })) {
            await confirmBtn.click({ force: true });
            console.log(`${player.name}: Picked card ${pick}`);
          } else {
            // Double click as fallback
            await cards.first().dblclick({ force: true });
            console.log(`${player.name}: Double-clicked pick ${pick}`);
          }
        } catch (e) {
          console.log(`${player.name}: Error - ${e instanceof Error ? e.message : 'unknown'}`);
        }

        await player.page.waitForTimeout(300);
      }

      await host.page.waitForTimeout(2500);
    }

    // === STEP 5: Check completion ===
    console.log('\n=== Step 5: Checking results ===');

    for (const player of players) {
      const url = player.page.url();
      console.log(`${player.name}: ${url}`);

      if (url.includes('/results/')) {
        console.log(`${player.name}: COMPLETED!`);
      }
    }

    console.log('\n=== Test finished ===');
  });
});
