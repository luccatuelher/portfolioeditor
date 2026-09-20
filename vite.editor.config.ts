import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

// Build do EDITOR num único arquivo (dist-editor/editor.html) para abrir com 2 cliques.
export default defineConfig({
  plugins: [react(), viteSingleFile()],
  build: {
    outDir: 'dist-editor',
    emptyOutDir: true,
    rollupOptions: { input: 'editor.html' },
  },
});
