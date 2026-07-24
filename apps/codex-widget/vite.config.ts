import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

export default defineConfig({
  plugins: [
    react(),
    // Inline all JS and CSS into a single self-contained HTML file.
    // Codex loads the HTML as an iframe resource — no external network
    // requests are possible from within the widget.
    viteSingleFile({
      inlinePattern: ['**/*.{js,css,woff,woff2}'],
      removeScripts: false,
      removeViteMeta: true,
    }),
  ],
  build: {
    outDir: './dist',
    emptyOutDir: true,
    chunkSizeWarningLimit: 2000,
    rollupOptions: {
      output: {
        // Inline all chunks so the output is exactly one HTML file.
        inlineDynamicImports: true,
      },
    },
  },
  server: {
    port: 4174,
  },
});
