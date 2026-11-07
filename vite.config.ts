/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Vitest configuration lives alongside the Vite config so there is a single
// source of truth for build and test settings (design D1, AC-NFR-01.3/01.4).
export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['src/test/setup.ts'],
    css: true,
  },
});
