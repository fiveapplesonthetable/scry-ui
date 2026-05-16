import {defineConfig} from 'vite';

// Vite dev: serves src/ on 5173, proxies /api to the Express backend on 8787.
// Vite build: emits dist/ which Express serves in production (`npm start`).
export default defineConfig({
  root: '.',
  publicDir: false,
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8787',
        changeOrigin: false,
        // SSE: don't buffer.
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq) => {
            proxyReq.setHeader('Accept-Encoding', 'identity');
          });
        },
      },
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: true,
    rollupOptions: {
      input: 'index.html',
    },
  },
});
