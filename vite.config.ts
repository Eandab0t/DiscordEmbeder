import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// Single-file output: dist/index.html must work when opened directly (file://),
// so no separate asset files and no absolute /asset URLs.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5188,
    strictPort: true,
  },
  build: {
    assetsInlineLimit: 100_000_000,
    rollupOptions: {
      output: {
        // One chunk (dynamic imports get inlined too) so index.html is self-contained.
        inlineDynamicImports: true,
        manualChunks: undefined,
      },
    },
  },
});
