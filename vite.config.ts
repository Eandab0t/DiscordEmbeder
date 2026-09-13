import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5188,
    strictPort: true,
  },
  build: {
    rollupOptions: {
      output: {
        // Split infrequently-changing dependencies into cache-friendly chunks.
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          if (id.includes('codemirror') || id.includes('@codemirror') || id.includes('lezer')) {
            return 'codemirror';
          }
          if (id.includes('@dnd-kit')) return 'dndkit';
          if (id.includes('react') || id.includes('scheduler')) return 'react';
          return 'vendor';
        },
      },
    },
  },
});
