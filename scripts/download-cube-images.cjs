#!/usr/bin/env node
/**
 * Download card images for a cube from YGOProDeck API
 * Usage: node scripts/download-cube-images.js [cubeName]
 * Example: node scripts/download-cube-images.js the-library
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

const CONCURRENT_DOWNLOADS = 10; // Number of parallel downloads
const RETRY_DELAY = 1000; // 1 second delay on retry
const MAX_RETRIES = 3;

const IMAGES_DIR = path.join(__dirname, '..', 'public', 'images');
const CARDS_DIR = path.join(IMAGES_DIR, 'cards');
const CARDS_SMALL_DIR = path.join(IMAGES_DIR, 'cards_small');
const CUBES_DIR = path.join(__dirname, '..', 'public', 'cubes');

// Ensure directories exist
[IMAGES_DIR, CARDS_DIR, CARDS_SMALL_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

function downloadFile(url, destPath) {
  return new Promise((resolve, reject) => {
    // Skip if file already exists
    if (fs.existsSync(destPath)) {
      resolve({ skipped: true });
      return;
    }

    const file = fs.createWriteStream(destPath);

    https.get(url, (response) => {
      if (response.statusCode === 200) {
        response.pipe(file);
        file.on('finish', () => {
          file.close();
          resolve({ skipped: false });
        });
      } else if (response.statusCode === 301 || response.statusCode === 302) {
        // Handle redirect
        file.close();
        fs.unlinkSync(destPath);
        downloadFile(response.headers.location, destPath).then(resolve).catch(reject);
      } else {
        file.close();
        fs.unlinkSync(destPath);
        reject(new Error(`HTTP ${response.statusCode}`));
      }
    }).on('error', (err) => {
      file.close();
      if (fs.existsSync(destPath)) {
        fs.unlinkSync(destPath);
      }
      reject(err);
    });
  });
}

async function downloadWithRetry(url, destPath, retries = MAX_RETRIES) {
  for (let i = 0; i < retries; i++) {
    try {
      return await downloadFile(url, destPath);
    } catch (err) {
      if (i < retries - 1) {
        await new Promise(r => setTimeout(r, RETRY_DELAY * (i + 1)));
      } else {
        throw err;
      }
    }
  }
}

async function downloadCardImages(cardIds) {
  const total = cardIds.length * 2; // Regular + small for each card
  let completed = 0;
  let downloaded = 0;
  let skipped = 0;
  let failed = 0;
  const errors = [];

  console.log(`\nDownloading images for ${cardIds.length} cards (${total} files total)...`);
  console.log(`Regular images: ${CARDS_DIR}`);
  console.log(`Small images: ${CARDS_SMALL_DIR}\n`);

  // Create download tasks for both sizes
  const tasks = [];
  for (const cardId of cardIds) {
    // Regular size
    tasks.push({
      cardId,
      size: 'regular',
      url: `https://images.ygoprodeck.com/images/cards/${cardId}.jpg`,
      destPath: path.join(CARDS_DIR, `${cardId}.jpg`)
    });
    // Small size
    tasks.push({
      cardId,
      size: 'small',
      url: `https://images.ygoprodeck.com/images/cards_small/${cardId}.jpg`,
      destPath: path.join(CARDS_SMALL_DIR, `${cardId}.jpg`)
    });
  }

  // Process in batches
  async function processTask(task) {
    try {
      const result = await downloadWithRetry(task.url, task.destPath);
      completed++;
      if (result.skipped) {
        skipped++;
      } else {
        downloaded++;
      }

      // Progress update every 50 files
      if (completed % 50 === 0 || completed === total) {
        const percent = Math.round((completed / total) * 100);
        process.stdout.write(`\rProgress: ${completed}/${total} (${percent}%) - Downloaded: ${downloaded}, Skipped: ${skipped}, Failed: ${failed}`);
      }
    } catch (err) {
      completed++;
      failed++;
      errors.push({ cardId: task.cardId, size: task.size, error: err.message });
    }
  }

  // Process tasks in parallel batches
  for (let i = 0; i < tasks.length; i += CONCURRENT_DOWNLOADS) {
    const batch = tasks.slice(i, i + CONCURRENT_DOWNLOADS);
    await Promise.all(batch.map(processTask));
  }

  console.log('\n\n=== Download Complete ===');
  console.log(`Total files: ${total}`);
  console.log(`Downloaded: ${downloaded}`);
  console.log(`Skipped (already exist): ${skipped}`);
  console.log(`Failed: ${failed}`);

  if (errors.length > 0) {
    console.log('\nFailed downloads:');
    errors.forEach(e => console.log(`  Card ${e.cardId} (${e.size}): ${e.error}`));
  }

  return { downloaded, skipped, failed, errors };
}

async function main() {
  const cubeName = process.argv[2] || 'the-library';
  const cubePath = path.join(CUBES_DIR, `${cubeName}.json`);

  if (!fs.existsSync(cubePath)) {
    console.error(`Cube not found: ${cubePath}`);
    console.error(`Available cubes:`);
    const cubes = fs.readdirSync(CUBES_DIR).filter(f => f.endsWith('.json'));
    cubes.forEach(c => console.error(`  - ${c.replace('.json', '')}`));
    process.exit(1);
  }

  console.log(`Loading cube: ${cubeName}`);
  const cube = JSON.parse(fs.readFileSync(cubePath, 'utf8'));
  const cardIds = Object.keys(cube.cardMap);
  console.log(`Found ${cardIds.length} cards in cube`);

  await downloadCardImages(cardIds);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
