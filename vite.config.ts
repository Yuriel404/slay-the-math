import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: './',
  server: { port: 5173, strictPort: true },
  build: {
    rollupOptions: { output: { manualChunks(id) {
      if (!id.includes('node_modules')) return;
      if (/\/(react|react-dom|scheduler)\//.test(id)) return 'react';
      if (id.includes('motion')) return 'motion';
      if (/\/(dexie|zod)\//.test(id)) return 'storage';
    } } },
  },
  test: { include: ['tests/**/*.test.ts'], environment: 'node' },
});
