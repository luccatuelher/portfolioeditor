/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// F1 usa esta config sobretudo para o Vitest. Os artefatos editor.html/site.html
// (vite-plugin-singlefile) entram nas fases F2/F3/F7, quando houver renderer.
export default defineConfig({
  plugins: [react()],
  // Honra a porta atribuída pelo harness (autoPort) via env PORT; cai para 5173.
  server: { port: Number(process.env.PORT) || 5173, strictPort: false },
  test: {
    globals: true,
    environment: 'node',
    include: ['test/**/*.test.{ts,tsx}'],
  },
});
