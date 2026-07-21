import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { readFileSync } from 'fs';

export default defineConfig({
  base: './',
  plugins: [
    vue({
      customElement: true, // Enable Web Component mode
    }),
    {
      name: 'create-demo',
      generateBundle() {
        const indexHtml = readFileSync('index.html', 'utf8').replace(
          /<script type="module" src="\/src\/main\.ts"><\/script>/,
          '<script type="module" src="./er-biz-x.js"></script>',
        );
        this.emitFile({
          type: 'asset',
          fileName: 'index.html',
          source: indexHtml,
        });
      },
    },
  ],
  define: {
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV),
  },
  server: {
    port: 3100,
    host: '0.0.0.0',
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
  build: {
    emptyOutDir: true,
    assetsInlineLimit: 10240,
    chunkSizeWarningLimit: 10000,
    rollupOptions: {
      output: {
        entryFileNames: 'er-biz-x.js',
        chunkFileNames: '[name]-[hash].js',
        assetFileNames: '[name]-[hash][extname]',
      },
    },
  },
});
