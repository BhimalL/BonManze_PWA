// scripts/syncToEmulator.js
//
// Automatically syncs modified and untracked files from the OneDrive workspace
// to the active emulator workspace at C:\Users\bhimall\BonManze_pwa.
//
// Run: node scripts/syncToEmulator.js

import { execSync } from 'child_process';
import { copyFileSync, mkdirSync, existsSync } from 'fs';
import { dirname, join } from 'path';

const DEST = 'C:\\Users\\bhimall\\BonManze_pwa';

try {
  console.log('Querying git for modified and untracked files...');
  const output = execSync('git status --porcelain', { encoding: 'utf-8' });
  const lines = output.trim().split('\n').filter(Boolean);

  if (lines.length === 0) {
    console.log('No modified files found to sync.');
    process.exit(0);
  }

  for (const line of lines) {
    const match = line.match(/^.{2}\s+(.*)$/);
    if (!match) continue;
    const filePath = match[1].trim();
    
    // Skip internal/dependency paths
    if (
      filePath.includes('node_modules') || 
      filePath.startsWith('.git') || 
      filePath.startsWith('dist') ||
      filePath.includes('.gemini')
    ) {
      continue;
    }
    
    const src = filePath;
    const dest = join(DEST, filePath);
    
    console.log(`Syncing: ${src} -> ${dest}`);
    const destDir = dirname(dest);
    if (!existsSync(destDir)) {
      mkdirSync(destDir, { recursive: true });
    }
    copyFileSync(src, dest);
  }
  console.log('All files successfully synchronized to emulator clone!');
} catch (e) {
  console.error('Sync failed:', e.message);
  process.exit(1);
}
