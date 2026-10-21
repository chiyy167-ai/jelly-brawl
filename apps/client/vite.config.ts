import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base 用相对路径，部署到 GitHub Pages 子路径也能找到资源
export default defineConfig({
  base: './',
  plugins: [react()],
  build: { chunkSizeWarningLimit: 1000 },
});
