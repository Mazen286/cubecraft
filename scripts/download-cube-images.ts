/**
 * Script to download card images for default cubes
 * Usage: npx tsx scripts/download-cube-images.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import * as https from 'https';
import * as http from 'http';

const CUBES_DIR = path.join(process.cwd(), 'public/cubes');
const IMAGES_DIR = path.join(process.cwd(), 'public/images/cards');

// Cubes to process
const CUBE_FILES = [
  'arena-powered-cube.json',
  'mtgo-vintage-cube.json',
  'the-library.json',
];

interface Card {
  id: number;
  name: string;
  imageUrl?: string;
}

interface CubeData {
  name: string;
  cardMap: Record<string, Card>;
}

/**
 * Download a file from URL
 */
function downloadFile(url: string, destPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(destPath);
    const protocol = url.startsWith('https') ? https : http;

    protocol.get(url, (response) => {
      // Handle redirects
      if (response.statusCode === 301 || response.statusCode === 302) {
        const redirectUrl = response.headers.location;
        if (redirectUrl) {
          file.close();
          fs.unlinkSync(destPath);
          downloadFile(redirectUrl, destPath).then(resolve).catch(reject);
          return;
        }
      }

      if (response.statusCode !== 200) {
        file.close();
        fs.unlinkSync(destPath);
        reject(new Error(`HTTP ${response.statusCode}`));
        return;
      }

      response.pipe(file);
      file.on('finish', () => {
        file.close();
        resolve();
      });
    }).on('error', (err) => {
      file.close();
      if (fs.existsSync(destPath)) fs.unlinkSync(destPath);
      reject(err);
    });
  });
}

/**
 * Get local image path for a card
 */
function getLocalImagePath(cubeId: string, cardId: number | string): string {
  return `/images/cards/${cubeId}/${cardId}.jpg`;
}

/**
 * Process a cube file
 */
async function processCube(cubeFile: string): Promise<void> {
  const cubeId = cubeFile.replace('.json', '');
  const cubePath = path.join(CUBES_DIR, cubeFile);

  if (!fs.existsSync(cubePath)) {
    console.log(`Skipping ${cubeFile} - file not found`);
    return;
  }

  console.log(`\nProcessing ${cubeFile}...`);

  const cubeData: CubeData = JSON.parse(fs.readFileSync(cubePath, 'utf-8'));
  const cards = Object.values(cubeData.cardMap);

  // Create images directory for this cube
  const cubeImagesDir = path.join(IMAGES_DIR, cubeId);
  if (!fs.existsSync(cubeImagesDir)) {
    fs.mkdirSync(cubeImagesDir, { recursive: true });
  }

  let downloaded = 0;
  let skipped = 0;
  let failed = 0;

  for (const card of cards) {
    if (!card.imageUrl) {
      skipped++;
      continue;
    }

    const localPath = path.join(cubeImagesDir, `${card.id}.jpg`);

    // Skip if already downloaded
    if (fs.existsSync(localPath)) {
      skipped++;
      continue;
    }

    try {
      await downloadFile(card.imageUrl, localPath);
      downloaded++;

      // Rate limiting
      await new Promise(r => setTimeout(r, 50));

      if (downloaded % 50 === 0) {
        console.log(`  Downloaded ${downloaded} images...`);
      }
    } catch (error) {
      failed++;
      console.warn(`  Failed to download ${card.name}: ${error}`);
    }
  }

  console.log(`  Done: ${downloaded} downloaded, ${skipped} skipped, ${failed} failed`);

  // Update cube JSON with local image paths
  let updated = 0;
  for (const [id, card] of Object.entries(cubeData.cardMap)) {
    if (card.imageUrl) {
      const localImagePath = getLocalImagePath(cubeId, card.id);
      const fullLocalPath = path.join(IMAGES_DIR, cubeId, `${card.id}.jpg`);

      if (fs.existsSync(fullLocalPath)) {
        (card as Card).imageUrl = localImagePath;
        updated++;
      }
    }
  }

  // Save updated cube JSON
  fs.writeFileSync(cubePath, JSON.stringify(cubeData, null, 2));
  console.log(`  Updated ${updated} image URLs to local paths`);
}

async function main() {
  console.log('Downloading card images for default cubes...');
  console.log(`Images will be saved to: ${IMAGES_DIR}`);

  // Create base images directory
  if (!fs.existsSync(IMAGES_DIR)) {
    fs.mkdirSync(IMAGES_DIR, { recursive: true });
  }

  for (const cubeFile of CUBE_FILES) {
    await processCube(cubeFile);
  }

  console.log('\nDone!');
}

main().catch(console.error);
