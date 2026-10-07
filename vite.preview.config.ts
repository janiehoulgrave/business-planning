// Builds a single self-contained HTML file for previewing the app inside Claude.
// Not used for the real site (Vercel uses vite.config.ts).
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

export default defineConfig({
  plugins: [react(), tailwindcss(), viteSingleFile()],
  define: { 'import.meta.env.VITE_PREVIEW': JSON.stringify('1') },
  build: { outDir: 'preview-dist', chunkSizeWarningLimit: 4000 },
});
