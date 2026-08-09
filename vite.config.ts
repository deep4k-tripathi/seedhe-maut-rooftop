import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    target: 'es2020',
    cssTarget: 'safari15',
    // One page, one bundle: an extra request costs more than the bytes saved.
    modulePreload: { polyfill: false },
  },
  server: { port: 5173 },
});
