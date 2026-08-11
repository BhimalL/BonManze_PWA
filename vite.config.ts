import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
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
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
