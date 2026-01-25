#!/usr/bin/env node

/**
 * Watch for CSV changes and auto-rebuild cube JSON
 * Usage: node scripts/watch-cubes.cjs
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const CUBES_DIR = path.join(__dirname, '../public/cubes');
const BUILD_SCRIPT = path.join(__dirname, 'build-cube.cjs');

let debounceTimer = null;
let isBuilding = false;

function runBuild() {
  if (isBuilding) {
    console.log('⏳ Build already in progress, queuing...');
    return;
  }

  isBuilding = true;
  console.log('\n🔄 CSV changed, rebuilding...\n');

  const child = spawn('node', [BUILD_SCRIPT], { stdio: 'inherit' });

  child.on('close', (code) => {
    isBuilding = false;
    if (code === 0) {
      console.log('\n👀 Watching for CSV changes... (Ctrl+C to stop)\n');
    }
  });
}

function debouncedBuild() {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(runBuild, 500);
}

console.log('👀 Watching for CSV changes in public/cubes/...');
console.log('   Edit a .csv file and save to auto-rebuild the JSON\n');

fs.watch(CUBES_DIR, (eventType, filename) => {
  if (filename && filename.endsWith('.csv')) {
    console.log(`📝 Detected change: ${filename}`);
    debouncedBuild();
  }
});

// Keep process alive
process.stdin.resume();
