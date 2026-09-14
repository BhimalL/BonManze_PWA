import path from 'path';
import { execSync } from 'child_process';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');

    // Build stamp (see Working Agreement, 2026-09-14 amendment): lets anyone looking at the
    // running app confirm at a glance which commit it's actually running, instead of a stale
    // cached bundle silently looking like a regression. Recomputed every time the dev server
    // starts (npm run dev) and every production build (npm run build) — never at runtime.
    let buildCommit = 'unknown';
    try {
      buildCommit = execSync('git rev-parse --short HEAD').toString().trim();
    } catch {
      // No .git available in this context (e.g. some deploy environments) — fall back rather
      // than fail the build over a cosmetic feature.
    }
    const buildTime = new Date().toISOString();

    return {
      server: {
        port: 3000,
        // Fail loudly instead of silently moving to 3001/3002 etc. when
        // port 3000 is already taken (e.g. a previous dev server process
        // didn't fully exit). The app's persisted state (localStorage) is
        // scoped per browser origin, which includes the port — if the
        // server quietly starts on a different port and the browser tab
        // follows it there, every existing order/customer/menu/library
        // record appears to have "vanished," when it's actually still
        // sitting under the old port's origin. Better to fail the start
        // and free the old port than to land somewhere new by surprise.
        strictPort: true,
        host: '0.0.0.0',
      },
      plugins: [react()],
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        __BUILD_INFO__: JSON.stringify({ commit: buildCommit, time: buildTime })
      },
      optimizeDeps: {
        include: [
          'firebase/app',
          'firebase/auth',
          'firebase/firestore',
          'firebase/functions',
          'firebase/storage'
        ]
      },
      resolve: {
        dedupe: ['firebase'],
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
