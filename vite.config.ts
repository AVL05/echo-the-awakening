import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: { watch: { ignored: ['**/work/**', '**/outputs/**'] } },
  build: { target: 'es2022', chunkSizeWarningLimit: 1500 },
  worker: { format: 'es' },
});
