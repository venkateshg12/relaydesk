import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    emptyOutDir: false,
    outDir: 'dist',
    minify: 'esbuild',
    lib: {
      entry: resolve(import.meta.dirname, 'src/loader/index.ts'),
      name: 'RelayDeskLoader',
      formats: ['iife'],
      fileName: () => 'loader.js',
    },
  },
});
