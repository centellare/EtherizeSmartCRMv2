
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
  port: 3000,
  host: true,
  allowedHosts: ['etherizesmartcrmv2-production.up.railway.app']
  },
  build: {
    outDir: 'dist',
  }
});
