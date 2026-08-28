const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const repoRoot = path.resolve(__dirname, '..');
const appDataDir = path.join(process.env.LOCALAPPDATA || path.join(process.env.USERPROFILE, 'AppData', 'Local'), 'BonManzE');
const emulatorDataDir = path.join(appDataDir, 'emulator-data');

// Create the target directories if they don't exist
if (!fs.existsSync(emulatorDataDir)) {
  fs.mkdirSync(emulatorDataDir, { recursive: true });
}

// Check if emulatorDataDir has any files inside it. If not, seed it from the backup folder in the repo
const files = fs.readdirSync(emulatorDataDir);
if (files.length === 0) {
  console.log('Seeding emulator data from backup...');
  const backupDir = path.join(repoRoot, 'firebase-export-178774160237069AG6N-BACKUP');
  if (fs.existsSync(backupDir)) {
    const copyRecursive = (src, dest) => {
      const exists = fs.existsSync(src);
      const stats = exists && fs.statSync(src);
      const isDirectory = exists && stats.isDirectory();
      if (isDirectory) {
        if (!fs.existsSync(dest)) fs.mkdirSync(dest);
        fs.readdirSync(src).forEach((childItemName) => {
          copyRecursive(path.join(src, childItemName), path.join(dest, childItemName));
        });
      } else {
        fs.copyFileSync(src, dest);
      }
    };
    copyRecursive(backupDir, emulatorDataDir);
    console.log('Seed complete.');
  } else {
    console.warn('Warning: Seed backup folder not found in repository root.');
  }
}

// Spawn the firebase emulators command with CWD set to appDataDir
console.log(`Starting Firebase emulators with working directory: ${appDataDir}`);
const child = spawn(
  'firebase',
  [
    'emulators:start',
    `--config=${path.join(repoRoot, 'firebase.json')}`,
    '--import=emulator-data',
    '--export-on-exit=emulator-data'
  ],
  {
    cwd: appDataDir,
    shell: true,
    stdio: 'inherit'
  }
);

child.on('close', (code) => {
  process.exit(code);
});
