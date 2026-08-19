import react from '@vitejs/plugin-react';
import {defineConfig} from 'vite';

export default defineConfig({
  base: '',
  plugins: [react()],
  server: {
    allowedHosts: ['6005d6aa7ea8.ngrok.app'],
  },
});
