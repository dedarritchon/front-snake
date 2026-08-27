import {execSync} from 'node:child_process';

import react from '@vitejs/plugin-react';
import {defineConfig} from 'vite';

function appVersion(): string {
  const sha = process.env.GITHUB_SHA;
  if (sha) {
    return sha.slice(0, 7);
  }
  try {
    return execSync('git rev-parse --short=7 HEAD', {encoding: 'utf8'}).trim();
  } catch {
    return 'dev';
  }
}

export default defineConfig({
  base: '/front-snake/',
  define: {
    __APP_VERSION__: JSON.stringify(appVersion()),
  },
  plugins: [react()],
  server: {
    allowedHosts: ['6005d6aa7ea8.ngrok.app'],
  },
});
