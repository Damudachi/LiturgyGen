import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  // On a GitHub Pages project page the site is served from
  // username.github.io/<repo>/, so every asset needs that prefix or the page
  // loads blank with a wall of 404s. The Pages workflow passes the repository
  // name in; everywhere else - the dev server, `npm start`, the desktop build -
  // the client is served from the root and this stays '/'.
  base: process.env.VITE_BASE_PATH || '/',
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    // The API runs beside us in dev; proxying keeps the client origin-relative
    // so the built bundle works unchanged when Express serves it.
    proxy: {
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
    },
  },
  build: { outDir: 'dist', sourcemap: false },
});
