#!/usr/bin/env node
/**
 * Downloads card images for all cards in the cube from YGOProDeck CDN.
 * Stores them locally in public/images/cards/ and public/images/cards_small/
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

const CUBE_PATH = path.join(__dirname, '../public/cubes/the-library.json');
const IMAGES_DIR = path.join(__dirname, '../public/images/cards');
const IMAGES_SMALL_DIR = path.join(__dirname, '../public/images/cards_small');

// Create directories if they don't exist
if (!fs.existsSync(IMAGES_DIR)) {
  fs.mkdirSync(IMAGES_DIR, { recursive: true });
}
if (!fs.existsSync(IMAGES_SMALL_DIR)) {
  fs.mkdirSync(IMAGES_SMALL_DIR, { recursive: true });
}

function downloadFile(url, destPath) {
  return new Promise((resolve, reject) => {
    // Skip if file already exists
    if (fs.existsSync(destPath)) {
      resolve('skipped');
      return;
    }

    const file = fs.createWriteStream(destPath);
    https.get(url, (response) => {
      if (response.statusCode === 200) {
        response.pipe(file);
        file.on('finish', () => {
          file.close();
          resolve('downloaded');
        });
      } else if (response.statusCode === 302 || response.statusCode === 301) {
        // Follow redirect
        file.close();
        fs.unlinkSync(destPath);
        downloadFile(response.headers.location, destPath).then(resolve).catch(reject);
      } else {
        file.close();
        fs.unlinkSync(destPath);
        reject(new Error(`HTTP ${response.statusCode} for ${url}`));
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

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  console.log('Loading cube data...');
  const cube = JSON.parse(fs.readFileSync(CUBE_PATH, 'utf8'));
  const cardIds = Object.keys(cube.cardMap);

  console.log(`Found ${cardIds.length} cards to download images for.\n`);

  let downloaded = 0;
  let skipped = 0;
  let failed = 0;
  const errors = [];

  for (let i = 0; i < cardIds.length; i++) {
    const cardId = cardIds[i];
    const progress = `[${i + 1}/${cardIds.length}]`;

    // Download full-size image
    const fullUrl = `https://images.ygoprodeck.com/images/cards/${cardId}.jpg`;
    const fullPath = path.join(IMAGES_DIR, `${cardId}.jpg`);

    // Download small image
    const smallUrl = `https://images.ygoprodeck.com/images/cards_small/${cardId}.jpg`;
    const smallPath = path.join(IMAGES_SMALL_DIR, `${cardId}.jpg`);

    try {
      const [fullResult, smallResult] = await Promise.all([
        downloadFile(fullUrl, fullPath),
        downloadFile(smallUrl, smallPath),
      ]);

      if (fullResult === 'skipped' && smallResult === 'skipped') {
        skipped++;
        process.stdout.write(`\r${progress} Skipped ${cardId} (already exists)    `);
      } else {
        downloaded++;
        process.stdout.write(`\r${progress} Downloaded ${cardId}                    `);
      }
    } catch (err) {
      failed++;
      errors.push({ cardId, error: err.message });
      process.stdout.write(`\r${progress} Failed ${cardId}: ${err.message}    `);
    }

    // Small delay to avoid rate limiting
    if ((i + 1) % 10 === 0) {
      await sleep(100);
    }
  }

  console.log('\n\n--- Summary ---');
  console.log(`Downloaded: ${downloaded}`);
  console.log(`Skipped (already existed): ${skipped}`);
  console.log(`Failed: ${failed}`);

  if (errors.length > 0) {
    console.log('\nFailed cards:');
    errors.forEach(({ cardId, error }) => {
      console.log(`  - ${cardId}: ${error}`);
    });
  }

  console.log('\nDone!');
}

main().catch(console.error);
