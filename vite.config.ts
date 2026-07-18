import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: './',
  plugins: [react()],
  resolve: { alias: { '@shared': new URL('./src/shared', import.meta.url).pathname } },
  css: { preprocessorOptions: { less: { javascriptEnabled: true } } },
});
