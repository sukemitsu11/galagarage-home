import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const backend = 'http://127.0.0.1:8080';

export default defineConfig({
  plugins: [react()],
  server: {
    host: '127.0.0.1',
    port: 4173,
    proxy: { '/api': backend, '/uploads': backend }
  },
  preview: { host: '127.0.0.1', port: 4173 }
});
