import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig, transformWithEsbuild, type Plugin } from 'vite';
import { resolve } from 'path';
import fs from 'fs';

function serveLoaderPlugin(): Plugin {
  return {
    name: 'serve-loader-plugin',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = req.url || '';
        if (url === '/loader.js' || url.startsWith('/loader.js?')) {
          try {
            const loaderPath = resolve(import.meta.dirname, 'src/loader/index.ts');
            const source = fs.readFileSync(loaderPath, 'utf-8');
            const result = await transformWithEsbuild(source, 'index.ts', {
              format: 'iife',
              target: 'es2020',
            });
            res.setHeader('Content-Type', 'application/javascript');
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.end(result.code);
            return;
          } catch (err) {
            console.error('Failed to transform loader.js:', err);
          }
        }
        next();
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), serveLoaderPlugin()],
  resolve: { alias: { '@': resolve(import.meta.dirname, 'src') } },
  server: {
    port: 5173,
    strictPort: true,
    cors: true,
  },
  build: {
    rollupOptions: {
      input: {
        frame: resolve(import.meta.dirname, 'frame.html'),
      },
    },
  },
});
