import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: './',
  // Tauri prints its own build output; don't wipe it.
  clearScreen: false,
  envPrefix: ['VITE_', 'TAURI_ENV_'],
  server: {
    port: 5173,
    strictPort: true,
    // Cargo writes (and locks) DLLs under src-tauri/target while `tauri dev`
    // runs. Watching them throws EBUSY and kills the dev server, so the Rust
    // build tree must stay outside the watcher.
    watch: { ignored: ['**/src-tauri/**', '**/dist/**', '**/test-results/**'] },
  },
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
