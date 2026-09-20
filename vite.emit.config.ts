import { defineConfig } from 'vitest/config';

// Config dedicada ao emissor de publicação (não faz parte da suíte normal).
export default defineConfig({
  test: {
    include: ['scripts/emit-site.ts'],
    environment: 'node',
  },
});
