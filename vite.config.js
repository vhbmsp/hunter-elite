import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    // three (core + addons) is ~600 kB on its own; keep it in a separately cached chunk.
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/three')) return 'three';
        },
      },
    },
  },
});
